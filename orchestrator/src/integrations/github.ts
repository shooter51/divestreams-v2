import { Octokit } from "@octokit/rest";
import type { Config } from "../config.js";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("github");

export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private dryRun: boolean;

  constructor(config: Config) {
    this.octokit = new Octokit({ auth: config.githubToken });
    this.owner = config.githubOwner;
    this.repo = config.githubRepo;
    this.dryRun = config.dryRun;
  }

  // --- Workflow dispatch ---

  async dispatchWorkflow(
    workflowId: string,
    ref: string,
    inputs: Record<string, string>
  ) {
    log.info({ workflowId, ref, inputs, dryRun: this.dryRun }, "Dispatching workflow");
    if (this.dryRun) return;

    await this.octokit.actions.createWorkflowDispatch({
      owner: this.owner,
      repo: this.repo,
      workflow_id: workflowId,
      ref,
      inputs,
    });
  }

  // --- Artifacts ---

  async downloadArtifact(
    runId: number,
    artifactName: string
  ): Promise<Buffer | null> {
    try {
      const artifacts = await this.octokit.actions.listWorkflowRunArtifacts({
        owner: this.owner,
        repo: this.repo,
        run_id: runId,
      });

      const artifact = artifacts.data.artifacts.find(
        (a) => a.name === artifactName
      );

      if (!artifact) {
        log.warn({ runId, artifactName }, "Artifact not found");
        return null;
      }

      const download = await this.octokit.actions.downloadArtifact({
        owner: this.owner,
        repo: this.repo,
        artifact_id: artifact.id,
        archive_format: "zip",
      });

      return Buffer.from(download.data as ArrayBuffer);
    } catch (err) {
      log.error({ runId, artifactName, err }, "Failed to download artifact");
      return null;
    }
  }

  // --- PRs ---

  async getPullRequest(prNumber: number) {
    const { data } = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });
    return data;
  }

  async createPullRequest(params: {
    title: string;
    head: string;
    base: string;
    body: string;
    labels?: string[];
  }) {
    log.info(
      { head: params.head, base: params.base, dryRun: this.dryRun },
      "Creating PR"
    );
    if (this.dryRun) return { number: 0, html_url: "(dry-run)" };

    const { data } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title: params.title,
      head: params.head,
      base: params.base,
      body: params.body,
    });

    if (params.labels?.length) {
      await this.octokit.issues.addLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: data.number,
        labels: params.labels,
      });
    }

    return data;
  }

  async mergePullRequest(prNumber: number, mergeMethod: "merge" | "squash" | "rebase" = "merge") {
    log.info({ prNumber, mergeMethod, dryRun: this.dryRun }, "Merging PR");
    if (this.dryRun) return;

    await this.octokit.pulls.merge({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      merge_method: mergeMethod,
    });
  }

  async enableAutoMerge(prNumber: number) {
    log.info({ prNumber, dryRun: this.dryRun }, "Enabling auto-merge");
    if (this.dryRun) return;

    // Auto-merge via GraphQL
    const { data: pr } = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    await this.octokit.graphql(
      `mutation ($pullRequestId: ID!) {
        enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: MERGE }) {
          pullRequest { number }
        }
      }`,
      { pullRequestId: pr.node_id }
    );
  }

  // --- Merge operations ---

  async checkMergeability(
    head: string,
    base: string
  ): Promise<{ mergeable: boolean }> {
    try {
      // Create a temporary merge to check
      const { data } = await this.octokit.repos.merge({
        owner: this.owner,
        repo: this.repo,
        base,
        head,
      });
      return { mergeable: true };
    } catch (err: unknown) {
      const error = err as { status?: number };
      if (error.status === 409) {
        return { mergeable: false };
      }
      throw err;
    }
  }

  // --- Workflow run info ---

  async getWorkflowRun(runId: number) {
    const { data } = await this.octokit.actions.getWorkflowRun({
      owner: this.owner,
      repo: this.repo,
      run_id: runId,
    });
    return data;
  }

  async getWorkflowRunJobs(runId: number) {
    const { data } = await this.octokit.actions.listJobsForWorkflowRun({
      owner: this.owner,
      repo: this.repo,
      run_id: runId,
    });
    return data.jobs;
  }

  // --- Comments ---

  async createComment(prNumber: number, body: string) {
    log.info({ prNumber, dryRun: this.dryRun }, "Creating PR comment");
    if (this.dryRun) return;

    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      body,
    });
  }
}

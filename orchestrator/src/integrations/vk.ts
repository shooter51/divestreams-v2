import type { Config } from "../config.js";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("vk");

export interface VKIssue {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  labels?: string[];
}

export interface VKAgentSession {
  workspace_id: string;
  status: string;
}

export class VKClient {
  private baseUrl: string;
  private projectId: string;
  private repoId: string;
  private dryRun: boolean;

  constructor(config: Config) {
    this.baseUrl = config.vkBaseUrl;
    this.projectId = config.vkProjectId;
    this.repoId = config.vkRepoId;
    this.dryRun = config.dryRun;
  }

  private async fetch(
    path: string,
    options: RequestInit = {}
  ): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    log.debug({ url, method: options.method || "GET" }, "VK API request");

    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`VK API error ${res.status}: ${body}`);
    }

    return res.json();
  }

  // --- Issues ---

  async createIssue(params: {
    title: string;
    description: string;
    priority?: string;
    labels?: string[];
  }): Promise<VKIssue> {
    log.info({ title: params.title, dryRun: this.dryRun }, "Creating VK issue");
    if (this.dryRun) {
      return { id: "dry-run-issue", title: params.title };
    }

    const data = await this.fetch(
      `/api/projects/${this.projectId}/issues`,
      {
        method: "POST",
        body: JSON.stringify({
          title: params.title,
          description: params.description,
          priority: params.priority || "medium",
          labels: params.labels || [],
        }),
      }
    );

    return data as VKIssue;
  }

  async updateIssue(
    issueId: string,
    updates: Partial<{
      title: string;
      description: string;
      status: string;
      priority: string;
      labels: string[];
    }>
  ): Promise<VKIssue> {
    log.info({ issueId, updates, dryRun: this.dryRun }, "Updating VK issue");
    if (this.dryRun) {
      return { id: issueId, title: updates.title || "" };
    }

    const data = await this.fetch(
      `/api/projects/${this.projectId}/issues/${issueId}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
      }
    );

    return data as VKIssue;
  }

  async getIssue(issueId: string): Promise<VKIssue> {
    const data = await this.fetch(
      `/api/projects/${this.projectId}/issues/${issueId}`
    );
    return data as VKIssue;
  }

  // --- Agent launching ---

  async launchAgent(params: {
    issueId: string;
    branch: string;
    prompt: string;
    profile?: string;
  }): Promise<VKAgentSession> {
    log.info(
      { issueId: params.issueId, branch: params.branch, dryRun: this.dryRun },
      "Launching VK agent"
    );
    if (this.dryRun) {
      return { workspace_id: "dry-run-workspace", status: "launched" };
    }

    const data = await this.fetch("/api/tasks/create-and-start", {
      method: "POST",
      body: JSON.stringify({
        project_id: this.projectId,
        repo_id: this.repoId,
        issue_id: params.issueId,
        branch: params.branch,
        prompt: params.prompt,
        profile: params.profile,
      }),
    });

    return data as VKAgentSession;
  }

  // --- Defect creation (convenience) ---

  async createDefect(params: {
    gateName: string;
    prNumber: number;
    branch: string;
    failedTests: string[];
  }): Promise<VKIssue> {
    const testList = params.failedTests
      .map((t) => `- ${t}`)
      .join("\n");

    return this.createIssue({
      title: `[Defect] Non-critical test failures in ${params.gateName} gate (PR #${params.prNumber})`,
      description: [
        `## Non-Critical Test Failures`,
        ``,
        `**PR:** #${params.prNumber}`,
        `**Branch:** ${params.branch}`,
        `**Gate:** ${params.gateName}`,
        ``,
        `### Failed Tests`,
        testList,
        ``,
        `These failures were classified as non-critical and the pipeline continued.`,
        `Please address these in a follow-up.`,
      ].join("\n"),
      priority: "low",
      labels: ["defect", "non-critical", `gate:${params.gateName}`],
    });
  }
}

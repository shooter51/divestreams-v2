import type { FastifyInstance } from "fastify";
import type { Config } from "../config.js";
import type { StateMachineEngine } from "../state-machine/engine.js";
import type { GitHubClient } from "../integrations/github.js";
import type { GateEvaluator } from "../gates/evaluator.js";
import type { FixAgent } from "../agents/fix-agent.js";
import type { JudgeAgent } from "../agents/judge-agent.js";
import type { VKClient } from "../integrations/vk.js";
import { verifyWebhookSignature } from "../utils/crypto.js";
import { Trigger, PipelineState } from "../state-machine/states.js";
import { createChildLogger } from "../utils/logger.js";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { agentSessions, pipelineRuns } from "../db/schema.js";

const log = createChildLogger("webhooks");

interface WebhookDeps {
  config: Config;
  engine: StateMachineEngine;
  github: GitHubClient;
  evaluator: GateEvaluator;
  fixAgent: FixAgent;
  judgeAgent: JudgeAgent;
  vk: VKClient;
}

export function registerWebhookRoutes(
  app: FastifyInstance,
  deps: WebhookDeps
) {
  const { config, engine } = deps;

  // Raw body for signature verification
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      try {
        done(null, JSON.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  app.post("/webhooks/github", async (request, reply) => {
    const signature = request.headers["x-hub-signature-256"] as string;
    const event = request.headers["x-github-event"] as string;
    const deliveryId = request.headers["x-github-delivery"] as string;

    // Verify signature
    const rawBody = JSON.stringify(request.body);
    if (!verifyWebhookSignature(rawBody, signature || "", config.githubWebhookSecret)) {
      log.warn({ deliveryId }, "Invalid webhook signature");
      return reply.code(401).send({ error: "Invalid signature" });
    }

    log.info({ event, deliveryId }, "Webhook received");

    const payload = request.body as Record<string, unknown>;

    try {
      switch (event) {
        case "pull_request":
          await handlePullRequest(payload, deps);
          break;

        case "workflow_run":
          await handleWorkflowRun(payload, deps);
          break;

        case "push":
          await handlePush(payload, deps);
          break;

        case "pull_request_review":
          await handlePullRequestReview(payload, deps);
          break;

        default:
          log.debug({ event }, "Unhandled webhook event");
      }
    } catch (err) {
      log.error({ event, deliveryId, err }, "Webhook handler error");
    }

    return reply.code(200).send({ ok: true });
  });
}

// --- Event Handlers ---

async function handlePullRequest(
  payload: Record<string, unknown>,
  deps: WebhookDeps
) {
  const action = payload.action as string;
  const pr = payload.pull_request as Record<string, unknown>;
  const prNumber = pr.number as number;
  const branch = (pr.head as Record<string, unknown>).ref as string;
  const targetBranch = (pr.base as Record<string, unknown>).ref as string;
  const commitSha = (pr.head as Record<string, unknown>).sha as string;
  const merged = pr.merged as boolean | undefined;

  log.info({ action, prNumber, branch, targetBranch }, "PR event");

  if (action === "opened" || action === "reopened") {
    // Only handle PRs targeting develop
    if (targetBranch !== "develop") {
      log.info(
        { prNumber, targetBranch },
        "Ignoring PR not targeting develop"
      );
      return;
    }

    // Check for existing run
    const existingRun = await deps.engine.getRunByPR(prNumber);
    if (existingRun) {
      log.info({ prNumber }, "Pipeline run already exists for this PR");
      return;
    }

    // Create pipeline run
    const run = await deps.engine.createRun({
      prNumber,
      branch,
      targetBranch,
      commitSha,
      maxFixCycles: deps.config.maxFixCycles,
    });

    // Advance: CREATED → UNIT_PACT_GATE
    await deps.engine.advance(run.id, Trigger.PR_OPENED);
  }

  if (action === "synchronize") {
    // New push to PR branch — check if we're in FIXING state
    const run = await deps.engine.getRunByPR(prNumber);
    if (!run) return;

    // Update commit SHA
    await deps.engine.updateCommitSha(run.id, commitSha);

    if (run.state === PipelineState.FIXING) {
      // Mark the active agent session as completed
      const db = getDb();
      const activeSessions = await db.query.agentSessions.findMany({
        where: eq(agentSessions.pipelineRunId, run.id),
      });
      const activeSession = activeSessions.find(
        (s) => s.status === "launched" || s.status === "working"
      );
      if (activeSession) {
        await db
          .update(agentSessions)
          .set({
            status: "completed",
            fixCommitSha: commitSha,
            completedAt: new Date().toISOString(),
          })
          .where(eq(agentSessions.id, activeSession.id));
      }

      // The agent monitor will pick up the completion and trigger FIX_AGENT_PUSHED
    }
  }

  if (action === "closed" && merged === true && targetBranch === "develop") {
    // PR was merged into develop. Find the pipeline run and trigger a dev deploy.
    // This handles two cases:
    // 1. Normal path: pipeline completed all gates and is waiting to deploy.
    // 2. Recovery: pipeline got stuck (e.g. gate dispatch failed with 422) — the
    //    CI PR check (branch protection) already validated the code, so we can
    //    deploy directly without re-running gates.
    const run = await deps.engine.getRunByPR(prNumber);
    if (!run) {
      log.info({ prNumber }, "PR merged but no pipeline run found — skipping");
      return;
    }

    const nonDeployableStates: string[] = [
      PipelineState.DEV_DEPLOYING,
      PipelineState.DEV_DEPLOYED,
      PipelineState.INTEGRATION_GATE,
      PipelineState.E2E_GATE,
      PipelineState.STAGING_PROMOTING,
      PipelineState.STAGING_DEPLOYING,
      PipelineState.STAGING_DEPLOYED,
      PipelineState.REGRESSION_GATE,
      PipelineState.READY_FOR_PROD,
      PipelineState.PROD_DEPLOYING,
      PipelineState.PROD_DEPLOYED,
      PipelineState.DONE,
    ];

    if (nonDeployableStates.includes(run.state)) {
      log.info(
        { prNumber, state: run.state },
        "PR merged but pipeline already past dev deploy — skipping"
      );
      return;
    }

    log.info(
      { prNumber, pipelineRunId: run.id, state: run.state },
      "PR merged into develop — dispatching dev deploy"
    );

    // Update commit SHA to the merge commit (the push event delivers this, but
    // belt-and-suspenders here using the PR head SHA which is the last commit).
    await deps.engine.updateCommitSha(run.id, commitSha);

    // Dispatch deploy directly on develop (where deploy-env.yml lives)
    await deps.github.dispatchWorkflow("deploy-env.yml", "develop", {
      pipeline_id: run.id,
      environment: "dev",
      image_tag: "dev",
      commit_sha: commitSha,
    });
  }
}

async function handleWorkflowRun(
  payload: Record<string, unknown>,
  deps: WebhookDeps
) {
  const action = payload.action as string;
  if (action !== "completed") return;

  const workflowRun = payload.workflow_run as Record<string, unknown>;
  const conclusion = workflowRun.conclusion as string;
  const workflowName = workflowRun.name as string;
  const runId = workflowRun.id as number;

  log.info(
    { workflowName, conclusion, runId },
    "Workflow run completed"
  );

  // Gate completions are handled via POST /api/gate-complete callback
  // from the ci-gate.yml workflow itself (more reliable than parsing
  // workflow_run events). This handler is a backup.
}

async function handlePush(
  payload: Record<string, unknown>,
  deps: WebhookDeps
) {
  const ref = payload.ref as string;

  // Push to main = production deploy trigger
  if (ref === "refs/heads/main") {
    log.info("Push to main detected — checking for READY_FOR_PROD pipelines");

    const db = getDb();
    const readyRuns = await db.query.pipelineRuns.findMany({
      where: eq(pipelineRuns.state, PipelineState.READY_FOR_PROD),
    });

    for (const run of readyRuns) {
      await deps.engine.advance(run.id, Trigger.HUMAN_APPROVED);
    }
  }
}

async function handlePullRequestReview(
  payload: Record<string, unknown>,
  deps: WebhookDeps
) {
  const action = payload.action as string;
  if (action !== "submitted") return;

  const review = payload.review as Record<string, unknown>;
  const state = review.state as string;

  if (state !== "approved") return;

  const pr = payload.pull_request as Record<string, unknown>;
  const prNumber = pr.number as number;
  const targetBranch = (pr.base as Record<string, unknown>).ref as string;

  // Only care about approved reviews on staging→main PRs
  if (targetBranch !== "main") return;

  log.info({ prNumber }, "PR approved for production");

  // Find the pipeline run that created this release PR
  // The release PR's source branch is staging, targeting main
  const db = getDb();
  const readyRuns = await db.query.pipelineRuns.findMany({
    where: eq(pipelineRuns.state, PipelineState.READY_FOR_PROD),
  });

  for (const run of readyRuns) {
    await deps.engine.advance(run.id, Trigger.HUMAN_APPROVED);
  }
}

import type { StateMachineEngine } from "./state-machine/engine.js";
import type { GitHubClient } from "./integrations/github.js";
import type { VKClient } from "./integrations/vk.js";
import type { FixAgent } from "./agents/fix-agent.js";
import type { JudgeAgent } from "./agents/judge-agent.js";
import type { Config } from "./config.js";
import type { TransitionContext } from "./state-machine/transitions.js";
import type { PipelineRun } from "./db/schema.js";
import { nanoid } from "nanoid";
import { getDb } from "./db/client.js";
import { defectIssues, gateResults } from "./db/schema.js";
import { eq, desc } from "drizzle-orm";
import { createChildLogger } from "./utils/logger.js";

const log = createChildLogger("side-effects");

export function registerSideEffects(
  engine: StateMachineEngine,
  github: GitHubClient,
  vk: VKClient,
  fixAgent: FixAgent,
  judgeAgent: JudgeAgent,
  config: Config
) {
  // --- Gate dispatch ---
  // NOTE: ci-gate.yml and deploy-env.yml only exist on develop/staging/main.
  // Always dispatch on ctx.targetBranch (e.g. "develop"), never on the feature
  // branch (ctx.branch), which may have been cut before these workflow files existed.

  engine.registerSideEffect(
    "dispatchUnitPactGate",
    async (ctx: TransitionContext) => {
      await github.dispatchWorkflow("ci-gate.yml", ctx.targetBranch, {
        pipeline_id: ctx.pipelineRunId,
        gate_name: "unit_pact",
        pr_number: String(ctx.prNumber),
      });
    }
  );

  engine.registerSideEffect(
    "dispatchIntegrationGate",
    async (ctx: TransitionContext) => {
      await github.dispatchWorkflow("ci-gate.yml", ctx.targetBranch, {
        pipeline_id: ctx.pipelineRunId,
        gate_name: "integration",
        pr_number: String(ctx.prNumber),
      });
    }
  );

  engine.registerSideEffect(
    "dispatchE2eGate",
    async (ctx: TransitionContext) => {
      await github.dispatchWorkflow("ci-gate.yml", ctx.targetBranch, {
        pipeline_id: ctx.pipelineRunId,
        gate_name: "e2e",
        pr_number: String(ctx.prNumber),
      });
    }
  );

  engine.registerSideEffect(
    "dispatchRegressionGate",
    async (ctx: TransitionContext) => {
      await github.dispatchWorkflow("ci-gate.yml", "staging", {
        pipeline_id: ctx.pipelineRunId,
        gate_name: "regression",
        pr_number: String(ctx.prNumber),
      });
    }
  );

  // --- Deploy dispatch ---

  engine.registerSideEffect(
    "dispatchDevDeploy",
    async (ctx: TransitionContext) => {
      await github.dispatchWorkflow("deploy-env.yml", ctx.targetBranch, {
        pipeline_id: ctx.pipelineRunId,
        environment: "dev",
        image_tag: "dev",
        commit_sha: ctx.commitSha,
      });
    }
  );

  engine.registerSideEffect(
    "dispatchStagingDeploy",
    async (ctx: TransitionContext) => {
      await github.dispatchWorkflow("deploy-env.yml", "staging", {
        pipeline_id: ctx.pipelineRunId,
        environment: "test",
        image_tag: "test",
        commit_sha: ctx.commitSha,
      });
    }
  );

  engine.registerSideEffect(
    "dispatchProdDeploy",
    async (ctx: TransitionContext) => {
      await github.dispatchWorkflow("deploy-env.yml", "main", {
        pipeline_id: ctx.pipelineRunId,
        environment: "production",
        image_tag: "latest",
        commit_sha: ctx.commitSha,
      });
    }
  );

  // --- Merge / Promote ---

  engine.registerSideEffect(
    "mergeToStaging",
    async (ctx: TransitionContext, run: PipelineRun) => {
      try {
        // Merge the develop PR first
        await github.mergePullRequest(ctx.prNumber, "squash");

        // Create promotion PR develop → staging
        const pr = await github.createPullRequest({
          title: `chore: promote develop → staging (PR #${ctx.prNumber})`,
          head: "develop",
          base: "staging",
          body: `Auto-promoted from PR #${ctx.prNumber} on branch \`${ctx.branch}\`.\n\nPipeline: \`${ctx.pipelineRunId}\``,
          labels: ["auto-promotion"],
        });

        if (pr.number > 0) {
          await github.enableAutoMerge(pr.number);
        }

        // The merge will trigger a push to staging → STAGING_DEPLOYING via webhook
        // For now, advance directly
        await engine.advance(ctx.pipelineRunId, "MERGE_COMPLETED" as any);
      } catch (err: unknown) {
        const error = err as { status?: number; message?: string };
        if (error.status === 409) {
          // Merge conflict
          log.warn(
            { pipelineRunId: ctx.pipelineRunId },
            "Merge conflict detected"
          );
          await engine.advance(ctx.pipelineRunId, "MERGE_CONFLICT" as any);
        } else {
          throw err;
        }
      }
    }
  );

  engine.registerSideEffect(
    "createReleasePR",
    async (ctx: TransitionContext) => {
      await github.createPullRequest({
        title: `release: deploy to production (PR #${ctx.prNumber})`,
        head: "staging",
        base: "main",
        body: [
          `## Release: staging → production`,
          ``,
          `Promoted from PR #${ctx.prNumber} on branch \`${ctx.branch}\`.`,
          `Pipeline: \`${ctx.pipelineRunId}\``,
          ``,
          `### Pre-release checklist`,
          `- [ ] Review changes`,
          `- [ ] Test on [test.divestreams.com](https://test.divestreams.com)`,
          `- [ ] Approve and merge when ready`,
          ``,
          `---`,
          `Auto-generated by Pipeline Orchestrator`,
        ].join("\n"),
        labels: ["release"],
      });
    }
  );

  // --- Defect creation ---

  async function createDefectFromLatestGate(
    pipelineRunId: string,
    ctx: TransitionContext
  ) {
    const db = getDb();
    const latestGate = await db
      .select()
      .from(gateResults)
      .where(eq(gateResults.pipelineRunId, pipelineRunId))
      .orderBy(desc(gateResults.createdAt))
      .limit(1);

    if (latestGate.length === 0) return;

    const gate = latestGate[0];
    const failedTests = (gate.failedTestNames as string[]) || [];

    const issue = await vk.createDefect({
      gateName: gate.gateName,
      prNumber: ctx.prNumber,
      branch: ctx.branch,
      failedTests,
    });

    await db.insert(defectIssues).values({
      id: nanoid(),
      pipelineRunId,
      vkIssueId: issue.id,
      gateName: gate.gateName,
      failedTests,
    });
  }

  engine.registerSideEffect("createDefect", async (ctx: TransitionContext) => {
    await createDefectFromLatestGate(ctx.pipelineRunId, ctx);
  });

  engine.registerSideEffect(
    "createDefectAndDeployDev",
    async (ctx: TransitionContext) => {
      await createDefectFromLatestGate(ctx.pipelineRunId, ctx);
      await github.dispatchWorkflow("deploy-env.yml", ctx.targetBranch, {
        pipeline_id: ctx.pipelineRunId,
        environment: "dev",
        image_tag: "dev",
        commit_sha: ctx.commitSha,
      });
    }
  );

  engine.registerSideEffect(
    "createDefectAndDispatchE2e",
    async (ctx: TransitionContext) => {
      await createDefectFromLatestGate(ctx.pipelineRunId, ctx);
      await github.dispatchWorkflow("ci-gate.yml", ctx.targetBranch, {
        pipeline_id: ctx.pipelineRunId,
        gate_name: "e2e",
        pr_number: String(ctx.prNumber),
      });
    }
  );

  engine.registerSideEffect(
    "createDefectAndMergeStaging",
    async (ctx: TransitionContext, run: PipelineRun) => {
      await createDefectFromLatestGate(ctx.pipelineRunId, ctx);
      // Trigger merge to staging (reuse mergeToStaging logic)
      const mergeEffect = engine["sideEffectHandlers"].get("mergeToStaging");
      if (mergeEffect) await mergeEffect(ctx, run);
    }
  );

  engine.registerSideEffect(
    "createDefectAndCreateReleasePR",
    async (ctx: TransitionContext) => {
      await createDefectFromLatestGate(ctx.pipelineRunId, ctx);
      const releaseEffect = engine["sideEffectHandlers"].get("createReleasePR");
      if (releaseEffect)
        await releaseEffect(ctx, {} as PipelineRun);
    }
  );

  // --- Agent launching ---

  engine.registerSideEffect(
    "launchFixAgent",
    async (ctx: TransitionContext, run: PipelineRun) => {
      const db = getDb();
      const latestGate = await db
        .select()
        .from(gateResults)
        .where(eq(gateResults.pipelineRunId, ctx.pipelineRunId))
        .orderBy(desc(gateResults.createdAt))
        .limit(1);

      const failedTests =
        latestGate.length > 0
          ? (latestGate[0].failedTestNames as string[]) || []
          : [];

      await fixAgent.launch(
        run,
        ctx.gateName || latestGate[0]?.gateName || "unknown",
        failedTests
      );
    }
  );

  engine.registerSideEffect(
    "launchJudgeAgent",
    async (ctx: TransitionContext, run: PipelineRun) => {
      await judgeAgent.launch(run, ctx.branch, ctx.targetBranch);
    }
  );

  log.info("All side effects registered");
}

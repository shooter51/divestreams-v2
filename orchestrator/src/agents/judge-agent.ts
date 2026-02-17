import { nanoid } from "nanoid";
import { getDb } from "../db/client.js";
import { agentSessions } from "../db/schema.js";
import type { PipelineRun } from "../db/schema.js";
import type { Config } from "../config.js";
import type { VKClient } from "../integrations/vk.js";
import type { StateMachineEngine } from "../state-machine/engine.js";
import { Trigger } from "../state-machine/states.js";
import { startMonitoring } from "./agent-monitor.js";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("judge-agent");

export class JudgeAgent {
  private config: Config;
  private vk: VKClient;
  private engine: StateMachineEngine;

  constructor(config: Config, vk: VKClient, engine: StateMachineEngine) {
    this.config = config;
    this.vk = vk;
    this.engine = engine;
  }

  async launch(
    run: PipelineRun,
    sourceBranch: string,
    targetBranch: string
  ): Promise<string> {
    log.info(
      {
        pipelineRunId: run.id,
        sourceBranch,
        targetBranch,
      },
      "Launching judge agent for merge conflict resolution"
    );

    const issue = await this.vk.createIssue({
      title: `[Judge] Resolve merge conflict: ${sourceBranch} → ${targetBranch} (PR #${run.prNumber})`,
      description: [
        `## Merge Conflict Resolution`,
        ``,
        `**PR:** #${run.prNumber}`,
        `**Source:** ${sourceBranch}`,
        `**Target:** ${targetBranch}`,
        ``,
        `### Instructions`,
        `There is a merge conflict between \`${sourceBranch}\` and \`${targetBranch}\`.`,
        `Resolve the conflict by merging \`${targetBranch}\` into \`${sourceBranch}\`,`,
        `resolving conflicts, and pushing the result.`,
        ``,
        `Preserve all intended changes from both branches.`,
        `Run tests after resolving to ensure nothing is broken.`,
      ].join("\n"),
      priority: "high",
      labels: ["judge-agent", "merge-conflict"],
    });

    const session = await this.vk.launchAgent({
      issueId: issue.id,
      branch: sourceBranch,
      prompt: [
        `Resolve the merge conflict between ${sourceBranch} and ${targetBranch}.`,
        `1. Merge ${targetBranch} into ${sourceBranch}`,
        `2. Resolve all conflicts preserving changes from both branches`,
        `3. Run tests to verify`,
        `4. Push the resolved branch`,
      ].join("\n"),
    });

    const sessionId = nanoid();
    const db = getDb();
    await db.insert(agentSessions).values({
      id: sessionId,
      pipelineRunId: run.id,
      agentType: "judge",
      vkWorkspaceId: session.workspace_id,
      cycleNumber: 1,
      status: "launched",
      triggerGate: "merge_conflict",
    });

    startMonitoring(sessionId, {
      pollIntervalMs: this.config.agentPollIntervalMs,
      timeoutMs: this.config.agentTimeoutMs,
      onComplete: async () => {
        await this.engine.advance(run.id, Trigger.JUDGE_RESOLVED);
      },
      onTimeout: async () => {
        await this.engine.advance(run.id, Trigger.JUDGE_FAILED);
      },
      onFailed: async (_sid, error) => {
        await this.engine.setError(run.id, error);
        await this.engine.advance(run.id, Trigger.JUDGE_FAILED);
      },
    });

    return sessionId;
  }
}

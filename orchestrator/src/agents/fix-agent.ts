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

const log = createChildLogger("fix-agent");

export class FixAgent {
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
    gateName: string,
    failedTests: string[]
  ): Promise<string> {
    const cycleNumber = run.fixCycleCount + 1;

    log.info(
      {
        pipelineRunId: run.id,
        gateName,
        cycleNumber,
        failedTests: failedTests.length,
      },
      "Launching fix agent"
    );

    // Increment fix cycle
    await this.engine.incrementFixCycle(run.id);

    // Create fix issue in VK if needed
    const issueTitle = `[Fix] ${gateName} failures on PR #${run.prNumber} (cycle ${cycleNumber}/${run.maxFixCycles})`;
    const testList = failedTests.map((t) => `- \`${t}\``).join("\n");

    const issue = await this.vk.createIssue({
      title: issueTitle,
      description: [
        `## Fix Required: ${gateName} Gate Failures`,
        ``,
        `**PR:** #${run.prNumber}`,
        `**Branch:** ${run.branch}`,
        `**Cycle:** ${cycleNumber}/${run.maxFixCycles}`,
        ``,
        `### Failed Tests`,
        testList,
        ``,
        `### Instructions`,
        `Fix the failing tests listed above. Push your fix to the \`${run.branch}\` branch.`,
        `The orchestrator will automatically re-run the ${gateName} gate when you push.`,
      ].join("\n"),
      priority: "high",
      labels: ["fix-agent", `gate:${gateName}`, `cycle:${cycleNumber}`],
    });

    // Launch agent via VK
    const session = await this.vk.launchAgent({
      issueId: issue.id,
      branch: run.branch,
      prompt: [
        `Fix the failing ${gateName} tests on branch ${run.branch}.`,
        `Failed tests:`,
        ...failedTests.map((t) => `- ${t}`),
        ``,
        `Push your fix when ready. The pipeline will automatically re-run.`,
      ].join("\n"),
    });

    // Record agent session
    const sessionId = nanoid();
    const db = getDb();
    await db.insert(agentSessions).values({
      id: sessionId,
      pipelineRunId: run.id,
      agentType: "fix",
      vkWorkspaceId: session.workspace_id,
      cycleNumber,
      status: "launched",
      triggerGate: gateName,
    });

    // Start monitoring
    startMonitoring(sessionId, {
      pollIntervalMs: this.config.agentPollIntervalMs,
      timeoutMs: this.config.agentTimeoutMs,
      onComplete: async (completed) => {
        if (completed.commitSha) {
          await this.engine.updateCommitSha(run.id, completed.commitSha);
        }
        await this.engine.advance(run.id, Trigger.FIX_AGENT_PUSHED, {
          gateName,
        });
      },
      onTimeout: async () => {
        await this.engine.advance(run.id, Trigger.FIX_AGENT_TIMEOUT, {
          gateName,
        });
      },
      onFailed: async (_sid, error) => {
        await this.engine.setError(run.id, error);
        await this.engine.advance(run.id, Trigger.FIX_AGENT_FAILED, {
          gateName,
        });
      },
    });

    return sessionId;
  }
}

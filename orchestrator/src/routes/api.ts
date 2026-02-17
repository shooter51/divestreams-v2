import type { FastifyInstance } from "fastify";
import type { Config } from "../config.js";
import type { StateMachineEngine } from "../state-machine/engine.js";
import type { GateEvaluator } from "../gates/evaluator.js";
import type { GitHubClient } from "../integrations/github.js";
import { Trigger } from "../state-machine/states.js";
import {
  parseVitestResults,
  parsePlaywrightResults,
} from "../gates/parsers/github-check.js";
import { getDb } from "../db/client.js";
import {
  pipelineRuns,
  stateTransitions,
  gateResults,
  agentSessions,
  defectIssues,
} from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("api");

interface ApiDeps {
  config: Config;
  engine: StateMachineEngine;
  evaluator: GateEvaluator;
  github: GitHubClient;
}

export function registerApiRoutes(app: FastifyInstance, deps: ApiDeps) {
  const { config, engine, evaluator } = deps;

  // --- Health check ---

  app.get("/api/health", async () => {
    return {
      status: "ok",
      dryRun: config.dryRun,
      uptime: process.uptime(),
    };
  });

  // --- Pipeline listing ---

  app.get("/api/pipelines", async () => {
    const db = getDb();
    const runs = await db
      .select()
      .from(pipelineRuns)
      .orderBy(desc(pipelineRuns.createdAt))
      .limit(50);

    return { pipelines: runs };
  });

  app.get<{ Params: { id: string } }>("/api/pipelines/:id", async (request) => {
    const { id } = request.params;
    const db = getDb();

    const run = await db.query.pipelineRuns.findFirst({
      where: eq(pipelineRuns.id, id),
    });

    if (!run) {
      return { error: "Pipeline run not found" };
    }

    const transitions = await db
      .select()
      .from(stateTransitions)
      .where(eq(stateTransitions.pipelineRunId, id))
      .orderBy(stateTransitions.createdAt);

    const gates = await db
      .select()
      .from(gateResults)
      .where(eq(gateResults.pipelineRunId, id))
      .orderBy(gateResults.createdAt);

    const agents = await db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.pipelineRunId, id))
      .orderBy(agentSessions.launchedAt);

    const defects = await db
      .select()
      .from(defectIssues)
      .where(eq(defectIssues.pipelineRunId, id))
      .orderBy(defectIssues.createdAt);

    return { pipeline: run, transitions, gates, agents, defects };
  });

  // --- Gate completion callback ---
  // Called by ci-gate.yml after a gate finishes

  app.post<{
    Body: {
      pipeline_id: string;
      gate_name: string;
      workflow_run_id: number;
      test_results: unknown;
      test_type: "vitest" | "playwright";
    };
  }>("/api/gate-complete", async (request, reply) => {
    // Verify bearer token
    const authHeader = request.headers.authorization;
    if (authHeader !== `Bearer ${config.orchestratorToken}`) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const {
      pipeline_id,
      gate_name,
      workflow_run_id,
      test_results,
      test_type,
    } = request.body;

    log.info(
      { pipeline_id, gate_name, workflow_run_id, test_type },
      "Gate completion received"
    );

    // Parse test results
    const parsed =
      test_type === "playwright"
        ? parsePlaywrightResults(test_results)
        : parseVitestResults(test_results);

    // Evaluate gate
    const evaluation = evaluator.evaluate(parsed);

    // Persist result
    await evaluator.persistResult(
      pipeline_id,
      gate_name,
      evaluation,
      workflow_run_id
    );

    // Map outcome to trigger
    let trigger: (typeof Trigger)[keyof typeof Trigger];
    switch (evaluation.outcome) {
      case "pass":
        trigger = Trigger.GATE_PASSED;
        break;
      case "non_critical_fail":
        trigger = Trigger.GATE_NON_CRITICAL_FAIL;
        break;
      case "critical_fail":
        trigger = Trigger.GATE_CRITICAL_FAIL;
        break;
    }

    // Advance state machine
    const result = await engine.advance(pipeline_id, trigger, {
      gateName: gate_name,
      metadata: {
        workflowRunId: workflow_run_id,
        totalTests: evaluation.totalTests,
        failedTests: evaluation.failedTests,
        criticalFailures: evaluation.criticalFailures,
        nonCriticalFailures: evaluation.nonCriticalFailures,
      },
    });

    return {
      ok: true,
      outcome: evaluation.outcome,
      transitioned: result.transitioned,
      fromState: result.fromState,
      toState: result.toState,
    };
  });

  // --- Deploy completion callback ---
  // Called by deploy-env.yml after a deploy finishes

  app.post<{
    Body: {
      pipeline_id: string;
      environment: string;
      success: boolean;
      error?: string;
    };
  }>("/api/deploy-complete", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (authHeader !== `Bearer ${config.orchestratorToken}`) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { pipeline_id, environment, success, error } = request.body;

    log.info(
      { pipeline_id, environment, success },
      "Deploy completion received"
    );

    const trigger = success ? Trigger.DEPLOY_COMPLETED : Trigger.DEPLOY_FAILED;

    if (!success && error) {
      await engine.setError(pipeline_id, error);
    }

    const result = await engine.advance(pipeline_id, trigger, {
      metadata: { environment },
    });

    // After DEV_DEPLOYED, auto-advance to INTEGRATION_GATE
    if (result.toState === "DEV_DEPLOYED") {
      await engine.advance(pipeline_id, Trigger.GATE_PASSED);
    }

    // After STAGING_DEPLOYED, auto-advance to REGRESSION_GATE
    if (result.toState === "STAGING_DEPLOYED") {
      await engine.advance(pipeline_id, Trigger.GATE_PASSED);
    }

    // After PROD_DEPLOYED, auto-advance to DONE
    if (result.toState === "PROD_DEPLOYED") {
      await engine.advance(pipeline_id, Trigger.GATE_PASSED);
    }

    return {
      ok: true,
      transitioned: result.transitioned,
      toState: result.toState,
    };
  });
}

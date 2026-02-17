import { nanoid } from "nanoid";
import { getDb } from "../db/client.js";
import { gateResults } from "../db/schema.js";
import { classifyTestFailure } from "./rules.js";
import type { TestResults } from "./parsers/github-check.js";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("gate-evaluator");

export type GateOutcome = "pass" | "non_critical_fail" | "critical_fail";

export interface GateEvaluation {
  outcome: GateOutcome;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  failedTestNames: string[];
  coveragePercent?: number;
  criticalFailures: string[];
  nonCriticalFailures: string[];
}

export class GateEvaluator {
  evaluate(results: TestResults): GateEvaluation {
    const criticalFailures: string[] = [];
    const nonCriticalFailures: string[] = [];

    for (const testName of results.failedTestNames) {
      const severity = classifyTestFailure(testName);
      if (severity === "critical") {
        criticalFailures.push(testName);
      } else {
        nonCriticalFailures.push(testName);
      }
    }

    let outcome: GateOutcome;
    if (results.failedTests === 0) {
      outcome = "pass";
    } else if (criticalFailures.length > 0) {
      outcome = "critical_fail";
    } else {
      outcome = "non_critical_fail";
    }

    log.info(
      {
        outcome,
        total: results.totalTests,
        passed: results.passedTests,
        failed: results.failedTests,
        critical: criticalFailures.length,
        nonCritical: nonCriticalFailures.length,
      },
      "Gate evaluation complete"
    );

    return {
      outcome,
      totalTests: results.totalTests,
      passedTests: results.passedTests,
      failedTests: results.failedTests,
      failedTestNames: results.failedTestNames,
      coveragePercent: results.coveragePercent,
      criticalFailures,
      nonCriticalFailures,
    };
  }

  async persistResult(
    pipelineRunId: string,
    gateName: string,
    evaluation: GateEvaluation,
    workflowRunId?: number
  ) {
    const db = getDb();

    await db.insert(gateResults).values({
      id: nanoid(),
      pipelineRunId,
      gateName,
      outcome: evaluation.outcome,
      workflowRunId,
      totalTests: evaluation.totalTests,
      passedTests: evaluation.passedTests,
      failedTests: evaluation.failedTests,
      failedTestNames: evaluation.failedTestNames,
      coveragePercent: evaluation.coveragePercent,
      severity:
        evaluation.criticalFailures.length > 0 ? "critical" : "non_critical",
    });
  }
}

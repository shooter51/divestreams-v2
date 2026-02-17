import { PipelineState, Trigger } from "./states.js";
import type { PipelineStateType, TriggerType } from "./states.js";

export interface TransitionDef {
  from: PipelineStateType;
  trigger: TriggerType;
  to: PipelineStateType;
  guard?: (ctx: TransitionContext) => boolean;
  sideEffect?: string; // Name of side effect to execute
}

export interface TransitionContext {
  pipelineRunId: string;
  prNumber: number;
  branch: string;
  targetBranch: string;
  commitSha: string;
  fixCycleCount: number;
  maxFixCycles: number;
  gateName?: string;
  metadata?: Record<string, unknown>;
}

// All valid transitions
export const transitions: TransitionDef[] = [
  // === Happy path ===

  // PR opened → run unit+pact gate
  {
    from: PipelineState.CREATED,
    trigger: Trigger.PR_OPENED,
    to: PipelineState.UNIT_PACT_GATE,
    sideEffect: "dispatchUnitPactGate",
  },

  // Unit+pact pass → deploy to dev
  {
    from: PipelineState.UNIT_PACT_GATE,
    trigger: Trigger.GATE_PASSED,
    to: PipelineState.DEV_DEPLOYING,
    sideEffect: "dispatchDevDeploy",
  },

  // Dev deployed → run integration gate
  {
    from: PipelineState.DEV_DEPLOYING,
    trigger: Trigger.DEPLOY_COMPLETED,
    to: PipelineState.DEV_DEPLOYED,
  },
  {
    from: PipelineState.DEV_DEPLOYED,
    trigger: Trigger.GATE_PASSED, // auto-advance
    to: PipelineState.INTEGRATION_GATE,
    sideEffect: "dispatchIntegrationGate",
  },

  // Integration pass → E2E gate
  {
    from: PipelineState.INTEGRATION_GATE,
    trigger: Trigger.GATE_PASSED,
    to: PipelineState.E2E_GATE,
    sideEffect: "dispatchE2eGate",
  },

  // E2E pass → promote to staging
  {
    from: PipelineState.E2E_GATE,
    trigger: Trigger.GATE_PASSED,
    to: PipelineState.STAGING_PROMOTING,
    sideEffect: "mergeToStaging",
  },

  // Staging merge done → deploy to staging
  {
    from: PipelineState.STAGING_PROMOTING,
    trigger: Trigger.MERGE_COMPLETED,
    to: PipelineState.STAGING_DEPLOYING,
    sideEffect: "dispatchStagingDeploy",
  },

  // Staging deployed → run regression gate
  {
    from: PipelineState.STAGING_DEPLOYING,
    trigger: Trigger.DEPLOY_COMPLETED,
    to: PipelineState.STAGING_DEPLOYED,
  },
  {
    from: PipelineState.STAGING_DEPLOYED,
    trigger: Trigger.GATE_PASSED, // auto-advance
    to: PipelineState.REGRESSION_GATE,
    sideEffect: "dispatchRegressionGate",
  },

  // Regression pass → ready for prod
  {
    from: PipelineState.REGRESSION_GATE,
    trigger: Trigger.GATE_PASSED,
    to: PipelineState.READY_FOR_PROD,
    sideEffect: "createReleasePR",
  },

  // Human approves → deploy to prod
  {
    from: PipelineState.READY_FOR_PROD,
    trigger: Trigger.HUMAN_APPROVED,
    to: PipelineState.PROD_DEPLOYING,
    sideEffect: "dispatchProdDeploy",
  },

  // Prod deployed → done
  {
    from: PipelineState.PROD_DEPLOYING,
    trigger: Trigger.DEPLOY_COMPLETED,
    to: PipelineState.PROD_DEPLOYED,
  },
  {
    from: PipelineState.PROD_DEPLOYED,
    trigger: Trigger.GATE_PASSED, // auto-advance
    to: PipelineState.DONE,
  },

  // === Non-critical failures (pipeline continues) ===

  {
    from: PipelineState.UNIT_PACT_GATE,
    trigger: Trigger.GATE_NON_CRITICAL_FAIL,
    to: PipelineState.DEV_DEPLOYING,
    sideEffect: "createDefectAndDeployDev",
  },
  {
    from: PipelineState.INTEGRATION_GATE,
    trigger: Trigger.GATE_NON_CRITICAL_FAIL,
    to: PipelineState.E2E_GATE,
    sideEffect: "createDefectAndDispatchE2e",
  },
  {
    from: PipelineState.E2E_GATE,
    trigger: Trigger.GATE_NON_CRITICAL_FAIL,
    to: PipelineState.STAGING_PROMOTING,
    sideEffect: "createDefectAndMergeStaging",
  },
  {
    from: PipelineState.REGRESSION_GATE,
    trigger: Trigger.GATE_NON_CRITICAL_FAIL,
    to: PipelineState.READY_FOR_PROD,
    sideEffect: "createDefectAndCreateReleasePR",
  },

  // === Critical failures → FIXING ===

  {
    from: PipelineState.UNIT_PACT_GATE,
    trigger: Trigger.GATE_CRITICAL_FAIL,
    to: PipelineState.FIXING,
    guard: (ctx) => ctx.fixCycleCount < ctx.maxFixCycles,
    sideEffect: "launchFixAgent",
  },
  {
    from: PipelineState.INTEGRATION_GATE,
    trigger: Trigger.GATE_CRITICAL_FAIL,
    to: PipelineState.FIXING,
    guard: (ctx) => ctx.fixCycleCount < ctx.maxFixCycles,
    sideEffect: "launchFixAgent",
  },
  {
    from: PipelineState.E2E_GATE,
    trigger: Trigger.GATE_CRITICAL_FAIL,
    to: PipelineState.FIXING,
    guard: (ctx) => ctx.fixCycleCount < ctx.maxFixCycles,
    sideEffect: "launchFixAgent",
  },
  {
    from: PipelineState.REGRESSION_GATE,
    trigger: Trigger.GATE_CRITICAL_FAIL,
    to: PipelineState.FIXING,
    guard: (ctx) => ctx.fixCycleCount < ctx.maxFixCycles,
    sideEffect: "launchFixAgent",
  },

  // Max cycles exceeded → FAILED
  {
    from: PipelineState.UNIT_PACT_GATE,
    trigger: Trigger.GATE_CRITICAL_FAIL,
    to: PipelineState.FAILED,
    guard: (ctx) => ctx.fixCycleCount >= ctx.maxFixCycles,
    sideEffect: "createDefect",
  },
  {
    from: PipelineState.INTEGRATION_GATE,
    trigger: Trigger.GATE_CRITICAL_FAIL,
    to: PipelineState.FAILED,
    guard: (ctx) => ctx.fixCycleCount >= ctx.maxFixCycles,
    sideEffect: "createDefect",
  },
  {
    from: PipelineState.E2E_GATE,
    trigger: Trigger.GATE_CRITICAL_FAIL,
    to: PipelineState.FAILED,
    guard: (ctx) => ctx.fixCycleCount >= ctx.maxFixCycles,
    sideEffect: "createDefect",
  },
  {
    from: PipelineState.REGRESSION_GATE,
    trigger: Trigger.GATE_CRITICAL_FAIL,
    to: PipelineState.FAILED,
    guard: (ctx) => ctx.fixCycleCount >= ctx.maxFixCycles,
    sideEffect: "createDefect",
  },

  // === Fix agent outcomes ===

  // Fix agent pushed → go back to the gate that triggered it
  {
    from: PipelineState.FIXING,
    trigger: Trigger.FIX_AGENT_PUSHED,
    to: PipelineState.UNIT_PACT_GATE,
    guard: (ctx) => ctx.gateName === "unit_pact",
    sideEffect: "dispatchUnitPactGate",
  },
  {
    from: PipelineState.FIXING,
    trigger: Trigger.FIX_AGENT_PUSHED,
    to: PipelineState.INTEGRATION_GATE,
    guard: (ctx) => ctx.gateName === "integration",
    sideEffect: "dispatchIntegrationGate",
  },
  {
    from: PipelineState.FIXING,
    trigger: Trigger.FIX_AGENT_PUSHED,
    to: PipelineState.E2E_GATE,
    guard: (ctx) => ctx.gateName === "e2e",
    sideEffect: "dispatchE2eGate",
  },
  {
    from: PipelineState.FIXING,
    trigger: Trigger.FIX_AGENT_PUSHED,
    to: PipelineState.REGRESSION_GATE,
    guard: (ctx) => ctx.gateName === "regression",
    sideEffect: "dispatchRegressionGate",
  },

  // Fix agent failed/timeout → FAILED
  {
    from: PipelineState.FIXING,
    trigger: Trigger.FIX_AGENT_FAILED,
    to: PipelineState.FAILED,
    sideEffect: "createDefect",
  },
  {
    from: PipelineState.FIXING,
    trigger: Trigger.FIX_AGENT_TIMEOUT,
    to: PipelineState.FAILED,
    sideEffect: "createDefect",
  },

  // === Merge conflict → Judge agent ===

  {
    from: PipelineState.STAGING_PROMOTING,
    trigger: Trigger.MERGE_CONFLICT,
    to: PipelineState.JUDGING,
    sideEffect: "launchJudgeAgent",
  },
  {
    from: PipelineState.JUDGING,
    trigger: Trigger.JUDGE_RESOLVED,
    to: PipelineState.STAGING_PROMOTING,
    sideEffect: "mergeToStaging",
  },
  {
    from: PipelineState.JUDGING,
    trigger: Trigger.JUDGE_FAILED,
    to: PipelineState.FAILED,
    sideEffect: "createDefect",
  },

  // === Deploy failures ===

  {
    from: PipelineState.DEV_DEPLOYING,
    trigger: Trigger.DEPLOY_FAILED,
    to: PipelineState.FAILED,
  },
  {
    from: PipelineState.STAGING_DEPLOYING,
    trigger: Trigger.DEPLOY_FAILED,
    to: PipelineState.FAILED,
  },
  {
    from: PipelineState.PROD_DEPLOYING,
    trigger: Trigger.DEPLOY_FAILED,
    to: PipelineState.FAILED,
  },

  // === Manual abort ===

  {
    from: PipelineState.FIXING,
    trigger: Trigger.MANUAL_ABORT,
    to: PipelineState.FAILED,
  },
];

export function findTransition(
  currentState: PipelineStateType,
  trigger: TriggerType,
  ctx: TransitionContext
): TransitionDef | null {
  const candidates = transitions.filter(
    (t) => t.from === currentState && t.trigger === trigger
  );

  // Evaluate guards — first match wins
  for (const t of candidates) {
    if (!t.guard || t.guard(ctx)) {
      return t;
    }
  }

  return null;
}

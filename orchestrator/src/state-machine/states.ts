export const PipelineState = {
  CREATED: "CREATED",
  UNIT_PACT_GATE: "UNIT_PACT_GATE",
  DEV_DEPLOYING: "DEV_DEPLOYING",
  DEV_DEPLOYED: "DEV_DEPLOYED",
  INTEGRATION_GATE: "INTEGRATION_GATE",
  E2E_GATE: "E2E_GATE",
  STAGING_PROMOTING: "STAGING_PROMOTING",
  STAGING_DEPLOYING: "STAGING_DEPLOYING",
  STAGING_DEPLOYED: "STAGING_DEPLOYED",
  REGRESSION_GATE: "REGRESSION_GATE",
  READY_FOR_PROD: "READY_FOR_PROD",
  PROD_DEPLOYING: "PROD_DEPLOYING",
  PROD_DEPLOYED: "PROD_DEPLOYED",
  DONE: "DONE",
  // Side states
  FIXING: "FIXING",
  JUDGING: "JUDGING",
  FAILED: "FAILED",
} as const;

export type PipelineStateType =
  (typeof PipelineState)[keyof typeof PipelineState];

export const Trigger = {
  // PR lifecycle
  PR_OPENED: "PR_OPENED",
  PR_SYNCHRONIZED: "PR_SYNCHRONIZED",
  PR_MERGED: "PR_MERGED",

  // Gate outcomes
  GATE_PASSED: "GATE_PASSED",
  GATE_NON_CRITICAL_FAIL: "GATE_NON_CRITICAL_FAIL",
  GATE_CRITICAL_FAIL: "GATE_CRITICAL_FAIL",

  // Deploy
  DEPLOY_STARTED: "DEPLOY_STARTED",
  DEPLOY_COMPLETED: "DEPLOY_COMPLETED",
  DEPLOY_FAILED: "DEPLOY_FAILED",

  // Promotion
  MERGE_COMPLETED: "MERGE_COMPLETED",
  MERGE_CONFLICT: "MERGE_CONFLICT",

  // Agent
  FIX_AGENT_PUSHED: "FIX_AGENT_PUSHED",
  FIX_AGENT_FAILED: "FIX_AGENT_FAILED",
  FIX_AGENT_TIMEOUT: "FIX_AGENT_TIMEOUT",
  JUDGE_RESOLVED: "JUDGE_RESOLVED",
  JUDGE_FAILED: "JUDGE_FAILED",

  // Human
  HUMAN_APPROVED: "HUMAN_APPROVED",

  // System
  MAX_CYCLES_EXCEEDED: "MAX_CYCLES_EXCEEDED",
  MANUAL_ABORT: "MANUAL_ABORT",
} as const;

export type TriggerType = (typeof Trigger)[keyof typeof Trigger];

// Gates mapped to their expected states
export const GateForState: Record<string, PipelineStateType> = {
  unit_pact: PipelineState.UNIT_PACT_GATE,
  integration: PipelineState.INTEGRATION_GATE,
  e2e: PipelineState.E2E_GATE,
  regression: PipelineState.REGRESSION_GATE,
};

// States that are terminal
export const TERMINAL_STATES: PipelineStateType[] = [
  PipelineState.DONE,
  PipelineState.FAILED,
];

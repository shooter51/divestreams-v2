import { describe, it, expect } from "vitest";
import { findTransition, type TransitionContext } from "./transitions.js";
import { PipelineState, Trigger } from "./states.js";

function makeCtx(overrides: Partial<TransitionContext> = {}): TransitionContext {
  return {
    pipelineRunId: "test-run-1",
    prNumber: 42,
    branch: "feature/test",
    targetBranch: "develop",
    commitSha: "abc123",
    fixCycleCount: 0,
    maxFixCycles: 3,
    ...overrides,
  };
}

describe("State Machine Transitions", () => {
  // --- Happy path ---

  it("CREATED → UNIT_PACT_GATE on PR_OPENED", () => {
    const t = findTransition(PipelineState.CREATED, Trigger.PR_OPENED, makeCtx());
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.UNIT_PACT_GATE);
    expect(t!.sideEffect).toBe("dispatchUnitPactGate");
  });

  it("UNIT_PACT_GATE → DEV_DEPLOYING on GATE_PASSED", () => {
    const t = findTransition(PipelineState.UNIT_PACT_GATE, Trigger.GATE_PASSED, makeCtx());
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.DEV_DEPLOYING);
    expect(t!.sideEffect).toBe("dispatchDevDeploy");
  });

  it("DEV_DEPLOYING → DEV_DEPLOYED on DEPLOY_COMPLETED", () => {
    const t = findTransition(PipelineState.DEV_DEPLOYING, Trigger.DEPLOY_COMPLETED, makeCtx());
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.DEV_DEPLOYED);
  });

  it("E2E_GATE → STAGING_PROMOTING on GATE_PASSED", () => {
    const t = findTransition(PipelineState.E2E_GATE, Trigger.GATE_PASSED, makeCtx());
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.STAGING_PROMOTING);
    expect(t!.sideEffect).toBe("mergeToStaging");
  });

  it("STAGING_PROMOTING → STAGING_DEPLOYING on MERGE_COMPLETED", () => {
    const t = findTransition(PipelineState.STAGING_PROMOTING, Trigger.MERGE_COMPLETED, makeCtx());
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.STAGING_DEPLOYING);
  });

  it("REGRESSION_GATE → READY_FOR_PROD on GATE_PASSED", () => {
    const t = findTransition(PipelineState.REGRESSION_GATE, Trigger.GATE_PASSED, makeCtx());
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.READY_FOR_PROD);
    expect(t!.sideEffect).toBe("createReleasePR");
  });

  it("READY_FOR_PROD → PROD_DEPLOYING on HUMAN_APPROVED", () => {
    const t = findTransition(PipelineState.READY_FOR_PROD, Trigger.HUMAN_APPROVED, makeCtx());
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.PROD_DEPLOYING);
    expect(t!.sideEffect).toBe("dispatchProdDeploy");
  });

  // --- Non-critical failures ---

  it("UNIT_PACT_GATE → DEV_DEPLOYING on NON_CRITICAL_FAIL", () => {
    const t = findTransition(PipelineState.UNIT_PACT_GATE, Trigger.GATE_NON_CRITICAL_FAIL, makeCtx());
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.DEV_DEPLOYING);
    expect(t!.sideEffect).toBe("createDefectAndDeployDev");
  });

  it("E2E_GATE → STAGING_PROMOTING on NON_CRITICAL_FAIL", () => {
    const t = findTransition(PipelineState.E2E_GATE, Trigger.GATE_NON_CRITICAL_FAIL, makeCtx());
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.STAGING_PROMOTING);
  });

  // --- Critical failures → FIXING ---

  it("UNIT_PACT_GATE → FIXING on CRITICAL_FAIL when cycles available", () => {
    const t = findTransition(PipelineState.UNIT_PACT_GATE, Trigger.GATE_CRITICAL_FAIL, makeCtx({ fixCycleCount: 0 }));
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.FIXING);
    expect(t!.sideEffect).toBe("launchFixAgent");
  });

  it("UNIT_PACT_GATE → FAILED on CRITICAL_FAIL when max cycles exceeded", () => {
    const t = findTransition(PipelineState.UNIT_PACT_GATE, Trigger.GATE_CRITICAL_FAIL, makeCtx({ fixCycleCount: 3 }));
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.FAILED);
    expect(t!.sideEffect).toBe("createDefect");
  });

  it("E2E_GATE → FIXING on CRITICAL_FAIL when cycle 2", () => {
    const t = findTransition(PipelineState.E2E_GATE, Trigger.GATE_CRITICAL_FAIL, makeCtx({ fixCycleCount: 2 }));
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.FIXING);
  });

  it("E2E_GATE → FAILED on CRITICAL_FAIL when cycle 3", () => {
    const t = findTransition(PipelineState.E2E_GATE, Trigger.GATE_CRITICAL_FAIL, makeCtx({ fixCycleCount: 3 }));
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.FAILED);
  });

  // --- Fix agent outcomes ---

  it("FIXING → UNIT_PACT_GATE on FIX_AGENT_PUSHED for unit_pact gate", () => {
    const t = findTransition(PipelineState.FIXING, Trigger.FIX_AGENT_PUSHED, makeCtx({ gateName: "unit_pact" }));
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.UNIT_PACT_GATE);
  });

  it("FIXING → E2E_GATE on FIX_AGENT_PUSHED for e2e gate", () => {
    const t = findTransition(PipelineState.FIXING, Trigger.FIX_AGENT_PUSHED, makeCtx({ gateName: "e2e" }));
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.E2E_GATE);
  });

  it("FIXING → FAILED on FIX_AGENT_FAILED", () => {
    const t = findTransition(PipelineState.FIXING, Trigger.FIX_AGENT_FAILED, makeCtx());
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.FAILED);
  });

  it("FIXING → FAILED on FIX_AGENT_TIMEOUT", () => {
    const t = findTransition(PipelineState.FIXING, Trigger.FIX_AGENT_TIMEOUT, makeCtx());
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.FAILED);
  });

  // --- Merge conflict ---

  it("STAGING_PROMOTING → JUDGING on MERGE_CONFLICT", () => {
    const t = findTransition(PipelineState.STAGING_PROMOTING, Trigger.MERGE_CONFLICT, makeCtx());
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.JUDGING);
    expect(t!.sideEffect).toBe("launchJudgeAgent");
  });

  it("JUDGING → STAGING_PROMOTING on JUDGE_RESOLVED", () => {
    const t = findTransition(PipelineState.JUDGING, Trigger.JUDGE_RESOLVED, makeCtx());
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.STAGING_PROMOTING);
  });

  // --- Deploy failures ---

  it("DEV_DEPLOYING → FAILED on DEPLOY_FAILED", () => {
    const t = findTransition(PipelineState.DEV_DEPLOYING, Trigger.DEPLOY_FAILED, makeCtx());
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.FAILED);
  });

  it("PROD_DEPLOYING → FAILED on DEPLOY_FAILED", () => {
    const t = findTransition(PipelineState.PROD_DEPLOYING, Trigger.DEPLOY_FAILED, makeCtx());
    expect(t).not.toBeNull();
    expect(t!.to).toBe(PipelineState.FAILED);
  });

  // --- No valid transition ---

  it("returns null for invalid transition", () => {
    const t = findTransition(PipelineState.DONE, Trigger.PR_OPENED, makeCtx());
    expect(t).toBeNull();
  });

  it("returns null for FAILED state (terminal)", () => {
    const t = findTransition(PipelineState.FAILED, Trigger.GATE_PASSED, makeCtx());
    expect(t).toBeNull();
  });
});

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "../db/client.js";
import { pipelineRuns, stateTransitions } from "../db/schema.js";
import type { PipelineRun } from "../db/schema.js";
import { createChildLogger } from "../utils/logger.js";
import {
  findTransition,
  type TransitionContext,
} from "./transitions.js";
import type { PipelineStateType, TriggerType } from "./states.js";
import { TERMINAL_STATES } from "./states.js";

const log = createChildLogger("engine");

export interface AdvanceResult {
  transitioned: boolean;
  fromState: PipelineStateType;
  toState?: PipelineStateType;
  sideEffect?: string;
  error?: string;
}

export class StateMachineEngine {
  private sideEffectHandlers = new Map<
    string,
    (ctx: TransitionContext, run: PipelineRun) => Promise<void>
  >();

  registerSideEffect(
    name: string,
    handler: (ctx: TransitionContext, run: PipelineRun) => Promise<void>
  ) {
    this.sideEffectHandlers.set(name, handler);
  }

  async advance(
    pipelineRunId: string,
    trigger: TriggerType,
    extra?: Partial<TransitionContext>
  ): Promise<AdvanceResult> {
    const db = getDb();

    const run = await db.query.pipelineRuns.findFirst({
      where: eq(pipelineRuns.id, pipelineRunId),
    });

    if (!run) {
      return {
        transitioned: false,
        fromState: "CREATED" as PipelineStateType,
        error: `Pipeline run ${pipelineRunId} not found`,
      };
    }

    const currentState = run.state as PipelineStateType;

    if (TERMINAL_STATES.includes(currentState)) {
      log.warn(
        { pipelineRunId, currentState, trigger },
        "Cannot advance from terminal state"
      );
      return {
        transitioned: false,
        fromState: currentState,
        error: `Pipeline is in terminal state: ${currentState}`,
      };
    }

    const ctx: TransitionContext = {
      pipelineRunId,
      prNumber: run.prNumber,
      branch: run.branch,
      targetBranch: run.targetBranch,
      commitSha: run.commitSha,
      fixCycleCount: run.fixCycleCount,
      maxFixCycles: run.maxFixCycles,
      ...extra,
    };

    const transition = findTransition(currentState, trigger, ctx);

    if (!transition) {
      log.warn(
        { pipelineRunId, currentState, trigger },
        "No valid transition found"
      );
      return {
        transitioned: false,
        fromState: currentState,
        error: `No transition from ${currentState} on ${trigger}`,
      };
    }

    const toState = transition.to;

    // Persist transition atomically
    const now = new Date().toISOString();

    await db
      .update(pipelineRuns)
      .set({
        state: toState,
        previousState: currentState,
        updatedAt: now,
      })
      .where(eq(pipelineRuns.id, pipelineRunId));

    await db.insert(stateTransitions).values({
      id: nanoid(),
      pipelineRunId,
      fromState: currentState,
      toState,
      trigger,
      metadata: extra?.metadata,
      createdAt: now,
    });

    log.info(
      {
        pipelineRunId,
        from: currentState,
        to: toState,
        trigger,
        sideEffect: transition.sideEffect,
      },
      "State transition"
    );

    // Execute side effect
    if (transition.sideEffect) {
      const handler = this.sideEffectHandlers.get(transition.sideEffect);
      if (handler) {
        try {
          const updatedRun = await db.query.pipelineRuns.findFirst({
            where: eq(pipelineRuns.id, pipelineRunId),
          });
          await handler(ctx, updatedRun!);
        } catch (err) {
          log.error(
            { pipelineRunId, sideEffect: transition.sideEffect, err },
            "Side effect failed"
          );
        }
      } else {
        log.warn(
          { sideEffect: transition.sideEffect },
          "No handler registered for side effect"
        );
      }
    }

    return {
      transitioned: true,
      fromState: currentState,
      toState,
      sideEffect: transition.sideEffect,
    };
  }

  async createRun(params: {
    prNumber: number;
    branch: string;
    targetBranch: string;
    commitSha: string;
    vkIssueId?: string;
    maxFixCycles?: number;
  }): Promise<PipelineRun> {
    const db = getDb();
    const id = nanoid();
    const now = new Date().toISOString();

    await db.insert(pipelineRuns).values({
      id,
      prNumber: params.prNumber,
      branch: params.branch,
      targetBranch: params.targetBranch,
      commitSha: params.commitSha,
      vkIssueId: params.vkIssueId,
      maxFixCycles: params.maxFixCycles ?? 3,
      createdAt: now,
      updatedAt: now,
    });

    const run = await db.query.pipelineRuns.findFirst({
      where: eq(pipelineRuns.id, id),
    });

    log.info(
      { pipelineRunId: id, prNumber: params.prNumber, branch: params.branch },
      "Pipeline run created"
    );

    return run!;
  }

  async getRun(id: string): Promise<PipelineRun | undefined> {
    const db = getDb();
    return db.query.pipelineRuns.findFirst({
      where: eq(pipelineRuns.id, id),
    });
  }

  async getRunByPR(prNumber: number): Promise<PipelineRun | undefined> {
    const db = getDb();
    return db.query.pipelineRuns.findFirst({
      where: eq(pipelineRuns.prNumber, prNumber),
    });
  }

  async incrementFixCycle(pipelineRunId: string): Promise<void> {
    const db = getDb();
    const run = await this.getRun(pipelineRunId);
    if (!run) return;

    await db
      .update(pipelineRuns)
      .set({
        fixCycleCount: run.fixCycleCount + 1,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(pipelineRuns.id, pipelineRunId));
  }

  async updateCommitSha(
    pipelineRunId: string,
    commitSha: string
  ): Promise<void> {
    const db = getDb();
    await db
      .update(pipelineRuns)
      .set({
        commitSha,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(pipelineRuns.id, pipelineRunId));
  }

  async setError(pipelineRunId: string, message: string): Promise<void> {
    const db = getDb();
    await db
      .update(pipelineRuns)
      .set({
        errorMessage: message,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(pipelineRuns.id, pipelineRunId));
  }
}

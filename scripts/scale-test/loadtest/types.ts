/**
 * Shared types for the load test harness
 */

export interface StepMetric {
  step: string;
  url: string;
  startTime: number;
  durationMs: number;
  httpStatus: number | null;
  error?: string;
}

export interface MetricEvent {
  workerId: number;
  tenantSlug: string;
  sessionStart: number;
  sessionEnd: number;
  steps: StepMetric[];
  sessionErrorCount: number;
}

/** Messages from orchestrator to worker */
export type OrchestratorMessage =
  | { type: "tenant"; slug: string }
  | { type: "shutdown" };

/** Messages from worker to orchestrator */
export type WorkerMessage =
  | { type: "next" }
  | { type: "metric"; event: MetricEvent }
  | { type: "ready" };

export interface AggregatedMetrics {
  timestamp: string;
  windowSessions: number;
  sessionsPerMin: number;
  tenantsHit: number;
  totalSteps: number;
  errorRatePct: number;
  avgSessionMs: number;
  p50StepMs: number;
  p95StepMs: number;
  slowestStep: string;
  slowestTenant: string;
  errors: string[];
  topSlowTenants: Array<{ slug: string; avgMs: number }>;
  topSlowSteps: Array<{ step: string; avgMs: number }>;
}

import * as fs from "fs";
import type { MetricEvent, AggregatedMetrics } from "./types.js";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function aggregateMetrics(events: MetricEvent[]): AggregatedMetrics {
  const timestamp = new Date().toISOString();

  if (events.length === 0) {
    return {
      timestamp,
      windowSessions: 0,
      sessionsPerMin: 0,
      tenantsHit: 0,
      totalSteps: 0,
      errorRatePct: 0,
      avgSessionMs: 0,
      p50StepMs: 0,
      p95StepMs: 0,
      slowestStep: "",
      slowestTenant: "",
      errors: [],
      topSlowTenants: [],
      topSlowSteps: [],
    };
  }

  const windowSessions = events.length;
  const sessionsPerMin = windowSessions * 2;

  const uniqueTenants = new Set(events.map((e) => e.tenantSlug));
  const tenantsHit = uniqueTenants.size;

  const allSteps = events.flatMap((e) => e.steps);
  const totalSteps = allSteps.length;

  const errorSteps = allSteps.filter((s) => s.error != null).length;
  const errorRatePct = totalSteps > 0 ? (errorSteps / totalSteps) * 100 : 0;

  const sessionDurations = events.map((e) => e.sessionEnd - e.sessionStart);
  const avgSessionMs =
    sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length;

  const stepDurations = allSteps.map((s) => s.durationMs).sort((a, b) => a - b);
  const p50StepMs = percentile(stepDurations, 50);
  const p95StepMs = percentile(stepDurations, 95);

  // Slowest step by mean durationMs
  const stepDurMap = new Map<string, number[]>();
  for (const s of allSteps) {
    const arr = stepDurMap.get(s.step) ?? [];
    arr.push(s.durationMs);
    stepDurMap.set(s.step, arr);
  }
  let slowestStep = "";
  let slowestStepAvg = -1;
  for (const [step, durations] of stepDurMap) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    if (avg > slowestStepAvg) {
      slowestStepAvg = avg;
      slowestStep = step;
    }
  }

  // Slowest tenant by mean session duration
  const tenantDurMap = new Map<string, number[]>();
  for (const e of events) {
    const dur = e.sessionEnd - e.sessionStart;
    const arr = tenantDurMap.get(e.tenantSlug) ?? [];
    arr.push(dur);
    tenantDurMap.set(e.tenantSlug, arr);
  }
  let slowestTenant = "";
  let slowestTenantAvg = -1;
  for (const [slug, durations] of tenantDurMap) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    if (avg > slowestTenantAvg) {
      slowestTenantAvg = avg;
      slowestTenant = slug;
    }
  }

  const errors = allSteps
    .filter((s) => s.error != null)
    .map((s) => s.error as string);

  const topSlowTenants = [...tenantDurMap.entries()]
    .map(([slug, durations]) => ({
      slug,
      avgMs: durations.reduce((a, b) => a + b, 0) / durations.length,
    }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 5);

  const topSlowSteps = [...stepDurMap.entries()]
    .map(([step, durations]) => ({
      step,
      avgMs: durations.reduce((a, b) => a + b, 0) / durations.length,
    }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 5);

  return {
    timestamp,
    windowSessions,
    sessionsPerMin,
    tenantsHit,
    totalSteps,
    errorRatePct,
    avgSessionMs,
    p50StepMs,
    p95StepMs,
    slowestStep,
    slowestTenant,
    errors,
    topSlowTenants,
    topSlowSteps,
  };
}

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";

function fmt(n: number, decimals = 0): string {
  return n.toFixed(decimals);
}

function fmtMs(ms: number): string {
  return `${fmt(ms)}ms`;
}

export function renderDashboard(
  metrics: AggregatedMetrics,
  runningFor: number,
  totalSessions: number
): void {
  process.stdout.write("\x1b[2J\x1b[H");

  const runMins = Math.floor(runningFor / 60);
  const runSecs = runningFor % 60;
  const runStr = `${runMins}m ${runSecs}s`;

  const errorColor =
    metrics.errorRatePct > 5
      ? RED
      : metrics.errorRatePct > 1
        ? YELLOW
        : GREEN;

  console.log(
    `${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${RESET}`
  );
  console.log(
    `${BOLD}${CYAN}║       DiveStreams Load Test — Live Dashboard              ║${RESET}`
  );
  console.log(
    `${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${RESET}`
  );
  console.log();
  console.log(
    `  ${DIM}Running for:${RESET}  ${BOLD}${runStr}${RESET}    ${DIM}Total sessions:${RESET}  ${BOLD}${totalSessions}${RESET}`
  );
  console.log();
  console.log(`${BOLD}  ── Metrics ────────────────────────────────────────────${RESET}`);
  console.log(
    `  Sessions/min   ${BOLD}${GREEN}${fmt(metrics.sessionsPerMin)}${RESET}`
  );
  console.log(
    `  Error rate     ${BOLD}${errorColor}${fmt(metrics.errorRatePct, 2)}%${RESET}`
  );
  console.log(
    `  Avg session    ${BOLD}${fmtMs(metrics.avgSessionMs)}${RESET}`
  );
  console.log(`  p50 step       ${BOLD}${fmtMs(metrics.p50StepMs)}${RESET}`);
  console.log(`  p95 step       ${BOLD}${fmtMs(metrics.p95StepMs)}${RESET}`);
  console.log(
    `  Tenants hit    ${BOLD}${metrics.tenantsHit}${RESET}    Total steps  ${BOLD}${metrics.totalSteps}${RESET}`
  );
  console.log();

  if (metrics.topSlowTenants.length > 0) {
    console.log(
      `${BOLD}  ── Top 5 Slowest Tenants ────────────────────────────────${RESET}`
    );
    for (const t of metrics.topSlowTenants) {
      console.log(
        `  ${YELLOW}${t.slug.padEnd(30)}${RESET}  ${fmtMs(t.avgMs)}`
      );
    }
    console.log();
  }

  if (metrics.topSlowSteps.length > 0) {
    console.log(
      `${BOLD}  ── Top 5 Slowest Steps ─────────────────────────────────${RESET}`
    );
    for (const s of metrics.topSlowSteps) {
      console.log(
        `  ${YELLOW}${s.step.padEnd(30)}${RESET}  ${fmtMs(s.avgMs)}`
      );
    }
    console.log();
  }

  const recentErrors = metrics.errors.slice(-5);
  if (recentErrors.length > 0) {
    console.log(
      `${BOLD}  ── Recent Errors (last 5) ───────────────────────────────${RESET}`
    );
    for (const err of recentErrors) {
      console.log(`  ${RED}✗${RESET} ${err}`);
    }
    console.log();
  }
}

export function appendCsvRow(
  filePath: string,
  metrics: AggregatedMetrics,
  isFirst: boolean
): void {
  if (isFirst) {
    const header =
      "timestamp,windowSessions,sessionsPerMin,tenantsHit,totalSteps,errorRatePct,avgSessionMs,p50StepMs,p95StepMs,slowestStep,slowestTenant\n";
    fs.writeFileSync(filePath, header, { flag: "w" });
  }

  const row = [
    metrics.timestamp,
    metrics.windowSessions,
    metrics.sessionsPerMin,
    metrics.tenantsHit,
    metrics.totalSteps,
    metrics.errorRatePct.toFixed(4),
    metrics.avgSessionMs.toFixed(2),
    metrics.p50StepMs.toFixed(2),
    metrics.p95StepMs.toFixed(2),
    `"${metrics.slowestStep.replace(/"/g, '""')}"`,
    `"${metrics.slowestTenant.replace(/"/g, '""')}"`,
  ].join(",");

  fs.appendFileSync(filePath, row + "\n");
}

export function appendNdjsonRow(
  filePath: string,
  metrics: AggregatedMetrics,
  events: MetricEvent[]
): void {
  const record = { ...metrics, events };
  fs.appendFileSync(filePath, JSON.stringify(record) + "\n");
}

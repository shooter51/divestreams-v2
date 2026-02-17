import type { FastifyInstance } from "fastify";
import { getDb } from "../db/client.js";
import { pipelineRuns, stateTransitions, gateResults } from "../db/schema.js";
import { desc, eq } from "drizzle-orm";

export function registerDashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard", async (_request, reply) => {
    const db = getDb();

    const runs = await db
      .select()
      .from(pipelineRuns)
      .orderBy(desc(pipelineRuns.createdAt))
      .limit(20);

    const html = renderDashboard(runs);
    return reply.type("text/html").send(html);
  });
}

function renderDashboard(
  runs: Array<{
    id: string;
    prNumber: number;
    branch: string;
    targetBranch: string;
    state: string;
    commitSha: string;
    fixCycleCount: number;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  }>
) {
  const stateColors: Record<string, string> = {
    CREATED: "#6b7280",
    UNIT_PACT_GATE: "#f59e0b",
    DEV_DEPLOYING: "#3b82f6",
    DEV_DEPLOYED: "#3b82f6",
    INTEGRATION_GATE: "#f59e0b",
    E2E_GATE: "#f59e0b",
    STAGING_PROMOTING: "#8b5cf6",
    STAGING_DEPLOYING: "#3b82f6",
    STAGING_DEPLOYED: "#3b82f6",
    REGRESSION_GATE: "#f59e0b",
    READY_FOR_PROD: "#10b981",
    PROD_DEPLOYING: "#3b82f6",
    PROD_DEPLOYED: "#10b981",
    DONE: "#10b981",
    FIXING: "#ef4444",
    JUDGING: "#f97316",
    FAILED: "#dc2626",
  };

  const rows = runs
    .map((run) => {
      const color = stateColors[run.state] || "#6b7280";
      const sha = run.commitSha.slice(0, 7);
      const age = timeSince(new Date(run.createdAt));

      return `
        <tr>
          <td><a href="/api/pipelines/${run.id}" class="link">${run.id.slice(0, 8)}</a></td>
          <td><a href="https://github.com/shooter51/divestreams-v2/pull/${run.prNumber}" class="link">#${run.prNumber}</a></td>
          <td><code>${run.branch}</code></td>
          <td><span class="badge" style="background:${color}">${run.state}</span></td>
          <td><code>${sha}</code></td>
          <td>${run.fixCycleCount > 0 ? `${run.fixCycleCount}/3` : "-"}</td>
          <td class="error">${run.errorMessage || "-"}</td>
          <td>${age}</td>
        </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pipeline Orchestrator — DiveStreams</title>
  <meta http-equiv="refresh" content="30">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
    h1 { font-size: 1.5rem; margin-bottom: 1.5rem; color: #f8fafc; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 0.75rem 1rem; color: #94a3b8; font-weight: 500; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #1e293b; }
    td { padding: 0.75rem 1rem; border-bottom: 1px solid #1e293b; font-size: 0.9rem; }
    tr:hover { background: #1e293b; }
    code { background: #1e293b; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.85rem; }
    .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; color: white; }
    .link { color: #60a5fa; text-decoration: none; }
    .link:hover { text-decoration: underline; }
    .error { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #f87171; font-size: 0.8rem; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .refresh { color: #64748b; font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Pipeline Orchestrator</h1>
    <span class="refresh">Auto-refreshes every 30s</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Pipeline</th>
        <th>PR</th>
        <th>Branch</th>
        <th>State</th>
        <th>SHA</th>
        <th>Fix Cycles</th>
        <th>Error</th>
        <th>Age</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:2rem">No pipeline runs yet</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

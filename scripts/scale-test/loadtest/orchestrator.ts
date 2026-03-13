import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import { Worker } from "worker_threads";

require("dotenv").config({ path: path.join(__dirname, ".env") });

import {
  aggregateMetrics,
  renderDashboard,
  appendCsvRow,
  appendNdjsonRow,
} from "./metrics";
import type { MetricEvent, WorkerMessage, OrchestratorMessage } from "./types";

// ── Environment ──────────────────────────────────────────────────────────────

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const WORKER_COUNT = parseInt(process.env.WORKER_COUNT ?? "10", 10);
const METRICS_INTERVAL_MS = parseInt(
  process.env.METRICS_INTERVAL_MS ?? "30000",
  10
);
const SESSION_TIMEOUT_MS = parseInt(
  process.env.SESSION_TIMEOUT_MS ?? "15000",
  10
);
const BASE_DOMAIN = process.env.BASE_DOMAIN ?? "test.divestreams.com";
const LOAD_TEST_REGISTER = (process.env.LOAD_TEST_REGISTER ?? "false") === "true";
const SELF_TEST = (process.env.SELF_TEST ?? "false") === "true";

// ── Tenant Discovery ─────────────────────────────────────────────────────────

function httpsRequest(
  url: string,
  options: https.RequestOptions,
  body?: string
): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers as Record<string, string | string[] | undefined>,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function discoverTenantsViaAdmin(): Promise<string[]> {
  const adminBase = `admin.${BASE_DOMAIN}`;

  // Sign in
  const loginBody = JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const loginRes = await httpsRequest(
    `https://${adminBase}/api/auth/sign-in/email`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(loginBody),
      },
    },
    loginBody
  );

  if (loginRes.status < 200 || loginRes.status >= 300) {
    throw new Error(`Admin sign-in failed: HTTP ${loginRes.status}`);
  }

  // Extract session cookie
  const setCookie = loginRes.headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const sessionCookie = cookies
    .map((c) => c.split(";")[0])
    .join("; ");

  if (!sessionCookie) {
    throw new Error("No session cookie returned from admin sign-in");
  }

  // Fetch dashboard HTML
  const dashRes = await httpsRequest(
    `https://${adminBase}/dashboard`,
    {
      method: "GET",
      headers: { Cookie: sessionCookie },
    }
  );

  if (dashRes.status < 200 || dashRes.status >= 300) {
    throw new Error(`Admin dashboard fetch failed: HTTP ${dashRes.status}`);
  }

  // Scrape org slugs from href="/organizations/<slug>" patterns
  const slugPattern = /href="\/organizations\/([^/"]+)/g;
  const slugs = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = slugPattern.exec(dashRes.body)) !== null) {
    const slug = match[1];
    if (slug && slug !== "platform") {
      slugs.add(slug);
    }
  }

  if (slugs.size === 0) {
    throw new Error("No org slugs found in admin dashboard HTML");
  }

  return [...slugs];
}

async function discoverTenants(): Promise<string[]> {
  // Try admin API first
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    try {
      const slugs = await discoverTenantsViaAdmin();
      console.log(`[orchestrator] Discovered ${slugs.length} tenants via admin API`);
      return slugs;
    } catch (err) {
      console.warn(
        `[orchestrator] Admin API tenant discovery failed: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  // Fallback: tenants.json
  const tenantsFile = path.join(__dirname, "tenants.json");
  if (fs.existsSync(tenantsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(tenantsFile, "utf8")) as string[];
      if (Array.isArray(data) && data.length > 0) {
        console.log(`[orchestrator] Loaded ${data.length} tenants from tenants.json`);
        return data;
      }
    } catch (err) {
      console.warn(
        `[orchestrator] Failed to read tenants.json: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  // Hard fallback
  console.warn(
    "[orchestrator] WARNING: Using fallback tenant list [\"tdsla\"] — set ADMIN_EMAIL/ADMIN_PASSWORD or provide tenants.json"
  );
  return ["tdsla"];
}

// ── Shuffle ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  let tenants = await discoverTenants();
  let workerCount = WORKER_COUNT;

  // Self-test overrides
  if (SELF_TEST) {
    workerCount = 1;
    // Keep at most 3 tenants, ensure "tdsla" is included
    const selfTestTenants = tenants.filter((s) => s !== "tdsla").slice(0, 2);
    tenants = ["tdsla", ...selfTestTenants].slice(0, 3);
    console.log("[orchestrator] Self-test mode: 1 worker, ≤3 tenants");
  }

  // Startup banner
  const intervalSec = Math.round(METRICS_INTERVAL_MS / 1000);
  console.log(`
DiveStreams Load Test
====================
Tenants : ${tenants.length}
Workers : ${workerCount}
Metrics : every ${intervalSec}s → metrics.csv + metrics.ndjson
Target  : https://{slug}.${BASE_DOMAIN}/site

Self-test: SELF_TEST=true WORKER_COUNT=1 npx ts-node orchestrator.ts
Full run : npx ts-node orchestrator.ts
Stop     : Ctrl+C (graceful shutdown, metrics flushed)
`);

  // Tenant queue state
  let queue: string[] = shuffle(tenants);
  let queuePos = 0;

  function nextSlug(): string {
    if (queuePos >= queue.length) {
      queue = shuffle(tenants);
      queuePos = 0;
    }
    return queue[queuePos++];
  }

  // Metrics state
  let windowEvents: MetricEvent[] = [];
  let totalSessions = 0;
  let isFirstTick = true;
  const startTime = Date.now();

  const csvPath = path.join(__dirname, "metrics.csv");
  const ndjsonPath = path.join(__dirname, "metrics.ndjson");

  // Spawn workers
  const workers: Worker[] = [];

  for (let i = 0; i < workerCount; i++) {
    const worker = new Worker(path.join(__dirname, "worker.ts"), {
      workerData: {
        workerId: i,
        sessionTimeout: SESSION_TIMEOUT_MS,
        baseDomain: BASE_DOMAIN,
        enableRegister: LOAD_TEST_REGISTER,
      },
      execArgv: ["--import", "tsx"],
    });

    worker.on("message", (msg: WorkerMessage) => {
      if (msg.type === "ready") {
        worker.postMessage({ type: "tenant", slug: nextSlug() } as OrchestratorMessage);
      } else if (msg.type === "next") {
        worker.postMessage({ type: "tenant", slug: nextSlug() } as OrchestratorMessage);
      } else if (msg.type === "metric") {
        windowEvents.push(msg.event);
        totalSessions++;
      }
    });

    worker.on("error", (err: Error) => {
      console.error(`[worker ${i}] Error:`, err.message);
    });

    workers.push(worker);
  }

  // Metrics tick
  const metricsInterval = setInterval(() => {
    const events = windowEvents;
    windowEvents = [];

    const metrics = aggregateMetrics(events);
    const runningForSec = Math.floor((Date.now() - startTime) / 1000);

    renderDashboard(metrics, runningForSec, totalSessions);
    appendCsvRow(csvPath, metrics, isFirstTick);
    appendNdjsonRow(ndjsonPath, metrics, events);
    isFirstTick = false;
  }, METRICS_INTERVAL_MS);

  // Self-test auto-shutdown after 2 minutes
  let selfTestTimer: NodeJS.Timeout | null = null;
  if (SELF_TEST) {
    selfTestTimer = setTimeout(() => {
      console.log("[orchestrator] Self-test complete — shutting down");
      triggerShutdown();
    }, 2 * 60 * 1000);
  }

  // Graceful shutdown
  let shuttingDown = false;

  async function triggerShutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    clearInterval(metricsInterval);
    if (selfTestTimer) clearTimeout(selfTestTimer);

    console.log("\n[orchestrator] Shutting down...");

    // Signal all workers
    for (const w of workers) {
      try {
        w.postMessage({ type: "shutdown" } as OrchestratorMessage);
      } catch {
        // Worker may already be gone
      }
    }

    // Wait up to 5 seconds for workers to exit
    const deadline = Date.now() + 5000;
    await Promise.all(
      workers.map(
        (w) =>
          new Promise<void>((resolve) => {
            const remaining = deadline - Date.now();
            const timer = setTimeout(() => {
              w.terminate().catch(() => {});
              resolve();
            }, Math.max(remaining, 0));
            w.once("exit", () => {
              clearTimeout(timer);
              resolve();
            });
          })
      )
    );

    // Flush final metrics tick
    const finalEvents = windowEvents;
    const finalMetrics = aggregateMetrics(finalEvents);
    appendCsvRow(csvPath, finalMetrics, isFirstTick);
    appendNdjsonRow(ndjsonPath, finalMetrics, finalEvents);

    // Run summary
    const totalRuntimeMs = Date.now() - startTime;
    const totalRuntimeMin = totalRuntimeMs / 60000;
    const avgSessionsPerMin =
      totalRuntimeMin > 0 ? (totalSessions / totalRuntimeMin).toFixed(1) : "0";
    const runtimeStr = `${Math.floor(totalRuntimeMs / 60000)}m ${Math.floor((totalRuntimeMs % 60000) / 1000)}s`;

    console.log(`
[orchestrator] Run complete
  Total sessions : ${totalSessions}
  Total runtime  : ${runtimeStr}
  Avg sessions/min: ${avgSessionsPerMin}
`);

    process.exit(0);
  }

  process.on("SIGINT", triggerShutdown);
  process.on("SIGTERM", triggerShutdown);
}

main().catch((err) => {
  console.error("[orchestrator] Fatal error:", err);
  process.exit(1);
});

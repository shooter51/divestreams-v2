#!/usr/bin/env tsx
/**
 * Baseline Metrics Collection
 *
 * Collects pre-scale-test metrics from the test VPS:
 * - Current tenant count (via admin dashboard)
 * - Response times for key pages
 * - Health check status
 * - Database row counts per table
 */
import "dotenv/config";

const BASE_URL = process.env.SCALE_BASE_URL || "https://test.divestreams.com";
const ADMIN_URL = process.env.SCALE_ADMIN_URL || "https://admin.test.divestreams.com";
const DEMO_URL = process.env.SCALE_DEMO_URL || "https://demo.test.divestreams.com";
const ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD!;

interface Metric {
  name: string;
  value: string | number;
  unit?: string;
}

const metrics: Metric[] = [];

function addMetric(name: string, value: string | number, unit?: string) {
  metrics.push({ name, value, unit });
  console.log(`  ${name}: ${value}${unit ? ` ${unit}` : ""}`);
}

async function measureResponseTime(url: string, label: string): Promise<number> {
  const start = performance.now();
  try {
    const res = await fetch(url, { redirect: "follow" });
    const elapsed = Math.round(performance.now() - start);
    addMetric(`${label} response time`, elapsed, "ms");
    addMetric(`${label} status`, res.status);
    return elapsed;
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    addMetric(`${label} response time`, elapsed, "ms");
    addMetric(`${label} status`, `ERROR: ${err}`);
    return elapsed;
  }
}

// Simple cookie-based session for admin
class AdminClient {
  private cookies: Map<string, string> = new Map();

  private buildCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  private storeCookies(response: Response): void {
    const setCookieHeaders: string[] =
      typeof (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function"
        ? (response.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
        : [response.headers.get("set-cookie")].filter(Boolean) as string[];

    for (const header of setCookieHeaders) {
      const firstSegment = header.split(";")[0].trim();
      const eqIndex = firstSegment.indexOf("=");
      if (eqIndex === -1) continue;
      const name = firstSegment.substring(0, eqIndex).trim();
      const value = firstSegment.substring(eqIndex + 1).trim();
      if (name) this.cookies.set(name, value);
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    const res = await fetch(`${ADMIN_URL}/api/auth/sign-in/email`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
      headers: {
        "Content-Type": "application/json",
        "Origin": ADMIN_URL,
      },
      redirect: "manual",
    });
    this.storeCookies(res);
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    return res.ok && !body.error;
  }

  async getHtml(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: { Cookie: this.buildCookieHeader() },
    });
    this.storeCookies(res);
    return res.text();
  }
}

async function countTenantsViaAdmin(client: AdminClient): Promise<number> {
  const html = await client.getHtml(`${ADMIN_URL}/dashboard`);
  // Count organization links in the dashboard
  const orgPattern = /href="\/organizations\/[^"]+"/g;
  const matches = html.match(orgPattern);

  // Also try table rows
  const rowPattern = /<tr[^>]*>/g;
  const rows = html.match(rowPattern);

  // Try extracting count from text like "X organizations" or "Showing X"
  const countMatch = html.match(/(\d+)\s*(?:organizations?|tenants?)/i);

  if (countMatch) return parseInt(countMatch[1]);
  if (matches) return matches.length;
  if (rows) return Math.max(0, rows.length - 1); // subtract header row
  return -1; // unknown
}

async function main() {
  console.log("=== DiveStreams Scale Test — Baseline Metrics ===");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Target: ${BASE_URL}`);
  console.log("");

  // 1. Health check
  console.log("--- Health Check ---");
  await measureResponseTime(`${BASE_URL}/api/health`, "Health endpoint");
  console.log("");

  // 2. Public page response times
  console.log("--- Public Page Response Times ---");
  await measureResponseTime(`${BASE_URL}`, "Landing page");
  await measureResponseTime(`${DEMO_URL}/site`, "Demo public site");
  await measureResponseTime(`${DEMO_URL}/site/trips`, "Demo trips page");
  await measureResponseTime(`${DEMO_URL}/site/courses`, "Demo courses page");
  await measureResponseTime(`${DEMO_URL}/site/equipment`, "Demo equipment page");
  console.log("");

  // 3. Auth & tenant page response times
  console.log("--- Tenant Page Response Times (unauthenticated → redirect) ---");
  await measureResponseTime(`${DEMO_URL}/tenant`, "Tenant dashboard (redirect)");
  await measureResponseTime(`${DEMO_URL}/tenant/tours`, "Tenant tours (redirect)");
  await measureResponseTime(`${DEMO_URL}/tenant/bookings`, "Tenant bookings (redirect)");
  console.log("");

  // 4. Admin tenant count
  console.log("--- Admin Metrics ---");
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const admin = new AdminClient();
    const loggedIn = await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    if (loggedIn) {
      addMetric("Admin login", "success");
      const tenantCount = await countTenantsViaAdmin(admin);
      addMetric("Current tenant count", tenantCount);
    } else {
      addMetric("Admin login", "FAILED");
    }
  } else {
    console.log("  Skipping admin metrics (PLATFORM_ADMIN_EMAIL/PASSWORD not set)");
  }
  console.log("");

  // 5. Summary
  console.log("=== Baseline Summary ===");
  const table = metrics.map(m => `${m.name.padEnd(40)} ${String(m.value).padStart(8)}${m.unit ? ` ${m.unit}` : ""}`).join("\n");
  console.log(table);

  // Save to file
  const report = {
    timestamp: new Date().toISOString(),
    target: BASE_URL,
    metrics: metrics.reduce((acc, m) => {
      acc[m.name] = { value: m.value, unit: m.unit };
      return acc;
    }, {} as Record<string, { value: string | number; unit?: string }>),
  };

  const fs = await import("fs");
  const path = await import("path");
  const outPath = path.join(import.meta.dirname, "baseline-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${outPath}`);
}

main().catch(err => {
  console.error("Baseline collection failed:", err);
  process.exit(1);
});

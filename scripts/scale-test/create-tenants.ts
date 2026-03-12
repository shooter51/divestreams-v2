#!/usr/bin/env tsx
/**
 * Scale Test — Create 200 Tenants via HTTP
 *
 * Creates tenants by POSTing to the admin tenant creation form action.
 * Uses the platform admin session to authenticate.
 *
 * Usage:
 *   PLATFORM_ADMIN_EMAIL=admin@divestreams.com \
 *   PLATFORM_ADMIN_PASSWORD=PlatformAdmin2026! \
 *   npx tsx scripts/scale-test/create-tenants.ts
 *
 * Options:
 *   --count=N      Number of tenants to create (default: 200)
 *   --start=N      Starting index (default: 1, for resuming)
 *   --concurrency=N  Parallel creates (default: 5)
 *   --dry-run      Print tenant configs without creating
 */
import "dotenv/config";
import { generateTenantConfigs, OWNER_PASSWORD, DEFAULT_PLAN, CREATE_CONCURRENCY, type TenantConfig } from "./config";

const ADMIN_URL = process.env.SCALE_ADMIN_URL || "https://admin.test.divestreams.com";
const ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD!;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD required");
  process.exit(1);
}

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name: string, def: string) => {
  const a = args.find(a => a.startsWith(`--${name}=`));
  return a ? a.split("=")[1] : def;
};
const count = parseInt(getArg("count", "200"));
const startIndex = parseInt(getArg("start", "1"));
const concurrency = parseInt(getArg("concurrency", String(CREATE_CONCURRENCY)));
const dryRun = args.includes("--dry-run");

class AdminClient {
  private cookies: Map<string, string> = new Map();
  private _debugShown = false;

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

  async login(): Promise<void> {
    const res = await fetch(`${ADMIN_URL}/api/auth/sign-in/email`, {
      method: "POST",
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      headers: { "Content-Type": "application/json", Origin: ADMIN_URL },
      redirect: "manual",
    });
    this.storeCookies(res);

    // Debug: show cookies received
    const cookieNames = Array.from(this.cookies.keys());
    console.log(`  [DEBUG] Cookies after login: ${cookieNames.join(", ") || "(none)"}`);

    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok || body.error) {
      throw new Error(`Admin login failed: ${JSON.stringify(body)}`);
    }
    console.log("✓ Logged in as platform admin");

    // Verify we can access the admin dashboard
    const dashRes = await fetch(`${ADMIN_URL}/dashboard`, {
      headers: { Cookie: this.buildCookieHeader() },
      redirect: "manual",
    });
    this.storeCookies(dashRes);
    console.log(`  [DEBUG] Dashboard access: ${dashRes.status} ${dashRes.headers.get("location") || ""}`);

    // If redirected to login, session is not working
    if (dashRes.status === 302 && dashRes.headers.get("location")?.includes("login")) {
      throw new Error("Session not established — redirected to login");
    }
  }

  async createTenant(config: TenantConfig): Promise<{ ok: boolean; error?: string }> {
    const formData = new FormData();
    formData.set("slug", config.slug);
    formData.set("name", config.name);
    formData.set("plan", DEFAULT_PLAN);
    formData.set("createOwnerAccount", "on");
    formData.set("ownerEmail", config.ownerEmail);
    formData.set("ownerName", config.ownerName);
    formData.set("ownerPassword", OWNER_PASSWORD);
    // Don't seed demo data — we'll do that separately with our lighter data set
    // formData.set("seedDemoData", "on");

    const res = await fetch(`${ADMIN_URL}/tenants/new`, {
      method: "POST",
      body: formData,
      redirect: "manual",
      headers: { Cookie: this.buildCookieHeader() },
    });
    this.storeCookies(res);

    // 302/303 redirect to /dashboard means success
    if (res.status === 302 || res.status === 303) {
      return { ok: true };
    }

    // Check for errors in response body
    const html = await res.text();

    // Debug: show full response for first failure
    if (!this._debugShown) {
      this._debugShown = true;
      console.log(`  [DEBUG] Status: ${res.status}, Location: ${res.headers.get("location")}`);
      // Look for error messages in the HTML
      const dangerMatches = html.match(/(?:danger|error)[^>]*>[^<]*/gi);
      if (dangerMatches) {
        console.log(`  [DEBUG] Error matches: ${dangerMatches.slice(0, 3).join(" | ")}`);
      }
      // Check if we got redirected to login
      if (html.includes("/login") || html.includes("sign in")) {
        console.log(`  [DEBUG] Appears to be a login page — session may have expired`);
      }
    }

    const errorMatch = html.match(/class="[^"]*danger[^"]*"[^>]*>([^<]+)/);
    const error = errorMatch ? errorMatch[1].trim() : `HTTP ${res.status}`;

    // "already taken" means tenant already exists — treat as success
    if (error.includes("already taken") || error.includes("already exists")) {
      return { ok: true, error: "already exists (skipped)" };
    }

    return { ok: false, error };
  }
}

async function runBatch(
  client: AdminClient,
  configs: TenantConfig[],
  concurrency: number
): Promise<{ created: number; skipped: number; failed: number }> {
  let created = 0;
  let skipped = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < configs.length; i += concurrency) {
    const batch = configs.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (config) => {
        const result = await client.createTenant(config);
        return { config, result };
      })
    );

    for (const { config, result } of results) {
      if (result.ok && result.error?.includes("already exists")) {
        skipped++;
        process.stdout.write(`  ⏭ ${config.slug} (already exists)\n`);
      } else if (result.ok) {
        created++;
        process.stdout.write(`  ✓ ${config.slug} — ${config.name}\n`);
      } else {
        failed++;
        process.stdout.write(`  ✗ ${config.slug} — ${result.error}\n`);
      }
    }

    // Progress
    const done = Math.min(i + concurrency, configs.length);
    console.log(`  --- ${done}/${configs.length} processed ---`);

    // Small delay between batches to avoid overwhelming the server
    if (i + concurrency < configs.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return { created, skipped, failed };
}

async function main() {
  // Generate enough configs to cover from startIndex through startIndex + count - 1
  const endIndex = startIndex + count - 1;
  const allConfigs = generateTenantConfigs(endIndex);
  const configs = allConfigs.filter(c => c.index >= startIndex);

  console.log(`=== Scale Test — Create Tenants ===`);
  console.log(`Target: ${ADMIN_URL}`);
  console.log(`Tenants: ${configs.length} (index ${startIndex} to ${startIndex + configs.length - 1})`);
  console.log(`Plan: ${DEFAULT_PLAN}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Owner password: ${OWNER_PASSWORD}`);
  console.log("");

  if (dryRun) {
    console.log("--- Dry Run (no tenants will be created) ---");
    for (const config of configs.slice(0, 10)) {
      console.log(`  ${config.slug} — ${config.name} (${config.ownerEmail})`);
    }
    if (configs.length > 10) {
      console.log(`  ... and ${configs.length - 10} more`);
    }
    return;
  }

  const client = new AdminClient();
  await client.login();

  const startTime = Date.now();
  const { created, skipped, failed } = await runBatch(client, configs, concurrency);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("");
  console.log(`=== Done in ${elapsed}s ===`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped: ${skipped} (already existed)`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Total:   ${configs.length}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Create tenants failed:", err);
  process.exit(1);
});

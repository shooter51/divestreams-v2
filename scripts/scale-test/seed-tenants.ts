#!/usr/bin/env tsx
/**
 * Scale Test — Seed 200 Tenants with Data via HTTP
 *
 * Seeds each tenant with a lighter data set via form action POSTs:
 * - 3 boats, 5 dive sites, 4 tours, 3 equipment items
 * - 10 customers, 5 trips (~20 future + past), 10+ bookings
 * - 5 products, org settings
 *
 * Usage:
 *   npx tsx scripts/scale-test/seed-tenants.ts
 *
 * Options:
 *   --count=N        Number of tenants (default: 200)
 *   --start=N        Starting index (default: 1)
 *   --concurrency=N  Parallel seeds (default: 3)
 *   --dry-run        Print what would be seeded
 */
import "dotenv/config";
import {
  generateTenantConfigs,
  OWNER_PASSWORD,
  SEED_CONCURRENCY,
  SCALE_TOURS,
  SCALE_BOATS,
  SCALE_DIVE_SITES,
  SCALE_EQUIPMENT,
  SCALE_CUSTOMERS,
  SCALE_PRODUCTS,
  type TenantConfig,
} from "./config";

const BASE_DOMAIN = process.env.SCALE_BASE_DOMAIN || "test.divestreams.com";
// Optional: set SCALE_PROXY_URL=http://localhost:13000 to bypass TLS via SSH tunnel
const PROXY_URL = process.env.SCALE_PROXY_URL || "";

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name: string, def: string) => {
  const a = args.find(a => a.startsWith(`--${name}=`));
  return a ? a.split("=")[1] : def;
};
const count = parseInt(getArg("count", "200"));
const startIndex = parseInt(getArg("start", "1"));
const concurrency = parseInt(getArg("concurrency", String(SEED_CONCURRENCY)));
const dryRun = args.includes("--dry-run");

// ============================================================================
// SeedClient (simplified from scripts/seed-api/client.ts)
// ============================================================================

class SeedClient {
  baseUrl: string;
  private proxyUrl: string;
  private hostHeader: string;
  private cookies: Map<string, string> = new Map();
  private csrfToken: string | null = null;
  private csrfTokenExpiry: number = 0;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    if (PROXY_URL) {
      // Use proxy URL for actual requests, send Host header for routing
      const url = new URL(baseUrl);
      this.proxyUrl = PROXY_URL;
      this.hostHeader = url.hostname;
    } else {
      this.proxyUrl = baseUrl;
      this.hostHeader = "";
    }
  }

  private fetchUrl(path: string): string {
    return `${this.proxyUrl}${path}`;
  }

  private addHostHeader(headers: Record<string, string>): Record<string, string> {
    if (this.hostHeader) {
      headers["Host"] = this.hostHeader;
    }
    return headers;
  }

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

  async getHtml(path: string): Promise<string> {
    const res = await fetch(this.fetchUrl(path), {
      headers: this.addHostHeader({ Cookie: this.buildCookieHeader() }),
      signal: AbortSignal.timeout(30_000),
    });
    this.storeCookies(res);
    return res.text();
  }

  async post(path: string, formData: FormData): Promise<{ ok: boolean; status: number; location: string | null; html: string }> {
    const res = await fetch(this.fetchUrl(path), {
      method: "POST",
      body: formData,
      redirect: "manual",
      headers: this.addHostHeader({ Cookie: this.buildCookieHeader() }),
      signal: AbortSignal.timeout(30_000),
    });
    this.storeCookies(res);
    const html = await res.text();
    return {
      ok: res.ok || res.status === 302 || res.status === 303,
      status: res.status,
      location: res.headers.get("location"),
      html,
    };
  }

  async postJson(path: string, body: unknown): Promise<{ ok: boolean; status: number; body: unknown }> {
    const res = await fetch(this.fetchUrl(path), {
      method: "POST",
      body: JSON.stringify(body),
      redirect: "manual",
      headers: this.addHostHeader({
        "Content-Type": "application/json",
        Origin: this.baseUrl,
        Cookie: this.buildCookieHeader(),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    this.storeCookies(res);
    let responseBody: unknown;
    try { responseBody = await res.json(); } catch { responseBody = await res.text(); }
    return { ok: res.ok, status: res.status, body: responseBody };
  }

  async getCsrfToken(): Promise<string> {
    const now = Date.now();
    if (this.csrfToken && now < this.csrfTokenExpiry) return this.csrfToken;

    const html = await this.getHtml("/tenant/tours/new");
    const re1 = /name="_csrf"[^>]*value="([^"]+)"/;
    const re2 = /value="([^"]+)"[^>]*name="_csrf"/;
    const m = html.match(re1) || html.match(re2);
    if (!m) throw new Error("Failed to scrape CSRF token");
    this.csrfToken = m[1];
    this.csrfTokenExpiry = now + 3.5 * 60 * 60 * 1000;
    return this.csrfToken;
  }

  extractId(location: string, prefix: string): string | null {
    if (!location.startsWith(prefix)) return null;
    return location.slice(prefix.length).split("?")[0].split("/")[0] || null;
  }

  parseTripIds(html: string): string[] {
    const re = /href="\/tenant\/trips\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/g;
    const ids: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      if (!ids.includes(m[1])) ids.push(m[1]);
    }
    return ids;
  }
}

// ============================================================================
// Seed Modules
// ============================================================================

async function login(client: SeedClient, email: string, password: string): Promise<void> {
  const res = await client.postJson("/api/auth/sign-in/email", { email, password });
  if (!res.ok) throw new Error(`Login failed for ${email}: HTTP ${res.status}`);
  const body = res.body as Record<string, unknown>;
  if (body?.error) throw new Error(`Login error for ${email}: ${JSON.stringify(body.error)}`);
}

async function seedOrgSettings(client: SeedClient, config: TenantConfig): Promise<void> {
  const csrf = await client.getCsrfToken();
  const fd = new FormData();
  fd.set("_csrf", csrf);
  fd.set("intent", "update-profile");
  fd.set("name", config.name);
  fd.set("email", `info@${config.slug}.test`);
  fd.set("phone", `+1-555-${String(config.index).padStart(4, "0")}`);
  fd.set("timezone", "America/New_York");
  fd.set("currency", "USD");
  fd.set("street", `${100 + config.index} Ocean Drive`);
  fd.set("city", config.location);
  fd.set("state", "FL");
  fd.set("country", "US");
  fd.set("postalCode", "33037");
  await client.post("/tenant/settings/profile", fd);
}

async function seedBoats(client: SeedClient): Promise<string[]> {
  const ids: string[] = [];
  for (const spec of SCALE_BOATS) {
    const csrf = await client.getCsrfToken();
    const fd = new FormData();
    fd.set("_csrf", csrf);
    fd.set("name", spec.name);
    fd.set("type", spec.type);
    fd.set("capacity", String(spec.capacity));
    fd.set("description", spec.description);
    fd.set("registrationNumber", spec.registrationNumber);
    fd.set("amenities", spec.amenities.join(", "));
    fd.set("isActive", "true");
    const result = await client.post("/tenant/boats/new", fd);
    if (result.ok && result.location) {
      const id = client.extractId(result.location, "/tenant/boats/");
      if (id) ids.push(id);
    }
    await sleep(30);
  }
  return ids;
}

async function seedDiveSites(client: SeedClient): Promise<string[]> {
  const ids: string[] = [];
  for (const spec of SCALE_DIVE_SITES) {
    const csrf = await client.getCsrfToken();
    const fd = new FormData();
    fd.set("_csrf", csrf);
    fd.set("name", spec.name);
    fd.set("location", spec.location);
    fd.set("description", spec.description);
    fd.set("maxDepth", String(spec.maxDepth));
    fd.set("difficulty", spec.difficulty);
    fd.set("conditions", spec.conditions);
    fd.set("latitude", String(spec.latitude));
    fd.set("longitude", String(spec.longitude));
    fd.set("highlights", spec.highlights.join(", "));
    fd.set("isActive", "true");
    const result = await client.post("/tenant/dive-sites/new", fd);
    if (result.ok && result.location) {
      const id = client.extractId(result.location, "/tenant/dive-sites/");
      if (id) ids.push(id);
    }
    await sleep(30);
  }
  return ids;
}

async function seedTours(client: SeedClient): Promise<{ id: string; name: string }[]> {
  const tours: { id: string; name: string }[] = [];
  for (const spec of SCALE_TOURS) {
    const csrf = await client.getCsrfToken();
    const fd = new FormData();
    fd.set("_csrf", csrf);
    fd.set("name", spec.name);
    fd.set("type", spec.type);
    fd.set("duration", String(spec.duration));
    fd.set("price", String(spec.price));
    fd.set("maxParticipants", String(spec.maxParticipants));
    fd.set("minParticipants", String(spec.minParticipants));
    fd.set("description", spec.description);
    fd.set("inclusionsStr", spec.inclusionsStr);
    if (spec.minCertLevel) fd.set("minCertLevel", spec.minCertLevel);
    fd.set("currency", "USD");
    const result = await client.post("/tenant/tours/new", fd);
    if (result.ok && result.location) {
      const id = client.extractId(result.location, "/tenant/tours/");
      if (id) tours.push({ id, name: spec.name });
    }
    await sleep(30);
  }
  return tours;
}

async function seedEquipment(client: SeedClient): Promise<void> {
  for (const spec of SCALE_EQUIPMENT) {
    const csrf = await client.getCsrfToken();
    const fd = new FormData();
    fd.set("_csrf", csrf);
    fd.set("category", spec.category);
    fd.set("name", spec.name);
    fd.set("brand", spec.brand);
    fd.set("model", spec.model);
    if ("size" in spec && spec.size) fd.set("size", spec.size);
    fd.set("status", "available");
    fd.set("condition", "good");
    fd.set("isRentable", spec.isRentable ? "true" : "false");
    if (spec.rentalPrice > 0) fd.set("rentalPrice", String(spec.rentalPrice));
    fd.set("isPublic", spec.isPublic ? "true" : "false");
    await client.post("/tenant/equipment/new", fd);
    await sleep(30);
  }
}

function parseCustomerIds(html: string): string[] {
  const re = /\/tenant\/customers\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;
  const ids = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  return [...ids];
}

async function seedCustomers(client: SeedClient): Promise<{ id: string; email: string }[]> {
  for (const c of SCALE_CUSTOMERS) {
    const csrf = await client.getCsrfToken();
    const fd = new FormData();
    fd.set("_csrf", csrf);
    fd.set("firstName", c.firstName);
    fd.set("lastName", c.lastName);
    fd.set("email", c.email);
    fd.set("phone", c.phone);
    fd.set("dateOfBirth", c.dateOfBirth);
    fd.set("emergencyContactName", c.emergencyContactName);
    fd.set("emergencyContactPhone", c.emergencyContactPhone);
    fd.set("emergencyContactRelation", c.emergencyContactRelation);
    if (c.certAgency) fd.set("certAgency", c.certAgency);
    if (c.certLevel) fd.set("certLevel", c.certLevel);
    await client.post("/tenant/customers/new", fd);
    await sleep(30);
  }

  const html = await client.getHtml("/tenant/customers");
  const ids = parseCustomerIds(html);
  return SCALE_CUSTOMERS.map((c, i) => ({ id: ids[i] ?? "", email: c.email }));
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

async function seedTrips(
  client: SeedClient,
  tours: { id: string; name: string }[]
): Promise<{ id: string; isPast: boolean }[]> {
  // 2 past + 3 future per tour
  const tripSpecs: { tourId: string; date: string; startTime: string; endTime: string; maxP: number; isPast: boolean }[] = [];

  for (let i = 0; i < tours.length; i++) {
    const tour = tours[i];
    // Past trips
    tripSpecs.push({ tourId: tour.id, date: daysAgo(30 + i * 14), startTime: "08:00", endTime: "12:00", maxP: 8, isPast: true });
    tripSpecs.push({ tourId: tour.id, date: daysAgo(60 + i * 7), startTime: "08:00", endTime: "12:00", maxP: 8, isPast: true });
    // Future trips
    tripSpecs.push({ tourId: tour.id, date: daysFromNow(14 + i * 7), startTime: "08:00", endTime: "12:00", maxP: 8, isPast: false });
    tripSpecs.push({ tourId: tour.id, date: daysFromNow(35 + i * 7), startTime: "08:00", endTime: "12:00", maxP: 8, isPast: false });
    tripSpecs.push({ tourId: tour.id, date: daysFromNow(56 + i * 7), startTime: "08:00", endTime: "12:00", maxP: 8, isPast: false });
  }

  for (const spec of tripSpecs) {
    const csrf = await client.getCsrfToken();
    const fd = new FormData();
    fd.set("_csrf", csrf);
    fd.set("tourId", spec.tourId);
    fd.set("date", spec.date);
    fd.set("startTime", spec.startTime);
    fd.set("endTime", spec.endTime);
    fd.set("maxParticipants", String(spec.maxP));
    fd.set("isPublic", "true");
    fd.set("isRecurring", "false");
    await client.post("/tenant/trips/new", fd);
    await sleep(30);
  }

  // Scrape future trip IDs
  const html = await client.getHtml("/tenant/trips");
  const ids = client.parseTripIds(html);
  return ids.map(id => ({ id, isPast: false }));
}

async function seedBookings(
  client: SeedClient,
  customers: { id: string; email: string }[],
  trips: { id: string; isPast: boolean }[]
): Promise<number> {
  const futureTrips = trips.filter(t => !t.isPast);
  if (futureTrips.length === 0 || customers.length === 0) return 0;

  let bookingCount = 0;
  const usedPairs = new Set<string>();

  // 2 bookings per future trip
  for (let i = 0; i < futureTrips.length; i++) {
    const trip = futureTrips[i];
    for (let j = 0; j < 2; j++) {
      const customer = customers[(i * 2 + j) % customers.length];
      if (!customer.id) continue;
      const key = `${customer.id}:${trip.id}`;
      if (usedPairs.has(key)) continue;
      usedPairs.add(key);

      const csrf = await client.getCsrfToken();
      const fd = new FormData();
      fd.set("_csrf", csrf);
      fd.set("customerId", customer.id);
      fd.set("tripId", trip.id);
      fd.set("participants", "1");
      fd.set("source", "direct");
      const result = await client.post("/tenant/bookings/new", fd);
      if (result.ok) bookingCount++;
      await sleep(30);
    }
  }
  return bookingCount;
}

async function seedProducts(client: SeedClient): Promise<void> {
  for (const spec of SCALE_PRODUCTS) {
    const csrf = await client.getCsrfToken();
    const fd = new FormData();
    fd.set("_csrf", csrf);
    fd.set("name", spec.name);
    fd.set("category", spec.category);
    fd.set("price", String(spec.price));
    fd.set("sku", spec.sku);
    fd.set("description", spec.description);
    if (spec.trackInventory) fd.set("trackInventory", "on");
    if ("stockQuantity" in spec && spec.stockQuantity) fd.set("stockQuantity", String(spec.stockQuantity));
    if ("lowStockThreshold" in spec && spec.lowStockThreshold) fd.set("lowStockThreshold", String(spec.lowStockThreshold));
    await client.post("/tenant/pos/products/new", fd);
    await sleep(30);
  }
}

// ============================================================================
// Orchestrator
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

interface SeedResult {
  slug: string;
  success: boolean;
  boats: number;
  diveSites: number;
  tours: number;
  equipment: number;
  customers: number;
  trips: number;
  bookings: number;
  products: number;
  durationMs: number;
  error?: string;
}

async function seedOneTenant(config: TenantConfig): Promise<SeedResult> {
  const tenantUrl = `https://${config.slug}.${BASE_DOMAIN}`;
  const client = new SeedClient(tenantUrl);
  const start = Date.now();

  const result: SeedResult = {
    slug: config.slug,
    success: false,
    boats: 0, diveSites: 0, tours: 0, equipment: 0,
    customers: 0, trips: 0, bookings: 0, products: 0,
    durationMs: 0,
  };

  try {
    // Login as tenant owner
    await login(client, config.ownerEmail, OWNER_PASSWORD);

    // Seed in sequence (each step depends on prior state)
    await seedOrgSettings(client, config);

    const boatIds = await seedBoats(client);
    result.boats = boatIds.length;

    const siteIds = await seedDiveSites(client);
    result.diveSites = siteIds.length;

    const tours = await seedTours(client);
    result.tours = tours.length;

    await seedEquipment(client);
    result.equipment = SCALE_EQUIPMENT.length;

    const customers = await seedCustomers(client);
    result.customers = customers.filter(c => c.id).length;

    const trips = await seedTrips(client, tours);
    result.trips = trips.length;

    const bookings = await seedBookings(client, customers, trips);
    result.bookings = bookings;

    await seedProducts(client);
    result.products = SCALE_PRODUCTS.length;

    result.success = true;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  result.durationMs = Date.now() - start;
  return result;
}

async function main() {
  const endIndex = startIndex + count - 1;
  const allConfigs = generateTenantConfigs(endIndex);
  const configs = allConfigs.filter(c => c.index >= startIndex);

  console.log(`=== Scale Test — Seed Tenants ===`);
  console.log(`Domain: ${BASE_DOMAIN}`);
  console.log(`Tenants: ${configs.length} (index ${startIndex} to ${startIndex + configs.length - 1})`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Data per tenant: ${SCALE_BOATS.length} boats, ${SCALE_DIVE_SITES.length} sites, ${SCALE_TOURS.length} tours, ${SCALE_EQUIPMENT.length} equipment, ${SCALE_CUSTOMERS.length} customers, ${SCALE_PRODUCTS.length} products`);
  console.log("");

  if (dryRun) {
    console.log("--- Dry Run ---");
    for (const c of configs.slice(0, 5)) {
      console.log(`  ${c.slug}.${BASE_DOMAIN} — login as ${c.ownerEmail}`);
    }
    if (configs.length > 5) console.log(`  ... and ${configs.length - 5} more`);
    return;
  }

  const startTime = Date.now();
  const results: SeedResult[] = [];
  let completed = 0;

  // Process in concurrent batches
  for (let i = 0; i < configs.length; i += concurrency) {
    const batch = configs.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(c => seedOneTenant(c)));

    for (const r of batchResults) {
      results.push(r);
      completed++;
      const status = r.success ? "✓" : "✗";
      const details = r.success
        ? `${r.boats}B ${r.diveSites}S ${r.tours}T ${r.equipment}E ${r.customers}C ${r.trips}Tr ${r.bookings}Bk ${r.products}P (${(r.durationMs / 1000).toFixed(1)}s)`
        : r.error?.substring(0, 80);
      console.log(`  ${status} [${completed}/${configs.length}] ${r.slug} — ${details}`);
    }

    // Breathing room between batches
    if (i + concurrency < configs.length) {
      await sleep(500);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = results.length > 0
    ? (results.reduce((sum, r) => sum + r.durationMs, 0) / results.length / 1000).toFixed(1)
    : "0";

  console.log("");
  console.log(`=== Done in ${elapsed}s ===`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Avg seed time: ${avgDuration}s per tenant`);

  if (failed > 0) {
    console.log("");
    console.log("  Failed tenants:");
    for (const r of results.filter(r => !r.success)) {
      console.log(`    ${r.slug}: ${r.error}`);
    }
    process.exit(1);
  }

  // Save results
  const fs = await import("fs");
  const path = await import("path");
  const outPath = path.join(import.meta.dirname, "seed-results.json");
  fs.writeFileSync(outPath, JSON.stringify({ timestamp: new Date().toISOString(), elapsed, results }, null, 2));
  console.log(`\nResults saved to: ${outPath}`);
}

main().catch(err => {
  console.error("Seed tenants failed:", err);
  process.exit(1);
});

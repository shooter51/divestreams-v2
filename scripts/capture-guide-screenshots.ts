/**
 * Capture screenshots for the DiveStreams user guide.
 * 
 * Usage:
 *   npx tsx scripts/capture-guide-screenshots.ts [base-url]
 * 
 * Default base-url: https://demo.test.divestreams.com
 * 
 * The script navigates to each major section of the app and saves
 * screenshots to public/guide/screenshots/.
 * 
 * Prerequisites:
 *   - You must be logged in to the target environment, OR
 *   - Set GUIDE_EMAIL and GUIDE_PASSWORD environment variables
 */

import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, "../public/guide/screenshots");

const BASE_URL = process.argv[2] ?? "https://demo.test.divestreams.com";
const EMAIL = process.env.GUIDE_EMAIL ?? "e2e-tester@demo.com";
const PASSWORD = process.env.GUIDE_PASSWORD ?? "TestPassword123!";

const pages: Array<{ filename: string; path: string }> = [
  { filename: "dashboard.png", path: "/tenant" },
  { filename: "tours-list.png", path: "/tenant/tours" },
  { filename: "trips-list.png", path: "/tenant/trips" },
  { filename: "bookings-list.png", path: "/tenant/bookings" },
  { filename: "customers-list.png", path: "/tenant/customers" },
  { filename: "equipment-list.png", path: "/tenant/equipment" },
  { filename: "training-dashboard.png", path: "/tenant/training" },
  { filename: "reports.png", path: "/tenant/reports" },
  { filename: "settings.png", path: "/tenant/settings" },
];

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Log in
  console.log(`Logging in to ${BASE_URL}...`);
  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('[name="email"]', EMAIL);
  await page.fill('[name="password"]', PASSWORD);
  await page.click('[type="submit"]');
  await page.waitForURL(/\/tenant/);
  console.log("Logged in.");

  for (const { filename, path: pagePath } of pages) {
    console.log(`Capturing ${filename}...`);
    await page.goto(`${BASE_URL}${pagePath}`);
    await page.waitForLoadState("networkidle");
    const outputPath = path.join(SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: outputPath, fullPage: true });
    console.log(`  -> saved ${outputPath}`);
  }

  // Capture detail pages (use first available item)
  console.log("Capturing tour-detail.png...");
  await page.goto(`${BASE_URL}/tenant/tours`);
  await page.waitForLoadState("networkidle");
  const firstTourLink = page.locator("table tbody tr:first-child a").first();
  const tourHref = await firstTourLink.getAttribute("href");
  if (tourHref) {
    await page.goto(`${BASE_URL}${tourHref}`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "tour-detail.png"), fullPage: true });
    console.log("  -> saved tour-detail.png");
  }

  console.log("Capturing trip-detail.png...");
  await page.goto(`${BASE_URL}/tenant/trips`);
  await page.waitForLoadState("networkidle");
  const firstTripLink = page.locator("main a[href*='/tenant/trips/']").first();
  const tripHref = await firstTripLink.getAttribute("href");
  if (tripHref) {
    await page.goto(`${BASE_URL}${tripHref}`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "trip-detail.png"), fullPage: true });
    console.log("  -> saved trip-detail.png");
  }

  await browser.close();
  console.log("\nDone! All screenshots saved to public/guide/screenshots/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

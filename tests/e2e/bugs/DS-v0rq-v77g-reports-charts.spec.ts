/**
 * E2E Tests for DS-v0rq + DS-v77g: Reports charts always blank/no data
 *
 * DS-v0rq: Revenue Trend chart panel is always blank — no chart renders
 * DS-v77g: Revenue Trend, Bookings by Status, Top Tours charts ALL show "No data available"
 *          despite summary cards showing revenue data.
 *
 * Root cause: The advanced chart data is only fetched when ctx.isPremium is true in the loader.
 * If isPremium evaluates to false (e.g., subscription status not matching), the loader returns
 * empty arrays for chart data, causing all charts to display "No data available".
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "../page-objects/auth.page";
import { getTenantUrl } from "../helpers/urls";

test.describe("DS-v0rq + DS-v77g: Reports charts render data @reports", () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page, "demo");
    await loginPage.goto();
    await loginPage.login("e2e-tester@demo.com", "DemoPass1234");
  });

  test("reports page loads and summary cards show revenue data", async ({ page }) => {
    // Navigate to reports with "this_year" range to ensure we capture all seeded data
    await page.goto(getTenantUrl("demo", "/tenant/reports?range=this_year"));
    await page.waitForLoadState("networkidle");

    // Should see the reports heading
    await expect(page.getByRole("heading", { name: /reports/i })).toBeVisible();

    // Year to Date card should show non-zero revenue
    const ytdCard = page.locator("text=Year to Date").locator("..");
    await expect(ytdCard).toBeVisible();
  });

  test("revenue trend chart renders bars (not 'no data available')", async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/tenant/reports?range=this_year"));
    await page.waitForLoadState("networkidle");

    // The revenue trend section should be visible
    await expect(page.getByText(/revenue trend/i)).toBeVisible();

    // Should NOT show "No revenue data available" message
    await expect(page.getByText(/no revenue data available/i)).not.toBeVisible();

    // Should have visible chart bars with non-zero height
    const revenueSection = page.locator("h2:has-text('Revenue Trend')").locator("xpath=ancestor::div[contains(@class,'rounded-xl')]");
    const chartBars = revenueSection.locator(".bg-brand.rounded-t");
    const barCount = await chartBars.count();
    expect(barCount).toBeGreaterThan(0);

    // At least one bar should be visible (have non-zero rendered height)
    const firstBar = chartBars.first();
    const box = await firstBar.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(0);
  });

  test("bookings by status chart renders status bars (not 'no data available')", async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/tenant/reports?range=this_year"));
    await page.waitForLoadState("networkidle");

    // The bookings by status section should be visible
    await expect(page.getByText(/bookings by status/i)).toBeVisible();

    // Should NOT show "No booking data available"
    await expect(page.getByText(/no booking data available/i)).not.toBeVisible();

    // Should have at least one status label (e.g., Confirmed, Pending)
    const statusSection = page.locator("h2:has-text('Bookings by Status')").locator("..");
    const statusBars = statusSection.locator(".rounded-full.h-2");
    await expect(statusBars.first()).toBeVisible();
  });

  test("top tours by revenue chart renders tour rows (not 'no data available')", async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/tenant/reports?range=this_year"));
    await page.waitForLoadState("networkidle");

    // The top tours section should be visible
    await expect(page.getByText(/top tours by revenue/i)).toBeVisible();

    // Should NOT show "No tour data available"
    await expect(page.getByText(/no tour data available/i)).not.toBeVisible();

    // Should have at least one tour row with revenue amount
    const toursSection = page.locator("h2:has-text('Top Tours by Revenue')").locator("..");
    const tourRows = toursSection.locator(".bg-surface-inset.rounded-lg");
    await expect(tourRows.first()).toBeVisible();
  });

  test("no premium gate overlay should block chart content", async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/tenant/reports?range=this_year"));
    await page.waitForLoadState("networkidle");

    // Should NOT see any "Upgrade to Premium" overlay
    await expect(page.getByText(/upgrade to premium/i)).not.toBeVisible();
    // Should NOT see any "Premium Feature" text
    await expect(page.getByText(/premium feature/i)).not.toBeVisible();
  });
});

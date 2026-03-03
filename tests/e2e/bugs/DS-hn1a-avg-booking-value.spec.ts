/**
 * DS-hn1a: Reports Avg Booking Value shows $0
 *
 * Bug: avgBookingValue was computed from current period only. When no bookings
 * fall in the selected period (e.g. "this month" with only historical demo data),
 * the stat always showed $0.
 *
 * Fix: When the current period has no bookings, fall back to the all-time
 * average booking value so the stat always shows a meaningful number.
 */

import { test, expect } from "@playwright/test";
import { getTenantUrl } from "../helpers/urls";

test.describe("DS-hn1a: Avg Booking Value shows non-zero when bookings exist", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/auth/login"));
    await page.waitForLoadState("load");
    await page.getByRole("textbox", { name: /email/i }).fill("e2e-tester@demo.com");
    await page.locator('input[type="password"]').first().fill("DemoPass1234");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForLoadState("load");
  });

  test("Avg Booking Value stat card is visible on reports page", async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/tenant/reports"));
    await page.waitForLoadState("networkidle");

    const avgLabel = page.locator("p:has-text('Avg Booking Value')");
    await expect(avgLabel).toBeVisible({ timeout: 10000 });
  });

  test("Avg Booking Value shows a non-zero dollar amount when bookings exist", async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/tenant/reports"));
    await page.waitForLoadState("networkidle");

    // Find the Avg Booking Value card
    const avgLabel = page.locator("p:has-text('Avg Booking Value')");
    await expect(avgLabel).toBeVisible({ timeout: 10000 });

    // Get the dollar amount shown in the card (sibling p with text-2xl)
    const avgCard = avgLabel.locator("..");
    const amountEl = avgCard.locator("p").first();
    const amountText = await amountEl.textContent();

    // Should be a currency value
    expect(amountText).toMatch(/\$[\d,]+/);

    // Should NOT be $0 when there are bookings in the demo data
    expect(amountText?.trim()).not.toBe("$0.00");
    expect(amountText?.trim()).not.toBe("$0");
  });
});

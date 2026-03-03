/**
 * DS-gme9: Trip detail shows raw time "08:00:00" instead of "8:00 AM"
 * DS-cal8: Training shows raw ISO date instead of formatted date
 *
 * BUG (DS-gme9): Trip detail page shows time in raw HH:MM:SS format (e.g., "08:00:00")
 * instead of human-readable 12-hour format (e.g., "8:00 AM").
 *
 * BUG (DS-cal8): Training sessions list shows raw ISO date (e.g., "2024-01-15")
 * instead of formatted date (e.g., "January 15, 2024").
 *
 * REPRODUCTION (DS-gme9):
 * 1. Navigate to a trip detail page
 * 2. Observe that time is shown as "08:00:00" format
 *
 * REPRODUCTION (DS-cal8):
 * 1. Navigate to /tenant/training
 * 2. Observe that session dates are shown as ISO format "2024-01-15"
 *
 * FIX: Use formatTime() for time display; use toLocaleDateString() for date display
 */

import { test, expect } from "@playwright/test";
import { getTenantUrl } from "../helpers/urls";

async function loginAsTenantUser(page: import("@playwright/test").Page) {
  await page.goto(getTenantUrl("demo", "/auth/login"));
  await page.waitForLoadState("load");
  await page.getByRole("textbox", { name: /email/i }).fill("e2e-tester@demo.com");
  await page.locator('input[type="password"]').first().fill("DemoPass1234");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForLoadState("load");
}

test.describe("DS-gme9: Trip detail time formatting", () => {
  test("trip detail shows formatted time not raw HH:MM:SS", async ({ page }) => {
    await loginAsTenantUser(page);

    // Navigate to trips list to find a trip
    await page.goto(getTenantUrl("demo", "/tenant/trips"));
    await page.waitForLoadState("load");

    // Find a trip link and click it
    const tripLinks = page.locator("a[href*='/tenant/trips/']").filter({ hasText: /\w+/ });
    const count = await tripLinks.count();

    if (count === 0) {
      test.skip(true, "No trips found to test");
      return;
    }

    await tripLinks.first().click();
    await page.waitForLoadState("load");

    // Check that time is NOT shown in raw HH:MM:SS format
    // Raw format would match pattern like "08:00:00" or "8:00:00"
    const pageText = await page.locator("body").textContent() ?? "";

    // Should not contain raw time format like "08:00:00"
    expect(pageText).not.toMatch(/\b\d{2}:\d{2}:\d{2}\b/);

    // Should contain AM/PM format
    expect(pageText).toMatch(/\d+:\d{2}\s*(AM|PM)/);
  });
});

test.describe("DS-cal8: Training session date formatting", () => {
  test("training sessions show formatted dates not ISO format", async ({ page }) => {
    await loginAsTenantUser(page);

    await page.goto(getTenantUrl("demo", "/tenant/training"));
    await page.waitForLoadState("load");

    // Check if there are any upcoming sessions
    const sessionLinks = page.locator("a[href*='/tenant/training/sessions/']");
    const count = await sessionLinks.count();

    if (count === 0) {
      // No sessions - just verify page loaded
      await expect(page.locator("h1")).toContainText(/training/i);
      return;
    }

    // The page text should not contain raw ISO date format (YYYY-MM-DD)
    // for session dates in the upcoming sessions list
    const upcomingSection = page.locator("h2").filter({ hasText: /upcoming training sessions/i })
      .locator("..");

    const sectionText = await upcomingSection.textContent() ?? "";

    // Should NOT show bare ISO dates like "2024-01-15"
    // (A formatted date like "January 15, 2024" is acceptable)
    const isoDatePattern = /\b\d{4}-\d{2}-\d{2}\b/;
    expect(sectionText).not.toMatch(isoDatePattern);
  });
});

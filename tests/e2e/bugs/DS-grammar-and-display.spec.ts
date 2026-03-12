/**
 * DS-u7p6: "1 trips run" wrong pluralization
 * DS-npcw: "1 bookings" wrong pluralization
 * DS-1rz5: Half capacity legend dot missing in calendar
 * DS-cxo1: "No boat assigned" link goes to wrong URL
 *
 * These display/grammar defects are grouped into a single spec file.
 */

import { test, expect } from "@playwright/test";
import { getTenantUrl } from "../helpers/urls";

async function loginAsTenantUser(page: import("@playwright/test").Page) {
  await page.goto(getTenantUrl("demo", "/auth/login"));
  await page.waitForLoadState("load");
  await page.getByRole("textbox", { name: /email/i }).fill("e2e-tester@demo.com");
  await page.locator('input[type="password"]').first().fill("DemoPass1234");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/tenant/, { timeout: 15000 });
}

test.describe("DS-u7p6: Tours list trip count pluralization", () => {
  test("tours show correct pluralization for trip count", async ({ page }) => {
    await loginAsTenantUser(page);
    await page.goto(getTenantUrl("demo", "/tenant/tours"));
    await page.waitForLoadState("load");

    // Check that the page does NOT contain "1 trips run"
    // It should either be "0 trips run", "1 trip run", or "N trips run"
    const pageText = await page.locator("main").textContent() ?? "";
    expect(pageText).not.toMatch(/\b1 trips run\b/);

    // Verify the singular form "1 trip run" would be correct if count is 1
    // The pattern "X trip(s) run" should always be grammatically correct
    const tripRunMatches = pageText.match(/\d+ trips? run/g) ?? [];
    for (const match of tripRunMatches) {
      const count = parseInt(match, 10);
      if (count === 1) {
        // Singular form should be used — "trip" not "trips"
        expect(match).not.toContain("trips");
        expect(match).toContain("trip run");
      } else {
        expect(match).toMatch(/^\d+ trips run$/);
      }
    }
  });
});

test.describe("DS-npcw: Reports bookings pluralization", () => {
  test("reports tooltip shows correct bookings pluralization", async ({ page }) => {
    await loginAsTenantUser(page);
    await page.goto(getTenantUrl("demo", "/tenant/reports"));
    await page.waitForLoadState("load");

    // The page should load successfully
    await expect(page.locator("main h1").first()).toContainText(/reports/i);

    // Check that "1 bookings" doesn't appear anywhere on the page
    const pageText = await page.locator("main").textContent() ?? "";
    expect(pageText).not.toMatch(/\b1 bookings\b/);
  });
});

test.describe("DS-1rz5: Calendar legend has Half capacity dot", () => {
  test("calendar legend shows half capacity dot", async ({ page }) => {
    await loginAsTenantUser(page);
    await page.goto(getTenantUrl("demo", "/tenant/calendar"));
    await page.waitForLoadState("load");

    // Find the legend section
    await expect(page.locator("body")).toContainText(/Capacity/i);
    await expect(page.locator("body")).toContainText(/Half/i);

    // The "Half" legend item should have a dot (span with rounded-full class)
    const halfLegendItem = page.locator("span").filter({ hasText: /^Half$/ }).locator("..");
    await expect(halfLegendItem).toBeVisible();

    // The dot should exist before the "Half" text
    const dot = halfLegendItem.locator("span.rounded-full").first();
    await expect(dot).toBeVisible();
  });
});

test.describe("DS-cxo1: No boat assigned links to edit page", () => {
  test("trip with no boat shows link to edit page", async ({ page }) => {
    await loginAsTenantUser(page);
    await page.goto(getTenantUrl("demo", "/tenant/trips"));
    await page.waitForLoadState("load");

    const tripLinks = page.locator("a[href*='/tenant/trips/']").filter({ hasText: /\w+/ });
    const count = await tripLinks.count();

    if (count === 0) {
      test.skip(true, "No trips found");
      return;
    }

    // Click the first trip
    const firstTripLink = tripLinks.first();
    const href = await firstTripLink.getAttribute("href");
    await firstTripLink.click();
    await page.waitForLoadState("load");

    // If there's a "No boat assigned" link, it should point to the edit page
    const noBoatLink = page.locator("a").filter({ hasText: /no boat assigned/i });
    const noBoatCount = await noBoatLink.count();

    if (noBoatCount > 0) {
      const linkHref = await noBoatLink.first().getAttribute("href");
      // Should link to edit page, NOT to /tenant/boats/
      expect(linkHref).toMatch(/\/tenant\/trips\/[^/]+\/edit/);
      expect(linkHref).not.toMatch(/\/tenant\/boats\//);
    } else {
      // Trip has a boat - verify the boat link points to /tenant/boats/
      const boatLink = page.locator("div").filter({ hasText: /^Boat$/ }).locator("..").locator("a");
      if (await boatLink.count() > 0) {
        const boatLinkHref = await boatLink.first().getAttribute("href");
        expect(boatLinkHref).toMatch(/\/tenant\/boats\/.+/);
      }
    }

    // If we didn't find a "No boat assigned" trip, create a note
    if (noBoatCount === 0 && href) {
      // This is acceptable - trip has a boat
    }
  });
});

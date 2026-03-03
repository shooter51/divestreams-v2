/**
 * DS-nmdt: Trip status inconsistency between list and detail views
 *
 * BUG: The trips list view computes "full" status when booked >= max capacity,
 * while the trip detail view shows the raw DB status (e.g., "open").
 * This causes the status badge to differ between list and detail views.
 *
 * REPRODUCTION:
 * 1. Find a trip in the list view that shows "Full" status
 * 2. Click through to the trip detail page
 * 3. Expected: Same "Full" status shown
 * 4. Actual: Shows "Open" or different status
 *
 * FIX: Apply the same effective status computation in the detail loader
 */

import { test, expect } from "@playwright/test";
import { getTenantUrl } from "../helpers/urls";

test.describe("DS-nmdt: Trip status consistency between list and detail", () => {
  test("trip status is consistent between list and detail views", async ({ page }) => {
    // Login
    await page.goto(getTenantUrl("demo", "/auth/login"));
    await page.waitForLoadState("load");
    await page.getByRole("textbox", { name: /email/i }).fill("e2e-tester@demo.com");
    await page.locator('input[type="password"]').first().fill("DemoPass1234");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForLoadState("load");

    // Navigate to trips list
    await page.goto(getTenantUrl("demo", "/tenant/trips"));
    await page.waitForLoadState("load");

    // Find trip rows in the list
    const tripRows = page.locator("a[href*='/tenant/trips/']").filter({ hasText: /\w+/ });
    const count = await tripRows.count();

    if (count === 0) {
      test.skip(true, "No trips to test");
      return;
    }

    // Get the first trip's status badge text and href
    const firstRow = tripRows.first();
    const tripHref = await firstRow.getAttribute("href");

    // Get any status badge within the row
    const statusBadge = firstRow.locator("[class*='badge'], span[class*='status'], [class*='rounded-full']").first();
    const listStatusText = await statusBadge.textContent().catch(() => null);

    if (!tripHref) {
      test.skip(true, "No trip href found");
      return;
    }

    // Navigate to the trip detail page
    await page.goto(getTenantUrl("demo", tripHref));
    await page.waitForLoadState("load");

    // Get the status badge in the detail view (it's next to the trip title)
    const detailStatusBadge = page.locator("h1 ~ [class*='badge'], h1 + [class*='badge'], [class*='StatusBadge']").first();
    const detailStatusText = await detailStatusBadge.textContent().catch(() => null);

    // If we found both statuses, they should match
    if (listStatusText && detailStatusText) {
      expect(detailStatusText?.toLowerCase().trim()).toBe(listStatusText?.toLowerCase().trim());
    }

    // At minimum, verify the detail page loaded successfully
    await expect(page.locator("h1")).toBeVisible();
  });
});

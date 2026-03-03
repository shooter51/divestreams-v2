/**
 * DS-r6vd: Pricing page shows empty features
 *
 * BUG: The pricing page (/pricing) shows empty feature lists when the database
 * plans have an empty features array. The page should fall back to DEFAULT_PLANS
 * features when DB plans have no features defined.
 *
 * REPRODUCTION:
 * 1. Navigate to /pricing
 * 2. Observe that pricing plan cards show empty feature lists
 *
 * FIX: Merge DEFAULT_PLANS features when DB plan has empty features array
 */

import { test, expect } from "@playwright/test";
import { getBaseUrl } from "../helpers/urls";

test.describe("DS-r6vd: Pricing page shows feature lists", () => {
  test("pricing page shows non-empty feature lists", async ({ page }) => {
    await page.goto(getBaseUrl("/pricing"));
    await page.waitForLoadState("load");

    // The pricing page should show pricing plan cards
    await expect(page.locator("h1")).toContainText(/pricing/i);

    // Each plan card should have a list of features
    const featureLists = page.locator("ul");
    const count = await featureLists.count();
    expect(count).toBeGreaterThan(0);

    // At least one feature list item should be visible
    const featureItems = page.locator("ul li");
    const itemCount = await featureItems.count();
    expect(itemCount).toBeGreaterThan(0);

    // Verify the first feature item has meaningful text
    const firstItem = featureItems.first();
    await expect(firstItem).toBeVisible();
    const text = await firstItem.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });
});

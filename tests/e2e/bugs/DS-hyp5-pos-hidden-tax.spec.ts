/**
 * E2E Tests for DS-hyp5 + DS-q2o3: POS tax rate shows 0% or is hidden
 *
 * Bug: The Cart component displays "Tax (0%)" even when products in the cart
 *      have individual taxRate values (e.g., 8.25%). The org-level taxRate defaults
 *      to 0% but the actual tax calculation uses per-product taxRates correctly.
 *      The bug is in the DISPLAY: it always shows the org-level taxRate (0%)
 *      instead of the effective tax rate being applied.
 *
 * Expected: Cart should display the actual effective tax rate being applied.
 * Actual:   Cart shows "Tax (0%)" even when items have non-zero tax rates.
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "../page-objects/auth.page";
import { POSPage } from "../page-objects/pos.page";

test.describe("DS-hyp5: POS tax rate shows 0% or is hidden @pos", () => {
  let posPage: POSPage;

  test.beforeEach(async ({ page }) => {
    posPage = new POSPage(page, "demo");
    const loginPage = new LoginPage(page, "demo");
    await loginPage.goto();
    await loginPage.login("e2e-tester@demo.com", "DemoPass1234");
    await posPage.goto();
    await posPage.expectPOSInterface();
  });

  test("tax rate should show the actual rate applied when products have per-item tax rates", async ({ page }) => {
    // Add a product (demo products have taxRate=8.25%)
    await posPage.addProductByIndex(0);
    await posPage.waitForCartUpdate();

    // The Tax display should NOT show 0%
    await expect(page.locator("text=/Tax \\(0%\\)/")).not.toBeVisible();

    // Tax line should be visible with a non-zero percentage
    const taxLine = page.locator("text=/Tax \\(/");
    await expect(taxLine).toBeVisible();
    const taxText = await taxLine.textContent();
    // Extract the percentage from "Tax (X%)"
    const match = taxText?.match(/Tax \((\d+(?:\.\d+)?)%\)/);
    expect(match).not.toBeNull();
    const displayedRate = parseFloat(match![1]);
    expect(displayedRate).toBeGreaterThan(0);
  });

  test("tax amount in cart should be non-zero when product has tax rate", async ({ page }) => {
    // Add a product (taxRate=8.25%)
    await posPage.addProductByIndex(0);
    await posPage.waitForCartUpdate();

    // Tax amount should be > $0.00
    // Find the tax row and check the dollar amount
    const cartTotals = page.locator(".border-t.space-y-2").first();
    await expect(cartTotals).toBeVisible();

    // Total should be greater than subtotal (tax is added)
    const subtotalText = await page.locator("text=/Subtotal/").locator("..").locator("span").last().textContent();
    const totalText = await page.locator("text=/^Total$/").locator("..").locator("span").last().textContent();

    const subtotal = parseFloat(subtotalText?.replace("$", "") || "0");
    const total = parseFloat(totalText?.replace("$", "") || "0");
    expect(total).toBeGreaterThan(subtotal);
  });

  test("adding multiple products should show combined effective tax rate", async ({ page }) => {
    // Add two products
    await posPage.addProductByIndex(0);
    await posPage.waitForCartUpdate();
    await posPage.addProductByIndex(1);
    await posPage.waitForCartUpdate();

    // Tax display should not be 0%
    await expect(page.locator("text=/Tax \\(0%\\)/")).not.toBeVisible();

    // Tax line should show a percentage
    const taxLine = page.locator("text=/Tax \\(/");
    await expect(taxLine).toBeVisible();
  });
});

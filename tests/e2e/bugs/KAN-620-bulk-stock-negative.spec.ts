/**
 * E2E Test for KAN-620: Bulk Update Product Stock to Minus is Possible?
 *
 * Tests that the bulk stock adjustment feature properly validates and rejects
 * adjustments that would result in negative stock.
 *
 * Bug: "Adjust by amount" mode was silently clamping to 0 instead of showing an error.
 * Fix: Added validation to reject adjustments resulting in negative stock.
 *
 * NOTE: This test uses the existing demo tenant with pre-existing products.
 * Make sure demo tenant has at least 3 products with varying stock levels.
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "../page-objects/auth.page";

test.describe("KAN-620: Bulk Stock Update Validation @critical @inventory", () => {
  const tenantSlug = "demo";

  test.beforeEach(async ({ page }) => {
    // Login to demo tenant
    const loginPage = new LoginPage(page, tenantSlug);
    await loginPage.goto();
    await loginPage.login("owner@demo.com", "demo1234");

    // Navigate to products page
    await page.goto(`http://${tenantSlug}.localhost:5173/tenant/products`);
    await page.waitForLoadState("networkidle");
  });

  test('should reject "Adjust by amount" that would result in negative stock (QA test case)', async ({
    page,
  }) => {
    // QA Test Case: Current stock 15, adjust by -25, should error (would be -10)
    // Find a product with stock >= 15 and select it

    // Get first product and its stock
    const firstProduct = page.locator('table tbody tr').first();
    const productName = await firstProduct.locator('td').nth(1).textContent();
    const stockText = await firstProduct.locator('td').nth(4).textContent();
    const currentStock = parseInt(stockText?.trim() || "0");

    // Skip test if no suitable product
    if (currentStock < 15) {
      test.skip();
      return;
    }

    // Select the product
    await firstProduct.locator('input[type="checkbox"]').check();

    // Click "Bulk Update" button
    await page.click('button:has-text("Bulk Update")');

    // Wait for modal
    await expect(page.locator('h2:has-text("Bulk Update Stock")')).toBeVisible();

    // Select "Adjust by amount" mode (should be default)
    await page.locator('input[value="adjust"]').check();

    // Enter adjustment that would result in negative (current - 25)
    const negativeAdjustment = -(currentStock + 10); // Will be negative
    await page.fill('input[name="value"]', negativeAdjustment.toString());

    // Click Update Stock button
    await page.click('button:has-text("Update Stock")');

    // Should show error message
    await expect(
      page.locator('text=/Cannot adjust stock.*would have negative stock/i')
    ).toBeVisible({ timeout: 5000 });

    // Error should mention the product name and show calculation
    await expect(page.locator(`text=/${productName}/i`)).toBeVisible();
    await expect(page.locator(`text=/current: ${currentStock}/i`)).toBeVisible();

    // Close modal
    await page.keyboard.press("Escape");

    // Stock should not have changed - verify by checking it's still the same
    await page.reload();
    await expect(firstProduct.locator('td').nth(4)).toContainText(currentStock.toString());
  });

  test('should allow "Adjust by amount" when result stays positive', async ({ page }) => {
    // Find a product with stock >= 10
    const firstProduct = page.locator('table tbody tr').first();
    const productName = await firstProduct.locator('td').nth(1).textContent();
    const stockText = await firstProduct.locator('td').nth(4).textContent();
    const currentStock = parseInt(stockText?.trim() || "0");

    if (currentStock < 10) {
      test.skip();
      return;
    }

    // Select product
    await firstProduct.locator('input[type="checkbox"]').check();

    // Open bulk update modal
    await page.click('button:has-text("Bulk Update")');
    await expect(page.locator('h2:has-text("Bulk Update Stock")')).toBeVisible();

    // Select "Adjust by amount" mode
    await page.locator('input[value="adjust"]').check();

    // Enter -5 (safe adjustment)
    await page.fill('input[name="value"]', "-5");

    // Submit
    await page.click('button:has-text("Update Stock")');

    // Should show success message (toast)
    await expect(page.locator('text=/Updated stock for 1 product/i')).toBeVisible({
      timeout: 5000,
    });

    // Verify stock changed (current - 5)
    await page.reload();
    const expectedStock = currentStock - 5;
    await expect(firstProduct.locator('td').nth(4)).toContainText(expectedStock.toString());
  });

  test('should reject "Set to value" with negative number', async ({ page }) => {
    // Select first product
    const firstProduct = page.locator('table tbody tr').first();
    await firstProduct.locator('input[type="checkbox"]').check();

    // Open bulk update modal
    await page.click('button:has-text("Bulk Update")');
    await expect(page.locator('h2:has-text("Bulk Update Stock")')).toBeVisible();

    // Select "Set to value" mode
    await page.locator('input[value="set"]').check();

    // Enter negative value
    await page.fill('input[name="value"]', "-5");

    // Submit
    await page.click('button:has-text("Update Stock")');

    // Should show error
    await expect(page.locator('text=/Cannot set stock to negative value/i')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should allow "Set to value" with zero or positive', async ({ page }) => {
    // Select first product
    const firstProduct = page.locator('table tbody tr').first();
    const originalStock = await firstProduct.locator('td').nth(4).textContent();
    await firstProduct.locator('input[type="checkbox"]').check();

    // Open bulk update modal
    await page.click('button:has-text("Bulk Update")');
    await expect(page.locator('h2:has-text("Bulk Update Stock")')).toBeVisible();

    // Select "Set to value" mode
    await page.locator('input[value="set"]').check();

    // Set to a positive value (20)
    await page.fill('input[name="value"]', "20");

    // Submit
    await page.click('button:has-text("Update Stock")');

    // Should show success
    await expect(page.locator('text=/Updated stock for 1 product/i')).toBeVisible({
      timeout: 5000,
    });

    // Verify stock is 20
    await page.reload();
    await expect(firstProduct.locator('td').nth(4)).toContainText("20");

    // Restore original stock for other tests
    await firstProduct.locator('input[type="checkbox"]').check();
    await page.click('button:has-text("Bulk Update")');
    await page.locator('input[value="set"]').check();
    await page.fill('input[name="value"]', originalStock?.trim() || "10");
    await page.click('button:has-text("Update Stock")');
    await page.waitForTimeout(1000);
  });

  test("single product adjustment should validate negative stock", async ({ page }) => {
    // Get first product
    const firstProduct = page.locator('table tbody tr').first();
    const productName = await firstProduct.locator('td').nth(1).textContent();
    const stockText = await firstProduct.locator('td').nth(4).textContent();
    const currentStock = parseInt(stockText?.trim() || "0");

    // Click the +/- button
    await firstProduct.locator('button:has-text("+/-")').click();

    // Wait for adjustment modal
    await expect(page.locator(`h2:has-text("Adjust Stock:")`)).toBeVisible();

    // Current stock should be visible
    await expect(page.locator('div:has-text("Current Stock")')).toBeVisible();

    // Enter adjustment that would go negative
    const negativeAdjustment = -(currentStock + 10);
    await page.fill('input[name="adjustment"]', negativeAdjustment.toString());

    // Submit
    await page.click('button[type="submit"]:has-text("Adjust")');

    // Should show error (via toast)
    await expect(
      page.locator('text=/Cannot adjust stock.*would result in negative stock/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test("UI should show helpful validation message", async ({ page }) => {
    // Click +/- button on first product
    const firstProduct = page.locator('table tbody tr').first();
    await firstProduct.locator('button:has-text("+/-")').click();

    await expect(page.locator('h2:has-text("Adjust Stock:")')).toBeVisible();

    // Should show updated help text (not "clamped", but "rejected")
    await expect(
      page.locator('text=/Stock cannot go below 0.*will be rejected/i')
    ).toBeVisible();
  });
});

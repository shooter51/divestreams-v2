/**
 * E2E Tests for stock validation (KAN-620)
 *
 * Tests the full user-facing flow for stock validation:
 * - Bulk update → set negative → error shown
 * - Bulk update → set 0 → success
 * - Create product with negative stock → handled
 *
 * NOTE: Uses the existing demo tenant with pre-existing products.
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "./page-objects/auth.page";
import { getTenantUrl } from "./helpers/urls";

test.describe("Stock Validation E2E @inventory @critical", () => {
  const tenantSlug = "demo";

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page, tenantSlug);
    await loginPage.goto();
    await loginPage.login("e2e-tester@demo.com", "DemoPass1234");

    await page.goto(getTenantUrl(tenantSlug, "/tenant/products"));
    await page.waitForLoadState("load");
    await page.waitForSelector("table tbody tr", { timeout: 10000 });
    await page.waitForSelector('table tbody tr input[type="checkbox"]', {
      state: "visible",
      timeout: 5000,
    });
  });

  test("bulk update set mode: negative value shows error", async ({
    page,
  }) => {
    // Select first product
    const firstProduct = page.locator("table tbody tr").first();
    await firstProduct.locator('input[type="checkbox"]').check();

    // Open bulk update modal
    await page.click('button:has-text("Bulk Update")');
    await expect(
      page.locator('h2:has-text("Bulk Update Stock")')
    ).toBeVisible();

    // Switch to "Set to value" mode
    const setRadio = page.locator('span:has-text("Set to value")');
    await setRadio.click();

    // Enter negative value
    await page.fill('input[name="value"]', "-10");

    // Submit
    await page.click('button:has-text("Update Stock")');

    // Should show error about negative value
    await expect(
      page.locator("text=/Cannot set stock to negative value/i")
    ).toBeVisible({ timeout: 5000 });
  });

  test("bulk update set mode: 0 succeeds", async ({ page }) => {
    const firstProduct = page.locator("table tbody tr").first();
    const originalStock = await firstProduct
      .locator("td")
      .nth(4)
      .textContent();
    await firstProduct.locator('input[type="checkbox"]').check();

    await page.click('button:has-text("Bulk Update")');
    await expect(
      page.locator('h2:has-text("Bulk Update Stock")')
    ).toBeVisible();

    const setRadio = page.locator('span:has-text("Set to value")');
    await setRadio.click();

    await page.fill('input[name="value"]', "0");
    await page.click('button:has-text("Update Stock")');

    // Should show success
    await expect(
      page.locator("text=/Updated stock for 1 product/i")
    ).toBeVisible({ timeout: 5000 });

    // Verify stock is 0
    await page.reload();
    await page.waitForSelector("table tbody tr", { timeout: 10000 });
    await expect(firstProduct.locator("td").nth(4)).toContainText("0");

    // Restore original stock
    await firstProduct.locator('input[type="checkbox"]').check();
    await page.click('button:has-text("Bulk Update")');
    const setRadio2 = page.locator('span:has-text("Set to value")');
    await setRadio2.click();
    await page.fill('input[name="value"]', originalStock?.trim() || "10");
    await page.click('button:has-text("Update Stock")');
    await page.waitForLoadState("load").catch(() => {});
  });

  test("create product form enforces min=0 on stock quantity field", async ({
    page,
  }) => {
    // Click "+ Add Product"
    await page.click('button:has-text("+ Add Product")');

    // Wait for modal
    await expect(
      page.locator('h2:has-text("Add Product")')
    ).toBeVisible();

    // The stock quantity input should have min="0" attribute
    const stockInput = page.locator('input[name="stockQuantity"]');
    await expect(stockInput).toBeVisible();
    const minValue = await stockInput.getAttribute("min");
    expect(minValue).toBe("0");

    // Close modal
    await page.click('button:has-text("Cancel")');
  });

  test("adjust stock modal shows validation message about negative stock rejection", async ({
    page,
  }) => {
    const firstProduct = page.locator("table tbody tr").first();
    await firstProduct.locator('button:has-text("+/-")').click();

    await expect(
      page.locator('h2:has-text("Adjust Stock:")')
    ).toBeVisible();

    // Should show the note about stock not going below 0
    await expect(
      page.locator(
        "text=/Stock cannot go below 0|cannot go below 0|will be rejected/i"
      )
    ).toBeVisible();

    // Close modal
    await page.click('button:has-text("Cancel")');
  });
});

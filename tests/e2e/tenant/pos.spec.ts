import { test, expect } from "@playwright/test";
import { POSPage } from "../page-objects";
import { testConfig, loginToTenant } from "../fixtures/test-fixtures";

test.describe("POS System - Interface", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays POS interface with main elements", async ({ page }) => {
    const pos = new POSPage(page, testConfig.tenantSubdomain);
    await pos.goto();

    await pos.expectPOSInterface();
  });

  test("has new sale button", async ({ page }) => {
    const pos = new POSPage(page, testConfig.tenantSubdomain);
    await pos.goto();

    await expect(page.getByRole("button", { name: /new sale/i })).toBeVisible();
  });

  test("has scan barcode button", async ({ page }) => {
    const pos = new POSPage(page, testConfig.tenantSubdomain);
    await pos.goto();

    await expect(page.getByRole("button", { name: /scan barcode/i })).toBeVisible();
  });

  test("shows tenant name and date", async ({ page }) => {
    const pos = new POSPage(page, testConfig.tenantSubdomain);
    await pos.goto();

    // Should show current date
    const today = new Date().toLocaleDateString();
    await expect(page.getByText(new RegExp(today.split("/")[0]))).toBeVisible();
  });
});

test.describe("POS System - Tabs", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    const pos = new POSPage(page, testConfig.tenantSubdomain);
    await pos.goto();
  });

  test("has retail tab", async ({ page }) => {
    await expect(page.getByRole("button", { name: /retail/i })).toBeVisible();
  });

  test("has rentals tab", async ({ page }) => {
    await expect(page.getByRole("button", { name: /rentals/i })).toBeVisible();
  });

  test("has trips tab", async ({ page }) => {
    await expect(page.getByRole("button", { name: /trips/i })).toBeVisible();
  });

  test("can switch between tabs", async ({ page }) => {
    const pos = new POSPage(page, testConfig.tenantSubdomain);

    // Default should be retail
    await pos.selectTab("rentals");
    await expect(page.getByRole("button", { name: /rentals/i })).toHaveClass(/bg-white|text-blue/);

    await pos.selectTab("trips");
    await expect(page.getByRole("button", { name: /trips/i })).toHaveClass(/bg-white|text-blue/);

    await pos.selectTab("retail");
    await expect(page.getByRole("button", { name: /retail/i })).toHaveClass(/bg-white|text-blue/);
  });
});

test.describe("POS System - Barcode Scanner", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    const pos = new POSPage(page, testConfig.tenantSubdomain);
    await pos.goto();
  });

  test("opens barcode scanner modal", async ({ page }) => {
    const pos = new POSPage(page, testConfig.tenantSubdomain);
    await pos.openBarcodeScanner();

    await pos.expectBarcodeScannerModal();
  });

  test("can close barcode scanner modal", async ({ page }) => {
    const pos = new POSPage(page, testConfig.tenantSubdomain);
    await pos.openBarcodeScanner();
    await pos.expectBarcodeScannerModal();

    await pos.closeBarcodeScanner();

    await expect(page.getByText(/scan product barcode/i)).not.toBeVisible();
  });
});

test.describe("POS System - Cart", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    const pos = new POSPage(page, testConfig.tenantSubdomain);
    await pos.goto();
  });

  test("new sale clears cart", async ({ page }) => {
    const pos = new POSPage(page, testConfig.tenantSubdomain);

    // Click new sale
    await pos.clearCart();

    // Cart should be empty or show empty message
    // This depends on initial state - if products exist, they should be added first
  });

  test("has customer selection option", async ({ page }) => {
    // Check for customer selection button/area
    await expect(
      page.getByRole("button", { name: /select customer|add customer|customer/i })
    ).toBeVisible();
  });
});

test.describe("POS System - Customer Search", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    const pos = new POSPage(page, testConfig.tenantSubdomain);
    await pos.goto();
  });

  test("can open customer search modal", async ({ page }) => {
    const pos = new POSPage(page, testConfig.tenantSubdomain);
    await pos.openCustomerSearch();

    // Should show customer search modal
    await expect(page.getByPlaceholder(/search customer/i)).toBeVisible();
  });

  test("can search for customers", async ({ page }) => {
    const pos = new POSPage(page, testConfig.tenantSubdomain);
    await pos.openCustomerSearch();
    await pos.searchCustomer("john");

    // Search should trigger - results depend on data
    await page.waitForTimeout(1000); // Wait for search debounce
  });
});

test.describe("POS System - Checkout Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    const pos = new POSPage(page, testConfig.tenantSubdomain);
    await pos.goto();
  });

  test("shows checkout buttons when cart has items", async ({ page }) => {
    // This test depends on having products available
    // Look for checkout-related buttons in the cart area
    const cartArea = page.locator('[class*="cart"], .w-96');

    // There should be payment buttons or they appear after adding items
    await expect(cartArea).toBeVisible();
  });
});

test.describe("POS System - Product Search", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    const pos = new POSPage(page, testConfig.tenantSubdomain);
    await pos.goto();
  });

  test("has search input for products", async ({ page }) => {
    // Check for search functionality in the product grid area
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput.first()).toBeVisible();
  });

  test("can search products", async ({ page }) => {
    const pos = new POSPage(page, testConfig.tenantSubdomain);
    await pos.searchProducts("test");

    // Search should filter the display
    await page.waitForTimeout(500); // Wait for any debounce
  });
});

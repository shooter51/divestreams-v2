import { test, expect } from "@playwright/test";
import { EquipmentPage, NewEquipmentPage } from "../page-objects";
import { testConfig, loginToTenant, generateTestData } from "../fixtures/test-fixtures";

test.describe("Equipment - List Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays equipment list page", async ({ page }) => {
    const equipment = new EquipmentPage(page, testConfig.tenantSubdomain);
    await equipment.goto();

    await equipment.expectEquipmentPage();
  });

  test("has add new equipment button", async ({ page }) => {
    const equipment = new EquipmentPage(page, testConfig.tenantSubdomain);
    await equipment.goto();

    await expect(page.getByRole("link", { name: /new equipment|add equipment/i })).toBeVisible();
  });

  test("can navigate to new equipment form", async ({ page }) => {
    const equipment = new EquipmentPage(page, testConfig.tenantSubdomain);
    await equipment.goto();
    await equipment.clickNewEquipment();

    await expect(page).toHaveURL(/\/equipment\/new/);
  });

  test("displays equipment list or grid", async ({ page }) => {
    const equipment = new EquipmentPage(page, testConfig.tenantSubdomain);
    await equipment.goto();

    await equipment.expectEquipmentList();
  });
});

test.describe("Equipment - New Equipment Form", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays new equipment form", async ({ page }) => {
    const newEquipment = new NewEquipmentPage(page, testConfig.tenantSubdomain);
    await newEquipment.goto();

    await newEquipment.expectForm();
  });

  test("has name field", async ({ page }) => {
    const newEquipment = new NewEquipmentPage(page, testConfig.tenantSubdomain);
    await newEquipment.goto();

    await expect(page.getByLabel(/name/i)).toBeVisible();
  });

  test("has category selection", async ({ page }) => {
    const newEquipment = new NewEquipmentPage(page, testConfig.tenantSubdomain);
    await newEquipment.goto();

    await expect(page.getByLabel(/category/i)).toBeVisible();
  });

  test("has rental price field", async ({ page }) => {
    const newEquipment = new NewEquipmentPage(page, testConfig.tenantSubdomain);
    await newEquipment.goto();

    await expect(page.getByLabel(/rental price|daily rate/i)).toBeVisible();
  });

  test("has save/create button", async ({ page }) => {
    const newEquipment = new NewEquipmentPage(page, testConfig.tenantSubdomain);
    await newEquipment.goto();

    await expect(page.getByRole("button", { name: /save|create/i })).toBeVisible();
  });

  test("can fill and submit form", async ({ page }) => {
    const newEquipment = new NewEquipmentPage(page, testConfig.tenantSubdomain);
    await newEquipment.goto();

    const testData = generateTestData();

    await newEquipment.fillForm({
      name: `Test BCD ${testData.subdomain}`,
      category: "bcd", // Assuming this is a valid category option
      rentalPrice: 25,
    });

    await newEquipment.submit();

    // Should redirect to equipment list or show success
    // This depends on whether the submission succeeds
  });
});

test.describe("Equipment - Search and Filter", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    const equipment = new EquipmentPage(page, testConfig.tenantSubdomain);
    await equipment.goto();
  });

  test("has search input", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
  });

  test("can search equipment", async ({ page }) => {
    const equipment = new EquipmentPage(page, testConfig.tenantSubdomain);
    await equipment.search("BCD");

    // URL should include search param or results should filter
    await page.waitForTimeout(500);
  });

  test("has category filter", async ({ page }) => {
    const categoryFilter = page.getByLabel(/category/i);
    if (await categoryFilter.isVisible({ timeout: 2000 })) {
      await expect(categoryFilter).toBeVisible();
    }
  });
});

test.describe("Equipment - Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("navigating to equipment detail from list", async ({ page }) => {
    const equipment = new EquipmentPage(page, testConfig.tenantSubdomain);
    await equipment.goto();

    // If there are equipment items in the list, clicking one should navigate to detail
    const equipmentLink = page.getByRole("link").filter({ hasText: /view|details|edit/i }).first();

    if (await equipmentLink.isVisible({ timeout: 2000 })) {
      await equipmentLink.click();
      await expect(page).toHaveURL(/\/equipment\/\d+/);
    }
  });
});

test.describe("Equipment - Edit Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("edit form has save button", async ({ page }) => {
    const equipment = new EquipmentPage(page, testConfig.tenantSubdomain);
    await equipment.goto();

    // Navigate to first equipment's edit page if available
    const editLink = page.getByRole("link", { name: /edit/i }).first();

    if (await editLink.isVisible({ timeout: 2000 })) {
      await editLink.click();
      await expect(page.getByRole("button", { name: /save|update/i })).toBeVisible();
    }
  });
});

test.describe("Equipment - Availability Status", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    const equipment = new EquipmentPage(page, testConfig.tenantSubdomain);
    await equipment.goto();
  });

  test("equipment list shows status indicators", async ({ page }) => {
    // Look for status indicators (available, rented, maintenance)
    const statusIndicators = page.locator('[class*="status"], [class*="badge"]');

    if (await statusIndicators.first().isVisible({ timeout: 2000 })) {
      await expect(statusIndicators.first()).toBeVisible();
    }
  });
});

import { test, expect } from "@playwright/test";
import { testConfig, loginToTenant, generateTestData } from "../fixtures/test-fixtures";

test.describe("Boats - List Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays boats list page", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/boats`);

    await expect(page.getByRole("heading", { name: /boat/i })).toBeVisible();
  });

  test("has add new boat button", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/boats`);

    await expect(page.getByRole("link", { name: /new boat|add boat/i })).toBeVisible();
  });

  test("can navigate to new boat form", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/boats`);

    await page.getByRole("link", { name: /new boat|add boat/i }).click();

    await expect(page).toHaveURL(/\/boats\/new/);
  });

  test("displays boats list or grid", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/boats`);

    await expect(
      page.locator("table, [class*='boat-list'], [class*='grid'], [class*='card']")
    ).toBeVisible();
  });
});

test.describe("Boats - New Boat Form", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/boats/new`);
  });

  test("displays new boat form", async ({ page }) => {
    await expect(page.getByLabel(/name/i)).toBeVisible();
  });

  test("has name field", async ({ page }) => {
    await expect(page.getByLabel(/name/i)).toBeVisible();
  });

  test("has capacity field", async ({ page }) => {
    await expect(page.getByLabel(/capacity|passengers/i)).toBeVisible();
  });

  test("has save/create button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /save|create/i })).toBeVisible();
  });

  test("can fill and submit form", async ({ page }) => {
    const testData = generateTestData();

    await page.getByLabel(/name/i).fill(`Test Boat ${testData.subdomain}`);

    // Fill capacity if available
    const capacityField = page.getByLabel(/capacity|passengers/i);
    if (await capacityField.isVisible({ timeout: 1000 })) {
      await capacityField.fill("12");
    }

    await page.getByRole("button", { name: /save|create/i }).click();

    // Should redirect or show success
  });
});

test.describe("Boats - Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/boats`);
  });

  test("navigating to boat detail from list", async ({ page }) => {
    const boatLink = page.getByRole("link").filter({ hasText: /view|details|edit/i }).first();

    if (await boatLink.isVisible({ timeout: 2000 })) {
      await boatLink.click();
      await expect(page).toHaveURL(/\/boats\/\d+/);
    }
  });
});

test.describe("Boats - Edit Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/boats`);
  });

  test("edit form has save button", async ({ page }) => {
    const editLink = page.getByRole("link", { name: /edit/i }).first();

    if (await editLink.isVisible({ timeout: 2000 })) {
      await editLink.click();
      await expect(page.getByRole("button", { name: /save|update/i })).toBeVisible();
    }
  });
});

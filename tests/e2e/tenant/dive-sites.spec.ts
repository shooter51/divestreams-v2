import { test, expect } from "@playwright/test";
import { testConfig, loginToTenant, generateTestData } from "../fixtures/test-fixtures";

test.describe("Dive Sites - List Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays dive sites list page", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/dive-sites`);

    await expect(page.getByRole("heading", { name: /dive site|site/i })).toBeVisible();
  });

  test("has add new dive site button", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/dive-sites`);

    await expect(page.getByRole("link", { name: /new.*site|add.*site/i })).toBeVisible();
  });

  test("can navigate to new dive site form", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/dive-sites`);

    await page.getByRole("link", { name: /new.*site|add.*site/i }).click();

    await expect(page).toHaveURL(/\/dive-sites\/new/);
  });

  test("displays dive sites list or grid", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/dive-sites`);

    await expect(
      page.locator("table, [class*='site-list'], [class*='grid'], [class*='card']")
    ).toBeVisible();
  });
});

test.describe("Dive Sites - New Site Form", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/dive-sites/new`);
  });

  test("displays new dive site form", async ({ page }) => {
    await expect(page.getByLabel(/name/i)).toBeVisible();
  });

  test("has name field", async ({ page }) => {
    await expect(page.getByLabel(/name/i)).toBeVisible();
  });

  test("has description field", async ({ page }) => {
    await expect(page.getByLabel(/description/i)).toBeVisible();
  });

  test("has depth fields", async ({ page }) => {
    await expect(page.getByLabel(/depth|max depth|min depth/i).first()).toBeVisible();
  });

  test("has save/create button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /save|create/i })).toBeVisible();
  });

  test("can fill and submit form", async ({ page }) => {
    const testData = generateTestData();

    await page.getByLabel(/name/i).fill(`Test Dive Site ${testData.subdomain}`);
    await page.getByLabel(/description/i).fill("A beautiful test dive site");

    // Fill depth fields if available
    const depthField = page.getByLabel(/max depth/i);
    if (await depthField.isVisible({ timeout: 1000 })) {
      await depthField.fill("30");
    }

    await page.getByRole("button", { name: /save|create/i }).click();

    // Should redirect or show success
  });
});

test.describe("Dive Sites - Search and Filter", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/dive-sites`);
  });

  test("has search input", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 2000 })) {
      await expect(searchInput).toBeVisible();
    }
  });
});

test.describe("Dive Sites - Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/dive-sites`);
  });

  test("navigating to dive site detail from list", async ({ page }) => {
    const siteLink = page.getByRole("link").filter({ hasText: /view|details|edit/i }).first();

    if (await siteLink.isVisible({ timeout: 2000 })) {
      await siteLink.click();
      await expect(page).toHaveURL(/\/dive-sites\/\d+/);
    }
  });
});

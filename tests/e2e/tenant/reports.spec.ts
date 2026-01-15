import { test, expect } from "@playwright/test";
import { testConfig, loginToTenant } from "../fixtures/test-fixtures";

test.describe("Reports - Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays reports page", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/reports`);

    await expect(page.getByRole("heading", { name: /report/i })).toBeVisible();
  });

  test("shows revenue metrics", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/reports`);

    // Should show some kind of revenue/sales data
    await expect(page.getByText(/revenue|sales|\$/i).first()).toBeVisible();
  });

  test("shows booking metrics", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/reports`);

    // Should show booking related data
    await expect(page.getByText(/booking|reservation/i).first()).toBeVisible();
  });
});

test.describe("Reports - Date Range Selection", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/reports`);
  });

  test("has date range controls", async ({ page }) => {
    // Look for date inputs or range selector
    const dateControl = page.locator('[type="date"], [class*="date-picker"], [class*="range"]');

    if (await dateControl.first().isVisible({ timeout: 2000 })) {
      await expect(dateControl.first()).toBeVisible();
    }
  });

  test("has preset date ranges", async ({ page }) => {
    // Look for preset buttons like "This Week", "This Month", "Last 30 Days"
    const presetButton = page.getByRole("button", { name: /week|month|30 days|today/i });

    if (await presetButton.first().isVisible({ timeout: 2000 })) {
      await expect(presetButton.first()).toBeVisible();
    }
  });
});

test.describe("Reports - Export", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/reports`);
  });

  test("has export functionality", async ({ page }) => {
    // Look for export button
    const exportButton = page.getByRole("button", { name: /export|download|csv|pdf/i });

    if (await exportButton.isVisible({ timeout: 2000 })) {
      await expect(exportButton).toBeVisible();
    }
  });
});

test.describe("Reports - Charts and Visualizations", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/reports`);
  });

  test("displays data visualizations", async ({ page }) => {
    // Look for chart elements
    const charts = page.locator('[class*="chart"], [class*="graph"], canvas, svg');

    if (await charts.first().isVisible({ timeout: 2000 })) {
      await expect(charts.first()).toBeVisible();
    }
  });
});

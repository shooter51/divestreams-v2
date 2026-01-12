import { test, expect } from "@playwright/test";

test.describe("Tenant Tour Management", () => {
  const tenantUrl = "http://demo.localhost:5173";

  test.beforeEach(async ({ page }) => {
    await page.goto(`${tenantUrl}/app/tours`);
  });

  test("displays tours list", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /tour/i })).toBeVisible();
    // Should show tours
    await expect(page.locator("table, [class*='card'], [class*='grid']")).toBeVisible();
  });

  test("shows tour details including price", async ({ page }) => {
    await expect(page.getByText(/\$/)).toBeVisible();
  });

  test("navigates to create tour form", async ({ page }) => {
    await page.getByRole("link", { name: /new tour|add tour/i }).click();
    await expect(page).toHaveURL(/\/tours\/new/);
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/price/i)).toBeVisible();
  });

  test("creates new tour", async ({ page }) => {
    await page.goto(`${tenantUrl}/app/tours/new`);

    await page.getByLabel(/name/i).fill("E2E Test Tour");
    await page.getByLabel(/description/i).fill("A test tour created by E2E tests");
    await page.getByLabel(/price/i).fill("150");
    await page.getByLabel(/duration/i).fill("3 hours");
    await page.getByLabel(/max participants/i).fill("8");

    await page.getByRole("button", { name: /save|create/i }).click();

    await expect(page).toHaveURL(/\/tours/);
  });

  test("views tour trips", async ({ page }) => {
    const tourLink = page.locator("table tbody tr a, [class*='card'] a").first();

    if (await tourLink.isVisible()) {
      await tourLink.click();
      // Should show trips for this tour
      await expect(page.getByText(/trip|schedule|date/i)).toBeVisible();
    }
  });

  test("can toggle tour active status", async ({ page }) => {
    const tourRow = page.locator("table tbody tr").first();

    if (await tourRow.isVisible()) {
      const activeToggle = tourRow.locator('input[type="checkbox"], button[aria-label*="active"]');

      if (await activeToggle.isVisible()) {
        await activeToggle.click();
        // Should update status
        await expect(page.getByText(/updated|saved/i)).toBeVisible();
      }
    }
  });
});

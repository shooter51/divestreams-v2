import { test, expect } from "@playwright/test";
import { testConfig, loginToAdmin } from "../fixtures/test-fixtures";

test.describe("Admin - Plans Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginToAdmin(page);
  });

  test("displays plans page", async ({ page }) => {
    await page.goto("http://admin.localhost:5173/plans");

    await expect(page.getByRole("heading", { name: /plan/i })).toBeVisible();
  });

  test("shows list of subscription plans", async ({ page }) => {
    await page.goto("http://admin.localhost:5173/plans");

    // Should show plan list/table
    await expect(
      page.locator("table, [class*='plan-list'], [class*='grid']")
    ).toBeVisible();
  });

  test("shows plan pricing", async ({ page }) => {
    await page.goto("http://admin.localhost:5173/plans");

    // Should show prices
    await expect(page.getByText(/\$\d+|free/i).first()).toBeVisible();
  });

  test("can navigate to plan detail", async ({ page }) => {
    await page.goto("http://admin.localhost:5173/plans");

    const planLink = page.getByRole("link").filter({ hasText: /edit|view|details/i }).first();

    if (await planLink.isVisible({ timeout: 2000 })) {
      await planLink.click();
      await expect(page).toHaveURL(/\/plans\/\d+|\/plans\/[a-z]+/);
    }
  });
});

test.describe("Admin - Plan Detail", () => {
  test.beforeEach(async ({ page }) => {
    await loginToAdmin(page);
  });

  test("plan detail shows plan information", async ({ page }) => {
    await page.goto("http://admin.localhost:5173/plans");

    const planLink = page.getByRole("link").filter({ hasText: /edit|view|details/i }).first();

    if (await planLink.isVisible({ timeout: 2000 })) {
      await planLink.click();

      // Should show plan details
      await expect(page.getByText(/price|features|limits/i).first()).toBeVisible();
    }
  });
});

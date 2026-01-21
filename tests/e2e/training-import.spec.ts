import { test, expect } from "./fixtures/subdomain-page";
import type { Page } from "@playwright/test";

/**
 * Training Course Import E2E Tests
 *
 * Tests the import wizard for importing training courses from agency catalogs.
 */

test.describe("Training Import", () => {
  const testData = {
    tenant: {
      subdomain: "e2etest",
    },
    user: {
      email: process.env.E2E_USER_EMAIL || "e2e-user@example.com",
      password: process.env.E2E_USER_PASSWORD || "TestPass123!",
    },
  };

  // Helper to get tenant URL
  const getTenantUrl = (path: string = "/") =>
    `http://${testData.tenant.subdomain}.localhost:5173${path}`;

  // Helper to login to tenant
  async function loginToTenant(page: Page) {
    await page.goto(getTenantUrl("/auth/login"));
    await page.getByLabel(/email/i).fill(testData.user.email);
    await page.getByLabel(/password/i).fill(testData.user.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    try {
      await page.waitForURL(/\/(app|dashboard)/, { timeout: 10000 });
    } catch {
      await page.waitForTimeout(2000);
    }
  }

  test("should display import page with agency selection", async ({ page }) => {
    // Login first
    await loginToTenant(page);

    // Navigate to import page
    await page.goto(getTenantUrl("/app/training/import"));
    await page.waitForTimeout(1500);

    // Should show page title
    await expect(page.locator("h1")).toContainText("Import Training Courses");

    // Should show agency selection section
    await expect(page.locator('text=Select Certification Agency')).toBeVisible();

    // Should have agency dropdown
    await expect(page.locator('select[name="agencyId"]')).toBeVisible();

    // Should have submit button
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
  });
});

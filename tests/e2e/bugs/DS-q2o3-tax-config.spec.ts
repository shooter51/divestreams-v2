/**
 * DS-q2o3: No tax rate configuration in settings
 *
 * BUG: The POS applies tax rates (per-product or org-level) but there is no
 * UI for admins to view or configure the org-level tax rate. The
 * organization_settings table has taxRate, taxName, and taxIncludedInPrice
 * columns but no settings page exposes them.
 *
 * FIX: Add a Tax Settings section to the Shop Profile settings page.
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "../page-objects/auth.page";
import { getTenantUrl } from "../helpers/urls";

test.describe("DS-q2o3: Tax configuration in settings", () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page, "demo");
    await loginPage.goto();
    await loginPage.login("e2e-tester@demo.com", "DemoPass1234");
  });

  test("settings profile page should have tax rate input", async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/tenant/settings/profile"));
    await page.waitForLoadState("load");

    // There should be a Tax Settings section
    await expect(page.getByText(/tax settings/i)).toBeVisible();

    // There should be a tax rate input
    const taxRateInput = page.locator("#taxRate");
    await expect(taxRateInput).toBeVisible();
  });

  test("settings profile page should have tax name input", async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/tenant/settings/profile"));
    await page.waitForLoadState("load");

    // There should be a tax name input
    const taxNameInput = page.locator("#taxName");
    await expect(taxNameInput).toBeVisible();
  });
});

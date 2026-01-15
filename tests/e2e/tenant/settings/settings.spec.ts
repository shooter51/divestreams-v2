import { test, expect } from "@playwright/test";
import { SettingsPage, BillingPage } from "../../page-objects";
import { testConfig, loginToTenant } from "../../fixtures/test-fixtures";

test.describe("Settings - Index Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays settings page with heading", async ({ page }) => {
    const settings = new SettingsPage(page, testConfig.tenantSubdomain);
    await settings.goto();

    await settings.expectSettingsPage();
  });

  test("shows all settings links", async ({ page }) => {
    const settings = new SettingsPage(page, testConfig.tenantSubdomain);
    await settings.goto();

    await settings.expectSettingsLinks();
  });

  test("shows danger zone", async ({ page }) => {
    const settings = new SettingsPage(page, testConfig.tenantSubdomain);
    await settings.goto();

    await settings.expectDangerZone();
  });

  test("can navigate to profile settings", async ({ page }) => {
    const settings = new SettingsPage(page, testConfig.tenantSubdomain);
    await settings.goto();
    await settings.navigateToSection("profile");

    await expect(page).toHaveURL(/\/settings\/profile/);
  });

  test("can navigate to billing settings", async ({ page }) => {
    const settings = new SettingsPage(page, testConfig.tenantSubdomain);
    await settings.goto();
    await settings.navigateToSection("billing");

    await expect(page).toHaveURL(/\/settings\/billing/);
  });

  test("can navigate to team settings", async ({ page }) => {
    const settings = new SettingsPage(page, testConfig.tenantSubdomain);
    await settings.goto();
    await settings.navigateToSection("team");

    await expect(page).toHaveURL(/\/settings\/team/);
  });

  test("can navigate to integrations settings", async ({ page }) => {
    const settings = new SettingsPage(page, testConfig.tenantSubdomain);
    await settings.goto();
    await settings.navigateToSection("integrations");

    await expect(page).toHaveURL(/\/settings\/integrations/);
  });
});

test.describe("Settings - Billing Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays billing page", async ({ page }) => {
    const billing = new BillingPage(page, testConfig.tenantSubdomain);
    await billing.goto();

    await billing.expectBillingPage();
  });

  test("shows current plan section", async ({ page }) => {
    const billing = new BillingPage(page, testConfig.tenantSubdomain);
    await billing.goto();

    await billing.expectCurrentPlanSection();
  });

  test("shows usage section", async ({ page }) => {
    const billing = new BillingPage(page, testConfig.tenantSubdomain);
    await billing.goto();

    await billing.expectUsageSection();
  });

  test("shows available plans", async ({ page }) => {
    const billing = new BillingPage(page, testConfig.tenantSubdomain);
    await billing.goto();

    await billing.expectAvailablePlans();
  });

  test("shows payment method section", async ({ page }) => {
    const billing = new BillingPage(page, testConfig.tenantSubdomain);
    await billing.goto();

    await billing.expectPaymentMethodSection();
  });

  test("has back to settings link", async ({ page }) => {
    const billing = new BillingPage(page, testConfig.tenantSubdomain);
    await billing.goto();

    await expect(page.getByRole("link", { name: /back to settings/i })).toBeVisible();
  });

  test("back to settings link works", async ({ page }) => {
    const billing = new BillingPage(page, testConfig.tenantSubdomain);
    await billing.goto();
    await billing.goBackToSettings();

    await expect(page).toHaveURL(/\/settings$/);
  });

  test("shows current plan name", async ({ page }) => {
    const billing = new BillingPage(page, testConfig.tenantSubdomain);
    await billing.goto();

    // Should show plan name (Free, Professional, Enterprise, etc.)
    await expect(page.getByText(/free|professional|enterprise|pro/i).first()).toBeVisible();
  });

  test("has manage payment button", async ({ page }) => {
    const billing = new BillingPage(page, testConfig.tenantSubdomain);
    await billing.goto();

    await expect(page.getByRole("button", { name: /manage payment/i })).toBeVisible();
  });

  test("shows billing history section", async ({ page }) => {
    const billing = new BillingPage(page, testConfig.tenantSubdomain);
    await billing.goto();

    await expect(page.getByText(/billing history/i)).toBeVisible();
  });
});

test.describe("Settings - Profile Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays profile settings page", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/settings/profile`);

    await expect(page.getByRole("heading", { name: /profile|shop/i })).toBeVisible();
  });

  test("has business name field", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/settings/profile`);

    await expect(page.getByLabel(/business name|shop name|name/i)).toBeVisible();
  });
});

test.describe("Settings - Team Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays team settings page", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/settings/team`);

    await expect(page.getByRole("heading", { name: /team/i })).toBeVisible();
  });
});

test.describe("Settings - Integrations Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays integrations page", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/settings/integrations`);

    await expect(page.getByRole("heading", { name: /integration/i })).toBeVisible();
  });
});

test.describe("Settings - Notifications Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays notifications settings page", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/settings/notifications`);

    await expect(page.getByRole("heading", { name: /notification/i })).toBeVisible();
  });
});

test.describe("Settings - Booking Widget Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays booking widget settings page", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/settings/booking-widget`);

    await expect(page.getByRole("heading", { name: /booking widget|widget/i })).toBeVisible();
  });
});

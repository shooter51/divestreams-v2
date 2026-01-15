import { test, expect } from "@playwright/test";
import { DashboardPage, LoginPage } from "../page-objects";
import { testConfig, loginToTenant } from "../fixtures/test-fixtures";

test.describe("Tenant Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays dashboard with heading", async ({ page }) => {
    const dashboard = new DashboardPage(page, testConfig.tenantSubdomain);
    await dashboard.expectDashboard();
  });

  test("shows stats cards", async ({ page }) => {
    const dashboard = new DashboardPage(page, testConfig.tenantSubdomain);
    await dashboard.expectStatsCards();
  });

  test("shows upcoming trips section", async ({ page }) => {
    const dashboard = new DashboardPage(page, testConfig.tenantSubdomain);
    await dashboard.expectUpcomingTripsSection();
  });

  test("shows recent bookings section", async ({ page }) => {
    const dashboard = new DashboardPage(page, testConfig.tenantSubdomain);
    await dashboard.expectRecentBookingsSection();
  });

  test("shows subscription badge", async ({ page }) => {
    const dashboard = new DashboardPage(page, testConfig.tenantSubdomain);
    await dashboard.expectSubscriptionBadge();
  });

  test("view all trips link works", async ({ page }) => {
    const dashboard = new DashboardPage(page, testConfig.tenantSubdomain);
    await dashboard.clickViewAllTrips();

    await expect(page).toHaveURL(/\/trips/);
  });

  test("view all bookings link works", async ({ page }) => {
    const dashboard = new DashboardPage(page, testConfig.tenantSubdomain);
    await dashboard.clickViewAllBookings();

    await expect(page).toHaveURL(/\/bookings/);
  });
});

test.describe("Dashboard Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("can navigate to bookings", async ({ page }) => {
    const dashboard = new DashboardPage(page, testConfig.tenantSubdomain);
    await dashboard.navigateTo("bookings");

    await expect(page).toHaveURL(/\/bookings/);
    await expect(page.getByRole("heading", { name: /booking/i })).toBeVisible();
  });

  test("can navigate to customers", async ({ page }) => {
    const dashboard = new DashboardPage(page, testConfig.tenantSubdomain);
    await dashboard.navigateTo("customers");

    await expect(page).toHaveURL(/\/customers/);
    await expect(page.getByRole("heading", { name: /customer/i })).toBeVisible();
  });

  test("can navigate to tours", async ({ page }) => {
    const dashboard = new DashboardPage(page, testConfig.tenantSubdomain);
    await dashboard.navigateTo("tours");

    await expect(page).toHaveURL(/\/tours/);
    await expect(page.getByRole("heading", { name: /tour/i })).toBeVisible();
  });

  test("can navigate to settings", async ({ page }) => {
    const dashboard = new DashboardPage(page, testConfig.tenantSubdomain);
    await dashboard.navigateTo("settings");

    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
  });

  test("can navigate to POS", async ({ page }) => {
    const dashboard = new DashboardPage(page, testConfig.tenantSubdomain);
    await dashboard.navigateTo("pos");

    await expect(page).toHaveURL(/\/pos/);
    await expect(page.getByText(/point of sale/i)).toBeVisible();
  });
});

test.describe("Dashboard - Unauthenticated Access", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.context().clearCookies();

    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app`);

    await expect(page).toHaveURL(/login/);
  });
});

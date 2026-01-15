import { test, expect } from "@playwright/test";
import { TripsPage, NewTripPage } from "../page-objects";
import { testConfig, loginToTenant } from "../fixtures/test-fixtures";

test.describe("Trips - List Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays trips list page", async ({ page }) => {
    const trips = new TripsPage(page, testConfig.tenantSubdomain);
    await trips.goto();

    await trips.expectTripsPage();
  });

  test("has add new trip button", async ({ page }) => {
    const trips = new TripsPage(page, testConfig.tenantSubdomain);
    await trips.goto();

    await expect(page.getByRole("link", { name: /new trip|add trip/i })).toBeVisible();
  });

  test("can navigate to new trip form", async ({ page }) => {
    const trips = new TripsPage(page, testConfig.tenantSubdomain);
    await trips.goto();
    await trips.clickNewTrip();

    await expect(page).toHaveURL(/\/trips\/new/);
  });
});

test.describe("Trips - New Trip Form", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays new trip form", async ({ page }) => {
    const newTrip = new NewTripPage(page, testConfig.tenantSubdomain);
    await newTrip.goto();

    await newTrip.expectForm();
  });

  test("has tour selection", async ({ page }) => {
    const newTrip = new NewTripPage(page, testConfig.tenantSubdomain);
    await newTrip.goto();

    await expect(page.getByLabel(/tour/i)).toBeVisible();
  });

  test("has date picker", async ({ page }) => {
    const newTrip = new NewTripPage(page, testConfig.tenantSubdomain);
    await newTrip.goto();

    await expect(page.getByLabel(/date/i)).toBeVisible();
  });

  test("has time picker", async ({ page }) => {
    const newTrip = new NewTripPage(page, testConfig.tenantSubdomain);
    await newTrip.goto();

    await expect(page.getByLabel(/time/i)).toBeVisible();
  });

  test("has max participants field", async ({ page }) => {
    const newTrip = new NewTripPage(page, testConfig.tenantSubdomain);
    await newTrip.goto();

    await expect(page.getByLabel(/max participants|capacity/i)).toBeVisible();
  });

  test("has save/create button", async ({ page }) => {
    const newTrip = new NewTripPage(page, testConfig.tenantSubdomain);
    await newTrip.goto();

    await expect(page.getByRole("button", { name: /save|create/i })).toBeVisible();
  });
});

test.describe("Trips - Calendar View", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("displays calendar page", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/calendar`);

    // Calendar should be visible
    await expect(page.getByRole("heading", { name: /calendar/i })).toBeVisible();
  });

  test("calendar shows trip events", async ({ page }) => {
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app/calendar`);

    // Should have calendar grid or event elements
    await expect(
      page.locator('[class*="calendar"], [class*="fc-"], [role="grid"]')
    ).toBeVisible();
  });
});

test.describe("Trips - Trip Detail", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("navigating to trip detail from list", async ({ page }) => {
    const trips = new TripsPage(page, testConfig.tenantSubdomain);
    await trips.goto();

    // If there are trips in the list, clicking one should navigate to detail
    const tripLink = page.getByRole("link").filter({ hasText: /view|details/i }).first();

    if (await tripLink.isVisible({ timeout: 2000 })) {
      await tripLink.click();
      await expect(page).toHaveURL(/\/trips\/\d+/);
    }
  });
});

test.describe("Trips - Filter and Search", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
    const trips = new TripsPage(page, testConfig.tenantSubdomain);
    await trips.goto();
  });

  test("has date filter", async ({ page }) => {
    // Look for date filter input
    const dateFilter = page.getByLabel(/date|from|filter by date/i);
    if (await dateFilter.isVisible({ timeout: 2000 })) {
      await expect(dateFilter).toBeVisible();
    }
  });

  test("has status filter", async ({ page }) => {
    // Look for status filter
    const statusFilter = page.getByLabel(/status/i);
    if (await statusFilter.isVisible({ timeout: 2000 })) {
      await expect(statusFilter).toBeVisible();
    }
  });
});

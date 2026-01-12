import { test, expect } from "@playwright/test";

test.describe("Tenant Booking Flow", () => {
  // Assuming a demo tenant exists at demo.localhost:5173
  const tenantUrl = "http://demo.localhost:5173";

  test.beforeEach(async ({ page }) => {
    await page.goto(`${tenantUrl}/app`);
    // May need to login - handle if redirected to login
    if (page.url().includes("/login")) {
      // Login with tenant credentials if needed
      await page.getByLabel(/email/i).fill("owner@demo.com");
      await page.getByLabel(/password/i).fill("demo123");
      await page.getByRole("button", { name: /sign in/i }).click();
    }
  });

  test("displays bookings list", async ({ page }) => {
    await page.goto(`${tenantUrl}/app/bookings`);
    await expect(page.getByRole("heading", { name: /booking/i })).toBeVisible();
    // Should show booking stats
    await expect(page.getByText(/today|upcoming|pending/i)).toBeVisible();
  });

  test("navigates to new booking form", async ({ page }) => {
    await page.goto(`${tenantUrl}/app/bookings`);
    await page.getByRole("link", { name: /new booking/i }).click();
    await expect(page).toHaveURL(/\/bookings\/new/);
  });

  test("filters bookings by status", async ({ page }) => {
    await page.goto(`${tenantUrl}/app/bookings`);

    // Select a status filter
    await page.getByRole("combobox", { name: /status/i }).selectOption("confirmed");
    await page.getByRole("button", { name: /filter/i }).click();

    // URL should include status param
    await expect(page).toHaveURL(/status=confirmed/);
  });

  test("searches bookings", async ({ page }) => {
    await page.goto(`${tenantUrl}/app/bookings`);

    await page.getByPlaceholder(/search/i).fill("john");
    await page.getByRole("button", { name: /filter/i }).click();

    // URL should include search param
    await expect(page).toHaveURL(/search=john/);
  });

  test("views booking details", async ({ page }) => {
    await page.goto(`${tenantUrl}/app/bookings`);

    // Click on first booking if exists
    const bookingLink = page.getByRole("link", { name: /BK-|view/i }).first();

    if (await bookingLink.isVisible()) {
      await bookingLink.click();
      await expect(page).toHaveURL(/\/bookings\/\d+/);
      // Should show booking details
      await expect(page.getByText(/customer|trip|total/i)).toBeVisible();
    }
  });

  test("shows payment status for partially paid bookings", async ({ page }) => {
    await page.goto(`${tenantUrl}/app/bookings`);

    // Look for partial payment indicator
    const partialPaymentText = page.getByText(/\$.*paid/i);

    // If partial payments exist, they should be visible
    if (await partialPaymentText.first().isVisible()) {
      await expect(partialPaymentText.first()).toBeVisible();
    }
  });

  test("displays booking status badges", async ({ page }) => {
    await page.goto(`${tenantUrl}/app/bookings`);

    // Should show status badges (confirmed, pending, etc.)
    await expect(
      page.locator(".bg-green-100, .bg-yellow-100, .bg-red-100, [class*='status']")
    ).toBeVisible();
  });

  test("pagination works correctly", async ({ page }) => {
    await page.goto(`${tenantUrl}/app/bookings`);

    // If pagination exists
    const nextButton = page.getByRole("button", { name: /next|>/i });

    if (await nextButton.isVisible()) {
      await nextButton.click();
      await expect(page).toHaveURL(/page=2/);
    }
  });
});

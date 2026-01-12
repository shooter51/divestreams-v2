import { test, expect } from "@playwright/test";

test.describe("Tenant Customer Management", () => {
  const tenantUrl = "http://demo.localhost:5173";

  test.beforeEach(async ({ page }) => {
    await page.goto(`${tenantUrl}/app/customers`);
  });

  test("displays customers list", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /customer/i })).toBeVisible();
    // Should show customer table
    await expect(page.locator("table")).toBeVisible();
  });

  test("searches customers by name", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill("john");
    await page.getByRole("button", { name: /search|filter/i }).click();

    await expect(page).toHaveURL(/search=john/);
  });

  test("navigates to new customer form", async ({ page }) => {
    await page.getByRole("link", { name: /new customer|add customer/i }).click();
    await expect(page).toHaveURL(/\/customers\/new/);
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("creates new customer", async ({ page }) => {
    await page.goto(`${tenantUrl}/app/customers/new`);

    await page.getByLabel(/first name/i).fill("Test");
    await page.getByLabel(/last name/i).fill("Customer");
    await page.getByLabel(/email/i).fill(`test${Date.now()}@example.com`);
    await page.getByLabel(/phone/i).fill("+1-555-0199");

    await page.getByRole("button", { name: /save|create/i }).click();

    // Should redirect back to customers list or detail
    await expect(page).toHaveURL(/\/customers/);
  });

  test("views customer details", async ({ page }) => {
    const customerLink = page.getByRole("link", { name: /view|details/i }).first();

    if (await customerLink.isVisible()) {
      await customerLink.click();
      await expect(page).toHaveURL(/\/customers\/\d+/);
      await expect(page.getByText(/email|phone|certification/i)).toBeVisible();
    }
  });

  test("shows customer booking history", async ({ page }) => {
    const customerLink = page.locator("table tbody tr a").first();

    if (await customerLink.isVisible()) {
      await customerLink.click();
      // Customer detail page should show booking history
      await expect(page.getByText(/booking|history/i)).toBeVisible();
    }
  });
});

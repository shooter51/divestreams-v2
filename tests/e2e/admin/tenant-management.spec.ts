import { test, expect } from "@playwright/test";

test.describe("Admin Tenant Management", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto("http://admin.localhost:5173/login");
    const adminPassword = process.env.ADMIN_PASSWORD || "DiveAdmin2026";
    await page.getByLabel(/password/i).fill(adminPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("displays tenant list on dashboard", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /tenant/i })).toBeVisible();
    // Should show tenant table or list
    await expect(page.locator("table, [role='grid']")).toBeVisible();
  });

  test("navigates to create tenant form", async ({ page }) => {
    await page.getByRole("link", { name: /create|new/i }).click();
    await expect(page).toHaveURL(/\/tenants\/new|\/create/);
    await expect(page.getByLabel(/subdomain/i)).toBeVisible();
    await expect(page.getByLabel(/business name/i)).toBeVisible();
  });

  test("validates subdomain format", async ({ page }) => {
    await page.goto("http://admin.localhost:5173/tenants/new");

    // Try invalid subdomain
    await page.getByLabel(/subdomain/i).fill("invalid subdomain!");
    await page.getByLabel(/business name/i).fill("Test Business");
    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByRole("button", { name: /create/i }).click();

    // Should show validation error
    await expect(page.getByText(/invalid|format/i)).toBeVisible();
  });

  test("creates tenant with valid data", async ({ page }) => {
    await page.goto("http://admin.localhost:5173/tenants/new");

    const uniqueSubdomain = `test${Date.now()}`;

    await page.getByLabel(/subdomain/i).fill(uniqueSubdomain);
    await page.getByLabel(/business name/i).fill("E2E Test Business");
    await page.getByLabel(/email/i).fill("e2etest@example.com");
    await page.getByLabel(/phone/i).fill("+1-555-0123");

    await page.getByRole("button", { name: /create/i }).click();

    // Should redirect to dashboard after creation
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("can enable demo data population", async ({ page }) => {
    await page.goto("http://admin.localhost:5173/tenants/new");

    // Check that demo data checkbox exists
    const demoCheckbox = page.getByRole("checkbox", { name: /demo/i });
    await expect(demoCheckbox).toBeVisible();

    // Check the checkbox
    await demoCheckbox.check();
    await expect(demoCheckbox).toBeChecked();
  });

  test("shows tenant details when clicking on a tenant", async ({ page }) => {
    // Click on first tenant in list (if any)
    const tenantRow = page.locator("table tbody tr, [role='row']").first();

    if (await tenantRow.isVisible()) {
      await tenantRow.click();
      // Should navigate to tenant detail or show modal
      await expect(page.getByText(/subdomain|email|plan/i)).toBeVisible();
    }
  });
});

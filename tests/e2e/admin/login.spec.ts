import { test, expect } from "@playwright/test";

test.describe("Admin Login", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin login page
    await page.goto("http://admin.localhost:5173/login");
  });

  test("displays login form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /admin/i })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("shows error for invalid password", async ({ page }) => {
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/invalid password/i)).toBeVisible();
  });

  test("redirects to dashboard on successful login", async ({ page }) => {
    const adminPassword = process.env.ADMIN_PASSWORD || "DiveAdmin2026";

    await page.getByLabel(/password/i).fill(adminPassword);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /tenant/i })).toBeVisible();
  });

  test("shows loading state during submission", async ({ page }) => {
    await page.getByLabel(/password/i).fill("anypassword");

    // Click and check for loading state
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("button", { name: /signing in/i })).toBeVisible();
  });
});

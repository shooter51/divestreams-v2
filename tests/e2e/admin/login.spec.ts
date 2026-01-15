import { test, expect } from "@playwright/test";

test.describe("Admin Login", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin login page
    await page.goto("http://admin.localhost:5173/login");
  });

  test("displays login form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /admin/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("shows error for invalid email format", async ({ page }) => {
    await page.getByLabel(/email/i).fill("invalid-email");
    await page.getByLabel(/password/i).fill("somepassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test("shows loading state during submission", async ({ page }) => {
    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByLabel(/password/i).fill("anypassword");

    // Click and check for loading state
    await page.getByRole("button", { name: /sign in/i }).click();

    // Look for the loading indicator (spinner or "Signing in..." text)
    await expect(page.locator('[class*="animate-spin"]').or(page.getByText(/signing in/i))).toBeVisible({ timeout: 2000 });
  });
});

import { test, expect } from "@playwright/test";

test.describe("Marketing Signup Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:5173/signup");
  });

  test("displays signup form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /get started|sign up|create/i })).toBeVisible();
    await expect(page.getByLabel(/subdomain/i)).toBeVisible();
    await expect(page.getByLabel(/business name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("validates subdomain format", async ({ page }) => {
    await page.getByLabel(/subdomain/i).fill("invalid subdomain!");
    await page.getByLabel(/business name/i).fill("Test Business");
    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByLabel(/password/i).fill("SecurePass123!");

    await page.getByRole("button", { name: /sign up|create|get started/i }).click();

    await expect(page.getByText(/invalid|format/i)).toBeVisible();
  });

  test("shows subdomain preview", async ({ page }) => {
    await page.getByLabel(/subdomain/i).fill("myshop");

    // Should show preview of the full URL
    await expect(page.getByText(/myshop.*divestreams/i)).toBeVisible();
  });

  test("creates account with valid data", async ({ page }) => {
    const uniqueSubdomain = `e2etest${Date.now()}`;

    await page.getByLabel(/subdomain/i).fill(uniqueSubdomain);
    await page.getByLabel(/business name/i).fill("E2E Test Dive Shop");
    await page.getByLabel(/email/i).fill(`${uniqueSubdomain}@example.com`);
    await page.getByLabel(/password/i).fill("SecureTestPass123!");

    await page.getByRole("button", { name: /sign up|create|get started/i }).click();

    // Should redirect to the new tenant
    await expect(page).toHaveURL(new RegExp(`${uniqueSubdomain}.*\\/app`));
  });
});

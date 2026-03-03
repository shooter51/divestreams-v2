/**
 * DS-4r2m: Shop profile email field has no required validation
 *
 * BUG: The shop profile form at /tenant/settings/profile allows submission
 * with an empty email field. While the HTML input has `required`, the server-side
 * action does not validate that email is provided before saving.
 *
 * REPRODUCTION:
 * 1. Navigate to /tenant/settings/profile
 * 2. Clear the email field
 * 3. Submit the form
 * 4. Expected: Validation error appears
 * 5. Actual: Form submits successfully with empty email
 *
 * FIX: Add server-side required check: if (!email) return { error: "Email is required" }
 */

import { test, expect } from "@playwright/test";
import { getTenantUrl } from "../helpers/urls";

test.describe("DS-4r2m: Shop profile email required validation", () => {
  test("clearing email and submitting shows validation error", async ({ page }) => {
    // Navigate to login
    await page.goto(getTenantUrl("demo", "/auth/login"));
    await page.waitForLoadState("load");

    // Login
    await page.getByRole("textbox", { name: /email/i }).fill("e2e-tester@demo.com");
    await page.locator('input[type="password"]').first().fill("DemoPass1234");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForLoadState("load");

    // Navigate to profile settings
    await page.goto(getTenantUrl("demo", "/tenant/settings/profile"));
    await page.waitForLoadState("load");

    // Verify page loaded
    await expect(page.locator("h1")).toContainText(/shop profile/i);

    // Find and clear the email field
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toBeVisible();
    await emailInput.clear();

    // Try to submit the form - bypass HTML5 required validation via JS
    await page.evaluate(() => {
      const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
      if (emailInput) {
        emailInput.removeAttribute("required");
      }
    });

    // Submit the profile form
    const submitButton = page.locator('button[type="submit"]').filter({ hasText: /save changes/i });
    await submitButton.click();
    await page.waitForLoadState("load");

    // Should show an error message about email being required
    const errorMessage = page.locator(".text-danger, .bg-danger-muted, [class*='danger']").filter({ hasText: /email/i });
    await expect(errorMessage).toBeVisible();
  });

  test("email field has required attribute", async ({ page }) => {
    // Navigate to login
    await page.goto(getTenantUrl("demo", "/auth/login"));
    await page.waitForLoadState("load");

    await page.getByRole("textbox", { name: /email/i }).fill("e2e-tester@demo.com");
    await page.locator('input[type="password"]').first().fill("DemoPass1234");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForLoadState("load");

    await page.goto(getTenantUrl("demo", "/tenant/settings/profile"));
    await page.waitForLoadState("load");

    // Email input should have required attribute
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toHaveAttribute("required");
  });
});

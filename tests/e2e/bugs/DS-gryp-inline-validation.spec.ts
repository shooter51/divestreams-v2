/**
 * DS-gryp: Login and signup forms show no inline validation error messages
 *
 * BUG: Forms across the app silently focus the next required field without
 * showing any inline error messages. The `required` attribute on inputs triggers
 * browser-native validation (tooltip/focus) instead of custom inline error text.
 *
 * REPRODUCTION:
 * 1. Navigate to /auth/login (root domain — discovery mode)
 * 2. Click "Find My Account" without entering email
 * Expected: "Email is required" error appears below the email field
 * Actual: Browser silently focuses the field, no inline error text shown
 *
 * FIX: Add `noValidate` to forms so browser-native validation is skipped,
 * server-side validation runs, and inline error messages (already wired in
 * JSX via actionData) are displayed.
 */

import { test, expect } from "@playwright/test";
import { getBaseUrl, getTenantUrl } from "../helpers/urls";

test.describe("DS-gryp: inline validation error messages @bug", () => {
  test("DS-gryp: login shows email required error when submitted empty", async ({ page }) => {
    // Go to root login (discovery mode — no subdomain)
    await page.goto(getBaseUrl("/auth/login"));
    await page.waitForLoadState("load");

    // The page should be in discovery mode
    await expect(page.getByRole("button", { name: /find my account/i })).toBeVisible();

    // Click submit without entering email — form must have noValidate so server validates
    await page.getByRole("button", { name: /find my account/i }).click();
    await page.waitForLoadState("load");

    // Inline error should appear below the email field
    const emailError = page.locator(".text-danger").filter({ hasText: /email is required/i });
    await expect(emailError).toBeVisible();
  });

  test("DS-gryp: tenant login shows email required error when submitted empty", async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/auth/login"));
    await page.waitForLoadState("load");

    // Should be tenant login mode with Sign In button
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

    // Click submit without entering email — form must have noValidate so server validates
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForLoadState("load");

    // Inline error should appear below the email field
    const emailError = page.locator(".text-danger").filter({ hasText: /email is required/i });
    await expect(emailError).toBeVisible();
  });
});

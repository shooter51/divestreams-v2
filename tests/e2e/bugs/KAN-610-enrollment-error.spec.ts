/**
 * KAN-610: Error 500/400 when accessing 'New Enrollment' on training page
 *
 * BUG: User clicks "New Enrollment" button from training dashboard or enrollments
 * list and gets 500/400 error because the route requires sessionId query param
 * but the links don't provide it.
 *
 * REPRODUCTION:
 * 1. Navigate to training dashboard
 * 2. Click "New Enrollment" button in Quick Actions
 * 3. Expected: Form loads with session selector
 * 4. Actual: 400 error "Session ID required"
 *
 * AFFECTED LOCATIONS:
 * - /tenant/training (training dashboard) - Quick Actions "New Enrollment"
 * - /tenant/training/enrollments (enrollments list) - "New Enrollment" button
 */

import { test, expect } from "@playwright/test";

test.describe("KAN-610: New Enrollment Button Error", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin to demo tenant
    await page.goto("http://demo.localhost:5173/admin");
    await page.waitForLoadState("networkidle");

    // Fill in admin password if on login page
    const passwordInput = page.locator('input[name="password"]');
    if (await passwordInput.isVisible()) {
      await passwordInput.fill("admin");
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState("networkidle");
    }
  });

  test("should load enrollment form from training dashboard without error", async ({ page }) => {
    // Navigate to training dashboard
    await page.goto("/tenant/training");
    await page.waitForLoadState("networkidle");

    // Click "New Enrollment" in Quick Actions
    const newEnrollmentButton = page.locator('a:has-text("New Enrollment")').first();
    await expect(newEnrollmentButton).toBeVisible();
    await newEnrollmentButton.click();

    // Should NOT get 400/500 error
    await page.waitForLoadState("networkidle");

    // Check we're on the enrollment form page
    await expect(page).toHaveURL(/\/tenant\/training\/enrollments\/new/);

    // Should see the form title
    await expect(page.locator("h1")).toContainText(/Enroll Student|New Enrollment/);

    // Should NOT see error messages
    await expect(page.locator("text=Session ID required")).not.toBeVisible();
    await expect(page.locator("text=400")).not.toBeVisible();
    await expect(page.locator("text=500")).not.toBeVisible();

    // Should see form fields
    await expect(page.locator('select[name="customerId"]')).toBeVisible();
  });

  test("should load enrollment form from enrollments list without error", async ({ page }) => {
    // Navigate to enrollments list
    await page.goto("/tenant/training/enrollments");
    await page.waitForLoadState("networkidle");

    // Click "New Enrollment" button
    const newEnrollmentButton = page.locator('a:has-text("New Enrollment")').first();
    await expect(newEnrollmentButton).toBeVisible();
    await newEnrollmentButton.click();

    // Should NOT get 400/500 error
    await page.waitForLoadState("networkidle");

    // Check we're on the enrollment form page
    await expect(page).toHaveURL(/\/tenant\/training\/enrollments\/new/);

    // Should see the form title
    await expect(page.locator("h1")).toContainText(/Enroll Student|New Enrollment/);

    // Should NOT see error messages
    await expect(page.locator("text=Session ID required")).not.toBeVisible();
    await expect(page.locator("text=400")).not.toBeVisible();
    await expect(page.locator("text=500")).not.toBeVisible();

    // Should see form fields
    await expect(page.locator('select[name="customerId"]')).toBeVisible();
  });

  test("should allow session selection when no sessionId provided", async ({ page }) => {
    // Go directly to enrollment form without sessionId
    await page.goto("/tenant/training/enrollments/new");
    await page.waitForLoadState("networkidle");

    // Should NOT error
    await expect(page.locator("text=Session ID required")).not.toBeVisible();

    // Should see session selector dropdown
    await expect(page.locator('select[name="sessionId"]')).toBeVisible();

    // Should see customer selector
    await expect(page.locator('select[name="customerId"]')).toBeVisible();
  });

  test("should still work with sessionId query parameter (existing flow)", async ({ page }) => {
    // Create a test session first
    // This assumes there's at least one session available
    await page.goto("/tenant/training/sessions");
    await page.waitForLoadState("networkidle");

    // Get first session if exists
    const firstSession = page.locator('a[href*="/tenant/training/sessions/"]').first();
    if (await firstSession.isVisible()) {
      await firstSession.click();
      await page.waitForLoadState("networkidle");

      // Click "Enroll Student" button
      const enrollButton = page.locator('a:has-text("Enroll Student")').first();
      if (await enrollButton.isVisible()) {
        await enrollButton.click();
        await page.waitForLoadState("networkidle");

        // Should work as before
        await expect(page).toHaveURL(/sessionId=/);
        await expect(page.locator("h1")).toContainText("Enroll Student");
        await expect(page.locator('select[name="customerId"]')).toBeVisible();
      }
    }
  });
});

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
import { TenantBasePage } from "../page-objects/base.page";

// Helper page object for tenant navigation
class TrainingPage extends TenantBasePage {
  async gotoLogin(): Promise<void> {
    await this.gotoAuth("/login");
  }

  async gotoTraining(): Promise<void> {
    await this.gotoApp("/training");
  }

  async goto(path: string): Promise<void> {
    await this.gotoApp(path);
  }
}

test.describe("KAN-610: New Enrollment Button Error", () => {
  let trainingPage: TrainingPage;

  test.beforeEach(async ({ page }) => {
    trainingPage = new TrainingPage(page, "demo");

    // Login as admin to demo tenant
    await trainingPage.gotoLogin();
    await page.waitForLoadState("load");

    // Fill in login credentials
    await page.getByLabel(/email/i).fill("owner@demo.com");
    await page.getByLabel(/password/i).fill("demo1234");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for redirect to tenant dashboard after successful login
    await page.waitForURL(/\/tenant/, { timeout: 10000 });
  });

  test("should load enrollment form from training dashboard without error", async ({ page }) => {
    // Navigate to training dashboard
    await trainingPage.gotoTraining();
    await page.waitForLoadState("load");

    // Wait for the Quick Actions section to be visible
    await expect(page.locator("h2:has-text('Quick Actions')")).toBeVisible({ timeout: 10000 });

    // Click "New Enrollment" in Quick Actions
    const newEnrollmentButton = page.locator('a:has-text("New Enrollment")').first();
    await expect(newEnrollmentButton).toBeVisible();
    await newEnrollmentButton.click();

    // Should NOT get 400/500 error
    await page.waitForLoadState("load");

    // Check we're on the enrollment form page
    await expect(page).toHaveURL(/\/tenant\/training\/enrollments\/new/);

    // Should see the form title (use more specific selector to avoid multiple h1s)
    await expect(page.locator("h1:has-text('Enroll Student')")).toBeVisible();

    // Should NOT see error messages
    await expect(page.locator("text=Session ID required")).not.toBeVisible();
    await expect(page.locator("text=400")).not.toBeVisible();
    await expect(page.locator("text=500")).not.toBeVisible();

    // Should see form fields
    await expect(page.locator('select[name="customerId"]')).toBeVisible();
  });

  test("should load enrollment form from enrollments list without error", async ({ page }) => {
    // Navigate to enrollments list
    await trainingPage.goto("/training/enrollments");
    await page.waitForLoadState("load");

    // Wait for page to load (check for heading)
    await expect(page.locator("h1:has-text('Training Enrollments')")).toBeVisible({ timeout: 10000 });

    // Click "New Enrollment" button
    const newEnrollmentButton = page.locator('a:has-text("New Enrollment")').first();
    await expect(newEnrollmentButton).toBeVisible();
    await newEnrollmentButton.click();

    // Should NOT get 400/500 error
    await page.waitForLoadState("load");

    // Check we're on the enrollment form page
    await expect(page).toHaveURL(/\/tenant\/training\/enrollments\/new/);

    // Should see the form title (use more specific selector to avoid multiple h1s)
    await expect(page.locator("h1:has-text('Enroll Student')")).toBeVisible();

    // Should NOT see error messages
    await expect(page.locator("text=Session ID required")).not.toBeVisible();
    await expect(page.locator("text=400")).not.toBeVisible();
    await expect(page.locator("text=500")).not.toBeVisible();

    // Should see form fields
    await expect(page.locator('select[name="customerId"]')).toBeVisible();
  });

  test("should allow session selection when no sessionId provided", async ({ page }) => {
    // Go directly to enrollment form without sessionId
    await trainingPage.goto("/training/enrollments/new");
    await page.waitForLoadState("load");

    // Wait for form to load
    await expect(page.locator("h1:has-text('Enroll Student')")).toBeVisible({ timeout: 10000 });

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
    await page.goto("http://demo.localhost:5173/tenant/training/sessions");
    await page.waitForLoadState("load");

    // Wait for sessions page to load
    await expect(page.locator("h1:has-text('Training Sessions')")).toBeVisible({ timeout: 10000 });

    // Get first session if exists
    const firstSession = page.locator('a[href*="/tenant/training/sessions/"]').first();
    if (await firstSession.isVisible()) {
      await firstSession.click();
      await page.waitForLoadState("load");

      // Click "Enroll Student" or "Add Enrollment" button
      const enrollButton = page.locator('a:has-text("Enroll Student"), a:has-text("Add Enrollment")').first();
      if (await enrollButton.isVisible()) {
        await enrollButton.click();
        await page.waitForLoadState("load");

        // Should work as before
        await expect(page).toHaveURL(/sessionId=/);
        await expect(page.locator("h1")).toContainText("Enroll Student");
        await expect(page.locator('select[name="customerId"]')).toBeVisible();
      }
    }
  });
});

import { test, expect } from "@playwright/test";
import { loginToAdmin, testConfig } from "./fixtures/test-fixtures";

// Admin URL helper - admin routes use subdomain-based routing
const getAdminUrl = (path: string) => `http://admin.localhost:5173${path}`;

test.describe("Admin Password Reset", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin using subdomain-based routing
    await loginToAdmin(page, testConfig.adminPassword);
  });

  test("should reset password with auto-generate method", async ({ page }) => {
    // Navigate to team settings using admin subdomain
    await page.goto(getAdminUrl("/settings/team"));

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Find a non-owner team member's reset button
    const memberRows = page.locator('tr').filter({ hasNot: page.locator('text="Owner"') });
    const resetButton = memberRows.first().locator('button:has-text("Reset Password")');

    // Skip if no reset buttons available (only owner exists)
    if (await resetButton.count() === 0) {
      test.skip();
      return;
    }

    // Click reset password for a team member
    await resetButton.click();

    // Modal should appear
    await expect(page.locator("text=Reset Password for")).toBeVisible();

    // Auto-generate should be selected by default
    await expect(page.locator('input[value="auto_generated"]')).toBeChecked();

    // Click reset in modal
    await page.locator('dialog button:has-text("Reset Password")').click();

    // Should show success message or generated password
    await expect(page.locator("text=/password/i")).toBeVisible();
  });

  test("should prevent resetting owner password", async ({ page }) => {
    await page.goto(getAdminUrl("/settings/team"));

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Find owner row and try to reset
    const ownerRow = page.locator('tr:has-text("Owner")');

    // Reset button should not be present or disabled for owner
    const resetButton = ownerRow.locator('button:has-text("Reset Password")');
    await expect(resetButton).toHaveCount(0);
  });
});

test.describe("Forced Password Change", () => {
  test.skip("should force user to change password after admin reset", async ({
    page,
  }) => {
    // This test requires setting up a user with force_password_change = true
    // Then logging in as that user - skipped as it requires specific test data setup

    // Login as user with forced password change (on tenant subdomain)
    await page.goto("http://demo.localhost:5173/auth/login");
    await page.fill('input[name="email"]', "forceduser@example.com");
    await page.fill('input[name="password"]', "temp_password");
    await page.click('button[type="submit"]');

    // Should be redirected to password change page
    await expect(page).toHaveURL(/\/settings\/password\?forced=true/);

    // Should show warning banner
    await expect(
      page.locator("text=/Password Change Required/i")
    ).toBeVisible();

    // Fill new password
    await page.fill('input[name="newPassword"]', "NewSecure123!");
    await page.fill('input[name="confirmPassword"]', "NewSecure123!");
    await page.click('button:has-text("Update Password")');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

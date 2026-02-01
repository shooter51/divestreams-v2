import { test, expect } from "@playwright/test";

test.describe("Admin Password Reset", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto("/admin/login");
    await page.fill('input[name="email"]', "admin@divestreams.com");
    await page.fill('input[name="password"]', "admin_password");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin/);
  });

  test("should reset password with auto-generate method", async ({ page }) => {
    // Navigate to team settings
    await page.goto("/admin/settings/team");

    // Click reset password for a team member
    await page.click('button:has-text("Reset Password")');

    // Modal should appear
    await expect(page.locator("text=Reset Password for")).toBeVisible();

    // Auto-generate should be selected by default
    await expect(page.locator('input[value="auto_generated"]')).toBeChecked();

    // Click reset
    await page.click('button:has-text("Reset Password")');

    // Should show success message or generated password
    await expect(page.locator("text=/password/i")).toBeVisible();
  });

  test("should prevent resetting owner password", async ({ page }) => {
    await page.goto("/admin/settings/team");

    // Find owner row and try to reset
    const ownerRow = page.locator('tr:has-text("Owner")');

    // Reset button should not be present or disabled
    const resetButton = ownerRow.locator('button:has-text("Reset Password")');
    await expect(resetButton).not.toBeVisible();
  });
});

test.describe("Forced Password Change", () => {
  test("should force user to change password after admin reset", async ({
    page,
  }) => {
    // This test requires setting up a user with force_password_change = true
    // Then logging in as that user

    // Login as user with forced password change
    await page.goto("/login");
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

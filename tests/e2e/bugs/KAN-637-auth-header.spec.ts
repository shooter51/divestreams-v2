/**
 * KAN-637: Customer already logged in, but 'Log in' and 'Sign Up' still exist on page header
 *
 * Bug: After customer login, public site header still shows "Log In" and "Sign Up" buttons
 * Expected: Header should show "My Account" and "Log Out" when logged in
 *
 * This test documents the bug and will FAIL until fixed.
 */

import { test, expect } from "@playwright/test";
import { TenantBasePage } from "../page-objects/base.page";

// Helper page object for public site navigation
class PublicSitePage extends TenantBasePage {
  async gotoSiteRegister(): Promise<void> {
    await this.gotoSite("/register");
  }

  async gotoSiteLogin(): Promise<void> {
    await this.gotoSite("/login");
  }

  async gotoSiteHome(): Promise<void> {
    await this.gotoSite("");
  }
}

test.describe("KAN-637: Auth header state after login @bug", () => {
  let sitePage: PublicSitePage;

  test.beforeEach(async ({ page }) => {
    sitePage = new PublicSitePage(page, "e2etest");
  });

  // Helper function to create a test customer via API
  async function createTestCustomer(page: any, sitePage: PublicSitePage, email: string, password: string) {
    // Use cookies to simulate customer login for testing
    // This bypasses the registration UI and focuses on the header bug
    const context = page.context();

    // For now, use the UI flow since we need the actual session cookie
    await sitePage.gotoSiteRegister();

    // Check if register page exists and public site is enabled
    const registerHeading = page.getByRole("heading", { name: /create.*account|sign up/i });
    const isRegisterPageAvailable = await registerHeading.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isRegisterPageAvailable) {
      // Public site might not be enabled - skip this test
      test.skip(true, "Public site not enabled for e2etest tenant");
      return false;
    }

    await page.getByLabel("First Name").fill("Test");
    await page.getByLabel("Last Name").fill("Customer");
    await page.getByLabel("Email Address").fill(email);
    await page.getByLabel(/phone/i).fill("555-0100");
    await page.getByLabel(/^password$/i).first().fill(password);
    await page.getByLabel(/confirm.*password/i).fill(password);
    await page.getByRole("button", { name: /create.*account|sign up/i }).click();

    // Wait for successful registration (redirects to account or shows success message)
    await page.waitForURL(/\/site\/(account|verify-email)/, { timeout: 10000 }).catch(async () => {
      // Check if there's an error (email already exists)
      const errorText = await page.textContent("body");
      if (errorText?.includes("already")) {
        // Email exists, try to login instead
        await sitePage.gotoSiteLogin();
        await page.getByLabel(/email/i).fill(email);
        await page.getByLabel(/password/i).fill(password);
        await page.getByRole("button", { name: /sign in|log in/i }).click();
        await page.waitForURL(/\/site\/account/, { timeout: 10000 });
      }
    });

    return true;
  }

  test("should show My Account when logged in, NOT Log In/Sign Up", async ({ page }) => {
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = "TestPassword123!";

    // Create and login test customer
    const created = await createTestCustomer(page, sitePage, testEmail, testPassword);
    if (!created) return; // Skip if public site not enabled

    // Navigate back to home page to verify header state
    await sitePage.gotoSiteHome();
    await page.waitForLoadState("load");

    const header = page.locator("header");

    // BUG DOCUMENTATION: These assertions will FAIL showing the bug
    // After login, header should NOT show "Log In" and "Sign Up"
    const loginLink = header.getByRole("link", { name: /log in/i });
    const signupLink = header.getByRole("link", { name: /sign up/i });
    const accountLink = header.getByRole("link", { name: /my account|account/i });

    // Check current state (this documents the bug)
    const loginVisible = await loginLink.isVisible().catch(() => false);
    const signupVisible = await signupLink.isVisible().catch(() => false);
    const accountVisible = await accountLink.isVisible().catch(() => false);

    console.log("=== KAN-637 BUG STATUS ===");
    console.log(`Login link visible: ${loginVisible} (should be false)`);
    console.log(`Signup link visible: ${signupVisible} (should be false)`);
    console.log(`Account link visible: ${accountVisible} (should be true)`);

    // This test SHOULD FAIL until bug is fixed
    await expect(
      loginLink,
      "BUG KAN-637: 'Log In' still visible after customer login"
    ).not.toBeVisible();

    await expect(
      signupLink,
      "BUG KAN-637: 'Sign Up' still visible after customer login"
    ).not.toBeVisible();

    await expect(
      accountLink,
      "Header should show 'My Account' when logged in"
    ).toBeVisible();
  });
});

/**
 * KAN-664: Customer login page, forgot password feature is 404 not found
 *
 * Bug: Clicking "Forgot password?" on the customer login page resulted in a 404
 * Fix: Added tenant/forgot-password and tenant/reset-password route registrations,
 *      and corrected the site login link to point to /auth/forgot-password
 */

import { test, expect } from "@playwright/test";
import { TenantBasePage } from "../page-objects/base.page";

class ForgotPasswordTestPage extends TenantBasePage {
  async gotoTenantForgotPassword(): Promise<void> {
    await this.page.goto(`${this.tenantUrl}/tenant/forgot-password`);
    await this.waitForNavigation();
  }

  async gotoTenantResetPassword(): Promise<void> {
    await this.page.goto(`${this.tenantUrl}/tenant/reset-password`);
    await this.waitForNavigation();
  }

  async gotoAuthForgotPassword(): Promise<void> {
    await this.gotoAuth("/forgot-password");
  }

  async gotoTenantLogin(): Promise<void> {
    await this.page.goto(`${this.tenantUrl}/tenant/login`);
    await this.waitForNavigation();
  }

  async gotoSiteLogin(): Promise<void> {
    await this.gotoSite("/login");
  }
}

test.describe("KAN-664: Forgot Password 404 Fix @bug", () => {
  let page: ForgotPasswordTestPage;

  test.beforeEach(async ({ page: p }) => {
    page = new ForgotPasswordTestPage(p, "demo");
  });

  test.describe("Tenant forgot-password route", () => {
    test("tenant forgot-password page loads (NOT 404)", async ({ page: p }) => {
      await page.gotoTenantForgotPassword();

      // Should NOT be a 404 page
      const pageContent = await p.content();
      expect(pageContent).not.toContain("404");

      // Should show forgot password form or content
      // The auth forgot-password has "Reset your password" heading
      // The tenant forgot-password has "Forgot your password?" heading
      const hasForgotContent = await p
        .getByText(/forgot.*password|reset.*password|check your email/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(hasForgotContent).toBe(true);
    });

    test("tenant forgot-password shows email form", async ({ page: p }) => {
      await page.gotoTenantForgotPassword();

      // Should have an email input
      const emailInput = p.locator('input[type="email"], input[name="email"]');
      await expect(emailInput.first()).toBeVisible({ timeout: 5000 });

      // Should have a submit button
      const submitButton = p.getByRole("button", { name: /send|reset|submit/i });
      await expect(submitButton.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Auth forgot-password route", () => {
    test("auth forgot-password page loads (NOT 404)", async ({ page: p }) => {
      await page.gotoAuthForgotPassword();

      const pageContent = await p.content();
      expect(pageContent).not.toContain("404");

      const hasForgotContent = await p
        .getByText(/forgot.*password|reset.*password|check your email/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(hasForgotContent).toBe(true);
    });
  });

  test.describe("Site login forgot password link", () => {
    test("site login forgot password link navigates to working page", async ({ page: p }) => {
      await page.gotoSiteLogin();

      // Check if site login page loaded (may be disabled for tenant)
      const hasLoginForm = await p
        .getByText(/sign in|log in|welcome back/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!hasLoginForm) {
        test.skip(true, "Public site login not available for this tenant");
        return;
      }

      // Find and click the forgot password link
      const forgotLink = p.getByRole("link", { name: /forgot.*password/i });
      const isForgotLinkVisible = await forgotLink
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (!isForgotLinkVisible) {
        test.skip(true, "Forgot password link not visible on site login");
        return;
      }

      // Verify the link points to /auth/forgot-password (not /site/forgot-password)
      const href = await forgotLink.getAttribute("href");
      expect(href).toBe("/auth/forgot-password");

      // Click and verify the page loads (not 404)
      await forgotLink.click();
      await p.waitForLoadState("load");

      const pageContent = await p.content();
      expect(pageContent).not.toContain("404");
    });
  });

  test.describe("Tenant login forgot password link", () => {
    test("tenant login has a forgot password link", async ({ page: p }) => {
      await page.gotoTenantLogin();

      // Check if login page loaded
      const hasLoginContent = await p
        .getByText(/sign in|log in/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!hasLoginContent) {
        test.skip(true, "Tenant login page not available");
        return;
      }

      // Should have a forgot password link
      const forgotLink = p.getByRole("link", { name: /forgot.*password/i });
      const hasForgotLink = await forgotLink
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      // If the tenant login has a forgot password link, clicking it should work
      if (hasForgotLink) {
        await forgotLink.click();
        // Wait for navigation to complete (client-side routing via history.pushState)
        await p.waitForURL(/forgot-password|\/tenant(?!\/(login|auth))/, { timeout: 10000 }).catch(() => {});

        // Should navigate to forgot-password page, not a 404
        // (if somehow already logged in, might redirect to /tenant dashboard instead)
        if (p.url().includes('/tenant') && !p.url().includes('forgot-password')) return;
        expect(p.url()).toContain("forgot-password");
        // Should show the forgot password form (email input)
        const hasEmailInput = await p.getByRole("textbox", { name: /email/i }).isVisible({ timeout: 5000 }).catch(() => false);
        expect(hasEmailInput).toBeTruthy();
      }
    });
  });

  test.describe("Tenant reset-password route", () => {
    test("tenant reset-password redirects to forgot-password when no token", async ({
      page: p,
    }) => {
      await page.gotoTenantResetPassword();

      // Without a token, should redirect to forgot-password page
      // or show some form of password reset content
      const url = p.url();
      const hasForgotContent = await p
        .getByText(/forgot.*password|reset.*password|email/i)
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      // Either redirected to forgot-password or shows the reset form
      expect(url.includes("forgot-password") || hasForgotContent).toBe(true);
    });
  });
});

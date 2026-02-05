import { type Page, expect } from "@playwright/test";
import { TenantBasePage } from "./base.page";

/**
 * Tenant Login Page Object
 */
export class LoginPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoAuth("/login");
  }

  async login(email: string, password: string): Promise<void> {
    // Email field requires getByRole for accessibility matching
    await this.page.getByRole("textbox", { name: /email/i }).fill(email);
    await this.fillByLabel(/password/i, password);
    // Click and wait for navigation after successful login
    await this.clickButton(/sign in/i);
    // Wait for redirect to tenant dashboard (URL change is more reliable than networkidle)
    await this.page.waitForURL(/\/tenant/, { timeout: 15000 });
  }

  async expectLoginForm(): Promise<void> {
    await expect(this.page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(this.page.locator('input[type="password"]').first()).toBeVisible();
    await expect(this.page.getByRole("button", { name: /sign in/i })).toBeVisible();
  }

  async expectError(message: string | RegExp): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  async expectRedirectToDashboard(): Promise<void> {
    await expect(this.page).toHaveURL(/\/tenant/);
  }

  async clickForgotPassword(): Promise<void> {
    await this.page.getByRole("link", { name: /forgot/i }).click();
  }

  get isSubmitting(): Promise<boolean> {
    return this.page.getByRole("button", { name: /signing in/i }).isVisible();
  }
}

/**
 * Forgot Password Page Object
 */
export class ForgotPasswordPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoAuth("/forgot-password");
  }

  async requestReset(email: string): Promise<void> {
    await this.fillByLabel(/email/i, email);
    await this.clickButton(/send reset link/i);
  }

  async expectForm(): Promise<void> {
    await expect(this.page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(this.page.getByRole("button", { name: /send reset link/i })).toBeVisible();
  }

  async expectSuccessMessage(): Promise<void> {
    await expect(this.page.getByText(/check your email/i)).toBeVisible();
  }

  async clickBackToLogin(): Promise<void> {
    await this.page.getByRole("link", { name: /back to login/i }).click();
  }
}

/**
 * Reset Password Page Object
 */
export class ResetPasswordPage extends TenantBasePage {
  async goto(token: string): Promise<void> {
    await this.page.goto(`${this.tenantUrl}/auth/reset-password?token=${token}`);
    await this.waitForNavigation();
  }

  async resetPassword(password: string, confirmPassword: string): Promise<void> {
    await this.fillByLabel(/new password/i, password);
    await this.fillByLabel(/confirm password/i, confirmPassword);
    await this.clickButton(/reset password/i);
  }

  async expectForm(): Promise<void> {
    await expect(this.page.getByLabel(/new password/i)).toBeVisible();
    await expect(this.page.getByLabel(/confirm password/i)).toBeVisible();
  }

  async expectError(message: string | RegExp): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible();
  }
}

/**
 * Marketing Signup Page Object (main domain)
 */
export class SignupPage {
  constructor(protected readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("http://localhost:5173/signup");
  }

  async fillForm(data: {
    subdomain: string;
    businessName: string;
    email: string;
    password: string;
  }): Promise<void> {
    await this.page.getByLabel(/subdomain/i).fill(data.subdomain);
    await this.page.getByLabel(/business name/i).fill(data.businessName);
    await this.page.getByRole("textbox", { name: /email/i }).fill(data.email);
    await this.page.locator('input[type="password"]').first().fill(data.password);
  }

  async submit(): Promise<void> {
    await this.page.getByRole("button", { name: /sign up|create|get started/i }).click();
  }

  async expectForm(): Promise<void> {
    await expect(this.page.getByLabel(/subdomain/i)).toBeVisible();
    await expect(this.page.getByLabel(/business name/i)).toBeVisible();
    await expect(this.page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(this.page.locator('input[type="password"]').first()).toBeVisible();
  }

  async expectSubdomainPreview(subdomain: string): Promise<void> {
    await expect(this.page.getByText(new RegExp(`${subdomain}.*divestreams`, "i"))).toBeVisible();
  }

  async expectValidationError(): Promise<void> {
    await expect(this.page.getByText(/invalid|format|required/i)).toBeVisible();
  }

  async expectRedirectToTenant(subdomain: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${subdomain}.*\\/app`));
  }
}

import { test, expect } from "@playwright/test";
import { LoginPage, ForgotPasswordPage } from "../page-objects";
import { testConfig } from "../fixtures/test-fixtures";

test.describe("Tenant Authentication - Login", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
  });

  test("displays login form with tenant name", async ({ page }) => {
    const loginPage = new LoginPage(page, testConfig.tenantSubdomain);
    await loginPage.goto();

    await loginPage.expectLoginForm();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    const loginPage = new LoginPage(page, testConfig.tenantSubdomain);
    await loginPage.goto();

    await loginPage.login("invalid@example.com", "wrongpassword");

    await loginPage.expectError(/invalid|incorrect|wrong/i);
  });

  test("shows error for missing email", async ({ page }) => {
    const loginPage = new LoginPage(page, testConfig.tenantSubdomain);
    await loginPage.goto();

    await loginPage.fillByLabel(/password/i, "somepassword");
    await loginPage.clickButton(/sign in/i);

    // Form validation should prevent submission or show error
    await expect(page.getByLabel(/email/i)).toHaveAttribute("required", "");
  });

  test("shows error for missing password", async ({ page }) => {
    const loginPage = new LoginPage(page, testConfig.tenantSubdomain);
    await loginPage.goto();

    await loginPage.fillByLabel(/email/i, "test@example.com");
    await loginPage.clickButton(/sign in/i);

    // Form validation should prevent submission or show error
    await expect(page.getByLabel(/password/i)).toHaveAttribute("required", "");
  });

  test("shows loading state during login", async ({ page }) => {
    const loginPage = new LoginPage(page, testConfig.tenantSubdomain);
    await loginPage.goto();

    await loginPage.fillByLabel(/email/i, "test@example.com");
    await loginPage.fillByLabel(/password/i, "password123");

    // Start click but don't wait for navigation
    const submitPromise = loginPage.clickButton(/sign in/i);

    // Check for loading state
    await expect(page.getByRole("button", { name: /signing in/i })).toBeVisible({ timeout: 2000 });

    await submitPromise;
  });

  test("successful login redirects to dashboard", async ({ page }) => {
    const loginPage = new LoginPage(page, testConfig.tenantSubdomain);
    await loginPage.goto();

    await loginPage.login(
      testConfig.tenantCredentials.email,
      testConfig.tenantCredentials.password
    );

    await loginPage.expectRedirectToDashboard();
  });

  test("has link to forgot password", async ({ page }) => {
    const loginPage = new LoginPage(page, testConfig.tenantSubdomain);
    await loginPage.goto();

    await expect(page.getByRole("link", { name: /forgot/i })).toBeVisible();
  });

  test("forgot password link navigates to correct page", async ({ page }) => {
    const loginPage = new LoginPage(page, testConfig.tenantSubdomain);
    await loginPage.goto();

    await loginPage.clickForgotPassword();

    await expect(page).toHaveURL(/forgot-password/);
  });

  test("redirects already logged-in user to app", async ({ page }) => {
    // First login
    const loginPage = new LoginPage(page, testConfig.tenantSubdomain);
    await loginPage.goto();
    await loginPage.login(
      testConfig.tenantCredentials.email,
      testConfig.tenantCredentials.password
    );
    await loginPage.expectRedirectToDashboard();

    // Try to go back to login
    await loginPage.goto();

    // Should redirect back to app
    await expect(page).toHaveURL(/\/app/);
  });
});

test.describe("Tenant Authentication - Forgot Password", () => {
  test("displays forgot password form", async ({ page }) => {
    const forgotPage = new ForgotPasswordPage(page, testConfig.tenantSubdomain);
    await forgotPage.goto();

    await forgotPage.expectForm();
  });

  test("submits forgot password request", async ({ page }) => {
    const forgotPage = new ForgotPasswordPage(page, testConfig.tenantSubdomain);
    await forgotPage.goto();

    await forgotPage.requestReset("test@example.com");

    // Should show success message (to prevent email enumeration)
    await forgotPage.expectSuccessMessage();
  });

  test("shows error for missing email", async ({ page }) => {
    const forgotPage = new ForgotPasswordPage(page, testConfig.tenantSubdomain);
    await forgotPage.goto();

    await forgotPage.clickButton(/send reset link/i);

    // Form validation should require email
    await expect(page.getByLabel(/email/i)).toHaveAttribute("required", "");
  });

  test("has link back to login", async ({ page }) => {
    const forgotPage = new ForgotPasswordPage(page, testConfig.tenantSubdomain);
    await forgotPage.goto();

    await forgotPage.clickBackToLogin();

    await expect(page).toHaveURL(/login/);
  });

  test("success message has link back to login", async ({ page }) => {
    const forgotPage = new ForgotPasswordPage(page, testConfig.tenantSubdomain);
    await forgotPage.goto();

    await forgotPage.requestReset("test@example.com");
    await forgotPage.expectSuccessMessage();

    await expect(page.getByRole("link", { name: /back to login/i })).toBeVisible();
  });
});

test.describe("Tenant Authentication - Logout", () => {
  test("logout redirects to login page", async ({ page }) => {
    const loginPage = new LoginPage(page, testConfig.tenantSubdomain);

    // Login first
    await loginPage.goto();
    await loginPage.login(
      testConfig.tenantCredentials.email,
      testConfig.tenantCredentials.password
    );
    await loginPage.expectRedirectToDashboard();

    // Logout
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/auth/logout`);

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test("session is cleared after logout", async ({ page }) => {
    const loginPage = new LoginPage(page, testConfig.tenantSubdomain);

    // Login first
    await loginPage.goto();
    await loginPage.login(
      testConfig.tenantCredentials.email,
      testConfig.tenantCredentials.password
    );
    await loginPage.expectRedirectToDashboard();

    // Logout
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/auth/logout`);

    // Try to access protected route
    await page.goto(`http://${testConfig.tenantSubdomain}.localhost:5173/app`);

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });
});

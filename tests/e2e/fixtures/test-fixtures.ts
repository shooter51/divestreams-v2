import { test as base, type Page } from "@playwright/test";
import { getTenantUrl, getAdminUrl } from "../helpers/urls";

/**
 * Test credentials and configuration
 */
export const testConfig = {
  adminPassword: process.env.ADMIN_PASSWORD || "DiveAdmin2026",
  adminEmail: "admin@divestreams.com",
  tenantSubdomain: "demo",
  tenantCredentials: {
    email: "e2e-tester@demo.com",
    password: "DemoPass1234",
  },
  testUser: {
    email: `test${Date.now()}@example.com`,
    password: "SecureTestPass123!",
    firstName: "Test",
    lastName: "User",
  },
};

/**
 * Helper to login to tenant
 */
export async function loginToTenant(
  page: Page,
  subdomain: string = testConfig.tenantSubdomain,
  email: string = testConfig.tenantCredentials.email,
  password: string = testConfig.tenantCredentials.password
): Promise<void> {
  await page.goto(getTenantUrl(subdomain, "/auth/login"));

  // Check if already logged in
  if (page.url().includes("/tenant")) {
    return;
  }

  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect to app (longer timeout for remote environments)
  await page.waitForURL(/\/tenant/, { timeout: 15000 });
}

/**
 * Helper to login to admin
 * Admin login requires both email AND password (platform admin users only)
 */
export async function loginToAdmin(
  page: Page,
  email: string = testConfig.adminEmail,
  password: string = testConfig.adminPassword
): Promise<void> {
  await page.goto(getAdminUrl("/login"));

  // Admin login requires BOTH email and password (use getByRole for accessibility)
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect to dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

/**
 * Generate unique test data
 */
export function generateTestData() {
  const timestamp = Date.now();
  return {
    subdomain: `test${timestamp}`,
    email: `test${timestamp}@example.com`,
    businessName: `Test Business ${timestamp}`,
    customerName: {
      firstName: "Test",
      lastName: `Customer${timestamp}`,
    },
    tourName: `Test Tour ${timestamp}`,
    productName: `Test Product ${timestamp}`,
  };
}

/**
 * Extended test fixtures with authenticated pages
 */
type TestFixtures = {
  tenantPage: Page;
  adminPage: Page;
};

export const test = base.extend<TestFixtures>({
  tenantPage: async ({ page }, use) => {
    // Try to login, but don't fail if tenant doesn't exist
    try {
      await loginToTenant(page);
    } catch {
      // Login failed - tenant may not exist
      // Tests should handle this case
    }
    await use(page);
  },

  adminPage: async ({ page }, use) => {
    await loginToAdmin(page);
    await use(page);
  },
});

export { expect } from "@playwright/test";

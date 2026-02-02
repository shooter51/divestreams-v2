/**
 * Test Helpers Index
 *
 * Re-exports common test utilities for E2E tests.
 */

import type { Page } from "@playwright/test";
import { testConfig, loginToAdmin, loginToTenant } from "../e2e/fixtures/test-fixtures";

/**
 * Login as admin user
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await loginToAdmin(page);
}

/**
 * Login as customer/tenant user
 */
export async function loginAsCustomer(
  page: Page,
  subdomain: string = testConfig.tenantSubdomain
): Promise<void> {
  await loginToTenant(page, subdomain);
}

/**
 * Seed demo data for testing
 * This is a no-op as demo data is seeded by the test database setup.
 * Included for API compatibility with tests that expect this function.
 */
export async function seedDemoData(): Promise<void> {
  // Demo data is seeded during test setup via scripts/seed-demo-data.ts
  // This function exists for API compatibility
  return;
}

// Re-export other utilities
export { testConfig, generateTestData } from "../e2e/fixtures/test-fixtures";
export { getRedirectPathname, expectRedirectTo } from "./redirect";

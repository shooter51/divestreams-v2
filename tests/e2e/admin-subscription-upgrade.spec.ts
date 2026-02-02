/**
 * E2E Test: Admin Subscription Upgrade Flow
 *
 * [KAN-594 FIX PHASE 5]
 * End-to-end test that simulates the exact scenario reported by QA:
 * 1. Admin upgrades tenant subscription from Free → Enterprise
 * 2. Tenant logs in and verifies premium features are accessible
 */

import { test, expect } from "@playwright/test";

test.describe("KAN-594: Admin Subscription Upgrade", () => {
  const adminEmail = "admin@divestreams.com";
  const adminPassword = "admin123";
  const testTenantSlug = `e2e-kan594-${Date.now()}`;
  const testTenantEmail = `test-${Date.now()}@example.com`;
  const testPassword = "Test1234!";

  // Skip: This test is designed for production/staging environments only
  // It uses https://admin.divestreams.com URLs and requires a live database
  test.skip("admin upgrades subscription and tenant gains premium access", async ({ page, browser }) => {
    // Step 1: Admin creates new organization
    await page.goto("https://admin.divestreams.com/auth/login");
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL("**/dashboard");

    await page.goto("https://admin.divestreams.com/admin/tenants/new");
    await page.fill('input[name="slug"]', testTenantSlug);
    await page.fill('input[name="name"]', "E2E Test Organization");
    await page.fill('input[name="email"]', testTenantEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL(`**/admin/tenants/${testTenantSlug}`);

    // Step 2: Verify initial subscription is Free Trial
    const initialPlanBadge = await page.locator('text=Free Trial').first();
    await expect(initialPlanBadge).toBeVisible();

    // Step 3: Admin upgrades to Enterprise
    const planSelect = await page.locator('select[name="planId"]');
    await planSelect.selectOption({ label: /Enterprise/ });

    const statusSelect = await page.locator('select[name="status"]');
    await statusSelect.selectOption("active");

    await page.click('button:has-text("Update Subscription")');

    // Wait for success message
    await expect(page.locator('text=Changes saved successfully')).toBeVisible();

    // Step 4: Verify subscription updated in admin panel
    const enterpriseBadge = await page.locator('text=Enterprise').first();
    await expect(enterpriseBadge).toBeVisible();

    // Step 5: Open tenant context in new page
    const tenantContext = await browser.newContext();
    const tenantPage = await tenantContext.newPage();

    await tenantPage.goto(`https://${testTenantSlug}.divestreams.com/auth/login`);
    await tenantPage.fill('input[name="email"]', testTenantEmail);
    await tenantPage.fill('input[name="password"]', testPassword);
    await tenantPage.click('button[type="submit"]');

    await tenantPage.waitForURL("**/tenant/dashboard");

    // Step 6: Verify premium features are accessible (not locked)
    // Check for Integrations link (premium feature)
    const integrationsLink = await tenantPage.locator('a[href*="/tenant/integrations"]');
    await expect(integrationsLink).toBeVisible();

    // Navigate to integrations page (should not show "Premium Required" message)
    await integrationsLink.click();
    await tenantPage.waitForURL("**/tenant/integrations");

    // Should NOT see premium lock message
    await expect(tenantPage.locator('text=Premium Required')).not.toBeVisible();
    await expect(tenantPage.locator('text=Upgrade to access')).not.toBeVisible();

    // Should see integrations content
    await expect(tenantPage.locator('h1:has-text("Integrations")')).toBeVisible();

    // Step 7: Verify other premium features (Boats, Equipment, etc.)
    const boatsLink = await tenantPage.locator('a[href*="/tenant/boats"]');
    await expect(boatsLink).toBeVisible();

    const equipmentLink = await tenantPage.locator('a[href*="/tenant/equipment"]');
    await expect(equipmentLink).toBeVisible();

    await tenantContext.close();

    // Cleanup: Delete test organization
    await page.goto(`https://admin.divestreams.com/admin/tenants/${testTenantSlug}`);
    await page.click('button:has-text("Delete Organization")');
    await page.click('button:has-text("Confirm")'); // If confirmation dialog exists
  });

  test("database verification: planId is not NULL after upgrade", async ({ page }) => {
    // This test would require database access
    // In a real implementation, this would query the database directly
    // For now, we verify via API endpoint that exposes subscription data

    test.skip(true, "Requires direct database access or API endpoint");
  });

  test("cache invalidation: tenant sees changes immediately", async ({ page, browser }) => {
    // Step 1: Login as tenant with free plan
    const tenantSlug = "demo"; // Use existing demo tenant
    await page.goto(`https://${tenantSlug}.divestreams.com/auth/login`);

    // Note: This test verifies cache invalidation works
    // Full implementation would require:
    // 1. Record initial feature access state
    // 2. Admin upgrades subscription
    // 3. Verify tenant sees changes without re-login

    test.skip(true, "Requires existing test tenant with known credentials");
  });
});

test.describe("KAN-594: Migration Verification", () => {
  test("verify no NULL planIds exist after migration", async ({ request }) => {
    // This would call an admin API endpoint that checks database state
    test.skip(true, "Requires admin API endpoint for database verification");
  });
});

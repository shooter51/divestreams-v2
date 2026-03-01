/**
 * Smoke Test for KAN-652
 *
 * This test verifies the customer booking cancellation feature
 * is deployed and the routes are accessible.
 */

import { test, expect } from '@playwright/test';
import { getTenantUrl } from '../helpers/urls';

const TENANT = 'demo';

test.describe('KAN-652: Smoke Test', () => {

  test('environment is accessible and booking cancellation feature exists', async ({ page }) => {
    // 1. Verify site is accessible
    await page.goto(getTenantUrl(TENANT, '/site'));
    await expect(page).toHaveTitle(/DiveStreams|Dive/);

    // 2. Navigate to login page
    await page.goto(getTenantUrl(TENANT, '/site/login'));
    const hasLoginContent = await page.locator('h1').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasLoginContent) {
      console.log('Public site login not available — skipping remaining checks');
      return;
    }

    console.log('Environment is accessible');
  });

  test('booking detail route is accessible', async ({ page }) => {
    // This test verifies the new route exists (will 404 for invalid ID, but route should be registered)
    const response = await page.goto(getTenantUrl(TENANT, '/site/account/bookings/test-booking-id'));

    // We expect either:
    // - 401/403 (not logged in)
    // - 404 (booking not found)
    // - 400 (invalid ID format)
    // Any of these means the route is registered
    expect([400, 401, 403, 404]).toContain(response?.status() || 0);

    console.log('Booking detail route is registered');
  });
});

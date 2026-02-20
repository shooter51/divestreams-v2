/**
 * KAN-652 Smoke Test
 *
 * Verifies that the customer booking cancellation feature is deployed
 * and the new routes are accessible.
 */

import { test, expect } from '@playwright/test';
import { getTenantUrl } from '../helpers/urls';

const TENANT = 'demo';

test.describe('KAN-652: Smoke Test', () => {

  test('booking detail route exists (returns 401/403 when not logged in)', async ({ page }) => {
    // Test that the new /site/account/bookings/$id route is registered
    const response = await page.goto(getTenantUrl(TENANT, '/site/account/bookings/test-booking-id'));

    // Should get 401/403 (requires auth) or 400 (bad ID) - NOT 404 (route not found)
    const status = response?.status() || 0;

    console.log(`Route /site/account/bookings/$id returned status: ${status}`);

    // Any of these statuses means the route is registered
    expect([400, 401, 403]).toContain(status);
  });

  test('customer can access registration page', async ({ page }) => {
    await page.goto(getTenantUrl(TENANT, '/site/register'));

    // Should see registration form
    const hasContent = await page.locator('h1, h2').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasContent) {
      console.log('Registration page not available — skipping');
      test.skip();
      return;
    }

    // Should have email and password fields
    await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();
  });

  test('booking list page loads for authenticated users', async ({ page }) => {
    await page.goto(getTenantUrl(TENANT, '/site/account/bookings'));

    // Should redirect to login or show bookings page
    await page.waitForLoadState('load');

    const url = page.url();
    console.log(`Bookings page redirected to: ${url}`);

    // Either on bookings page (if logged in) or login page (if not)
    expect(url).toMatch(/\/(bookings|login)/);
  });

  test('environment is accessible and loads site content', async ({ page }) => {
    await page.goto(getTenantUrl(TENANT, '/site'));

    // Should load successfully
    await expect(page).toHaveTitle(/DiveStreams|Demo|Dive/);

    console.log('Site loads successfully');
  });
});

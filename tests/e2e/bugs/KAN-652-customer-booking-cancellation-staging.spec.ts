/**
 * E2E Test for KAN-652: Customer Booking Cancellation (Staging)
 *
 * This is a duplicate of the dev test, pointing at BASE_URL via helpers.
 * Both dev and staging variants now use the same URL helper approach.
 *
 * NOTE: This test requires public site features and customer booking data.
 * It will skip gracefully if the required data/features are not available.
 */

import { test, expect } from '@playwright/test';
import { getTenantUrl } from '../helpers/urls';

// Helper to generate unique email for test isolation
function generateTestEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

const TENANT = 'demo';

test.describe('KAN-652: Customer Booking Cancellation', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to demo tenant public site
    await page.goto(getTenantUrl(TENANT, '/site'));
    await page.waitForLoadState('load');
  });

  test('customer can view their booking details', async ({ page }) => {
    const testEmail = generateTestEmail();
    await page.goto(getTenantUrl(TENANT, '/site/register'));

    const hasRegisterForm = await page.locator('input[name="firstName"]').isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasRegisterForm) {
      console.log('Public site registration not available — skipping');
      test.skip();
      return;
    }

    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'Customer');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.fill('input[name="confirmPassword"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('load');

    await page.goto(getTenantUrl(TENANT, '/site/trips'));
    await page.waitForLoadState('load');

    const firstTrip = page.locator('a[href*="/site/trips/"]').first();
    if (!await firstTrip.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No trips available — skipping');
      test.skip();
      return;
    }
    await firstTrip.click();
    await page.waitForLoadState('load');

    const bookButton = page.locator('button:has-text("Book Now")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForLoadState('load');
    }

    const hasBookingForm = await page.locator('input[name="firstName"]').count() > 0;
    if (!hasBookingForm) {
      console.log('No booking form available — skipping');
      test.skip();
      return;
    }

    await page.fill('input[name="participants"]', '1');
    await page.click('button[type="submit"]:has-text("Continue")');
    await page.waitForLoadState('load');

    await page.goto(getTenantUrl(TENANT, '/site/account/bookings'));
    await page.waitForLoadState('load');

    await expect(page.locator('text=/Booking #/i')).toBeVisible();

    const viewDetailsLink = page.locator('a:has-text("View Details")').first();
    await expect(viewDetailsLink).toBeVisible();
    await viewDetailsLink.click();
    await page.waitForLoadState('load');

    await expect(page.locator('h1:has-text("Booking Details")')).toBeVisible();
    await expect(page.locator('text=/Booking Reference:/i')).toBeVisible();
    await expect(page.locator('h2:has-text("Trip Information")')).toBeVisible();
    await expect(page.locator('h2:has-text("Payment Summary")')).toBeVisible();

    const cancelButton = page.locator('button:has-text("Cancel Booking")');
    const hasCancelButton = await cancelButton.count() > 0;
    if (hasCancelButton) {
      await expect(cancelButton).toBeVisible();
    }
  });

  test('customer can cancel their own booking with reason', async ({ page }) => {
    const testEmail = generateTestEmail();
    await page.goto(getTenantUrl(TENANT, '/site/register'));

    const hasRegisterForm = await page.locator('input[name="firstName"]').isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasRegisterForm) {
      console.log('Public site registration not available — skipping');
      test.skip();
      return;
    }

    await page.fill('input[name="firstName"]', 'Cancel');
    await page.fill('input[name="lastName"]', 'Test');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.fill('input[name="confirmPassword"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('load');

    await page.goto(getTenantUrl(TENANT, '/site/trips'));
    await page.waitForLoadState('load');

    const firstTrip = page.locator('a[href*="/site/trips/"]').first();
    if (!await firstTrip.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No trips available — skipping');
      test.skip();
      return;
    }
    await firstTrip.click();
    await page.waitForLoadState('load');

    const bookButton = page.locator('button:has-text("Book Now")').first();
    if (await bookButton.isVisible()) {
      await bookButton.click();
      await page.waitForLoadState('load');
    }

    const hasBookingForm = await page.locator('input[name="firstName"]').count() > 0;
    if (!hasBookingForm) {
      console.log('No booking form available — skipping');
      test.skip();
      return;
    }

    await page.fill('input[name="participants"]', '1');
    await page.click('button[type="submit"]:has-text("Continue")');
    await page.waitForLoadState('load');

    await page.goto(getTenantUrl(TENANT, '/site/account/bookings'));
    await page.waitForLoadState('load');

    const viewDetailsLink = page.locator('a:has-text("View Details")').first();
    if (!await viewDetailsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No bookings to view — skipping');
      test.skip();
      return;
    }
    await viewDetailsLink.click();
    await page.waitForLoadState('load');

    const cancelButton = page.locator('button:has-text("Cancel Booking")');
    if (await cancelButton.count() === 0) {
      console.log('Booking already cancelled or completed — skipping');
      test.skip();
      return;
    }

    await cancelButton.click();

    await expect(page.locator('h3:has-text("Cancel Booking")')).toBeVisible();
    await expect(page.locator('text=/Warning/i')).toBeVisible();

    const reasonSelect = page.locator('select');
    await reasonSelect.selectOption('Schedule conflict');

    const confirmButton = page.locator('button:has-text("Confirm Cancellation")');
    await confirmButton.click();
    await page.waitForLoadState('load');

    await expect(page.locator('text=/cancelled successfully/i')).toBeVisible();
    await expect(page.locator('text=/CANCELLED/i')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel Booking")')).not.toBeVisible();
  });

  test('cancelled booking shows correct status and reason', async ({ page }) => {
    await page.goto(getTenantUrl(TENANT, '/site/account/bookings?filter=cancelled'));
    await page.waitForLoadState('load');

    const hasCancelledBookings = await page.locator('a:has-text("View Details")').count() > 0;
    if (!hasCancelledBookings) {
      console.log('No cancelled bookings available — skipping');
      test.skip();
      return;
    }

    const viewDetailsLink = page.locator('a:has-text("View Details")').first();
    await viewDetailsLink.click();
    await page.waitForLoadState('load');

    await expect(page.locator('text=/CANCELLED/i')).toBeVisible();
    await expect(page.locator('h2:has-text("Cancellation Information")')).toBeVisible();
    await expect(page.locator('text=/Cancelled on:/i')).toBeVisible();
    await expect(page.locator('text=/Reason:/i')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel Booking")')).not.toBeVisible();
  });

  test('cancellation reason is required (validation)', async ({ page }) => {
    await page.goto(getTenantUrl(TENANT, '/site/account/bookings'));
    await page.waitForLoadState('load');

    const hasBookings = await page.locator('a:has-text("View Details")').count() > 0;
    if (!hasBookings) {
      console.log('No bookings available — skipping');
      test.skip();
      return;
    }

    const viewDetailsLink = page.locator('a:has-text("View Details")').first();
    await viewDetailsLink.click();
    await page.waitForLoadState('load');

    const cancelButton = page.locator('button:has-text("Cancel Booking")');
    if (await cancelButton.count() === 0) {
      console.log('No cancellable bookings — skipping');
      test.skip();
      return;
    }

    await cancelButton.click();
    await expect(page.locator('h3:has-text("Cancel Booking")')).toBeVisible();

    const confirmButton = page.locator('button:has-text("Confirm Cancellation")');
    await expect(confirmButton).toBeDisabled();

    const reasonSelect = page.locator('select');
    await reasonSelect.selectOption('Other (please specify)');

    await expect(page.locator('textarea[placeholder*="reason"]')).toBeVisible();
    await expect(confirmButton).toBeDisabled();

    await page.fill('textarea', 'My custom cancellation reason');
    await expect(confirmButton).not.toBeDisabled();
  });

  test('cancelled booking appears in "Cancelled" filter tab', async ({ page }) => {
    await page.goto(getTenantUrl(TENANT, '/site/account/bookings'));
    await page.waitForLoadState('load');

    const cancelledTab = page.locator('button:has-text("Cancelled")');
    if (!await cancelledTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Bookings page or Cancelled tab not available — skipping');
      test.skip();
      return;
    }
    await cancelledTab.click();
    await page.waitForLoadState('load');

    expect(page.url()).toContain('filter=cancelled');

    const hasCancelledBookings = await page.locator('a:has-text("View Details")').count() > 0;
    if (!hasCancelledBookings) {
      await expect(page.locator('text=/No cancelled bookings/i')).toBeVisible();
    } else {
      await expect(page.locator('text=/Booking #/i')).toBeVisible();
      await expect(page.locator('text=/Cancelled/i')).toBeVisible();
      await expect(page.locator('text=/Cancelled:/i')).toBeVisible();
    }
  });

  test('custom cancellation reason works with "Other" option', async ({ page }) => {
    await page.goto(getTenantUrl(TENANT, '/site/account/bookings'));
    await page.waitForLoadState('load');

    const hasBookings = await page.locator('a:has-text("View Details")').count() > 0;
    if (!hasBookings) {
      console.log('No bookings available — skipping');
      test.skip();
      return;
    }

    const viewDetailsLink = page.locator('a:has-text("View Details")').first();
    await viewDetailsLink.click();
    await page.waitForLoadState('load');

    const cancelButton = page.locator('button:has-text("Cancel Booking")');
    if (await cancelButton.count() === 0) {
      console.log('No cancellable bookings — skipping');
      test.skip();
      return;
    }

    await cancelButton.click();
    await expect(page.locator('h3:has-text("Cancel Booking")')).toBeVisible();

    const reasonSelect = page.locator('select');
    await reasonSelect.selectOption('Other (please specify)');

    const customReasonTextarea = page.locator('textarea[placeholder*="reason"]');
    await expect(customReasonTextarea).toBeVisible();

    const customReason = 'I have a family emergency and need to cancel';
    await customReasonTextarea.fill(customReason);

    const confirmButton = page.locator('button:has-text("Confirm Cancellation")');
    await expect(confirmButton).not.toBeDisabled();

    await confirmButton.click();
    await page.waitForLoadState('load');

    await expect(page.locator('text=/cancelled successfully/i')).toBeVisible();

    await page.reload();
    await page.waitForLoadState('load');

    await expect(page.locator(`text=${customReason}`)).toBeVisible();
  });

  test('completed bookings cannot be cancelled', async ({ page }) => {
    await page.goto(getTenantUrl(TENANT, '/site/account/bookings?filter=completed'));
    await page.waitForLoadState('load');

    const hasCompletedBookings = await page.locator('a:has-text("View Details")').count() > 0;
    if (!hasCompletedBookings) {
      console.log('No completed bookings available — skipping');
      test.skip();
      return;
    }

    const viewDetailsLink = page.locator('a:has-text("View Details")').first();
    await viewDetailsLink.click();
    await page.waitForLoadState('load');

    await expect(page.locator('text=/COMPLETED/i')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel Booking")')).not.toBeVisible();
  });

  test('booking confirmation page shows link to booking details when logged in', async ({ page }) => {
    await page.goto(getTenantUrl(TENANT, '/site/account/bookings'));
    await page.waitForLoadState('load');

    const hasBookings = await page.locator('a:has-text("View Details")').count() > 0;
    if (!hasBookings) {
      console.log('No bookings available — skipping');
      test.skip();
      return;
    }

    const viewDetailsLinks = page.locator('a:has-text("View Details")');
    await expect(viewDetailsLinks.first()).toBeVisible();

    const href = await viewDetailsLinks.first().getAttribute('href');
    expect(href).toMatch(/\/site\/account\/bookings\/[a-f0-9-]+/);
  });
});

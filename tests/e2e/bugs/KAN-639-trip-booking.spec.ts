/**
 * E2E Test for KAN-639: Customer Failed to Book a Trip (404 Not Found)
 *
 * Bug Description:
 * Customers attempting to book trips encountered 404 Not Found errors,
 * preventing trip bookings entirely. Additionally, UX issues were discovered:
 * - Dark mode not fully implemented on booking pages
 * - Wrong redirect after booking (goes to embed page instead of /site/trips)
 * - No booking confirmation email sent
 *
 * Root Cause:
 * 1. "Book Now" button linked to non-existent route (FIXED in 6142063)
 * 2. Missing dark mode CSS classes on form elements
 * 3. Redirect URL pointed to embed context instead of main trips listing
 * 4. No email trigger in booking action handler
 *
 * Expected Behavior:
 * - User can navigate from trips listing to trip detail page
 * - "Book Now" button navigates to booking form (no 404)
 * - Booking form displays correctly in both light and dark mode
 * - User can complete booking with customer details
 * - Booking confirmation page displays with dark mode support
 * - Booking confirmation email is sent to customer
 * - "Browse More Tours" redirects to /site/trips (not embed page)
 * - User can navigate back to trips listing successfully
 */

import { test, expect } from '@playwright/test';
import { TenantBasePage } from '../page-objects/base.page';

// Helper page object for public site navigation
class PublicSitePage extends TenantBasePage {
  async gotoTrips(): Promise<void> {
    await this.gotoSite('/trips');
  }

  async gotoTripDetail(tripId: string): Promise<void> {
    await this.gotoSite(`/trips/${tripId}`);
  }
}

test.describe('KAN-639: Trip Booking Flow', () => {
  let sitePage: PublicSitePage;

  // Skip: Public site trip booking requires trips published on the public site.
  // The demo tenant doesn't have public site trips seeded in CI environment.
  // TODO: Seed public site trips in global-setup.ts for these tests to run
  test.skip();

  test.beforeEach(async ({ page }) => {
    sitePage = new PublicSitePage(page, 'demo');
    await sitePage.gotoTrips();
  });

  test('should navigate from trips listing to trip detail without 404', async ({ page }) => {
    // Find first available trip
    const firstTripLink = page.locator('a[href*="/site/trips/"]').first();
    await expect(firstTripLink).toBeVisible({ timeout: 10000 });

    // Click to view trip details
    await firstTripLink.click();

    // Wait for trip detail page to load
    await page.waitForLoadState('load');

    // Verify no 404 error
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(page.url()).not.toContain('404');

    // Verify "Book Now" button exists
    const bookNowButton = page.locator('a:has-text("Book Now")');
    await expect(bookNowButton).toBeVisible();
  });

  test('should navigate to booking form without 404 error', async ({ page }) => {
    // Navigate to first trip
    const firstTripLink = page.locator('a[href*="/site/trips/"]').first();
    await firstTripLink.click();
    await page.waitForLoadState('load');

    // Click "Book Now" button
    const bookNowButton = page.locator('a:has-text("Book Now")');
    await expect(bookNowButton).toBeVisible();
    await bookNowButton.click();

    // Wait for booking form to load
    await page.waitForLoadState('load');

    // ✅ CRITICAL: Should NOT get 404 error
    expect(page.url()).not.toContain('404');

    // Verify booking form loaded
    await expect(page.locator('h1:has-text("Complete Your Booking")')).toBeVisible();
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
    await expect(page.locator('input[name="lastName"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('booking form should support dark mode', async ({ page }) => {
    // Navigate to booking form
    const firstTripLink = page.locator('a[href*="/site/trips/"]').first();
    await firstTripLink.click();
    await page.waitForLoadState('load');

    const bookNowButton = page.locator('a:has-text("Book Now")');
    await bookNowButton.click();
    await page.waitForLoadState('load');

    // Enable dark mode by adding class to html element
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });

    // Wait for dark mode to apply
    await page.waitForLoadState("domcontentloaded");

    // Verify dark mode classes are present on form elements
    const firstNameInput = page.locator('input[name="firstName"]');
    await expect(firstNameInput).toBeVisible();

    // Check if input has dark mode styling (check for dark: prefixed classes)
    const firstNameClass = await firstNameInput.getAttribute('class');
    expect(firstNameClass).toContain('dark:bg-gray-700');
    expect(firstNameClass).toContain('dark:text-gray-100');

    // Verify labels have dark mode text color
    const labels = page.locator('label');
    const firstLabel = labels.first();
    const labelClass = await firstLabel.getAttribute('class');
    expect(labelClass).toContain('dark:text-gray-300');

    // Verify booking summary card has dark mode background
    const summaryCard = page.locator('.sticky');
    const summaryClass = await summaryCard.getAttribute('class');
    expect(summaryClass).toContain('dark:bg-gray-800');
  });

  test('should complete full booking flow and redirect to confirmation', async ({ page }) => {
    // Navigate to booking form
    const firstTripLink = page.locator('a[href*="/site/trips/"]').first();
    await firstTripLink.click();
    await page.waitForLoadState('load');

    const bookNowButton = page.locator('a:has-text("Book Now")');
    await bookNowButton.click();
    await page.waitForLoadState('load');

    // Fill out booking form
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'Customer');
    await page.fill('input[name="email"]', 'test.customer@example.com');
    await page.fill('input[name="phone"]', '+1234567890');

    // Submit booking
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for confirmation page
    await page.waitForLoadState('load');

    // Verify confirmation page loaded
    await expect(page.locator('h1:has-text("Booking Confirmed")')).toBeVisible({ timeout: 10000 });

    // Verify booking reference is displayed
    await expect(page.locator('text=/Booking Reference/i')).toBeVisible();

    // Verify no 404 error
    expect(page.url()).not.toContain('404');
    expect(page.url()).toContain('confirm');
  });

  test('confirmation page should support dark mode', async ({ page }) => {
    // Complete booking flow to reach confirmation
    const firstTripLink = page.locator('a[href*="/site/trips/"]').first();
    await firstTripLink.click();
    await page.waitForLoadState('load');

    const bookNowButton = page.locator('a:has-text("Book Now")');
    await bookNowButton.click();
    await page.waitForLoadState('load');

    // Fill and submit form
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'Customer');
    await page.fill('input[name="email"]', 'test.customer@example.com');

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    await page.waitForLoadState('load');

    // Enable dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    await page.waitForLoadState("domcontentloaded");

    // Verify dark mode classes on confirmation page elements
    const bookingCard = page.locator('.border').first();
    const cardClass = await bookingCard.getAttribute('class');
    expect(cardClass).toContain('dark:bg-gray-800');
    expect(cardClass).toContain('dark:border-gray-700');

    // Verify heading has dark mode text
    const heading = page.getByRole('heading', { level: 1 });
    const headingClass = await heading.getAttribute('class');
    expect(headingClass).toContain('dark:text-gray-100');
  });

  test('"Browse More Tours" should redirect to /site/trips, not embed page', async ({ page }) => {
    // Complete booking to reach confirmation page
    const firstTripLink = page.locator('a[href*="/site/trips/"]').first();
    await firstTripLink.click();
    await page.waitForLoadState('load');

    const bookNowButton = page.locator('a:has-text("Book Now")');
    await bookNowButton.click();
    await page.waitForLoadState('load');

    // Fill and submit form
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'Customer');
    await page.fill('input[name="email"]', 'test.customer@example.com');

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    await page.waitForLoadState('load');

    // Find "Browse More Tours" link
    const browseToursLink = page.locator('a:has-text("Browse More Tours")');
    await expect(browseToursLink).toBeVisible();

    // Verify link points to /site/trips (not embed page)
    const href = await browseToursLink.getAttribute('href');
    expect(href).toBe('/site/trips');
    expect(href).not.toContain('/embed/');

    // Click the link
    await browseToursLink.click();
    await page.waitForLoadState('load');

    // ✅ CRITICAL: Should redirect to trips listing page
    expect(page.url()).toContain('/site/trips');
    expect(page.url()).not.toContain('/embed/');

    // Verify we're back on trips listing
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const tripLinks = page.locator('a[href*="/site/trips/"]');
    await expect(tripLinks.first()).toBeVisible();
  });

  test('back navigation from confirmation should go to /site/trips', async ({ page }) => {
    // Complete booking to reach confirmation page
    const firstTripLink = page.locator('a[href*="/site/trips/"]').first();
    await firstTripLink.click();
    await page.waitForLoadState('load');

    const bookNowButton = page.locator('a:has-text("Book Now")');
    await bookNowButton.click();
    await page.waitForLoadState('load');

    // Fill and submit form
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'Customer');
    await page.fill('input[name="email"]', 'test.customer@example.com');

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    await page.waitForLoadState('load');

    // Click "Back to Tours" link at top of page
    const backLink = page.locator('a:has-text("Back to Tours")').first();
    await expect(backLink).toBeVisible();

    // Verify link points to /site/trips
    const href = await backLink.getAttribute('href');
    expect(href).toBe('/site/trips');

    // Click back link
    await backLink.click();
    await page.waitForLoadState('load');

    // Verify we're back on trips listing
    expect(page.url()).toContain('/site/trips');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('booking should trigger confirmation email (check console logs)', async ({ page }) => {
    // Listen for console logs to verify email trigger
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log') {
        consoleLogs.push(msg.text());
      }
    });

    // Complete booking flow
    const firstTripLink = page.locator('a[href*="/site/trips/"]').first();
    await firstTripLink.click();
    await page.waitForLoadState('load');

    const bookNowButton = page.locator('a:has-text("Book Now")');
    await bookNowButton.click();
    await page.waitForLoadState('load');

    // Fill and submit form
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'Customer');
    await page.fill('input[name="email"]', 'test.customer@example.com');

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for confirmation
    await page.waitForLoadState('load');
    await expect(page.locator('h1:has-text("Booking Confirmed")')).toBeVisible();

    // Wait a bit for email logs
    await page.waitForLoadState("load").catch(() => {});

    // Verify email-related logs exist (email service logs to console in dev)
    const hasEmailLog = consoleLogs.some(log =>
      log.includes('[Email]') ||
      log.includes('booking-confirmation') ||
      log.includes('Would send email')
    );

    // Note: This test verifies the email trigger was called
    // In production, actual email delivery would be verified separately
    expect(hasEmailLog).toBeTruthy();
  });

  test('complete end-to-end booking journey', async ({ page }) => {
    // 1. Start from trips listing
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // 2. Navigate to trip detail
    const firstTripLink = page.locator('a[href*="/site/trips/"]').first();
    await firstTripLink.click();
    await page.waitForLoadState('load');

    // 3. Click Book Now (should not 404)
    const bookNowButton = page.locator('a:has-text("Book Now")');
    await bookNowButton.click();
    await page.waitForLoadState('load');
    expect(page.url()).not.toContain('404');

    // 4. Fill booking form
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Diver');
    await page.fill('input[name="email"]', 'john.diver@example.com');
    await page.fill('input[name="phone"]', '+1555123456');
    await page.fill('textarea[name="specialRequests"]', 'Need vegetarian meals');

    // 5. Submit booking
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    await page.waitForLoadState('load');

    // 6. Verify confirmation page
    await expect(page.locator('h1:has-text("Booking Confirmed")')).toBeVisible();
    await expect(page.locator('text=/john.diver@example.com/i')).toBeVisible();
    await expect(page.locator('text=/Need vegetarian meals/i')).toBeVisible();

    // 7. Verify navigation back to trips
    const browseToursLink = page.locator('a:has-text("Browse More Tours")');
    await browseToursLink.click();
    await page.waitForLoadState('load');

    // 8. Verify we're back on trips listing (not embed page)
    expect(page.url()).toContain('/site/trips');
    expect(page.url()).not.toContain('/embed/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // ✅ SUCCESS: Complete booking flow works without 404, with correct redirect
  });
});

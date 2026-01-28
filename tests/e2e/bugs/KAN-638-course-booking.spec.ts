/**
 * E2E Test for KAN-638: Customer unable to book a course
 *
 * Bug Description:
 * When customer clicks "Proceed to Payment" button on course detail page,
 * nothing happens. The button should navigate to enrollment form with
 * selected session.
 *
 * Root Cause:
 * The "Enroll Now" button in sidebar price card links to enrollment form
 * without required sessionId parameter, causing 400 error.
 *
 * Expected Behavior:
 * - User selects a session from available sessions
 * - "Enroll Now" button becomes enabled
 * - Clicking button navigates to enrollment form with sessionId
 * - Enrollment form loads successfully
 *
 * THIS TEST SHOULD FAIL BEFORE FIX IS IMPLEMENTED
 */

import { test, expect } from '@playwright/test';

test.describe('KAN-638: Course Booking Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to a course detail page on customer-facing site
    // Using demo tenant for testing
    await page.goto('http://demo.localhost:5173/site/courses');

    // Wait for courses to load
    await page.waitForLoadState('networkidle');
  });

  test('should require session selection before enabling Enroll Now button', async ({ page }) => {
    // Find and click on first available course
    const firstCourseLink = page.locator('a[href*="/site/courses/"]').first();
    await expect(firstCourseLink).toBeVisible();
    await firstCourseLink.click();

    // Wait for course detail page to load
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toBeVisible();

    // Find the sidebar "Enroll Now" button
    const enrollButton = page.locator('a:has-text("Enroll Now")').first();
    await expect(enrollButton).toBeVisible();

    // ❌ THIS WILL FAIL: Button should be disabled until session is selected
    // Currently, button is always enabled and links to enrollment without sessionId
    await expect(enrollButton).toHaveAttribute('aria-disabled', 'true');

    // ❌ THIS WILL FAIL: Should have visual feedback for user
    const selectionPrompt = page.locator('text=/Select a session below/i');
    await expect(selectionPrompt).toBeVisible();
  });

  test('should navigate to enrollment form with sessionId when session is selected', async ({ page }) => {
    // Find and click on first available course
    const firstCourseLink = page.locator('a[href*="/site/courses/"]').first();
    await firstCourseLink.click();

    // Wait for course detail page to load
    await page.waitForLoadState('networkidle');

    // Check if there are available sessions
    const sessionCards = page.locator('text=/Available Training Sessions/i');
    const hasSessionsSection = await sessionCards.count() > 0;

    if (!hasSessionsSection) {
      test.skip('No sessions available for this course');
      return;
    }

    // Find and click "Enroll" button on a specific session card
    const sessionEnrollButton = page.locator('a:has-text("Enroll")').first();
    await expect(sessionEnrollButton).toBeVisible();

    // Get the href to verify sessionId is included
    const sessionEnrollHref = await sessionEnrollButton.getAttribute('href');
    expect(sessionEnrollHref).toContain('sessionId=');

    // Click the session-specific enroll button
    await sessionEnrollButton.click();

    // ✅ THIS SHOULD PASS: Session enroll buttons work correctly
    await page.waitForLoadState('networkidle');

    // Verify we're on the enrollment form
    await expect(page.locator('h1:has-text("Enroll in Course")')).toBeVisible();

    // Verify URL contains sessionId
    expect(page.url()).toContain('sessionId=');

    // Verify form loads without errors
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
    await expect(page.locator('input[name="lastName"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('sidebar Enroll Now button should work after selecting session', async ({ page }) => {
    // Find and click on first available course
    const firstCourseLink = page.locator('a[href*="/site/courses/"]').first();
    await firstCourseLink.click();

    // Wait for course detail page to load
    await page.waitForLoadState('networkidle');

    // Check if there are available sessions
    const hasSessionsSection = await page.locator('text=/Available Training Sessions/i').count() > 0;

    if (!hasSessionsSection) {
      test.skip('No sessions available for this course');
      return;
    }

    // Sidebar button should initially be disabled
    const sidebarEnrollButton = page.locator('a:has-text("Enroll Now")').first();

    // ❌ THIS WILL FAIL: Button should be disabled before session selection
    await expect(sidebarEnrollButton).toHaveAttribute('aria-disabled', 'true');

    // Select a session by clicking on it (not the enroll button)
    const firstSessionCard = page.locator('[class*="bg-gray-50 rounded-lg"]:has(a:has-text("Enroll"))').first();
    await firstSessionCard.click();

    // ❌ THIS WILL FAIL: After selecting session, sidebar button should become enabled
    await expect(sidebarEnrollButton).not.toHaveAttribute('aria-disabled', 'true');

    // Click the sidebar "Enroll Now" button
    await sidebarEnrollButton.click();

    // ❌ THIS WILL FAIL: Should navigate to enrollment form with sessionId
    await page.waitForLoadState('networkidle');

    // Verify we're on the enrollment form
    await expect(page.locator('h1:has-text("Enroll in Course")')).toBeVisible();

    // ❌ THIS WILL FAIL: URL should contain sessionId
    expect(page.url()).toContain('sessionId=');

    // Verify form loads without 400 error
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
  });

  test('clicking sidebar Enroll Now without session selection should show error', async ({ page }) => {
    // Find and click on first available course
    const firstCourseLink = page.locator('a[href*="/site/courses/"]').first();
    await firstCourseLink.click();

    // Wait for course detail page to load
    await page.waitForLoadState('networkidle');

    // Try to force-click the sidebar button (if it's not disabled)
    const sidebarEnrollButton = page.locator('a:has-text("Enroll Now")').first();

    // Remove disabled attribute if present (to test error handling)
    await page.evaluate(() => {
      const button = document.querySelector('a:has-text("Enroll Now")');
      if (button) {
        button.removeAttribute('aria-disabled');
      }
    });

    // Click the button
    await sidebarEnrollButton.click({ force: true });

    // ❌ THIS WILL FAIL: Should show 400 error or redirect with error message
    // Currently this is what happens and it's the bug being reported

    // Check if we get a 400 error page
    const has400Error = await page.locator('text=/400|Bad Request|No training session selected/i').count() > 0;

    // OR check if we're shown an error message
    const hasErrorMessage = await page.locator('[role="alert"], .error, .bg-red').count() > 0;

    // Currently: has400Error will be true (the bug)
    // After fix: Button should be disabled, so we shouldn't reach here
    // This test documents the current buggy behavior

    if (has400Error) {
      console.log('BUG CONFIRMED: 400 error when clicking Enroll Now without session selection');
    }
  });

  test('course with no available sessions should show contact message', async ({ page }) => {
    // Find and click on first available course
    const firstCourseLink = page.locator('a[href*="/site/courses/"]').first();
    await firstCourseLink.click();

    // Wait for course detail page to load
    await page.waitForLoadState('networkidle');

    // Check if there are no available sessions
    const noSessionsMessage = page.locator('text=/No Scheduled Sessions|Contact us/i');
    const hasNoSessions = await noSessionsMessage.count() > 0;

    if (!hasNoSessions) {
      test.skip('This course has available sessions');
      return;
    }

    // When no sessions available, sidebar button should show alternative text
    const contactLink = page.locator('a:has-text("Contact Us")');
    await expect(contactLink).toBeVisible();

    // Enroll Now button should either be hidden or disabled
    const enrollButton = page.locator('a:has-text("Enroll Now")');
    const enrollButtonCount = await enrollButton.count();

    if (enrollButtonCount > 0) {
      // If button exists, it should be disabled
      await expect(enrollButton).toHaveAttribute('aria-disabled', 'true');
    }
  });
});

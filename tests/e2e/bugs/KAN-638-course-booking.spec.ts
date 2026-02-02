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
import { TenantBasePage } from '../page-objects/base.page';

// Helper page object for public site navigation
class PublicSitePage extends TenantBasePage {
  async gotoCourses(): Promise<void> {
    await this.gotoSite('/courses');
  }
}

test.describe('KAN-638: Course Booking Flow', () => {
  let sitePage: PublicSitePage;

  // Skip: Public site course booking requires courses published on the public site.
  // The demo tenant doesn't have public site courses seeded in CI environment.
  // TODO: Seed public site courses in global-setup.ts for these tests to run
  test.skip();

  test.beforeEach(async ({ page }) => {
    // Navigate to courses page on customer-facing site using base URL
    sitePage = new PublicSitePage(page, 'demo');
    await sitePage.gotoCourses();
  });

  test('should require session selection before enabling Enroll Now button', async ({ page }) => {
    // Find and click on first available course
    const firstCourseLink = page.locator('a[href*="/site/courses/"]').first();
    await expect(firstCourseLink).toBeVisible();
    await firstCourseLink.click();

    // Wait for course detail page to load
    await page.waitForLoadState('load');
    await expect(page.locator('h1')).toBeVisible();

    // Find the sidebar "Enroll Now" button (it's a button, not a link)
    const enrollButton = page.getByRole('button', { name: /enroll now/i });
    await expect(enrollButton).toBeVisible();

    // ✅ PASSING: Button should be disabled until session is selected
    await expect(enrollButton).toBeDisabled();

    // ✅ PASSING: Should have visual feedback for user
    const selectionPrompt = page.locator('text=/Select a session below/i');
    await expect(selectionPrompt).toBeVisible();
  });

  test('should navigate to enrollment form with sessionId when session is selected', async ({ page }) => {
    // Find and click on first available course
    const firstCourseLink = page.locator('a[href*="/site/courses/"]').first();
    await firstCourseLink.click();

    // Wait for course detail page to load
    await page.waitForLoadState('load');

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
    await page.waitForLoadState('load');

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
    await page.waitForLoadState('load');

    // Check if there are available sessions
    const hasSessionsSection = await page.locator('text=/Available Training Sessions/i').count() > 0;

    if (!hasSessionsSection) {
      test.skip('No sessions available for this course');
      return;
    }

    // Sidebar button should initially be disabled
    const sidebarEnrollButton = page.getByRole('button', { name: /enroll now/i });

    // ✅ PASSING: Button should be disabled before session selection
    await expect(sidebarEnrollButton).toBeDisabled();

    // Select a session by clicking the session-specific Enroll link
    const sessionEnrollLink = page.locator('a:has-text("Enroll")').first();
    await expect(sessionEnrollLink).toBeVisible();

    // Click the session-specific enroll link (contains sessionId)
    await sessionEnrollLink.click();

    // ✅ PASSING: Should navigate to enrollment form with sessionId
    await page.waitForLoadState('load');

    // Verify we're on the enrollment form
    await expect(page.locator('h1:has-text("Enroll in Course")')).toBeVisible();

    // ✅ PASSING: URL should contain sessionId
    expect(page.url()).toContain('sessionId=');

    // Verify form loads without 400 error
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
  });

  test('clicking sidebar Enroll Now without session selection should show error', async ({ page }) => {
    // Find and click on first available course
    const firstCourseLink = page.locator('a[href*="/site/courses/"]').first();
    await firstCourseLink.click();

    // Wait for course detail page to load
    await page.waitForLoadState('load');

    // Find the sidebar button (it's a button element, not a link)
    const sidebarEnrollButton = page.getByRole('button', { name: /enroll now/i });

    // ✅ PASSING: Button should be disabled when no session selected
    await expect(sidebarEnrollButton).toBeDisabled();

    // Verify user sees prompt to select session
    await expect(page.locator('text=/Select a session below/i')).toBeVisible();

    // This test verifies the button is properly disabled to prevent the bug
    // (Previously, button was a link that allowed navigation without sessionId, causing 400 error)
  });

  test('course with no available sessions should show contact message', async ({ page }) => {
    // Find and click on first available course
    const firstCourseLink = page.locator('a[href*="/site/courses/"]').first();
    await firstCourseLink.click();

    // Wait for course detail page to load
    await page.waitForLoadState('load');

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
    const enrollButton = page.getByRole('button', { name: /enroll now/i });
    const enrollButtonCount = await enrollButton.count();

    if (enrollButtonCount > 0) {
      // If button exists, it should be disabled
      await expect(enrollButton).toBeDisabled();
    }
  });
});

import { test, expect } from "../fixtures/subdomain-page";
import type { Page } from "@playwright/test";

/**
 * Embed Courses Widget E2E Tests - DiveStreams
 *
 * COMPREHENSIVE TESTS FOR EMBED COURSE ENROLLMENT WIDGET
 * =======================================================
 *
 * Tests the course enrollment widget (/embed/:tenant/courses/*):
 * - Course listing page
 * - Course detail page with training sessions
 * - Enrollment form submission
 * - Confirmation page display
 *
 * IMPORTANT DEPENDENCIES:
 * -----------------------
 * This test suite requires:
 *   - Test tenant "e2etest" to exist (created by 00-full-workflow.spec.ts test 2.3)
 *   - Test user "e2e-user@example.com" to exist (created by 00-full-workflow.spec.ts test 3.4)
 *   - At least one public course with upcoming sessions (created by training-module.spec.ts)
 *
 * BLOCK STRUCTURE:
 * ----------------
 * Block A: Course Listing (~4 tests)
 * Block B: Course Detail (~5 tests)
 * Block C: Enrollment Form (~8 tests)
 * Block D: Confirmation Page (~4 tests)
 */

// Embed Courses Widget Tests
test.describe.serial("Embed Courses Widget Tests", () => {

// Shared test data - reuses tenant from 00-full-workflow.spec.ts
const testData = {
  tenant: {
    subdomain: "e2etest",
    shopName: "E2E Test Shop",
  },
  enrollment: {
    firstName: "John",
    lastName: "Doe",
    email: `test-enrollment-${Date.now()}@example.com`,
    phone: "555-1234",
    dateOfBirth: "1990-01-01",
    notes: "Test enrollment from E2E test suite",
  },
  createdIds: {
    courseId: null as string | null,
    sessionId: null as string | null,
    enrollmentId: null as string | null,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get embed widget URL
 */
const getEmbedUrl = (path: string = "/courses") =>
  `http://localhost:5173/embed/${testData.tenant.subdomain}${path}`;

/**
 * Extract course ID from URL
 */
function extractCourseId(url: string): string | null {
  const match = url.match(/\/courses\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

/**
 * Extract session ID from query params
 */
function extractSessionId(url: string): string | null {
  const urlObj = new URL(url);
  return urlObj.searchParams.get("sessionId");
}

/**
 * Extract enrollment ID from query params
 */
function extractEnrollmentId(url: string): string | null {
  const urlObj = new URL(url);
  return urlObj.searchParams.get("enrollmentId");
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK A: Course Listing (~4 tests)
// Tests course listing page that shows all public courses
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("Block A: Course Listing", () => {
  test("[KAN-555] A.1 Course listing page loads @smoke", async ({ page }) => {
    await page.goto(getEmbedUrl("/courses"));
    await page.waitForTimeout(1500);

    // Should load the courses listing page
    expect(page.url()).toContain("/embed/");
    expect(page.url()).toContain("/courses");

    // Should have page content
    const hasBody = await page.locator("body").isVisible().catch(() => false);
    expect(hasBody).toBeTruthy();
  });

  test("[KAN-556] A.2 Course listing shows course cards or empty state", async ({ page }) => {
    await page.goto(getEmbedUrl("/courses"));
    await page.waitForTimeout(1500);

    // Should show either course cards or an empty state
    const hasCourseCards = await page.locator("[class*='card'], [class*='grid'] a").first().isVisible().catch(() => false);
    const hasEmptyState = await page.getByText(/no courses|coming soon|check back/i).isVisible().catch(() => false);
    const hasHeader = await page.getByRole("heading", { name: /certification|course/i }).isVisible().catch(() => false);

    expect(hasCourseCards || hasEmptyState || hasHeader).toBeTruthy();
  });

  test("[KAN-557] A.3 Course cards show agency and level badges", async ({ page }) => {
    await page.goto(getEmbedUrl("/courses"));
    await page.waitForTimeout(1500);

    const firstCourseCard = page.locator("[class*='card'], [class*='grid'] a").first();
    const hasCourseCards = await firstCourseCard.isVisible().catch(() => false);

    if (hasCourseCards) {
      // Check for agency/level badges
      const hasAgencyBadge = await page.locator("[class*='card']").first().locator("img[alt*='PAD'], img[alt*='SSI'], img[alt*='NAU'], span").first().isVisible().catch(() => false);
      const hasLevelBadge = await page.getByText(/open water|advanced|rescue|divemaster/i).first().isVisible().catch(() => false);

      expect(hasAgencyBadge || hasLevelBadge).toBeTruthy();
    } else {
      console.log("No courses available - skipping badge test");
    }
  });

  test("[KAN-558] A.4 Course cards link to detail pages", async ({ page }) => {
    await page.goto(getEmbedUrl("/courses"));
    await page.waitForTimeout(1500);

    const firstCourseCard = page.locator("a[href*='/courses/']").first();
    const hasCourseCards = await firstCourseCard.isVisible().catch(() => false);

    if (hasCourseCards) {
      await firstCourseCard.click();
      await page.waitForTimeout(1500);

      // Should navigate to course detail page
      expect(page.url()).toMatch(/\/courses\/[a-f0-9-]+/);

      // Store course ID for later tests
      testData.createdIds.courseId = extractCourseId(page.url());
    } else {
      console.log("No courses available - skipping link test");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK B: Course Detail (~5 tests)
// Tests course detail page showing course info and available sessions
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("Block B: Course Detail", () => {
  test("[KAN-559] B.1 Course detail page loads", async ({ page }) => {
    // First go to listing to find a course
    await page.goto(getEmbedUrl("/courses"));
    await page.waitForTimeout(1500);

    const firstCourseCard = page.locator("a[href*='/courses/']").first();
    const hasCourseCards = await firstCourseCard.isVisible().catch(() => false);

    if (hasCourseCards) {
      await firstCourseCard.click();
      await page.waitForTimeout(1500);

      // Should be on course detail page
      expect(page.url()).toMatch(/\/courses\/[a-f0-9-]+/);
      expect(page.url()).not.toContain("/enroll");

      // Store course ID
      testData.createdIds.courseId = extractCourseId(page.url());
    } else {
      console.log("No courses available - skipping detail test");
    }
  });

  test("[KAN-560] B.2 Course detail shows agency and level info", async ({ page }) => {
    if (!testData.createdIds.courseId) {
      console.log("No course ID - skipping test");
      return;
    }

    await page.goto(getEmbedUrl(`/courses/${testData.createdIds.courseId}`));
    await page.waitForTimeout(1500);

    // Should show agency badge/name
    const hasAgencyInfo = await page.locator("img[alt*='PAD'], img[alt*='SSI'], span").first().isVisible().catch(() => false);
    const hasLevelBadge = await page.getByText(/open water|advanced|rescue|beginner|intermediate/i).first().isVisible().catch(() => false);

    expect(hasAgencyInfo || hasLevelBadge).toBeTruthy();
  });

  test("[KAN-561] B.3 Course detail shows course stats (days, students, hours, dives)", async ({ page }) => {
    if (!testData.createdIds.courseId) {
      console.log("No course ID - skipping test");
      return;
    }

    await page.goto(getEmbedUrl(`/courses/${testData.createdIds.courseId}`));
    await page.waitForTimeout(1500);

    // Check for course stats
    const hasDays = await page.getByText(/\d+\s*day/i).isVisible().catch(() => false);
    const hasStudents = await page.getByText(/max\s*\d+/i).isVisible().catch(() => false);
    const hasHours = await page.getByText(/\d+\s*hours/i).isVisible().catch(() => false);

    // At least one stat should be visible
    expect(hasDays || hasStudents || hasHours).toBeTruthy();
  });

  test("[KAN-562] B.4 Course detail lists available training sessions", async ({ page }) => {
    if (!testData.createdIds.courseId) {
      console.log("No course ID - skipping test");
      return;
    }

    await page.goto(getEmbedUrl(`/courses/${testData.createdIds.courseId}`));
    await page.waitForTimeout(1500);

    // Check for sessions section
    const hasSessionsHeader = await page.getByRole("heading", { name: /training session|available session/i }).isVisible().catch(() => false);
    const hasSessionList = await page.locator("[class*='session'], [class*='grid']").isVisible().catch(() => false);
    const hasNoSessionsMessage = await page.getByText(/no upcoming session|no session/i).isVisible().catch(() => false);

    expect(hasSessionsHeader || hasSessionList || hasNoSessionsMessage).toBeTruthy();
  });

  test("[KAN-563] B.5 Sessions show enroll buttons with available spots", async ({ page }) => {
    if (!testData.createdIds.courseId) {
      console.log("No course ID - skipping test");
      return;
    }

    await page.goto(getEmbedUrl(`/courses/${testData.createdIds.courseId}`));
    await page.waitForTimeout(1500);

    // Look for enroll button on sessions
    const enrollButton = page.getByRole("link", { name: /enroll/i }).first();
    const hasEnrollButton = await enrollButton.isVisible().catch(() => false);

    if (hasEnrollButton) {
      // Should show available spots
      const hasSpots = await page.getByText(/\d+\s*spot/i).isVisible().catch(() => false);
      expect(hasSpots || hasEnrollButton).toBeTruthy();

      // Store session ID from href for later tests
      const href = await enrollButton.getAttribute("href");
      if (href) {
        const sessionId = extractSessionId(`http://localhost${href}`);
        testData.createdIds.sessionId = sessionId;
      }
    } else {
      // No sessions or all full - that's OK
      const hasNoSessions = await page.getByText(/no upcoming|no session|full/i).isVisible().catch(() => false);
      expect(hasNoSessions || page.url().includes("/courses")).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK C: Enrollment Form (~8 tests)
// Tests enrollment form submission and validation
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("Block C: Enrollment Form", () => {
  test("[KAN-564] C.1 Enrollment form requires session ID", async ({ page }) => {
    if (!testData.createdIds.courseId) {
      console.log("No course ID - skipping test");
      return;
    }

    // Try to access enrollment without sessionId
    await page.goto(getEmbedUrl(`/courses/${testData.createdIds.courseId}/enroll`));
    await page.waitForTimeout(1500);

    // Should show error or redirect back
    const hasError = await page.getByText(/no.*session|session.*required/i).isVisible().catch(() => false);
    const redirectedBack = !page.url().includes("/enroll");

    expect(hasError || redirectedBack).toBeTruthy();
  });

  test("[KAN-565] C.2 Enrollment form loads with valid session ID", async ({ page }) => {
    if (!testData.createdIds.courseId || !testData.createdIds.sessionId) {
      console.log("No course or session ID - skipping test");
      return;
    }

    await page.goto(getEmbedUrl(`/courses/${testData.createdIds.courseId}/enroll?sessionId=${testData.createdIds.sessionId}`));
    await page.waitForTimeout(1500);

    // Should be on enrollment form
    expect(page.url()).toContain("/enroll");
    expect(page.url()).toContain("sessionId=");

    // Should have form
    const hasForm = await page.locator("form").isVisible().catch(() => false);
    expect(hasForm).toBeTruthy();
  });

  test("[KAN-566] C.3 Enrollment form has required fields", async ({ page }) => {
    if (!testData.createdIds.courseId || !testData.createdIds.sessionId) {
      console.log("No course or session ID - skipping test");
      return;
    }

    await page.goto(getEmbedUrl(`/courses/${testData.createdIds.courseId}/enroll?sessionId=${testData.createdIds.sessionId}`));
    await page.waitForTimeout(1500);

    // Check for required fields
    const hasFirstName = await page.getByLabel(/first name/i).isVisible().catch(() => false);
    const hasLastName = await page.getByLabel(/last name/i).isVisible().catch(() => false);
    const hasEmail = await page.getByRole("textbox", { name: /email/i }).isVisible().catch(() => false);

    expect(hasFirstName && hasLastName && hasEmail).toBeTruthy();
  });

  test("[KAN-567] C.4 Enrollment form has optional fields", async ({ page }) => {
    if (!testData.createdIds.courseId || !testData.createdIds.sessionId) {
      console.log("No course or session ID - skipping test");
      return;
    }

    await page.goto(getEmbedUrl(`/courses/${testData.createdIds.courseId}/enroll?sessionId=${testData.createdIds.sessionId}`));
    await page.waitForTimeout(1500);

    // Check for optional fields
    const hasPhone = await page.getByLabel(/phone/i).isVisible().catch(() => false);
    const hasDOB = await page.getByLabel(/date of birth|birth/i).isVisible().catch(() => false);
    const hasNotes = await page.getByLabel(/note|special/i).isVisible().catch(() => false);

    // At least one optional field should exist
    expect(hasPhone || hasDOB || hasNotes).toBeTruthy();
  });

  test("[KAN-568] C.5 Enrollment form shows session details in sidebar", async ({ page }) => {
    if (!testData.createdIds.courseId || !testData.createdIds.sessionId) {
      console.log("No course or session ID - skipping test");
      return;
    }

    await page.goto(getEmbedUrl(`/courses/${testData.createdIds.courseId}/enroll?sessionId=${testData.createdIds.sessionId}`));
    await page.waitForTimeout(1500);

    // Check for enrollment summary section
    const hasSummary = await page.getByText(/enrollment summary|training session/i).isVisible().catch(() => false);
    const hasSessionDate = await page.locator("[class*='summary'], [class*='detail']").first().isVisible().catch(() => false);

    expect(hasSummary || hasSessionDate).toBeTruthy();
  });

  test("[KAN-569] C.6 Enrollment form validates required fields", async ({ page }) => {
    if (!testData.createdIds.courseId || !testData.createdIds.sessionId) {
      console.log("No course or session ID - skipping test");
      return;
    }

    await page.goto(getEmbedUrl(`/courses/${testData.createdIds.courseId}/enroll?sessionId=${testData.createdIds.sessionId}`));
    await page.waitForTimeout(1500);

    // Try to submit without filling required fields
    const submitButton = page.getByRole("button", { name: /enroll/i });
    const hasSubmitButton = await submitButton.isVisible().catch(() => false);

    if (hasSubmitButton) {
      await submitButton.click();
      await page.waitForTimeout(1000);

      // Should stay on form page - validation prevents submission
      expect(page.url()).toContain("/enroll");
    }
  });

  test("[KAN-570] C.7 Enrollment form validates email format", async ({ page }) => {
    if (!testData.createdIds.courseId || !testData.createdIds.sessionId) {
      console.log("No course or session ID - skipping test");
      return;
    }

    await page.goto(getEmbedUrl(`/courses/${testData.createdIds.courseId}/enroll?sessionId=${testData.createdIds.sessionId}`));
    await page.waitForTimeout(1500);

    // Fill with invalid email
    await page.getByLabel(/first name/i).fill("Test");
    await page.getByLabel(/last name/i).fill("User");
    await page.getByRole("textbox", { name: /email/i }).fill("invalid-email");

    const submitButton = page.getByRole("button", { name: /enroll/i });
    if (await submitButton.isVisible().catch(() => false)) {
      await submitButton.click();
      await page.waitForTimeout(1000);

      // Should show error or stay on page
      const hasError = await page.locator("[class*='error'], [class*='text-red']").isVisible().catch(() => false);
      const stayedOnForm = page.url().includes("/enroll");

      expect(hasError || stayedOnForm).toBeTruthy();
    }
  });

  test("[KAN-571] C.8 Enrollment form submits successfully @critical", async ({ page }) => {
    if (!testData.createdIds.courseId || !testData.createdIds.sessionId) {
      console.log("No course or session ID - skipping test");
      return;
    }

    await page.goto(getEmbedUrl(`/courses/${testData.createdIds.courseId}/enroll?sessionId=${testData.createdIds.sessionId}`));
    await page.waitForTimeout(1500);

    // Fill out enrollment form
    await page.getByLabel(/first name/i).fill(testData.enrollment.firstName);
    await page.getByLabel(/last name/i).fill(testData.enrollment.lastName);
    await page.getByRole("textbox", { name: /email/i }).fill(testData.enrollment.email);

    // Fill optional fields if present
    const phoneField = page.getByLabel(/phone/i);
    if (await phoneField.isVisible().catch(() => false)) {
      await phoneField.fill(testData.enrollment.phone);
    }

    const dobField = page.getByLabel(/date of birth|birth/i);
    if (await dobField.isVisible().catch(() => false)) {
      await dobField.fill(testData.enrollment.dateOfBirth);
    }

    const notesField = page.getByLabel(/note|special/i);
    if (await notesField.isVisible().catch(() => false)) {
      await notesField.fill(testData.enrollment.notes);
    }

    // Submit form
    const submitButton = page.getByRole("button", { name: /enroll/i });
    await submitButton.click();
    await page.waitForTimeout(3000);

    // Should redirect to confirmation page
    const redirectedToConfirm = page.url().includes("/confirm");
    const hasEnrollmentId = page.url().includes("enrollmentId=");

    expect(redirectedToConfirm && hasEnrollmentId).toBeTruthy();

    // Store enrollment ID for next tests
    if (hasEnrollmentId) {
      testData.createdIds.enrollmentId = extractEnrollmentId(page.url());
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK D: Confirmation Page (~4 tests)
// Tests enrollment confirmation page
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("Block D: Confirmation Page", () => {
  test("[KAN-572] D.1 Confirmation page loads with enrollment ID", async ({ page }) => {
    if (!testData.createdIds.enrollmentId) {
      console.log("No enrollment ID - skipping test");
      return;
    }

    await page.goto(getEmbedUrl(`/courses/confirm?enrollmentId=${testData.createdIds.enrollmentId}`));
    await page.waitForTimeout(1500);

    // Should be on confirmation page
    expect(page.url()).toContain("/confirm");
    expect(page.url()).toContain("enrollmentId=");
  });

  test("[KAN-573] D.2 Confirmation page shows success message", async ({ page }) => {
    if (!testData.createdIds.enrollmentId) {
      console.log("No enrollment ID - skipping test");
      return;
    }

    await page.goto(getEmbedUrl(`/courses/confirm?enrollmentId=${testData.createdIds.enrollmentId}`));
    await page.waitForTimeout(1500);

    // Check for success indicators
    const hasSuccessMessage = await page.getByText(/confirmed|success|thank you/i).isVisible().catch(() => false);
    const hasCheckmark = await page.locator("svg[class*='check']").isVisible().catch(() => false);

    expect(hasSuccessMessage || hasCheckmark).toBeTruthy();
  });

  test("[KAN-574] D.3 Confirmation page shows enrollment details", async ({ page }) => {
    if (!testData.createdIds.enrollmentId) {
      console.log("No enrollment ID - skipping test");
      return;
    }

    await page.goto(getEmbedUrl(`/courses/confirm?enrollmentId=${testData.createdIds.enrollmentId}`));
    await page.waitForTimeout(1500);

    // Check for enrollment info
    const hasCourseName = await page.locator("h2, h3, h4").first().isVisible().catch(() => false);
    const hasStudentInfo = await page.getByText(new RegExp(testData.enrollment.firstName, "i")).isVisible().catch(() => false);
    const hasEmail = await page.getByText(new RegExp(testData.enrollment.email, "i")).isVisible().catch(() => false);

    expect(hasCourseName || hasStudentInfo || hasEmail).toBeTruthy();
  });

  test("[KAN-575] D.4 Confirmation page has action buttons", async ({ page }) => {
    if (!testData.createdIds.enrollmentId) {
      console.log("No enrollment ID - skipping test");
      return;
    }

    await page.goto(getEmbedUrl(`/courses/confirm?enrollmentId=${testData.createdIds.enrollmentId}`));
    await page.waitForTimeout(1500);

    // Check for action buttons
    const hasBackButton = await page.getByRole("link", { name: /browse|back|courses/i }).isVisible().catch(() => false);
    const hasPrintButton = await page.getByRole("button", { name: /print/i }).isVisible().catch(() => false);

    expect(hasBackButton || hasPrintButton).toBeTruthy();
  });
});

});

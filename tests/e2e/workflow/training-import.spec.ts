import { test, expect } from "@playwright/test";

/**
 * Training Import Wizard E2E Tests
 *
 * DEPENDENCIES:
 * - Test user "e2e-user@example.com" must exist (created by 00-full-workflow.spec.ts test 3.4)
 * - Run 00-full-workflow.spec.ts first if tests fail due to missing user
 */

const BASE_URL = process.env.BASE_URL || "http://e2etest.localhost:5173";
const getTenantUrl = (path: string) => `${BASE_URL}${path}`;

// Shared test data (consistent with other test files)
const testUser = {
  email: "e2e-user@example.com", // Shared with 00-full-workflow.spec.ts
  password: "TestPass123!",
};

// Helper to select a supported agency (PADI, SSI, or NAUI have course templates)
async function selectSupportedAgency(page: any) {
  const agencyDropdown = page.locator('select[name="agencyId"]');
  // Try to select PADI first (most common), fall back to SSI, then NAUI
  const options = await agencyDropdown.locator('option').allTextContents();
  const padiOption = options.find((opt: string) => opt.includes('PADI'));
  const ssiOption = options.find((opt: string) => opt.includes('SSI'));
  const nauiOption = options.find((opt: string) => opt.includes('NAUI'));

  if (padiOption) {
    await agencyDropdown.selectOption({ label: padiOption });
    return true;
  } else if (ssiOption) {
    await agencyDropdown.selectOption({ label: ssiOption });
    return true;
  } else if (nauiOption) {
    await agencyDropdown.selectOption({ label: nauiOption });
    return true;
  }
  return false;
}

// Helper function to login
async function loginToTenant(page: any) {
  await page.goto(getTenantUrl("/auth/login"));
  await page.fill('input[name="email"]', testUser.email);
  await page.fill('input[name="password"]', testUser.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(getTenantUrl("/tenant"));
}

test.describe("Training Import Wizard", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("A.1 Navigate to training import from dashboard @smoke", async ({ page }) => {
    // Go to training dashboard
    await page.goto(getTenantUrl("/tenant/training"));
    await page.waitForLoadState("networkidle");

    // Verify "Import Courses" button exists - wait for it to be visible
    const importButton = page.getByRole("link", { name: /import courses/i });
    await expect(importButton).toBeVisible({ timeout: 10000 });

    // Click to navigate to import page
    await importButton.click();
    await page.waitForURL(/\/tenant\/training\/import/);

    // Verify we're on import page
    expect(page.url()).toContain("/tenant/training/import");

    // Verify page title
    const heading = page.getByRole("heading", { name: /import training courses/i });
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("B.1 Step 1: Select agency displays correctly @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("networkidle");

    // Verify Step 1 is active
    const step1 = page.locator('text=Select Agency');
    await expect(step1).toBeVisible();

    // Verify agency dropdown exists
    const agencyDropdown = page.locator('select[name="agencyId"]');
    await expect(agencyDropdown).toBeVisible();

    // Should have at least the placeholder option (and possibly agencies from seed data)
    const options = agencyDropdown.locator('option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThanOrEqual(1); // At least the placeholder

    // First option should be the placeholder
    const firstOption = await options.first().textContent();
    expect(firstOption?.toLowerCase()).toContain('select');

    // Verify next button exists
    const nextButton = page.getByRole("button", { name: /next.*select courses/i });
    await expect(nextButton).toBeVisible();
  });

  test("B.2 Step 1: Cannot submit without selecting agency @validation", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("networkidle");

    // Try to submit without selection
    const nextButton = page.getByRole("button", { name: /next.*select courses/i });
    await nextButton.click();

    // HTML5 validation should prevent submission
    const agencyDropdown = page.locator('select[name="agencyId"]');
    const isInvalid = await agencyDropdown.evaluate((el: any) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();
  });

  test("C.1 Step 2: Select courses after choosing agency @critical", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("networkidle");

    // Select a supported agency (PADI, SSI, or NAUI)
    const selected = await selectSupportedAgency(page);

    if (selected) {
      // Submit to go to step 2
      const nextButton = page.getByRole("button", { name: /next.*select courses/i });
      await nextButton.click();
      await page.waitForLoadState("networkidle");

      // Verify we're on Step 2
      const step2Heading = page.getByRole("heading", { name: /choose courses to import/i });
      await expect(step2Heading).toBeVisible({ timeout: 10000 });

      // Verify mock courses are displayed
      const openWaterCourse = page.locator('text=/open water diver/i').first();
      await expect(openWaterCourse).toBeVisible();

      // Verify select all/none buttons
      const selectAllBtn = page.getByRole("button", { name: /select all/i });
      const selectNoneBtn = page.getByRole("button", { name: /select none/i });
      await expect(selectAllBtn).toBeVisible();
      await expect(selectNoneBtn).toBeVisible();
    } else {
      test.skip();
    }
  });

  test("C.2 Step 2: Select All and Select None buttons work @critical", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("networkidle");

    // Navigate to Step 2
    const selected = await selectSupportedAgency(page);

    if (selected) {
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("networkidle");

      // Wait for select all button to be visible
      const selectAllBtn = page.getByRole("button", { name: /select all/i });
      await expect(selectAllBtn).toBeVisible({ timeout: 10000 });

      // Click "Select All"
      await selectAllBtn.click();

      // Verify count shows all selected (use flexible regex for any count)
      const selectedCount = page.locator('text=/\\d+ of \\d+ selected/i');
      await expect(selectedCount).toBeVisible();
      const countText = await selectedCount.textContent();
      expect(countText).toMatch(/3 of 3 selected/i);

      // Click "Select None"
      const selectNoneBtn = page.getByRole("button", { name: /select none/i });
      await selectNoneBtn.click();

      // Verify count shows none selected
      await expect(selectedCount).toHaveText(/0 of 3 selected/i);
    } else {
      test.skip();
    }
  });

  test("C.3 Step 2: Individual course selection toggles correctly @critical", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("networkidle");

    // Navigate to Step 2
    const selected = await selectSupportedAgency(page);

    if (selected) {
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("networkidle");

      // Find first checkbox - wait for it
      const firstCheckbox = page.locator('input[name="courses"]').first();
      await expect(firstCheckbox).toBeVisible({ timeout: 10000 });

      // Click to select
      await firstCheckbox.click();
      await expect(firstCheckbox).toBeChecked();

      // Verify count updated
      const countText = page.locator('text=/\\d+ of \\d+ selected/i');
      await expect(countText).toHaveText(/1 of 3 selected/i);

      // Click to deselect
      await firstCheckbox.click();
      await expect(firstCheckbox).not.toBeChecked();

      // Verify count updated
      await expect(countText).toHaveText(/0 of 3 selected/i);
    } else {
      test.skip();
    }
  });

  test("C.4 Step 2: Cannot proceed without selecting courses @validation", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("networkidle");

    // Navigate to Step 2
    const selected = await selectSupportedAgency(page);

    if (selected) {
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("networkidle");

      // Verify preview button is disabled when nothing selected
      const previewButton = page.locator('button[type="submit"]').filter({ hasText: /preview/i });
      await expect(previewButton).toBeVisible({ timeout: 10000 });
      await expect(previewButton).toBeDisabled();
    } else {
      test.skip();
    }
  });

  test("C.5 Step 2: Course cards display all information @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("networkidle");

    // Navigate to Step 2
    const selected = await selectSupportedAgency(page);

    if (selected) {
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("networkidle");

      // Check Open Water Diver course card - wait for it
      const courseCard = page.locator('label').filter({ has: page.locator('text=/open water/i') }).first();
      await expect(courseCard).toBeVisible({ timeout: 10000 });

      // Verify course name
      await expect(courseCard.locator('text=/open water/i').first()).toBeVisible();

      // Verify course code (OW or similar)
      await expect(courseCard.locator('.bg-gray-100')).toBeVisible();

      // Verify description exists
      await expect(courseCard.locator('.text-gray-600')).toBeVisible();

      // Verify duration info exists
      await expect(courseCard.locator('.text-gray-500')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test("D.1 Step 3: Preview displays after selecting courses @critical", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("networkidle");

    // Navigate through all steps
    const selected = await selectSupportedAgency(page);

    if (selected) {
      // Step 1: Select agency - already done by helper
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("networkidle");

      // Step 2: Select a course
      const firstCheckbox = page.locator('input[name="courses"]').first();
      await expect(firstCheckbox).toBeVisible({ timeout: 10000 });
      await firstCheckbox.click();
      await expect(firstCheckbox).toBeChecked();

      // Submit to go to Step 3
      const previewButton = page.locator('button[type="submit"]').filter({ hasText: /preview/i });
      await expect(previewButton).toBeEnabled();
      await previewButton.click();
      await page.waitForLoadState("networkidle");

      // Verify we're on Step 3
      const step3Heading = page.getByRole("heading", { name: /preview.*import/i });
      await expect(step3Heading).toBeVisible({ timeout: 10000 });

      // Verify import message is shown
      const readyText = page.locator('text=/ready to import/i');
      await expect(readyText).toBeVisible();
    } else {
      test.skip();
    }
  });

  test("D.2 Step 3: Import button is enabled when courses selected @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("networkidle");

    // Navigate to Step 3
    const selected = await selectSupportedAgency(page);

    if (selected) {
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("networkidle");

      const firstCheckbox = page.locator('input[name="courses"]').first();
      await expect(firstCheckbox).toBeVisible({ timeout: 10000 });
      await firstCheckbox.click();
      await expect(firstCheckbox).toBeChecked();

      const previewButton = page.locator('button[type="submit"]').filter({ hasText: /preview/i });
      await expect(previewButton).toBeEnabled();
      await previewButton.click();
      await page.waitForLoadState("networkidle");

      // Verify import button exists and is enabled
      const importButton = page.locator('button[type="submit"]').filter({ hasText: /import/i });
      await expect(importButton).toBeVisible({ timeout: 10000 });
      await expect(importButton).toBeEnabled();
    } else {
      test.skip();
    }
  });

  test("D.3 Step 3: What will happen section displays correctly @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("networkidle");

    // Navigate to Step 3
    const selected = await selectSupportedAgency(page);

    if (selected) {
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("networkidle");

      const firstCheckbox = page.locator('input[name="courses"]').first();
      await expect(firstCheckbox).toBeVisible({ timeout: 10000 });
      await firstCheckbox.click();
      await expect(firstCheckbox).toBeChecked();

      const previewButton = page.locator('button[type="submit"]').filter({ hasText: /preview/i });
      await previewButton.click();
      await page.waitForLoadState("networkidle");

      // Verify "What will happen" section
      const whatWillHappen = page.locator('text=/what will happen/i');
      await expect(whatWillHappen).toBeVisible({ timeout: 10000 });

      // Verify key points are listed (matching actual UI text)
      const templateText = page.locator('text=/course templates will be added/i');
      const customizeText = page.locator('text=/customize pricing/i');
      const draftText = page.locator('text=/created as drafts/i');

      await expect(templateText).toBeVisible();
      await expect(customizeText).toBeVisible();
      await expect(draftText).toBeVisible();
    } else {
      test.skip();
    }
  });

  test("E.1 Progress indicator shows current step @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("networkidle");

    // Step 1: Verify step 1 is active (blue circle with "1")
    // The step indicator has: div.rounded-full with bg-blue-600 when active
    const step1Circle = page.locator('div.rounded-full:has-text("1")').first();
    await expect(step1Circle).toBeVisible();
    const step1Classes = await step1Circle.getAttribute('class');
    expect(step1Classes).toContain('bg-blue-600');

    // Navigate to Step 2
    const selected = await selectSupportedAgency(page);

    if (selected) {
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("networkidle");

      // Verify step 1 is completed (checkmark in green circle)
      const step1Checkmark = page.locator('div.rounded-full:has-text("✓")').first();
      await expect(step1Checkmark).toBeVisible();
      const step1CompletedClasses = await step1Checkmark.getAttribute('class');
      expect(step1CompletedClasses).toContain('bg-green-600');

      // Verify step 2 is active (blue circle with "2")
      const step2Circle = page.locator('div.rounded-full:has-text("2")').first();
      const step2Classes = await step2Circle.getAttribute('class');
      expect(step2Classes).toContain('bg-blue-600');
    } else {
      test.skip();
    }
  });

  test("E.2 Back button navigation works @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("networkidle");

    const selected = await selectSupportedAgency(page);

    if (selected) {
      // Go to Step 2
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("networkidle");

      // Click Back link (it's actually an <a> tag, not a button)
      const backLink = page.getByRole("link", { name: /back/i });
      await expect(backLink).toBeVisible({ timeout: 10000 });

      await backLink.click();
      await page.waitForLoadState("networkidle");

      // Verify we're back on Step 1
      const step1Heading = page.getByRole("heading", { name: /select certification agency/i });
      await expect(step1Heading).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});

import { test, expect } from "@playwright/test";
import { getTenantUrl as _getTenantUrl } from "../helpers/urls";

/**
 * Training Import Wizard E2E Tests
 *
 * DEPENDENCIES:
 * - Test user "e2e-user@example.com" must exist (created by 00-full-workflow.spec.ts test 3.4)
 * - Run 00-full-workflow.spec.ts first if tests fail due to missing user
 */

const getTenantUrl = (path: string) => _getTenantUrl("e2etest", path);

// Shared test data (consistent with other test files)
const testUser = {
  email: "e2e-user@example.com", // Shared with 00-full-workflow.spec.ts
  password: "TestPass123!",
};

// Helper to select a supported agency (PADI, SSI, or NAUI have course templates)
async function selectSupportedAgency(page: import("@playwright/test").Page) {
  const agencyDropdown = page.locator('#agencySelect');
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
async function loginToTenant(page: import("@playwright/test").Page) {
  await page.goto(getTenantUrl("/auth/login"));
  await page.fill('input[name="email"]', testUser.email);
  await page.fill('input[name="password"]', testUser.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/tenant/, { timeout: 10000 });
}

test.describe("Training Import Wizard", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("[KAN-576] A.1 Navigate to training import from dashboard @smoke", async ({ page }) => {
    // Go to training dashboard
    await page.goto(getTenantUrl("/tenant/training"));
    await page.waitForLoadState("load");
    await page.waitForLoadState("load").catch(() => {});

    // Check if we were redirected to dashboard (feature gate)
    if (page.url().includes("/dashboard") && !page.url().includes("/training")) {
      // Feature gate redirected - skip gracefully
      test.skip(true, "Training feature not available on current plan");
      return;
    }

    // Verify "Import Courses" button exists - retry with reload if needed
    const importButton = page.getByRole("link", { name: /import courses/i });
    if (!(await importButton.isVisible().catch(() => false))) {
      await page.reload();
      await page.waitForLoadState("load");
      await page.waitForLoadState("load").catch(() => {});
    }
    await expect(importButton).toBeVisible({ timeout: 10000 });

    // Click to navigate to import page
    await importButton.click();
    await page.waitForURL(/\/tenant\/training\/import/, { timeout: 10000 });

    // Verify we're on import page
    expect(page.url()).toContain("/tenant/training/import");

    // Verify page title
    const heading = page.getByRole("heading", { name: /import training courses/i });
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("[KAN-577] B.1 Step 1: Select agency displays correctly @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("load");

    // Check if we were redirected (feature gate)
    if (page.url().includes("/dashboard") && !page.url().includes("/training")) {
      test.skip(true, "Training feature not available on current plan");
      return;
    }

    // Wait for Step 1 with condition-based waiting (retry with reload if needed)
    const step1 = page.locator('text=Select Agency');
    try {
      await step1.waitFor({ state: "visible", timeout: 5000 });
    } catch {
      await page.reload();
      await page.waitForLoadState("load");
      await step1.waitFor({ state: "visible", timeout: 8000 });
    }
    await expect(step1).toBeVisible({ timeout: 8000 });

    // Verify agency dropdown exists
    const agencyDropdown = page.locator('#agencySelect');
    await expect(agencyDropdown).toBeVisible({ timeout: 5000 });

    // Should have at least the placeholder option (and possibly agencies from seed data)
    const options = agencyDropdown.locator('option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThanOrEqual(1); // At least the placeholder

    // First option should be the placeholder
    const firstOption = await options.first().textContent();
    expect(firstOption?.toLowerCase()).toContain('select');

    // Verify next button exists
    const nextButton = page.getByRole("button", { name: /next.*select courses/i });
    await expect(nextButton).toBeVisible({ timeout: 5000 });
  });

  test("[KAN-578] B.2 Step 1: Cannot submit without selecting agency @validation", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("load");

    // Check if we were redirected (feature gate)
    if (page.url().includes("/dashboard") && !page.url().includes("/training")) {
      test.skip(true, "Training feature not available on current plan");
      return;
    }

    // Wait for Next button with condition-based waiting (retry with reload if needed)
    const nextButton = page.getByRole("button", { name: /next.*select courses/i });
    try {
      await nextButton.waitFor({ state: "visible", timeout: 5000 });
    } catch {
      await page.reload();
      await page.waitForLoadState("load");
      await nextButton.waitFor({ state: "visible", timeout: 8000 });
    }
    await expect(nextButton).toBeVisible({ timeout: 8000 });
    await nextButton.click();

    // HTML5 validation should prevent submission
    const agencyDropdown = page.locator('#agencySelect');
    await expect(agencyDropdown).toBeVisible({ timeout: 5000 });
    const isInvalid = await agencyDropdown.evaluate((el: HTMLSelectElement) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();
  });

  test("[KAN-579] C.1 Step 2: Select courses after choosing agency @critical", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("load");

    // Select a supported agency (PADI, SSI, or NAUI)
    const selected = await selectSupportedAgency(page);

    if (selected) {
      // Submit to go to step 2
      const nextButton = page.getByRole("button", { name: /next.*select courses/i });
      await nextButton.click();
      await page.waitForLoadState("load");

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

  test("[KAN-580] C.2 Step 2: Select All and Select None buttons work @critical", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("load");

    // Navigate to Step 2
    const selected = await selectSupportedAgency(page);

    if (selected) {
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("load");

      // Wait for select all button to be visible
      const selectAllBtn = page.getByRole("button", { name: /select all/i });
      await expect(selectAllBtn).toBeVisible({ timeout: 10000 });

      // Click "Select All"
      await selectAllBtn.click();

      // Verify count shows all selected (flexible - any count where selected equals total)
      const selectedCount = page.locator('text=/\\d+ of \\d+ selected/i');
      await expect(selectedCount).toBeVisible();
      const countText = await selectedCount.textContent();
      // Parse the count to verify all are selected (e.g., "6 of 6 selected")
      const match = countText?.match(/(\d+) of (\d+) selected/i);
      expect(match).toBeTruthy();
      expect(match![1]).toEqual(match![2]); // Selected count equals total count

      // Click "Select None"
      const selectNoneBtn = page.getByRole("button", { name: /select none/i });
      await selectNoneBtn.click();

      // Verify count shows none selected (0 of N)
      await expect(selectedCount).toHaveText(/0 of \d+ selected/i);
    } else {
      test.skip();
    }
  });

  test("[KAN-581] C.3 Step 2: Individual course selection toggles correctly @critical", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("load");

    // Navigate to Step 2
    const selected = await selectSupportedAgency(page);

    if (selected) {
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("load");

      // Find first checkbox - wait for it
      const firstCheckbox = page.locator('input[name="courses"]').first();
      await expect(firstCheckbox).toBeVisible({ timeout: 10000 });

      // Click to select
      await firstCheckbox.click();
      await expect(firstCheckbox).toBeChecked();

      // Verify count updated to "1 of N selected" (flexible for any total)
      const countText = page.locator('text=/\\d+ of \\d+ selected/i');
      await expect(countText).toHaveText(/1 of \d+ selected/i);

      // Click to deselect
      await firstCheckbox.click();
      await expect(firstCheckbox).not.toBeChecked();

      // Verify count updated to "0 of N selected"
      await expect(countText).toHaveText(/0 of \d+ selected/i);
    } else {
      test.skip();
    }
  });

  test("[KAN-582] C.4 Step 2: Cannot proceed without selecting courses @validation", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("load");

    // Navigate to Step 2
    const selected = await selectSupportedAgency(page);

    if (selected) {
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("load");

      // Verify preview button is disabled when nothing selected
      const previewButton = page.locator('button[type="submit"]').filter({ hasText: /preview/i });
      await expect(previewButton).toBeVisible({ timeout: 10000 });
      await expect(previewButton).toBeDisabled();
    } else {
      test.skip();
    }
  });

  test("[KAN-583] C.5 Step 2: Course cards display all information @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("load");

    // Navigate to Step 2
    const selected = await selectSupportedAgency(page);

    if (selected) {
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("load");

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

  test("[KAN-584] D.1 Step 3: Preview displays after selecting courses @critical", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("load");

    // Navigate through all steps
    const selected = await selectSupportedAgency(page);

    if (selected) {
      // Step 1: Select agency - already done by helper
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("load");

      // Step 2: Select a course
      const firstCheckbox = page.locator('input[name="courses"]').first();
      await expect(firstCheckbox).toBeVisible({ timeout: 10000 });
      await firstCheckbox.click();
      await expect(firstCheckbox).toBeChecked();

      // Submit to go to Step 3
      const previewButton = page.locator('button[type="submit"]').filter({ hasText: /preview/i });
      await expect(previewButton).toBeEnabled();
      await previewButton.click();
      await page.waitForLoadState("load");

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

  test("[KAN-585] D.2 Step 3: Import button is enabled when courses selected @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("load");

    // Navigate to Step 3
    const selected = await selectSupportedAgency(page);

    if (selected) {
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("load");

      const firstCheckbox = page.locator('input[name="courses"]').first();
      await expect(firstCheckbox).toBeVisible({ timeout: 10000 });
      await firstCheckbox.click();
      await expect(firstCheckbox).toBeChecked();

      const previewButton = page.locator('button[type="submit"]').filter({ hasText: /preview/i });
      await expect(previewButton).toBeEnabled();
      await previewButton.click();
      await page.waitForLoadState("load");

      // Verify import button exists and is enabled
      const importButton = page.locator('button[type="submit"]').filter({ hasText: /import/i });
      await expect(importButton).toBeVisible({ timeout: 10000 });
      await expect(importButton).toBeEnabled();
    } else {
      test.skip();
    }
  });

  test("[KAN-586] D.3 Step 3: What will happen section displays correctly @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("load");

    // Navigate to Step 3
    const selected = await selectSupportedAgency(page);

    if (selected) {
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("load");

      const firstCheckbox = page.locator('input[name="courses"]').first();
      await expect(firstCheckbox).toBeVisible({ timeout: 10000 });
      await firstCheckbox.click();
      await expect(firstCheckbox).toBeChecked();

      const previewButton = page.locator('button[type="submit"]').filter({ hasText: /preview/i });
      await previewButton.click();
      await page.waitForLoadState("load");

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

  test("[KAN-587] E.1 Progress indicator shows current step @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("load");

    // Check if we were redirected (feature gate)
    if (page.url().includes("/dashboard") && !page.url().includes("/training")) {
      test.skip(true, "Training feature not available on current plan");
      return;
    }

    // Wait for step 1 indicator with condition-based waiting (retry with reload if needed)
    const step1Circle = page.locator('div.rounded-full:has-text("1")').first();
    try {
      await step1Circle.waitFor({ state: "visible", timeout: 5000 });
    } catch {
      await page.reload();
      await page.waitForLoadState("load");
      await step1Circle.waitFor({ state: "visible", timeout: 8000 });
    }
    await expect(step1Circle).toBeVisible({ timeout: 8000 });
    const step1Classes = await step1Circle.getAttribute('class');
    expect(step1Classes).toContain('bg-brand');

    // Navigate to Step 2
    const selected = await selectSupportedAgency(page);

    if (selected) {
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("load");

      // Verify step 1 is completed (checkmark in green circle)
      const step1Checkmark = page.locator('div.rounded-full:has-text("✓")').first();
      await expect(step1Checkmark).toBeVisible();
      const step1CompletedClasses = await step1Checkmark.getAttribute('class');
      expect(step1CompletedClasses).toContain('bg-green-600');

      // Verify step 2 is active (brand-colored circle with "2")
      const step2Circle = page.locator('div.rounded-full:has-text("2")').first();
      const step2Classes = await step2Circle.getAttribute('class');
      expect(step2Classes).toContain('bg-brand');
    } else {
      test.skip();
    }
  });

  test("[KAN-588] E.2 Back button navigation works @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/tenant/training/import"));
    await page.waitForLoadState("load");

    const selected = await selectSupportedAgency(page);

    if (selected) {
      // Go to Step 2
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForLoadState("load");

      // Click Back link (it's actually an <a> tag, not a button)
      const backLink = page.getByRole("link", { name: /back/i });
      await expect(backLink).toBeVisible({ timeout: 10000 });

      await backLink.click();
      await page.waitForLoadState("load");

      // Verify we're back on Step 1
      const step1Heading = page.getByRole("heading", { name: /select certification agency/i });
      await expect(step1Heading).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});

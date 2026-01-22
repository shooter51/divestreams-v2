import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://e2etest.localhost:5173";
const getTenantUrl = (path: string) => `${BASE_URL}${path}`;

// Helper function to login
async function loginToTenant(page: any) {
  await page.goto(getTenantUrl("/auth/login"));
  await page.fill('input[name="email"]', "admin@e2etest.com");
  await page.fill('input[name="password"]', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL(getTenantUrl("/app"));
}

test.describe("Training Import Wizard", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTenant(page);
  });

  test("A.1 Navigate to training import from dashboard @smoke", async ({ page }) => {
    // Go to training dashboard
    await page.goto(getTenantUrl("/app/training"));
    await page.waitForTimeout(1000);

    // Verify "Import Courses" button exists
    const importButton = page.getByRole("link", { name: /import courses/i });
    expect(await importButton.isVisible()).toBeTruthy();

    // Click to navigate to import page
    await importButton.click();
    await page.waitForURL(getTenantUrl("/app/training/import"));

    // Verify we're on import page
    expect(page.url()).toContain("/app/training/import");

    // Verify page title
    const heading = page.getByRole("heading", { name: /import training courses/i });
    expect(await heading.isVisible()).toBeTruthy();
  });

  test("B.1 Step 1: Select agency displays correctly @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/app/training/import"));
    await page.waitForTimeout(1000);

    // Verify Step 1 is active
    const step1 = page.locator('text=Select Agency');
    expect(await step1.isVisible()).toBeTruthy();

    // Verify agency dropdown exists
    const agencyDropdown = page.locator('select[name="agencyId"]');
    expect(await agencyDropdown.isVisible()).toBeTruthy();

    // Verify help text
    const helpText = page.locator('text=/Don\'t see your agency/i');
    expect(await helpText.isVisible()).toBeTruthy();

    // Verify next button exists
    const nextButton = page.getByRole("button", { name: /next.*select courses/i });
    expect(await nextButton.isVisible()).toBeTruthy();
  });

  test("B.2 Step 1: Cannot submit without selecting agency @validation", async ({ page }) => {
    await page.goto(getTenantUrl("/app/training/import"));
    await page.waitForTimeout(1000);

    // Try to submit without selection
    const nextButton = page.getByRole("button", { name: /next.*select courses/i });
    await nextButton.click();

    // HTML5 validation should prevent submission
    const agencyDropdown = page.locator('select[name="agencyId"]');
    const isInvalid = await agencyDropdown.evaluate((el: any) => !el.validity.valid);
    expect(isInvalid).toBeTruthy();
  });

  test("C.1 Step 2: Select courses after choosing agency @critical", async ({ page }) => {
    await page.goto(getTenantUrl("/app/training/import"));
    await page.waitForTimeout(1000);

    // Select an agency (assuming agencies are loaded)
    const agencyDropdown = page.locator('select[name="agencyId"]');
    const options = await agencyDropdown.locator('option').count();

    if (options > 1) { // More than just the placeholder
      await agencyDropdown.selectOption({ index: 1 });

      // Submit to go to step 2
      const nextButton = page.getByRole("button", { name: /next.*select courses/i });
      await nextButton.click();
      await page.waitForTimeout(2000);

      // Verify we're on Step 2
      const step2Heading = page.getByRole("heading", { name: /choose courses to import/i });
      expect(await step2Heading.isVisible()).toBeTruthy();

      // Verify mock courses are displayed
      const openWaterCourse = page.locator('text=/open water diver/i').first();
      expect(await openWaterCourse.isVisible()).toBeTruthy();

      // Verify select all/none buttons
      const selectAllBtn = page.getByRole("button", { name: /select all/i });
      const selectNoneBtn = page.getByRole("button", { name: /select none/i });
      expect(await selectAllBtn.isVisible()).toBeTruthy();
      expect(await selectNoneBtn.isVisible()).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test("C.2 Step 2: Select All and Select None buttons work @critical", async ({ page }) => {
    await page.goto(getTenantUrl("/app/training/import"));
    await page.waitForTimeout(1000);

    // Navigate to Step 2
    const agencyDropdown = page.locator('select[name="agencyId"]');
    const options = await agencyDropdown.locator('option').count();

    if (options > 1) {
      await agencyDropdown.selectOption({ index: 1 });
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForTimeout(2000);

      // Click "Select All"
      const selectAllBtn = page.getByRole("button", { name: /select all/i });
      await selectAllBtn.click();
      await page.waitForTimeout(500);

      // Verify count shows all selected
      const selectedCount = page.locator('text=/3 of 3 selected/i');
      expect(await selectedCount.isVisible()).toBeTruthy();

      // Click "Select None"
      const selectNoneBtn = page.getByRole("button", { name: /select none/i });
      await selectNoneBtn.click();
      await page.waitForTimeout(500);

      // Verify count shows none selected
      const noneSelected = page.locator('text=/0 of 3 selected/i');
      expect(await noneSelected.isVisible()).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test("C.3 Step 2: Individual course selection toggles correctly @critical", async ({ page }) => {
    await page.goto(getTenantUrl("/app/training/import"));
    await page.waitForTimeout(1000);

    // Navigate to Step 2
    const agencyDropdown = page.locator('select[name="agencyId"]');
    const options = await agencyDropdown.locator('option').count();

    if (options > 1) {
      await agencyDropdown.selectOption({ index: 1 });
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForTimeout(2000);

      // Find first checkbox
      const firstCheckbox = page.locator('input[name="courses"]').first();

      // Click to select
      await firstCheckbox.click();
      await page.waitForTimeout(300);
      expect(await firstCheckbox.isChecked()).toBeTruthy();

      // Verify count updated
      const oneSelected = page.locator('text=/1 of 3 selected/i');
      expect(await oneSelected.isVisible()).toBeTruthy();

      // Click to deselect
      await firstCheckbox.click();
      await page.waitForTimeout(300);
      expect(await firstCheckbox.isChecked()).toBeFalsy();

      // Verify count updated
      const noneSelected = page.locator('text=/0 of 3 selected/i');
      expect(await noneSelected.isVisible()).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test("C.4 Step 2: Cannot proceed without selecting courses @validation", async ({ page }) => {
    await page.goto(getTenantUrl("/app/training/import"));
    await page.waitForTimeout(1000);

    // Navigate to Step 2
    const agencyDropdown = page.locator('select[name="agencyId"]');
    const options = await agencyDropdown.locator('option').count();

    if (options > 1) {
      await agencyDropdown.selectOption({ index: 1 });
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForTimeout(2000);

      // Verify preview button is disabled when nothing selected
      const previewButton = page.locator('button[type="submit"]', { hasText: /preview import/i });
      expect(await previewButton.isDisabled()).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test("C.5 Step 2: Course cards display all information @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/app/training/import"));
    await page.waitForTimeout(1000);

    // Navigate to Step 2
    const agencyDropdown = page.locator('select[name="agencyId"]');
    const options = await agencyDropdown.locator('option').count();

    if (options > 1) {
      await agencyDropdown.selectOption({ index: 1 });
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForTimeout(2000);

      // Check Open Water Diver course card
      const courseCard = page.locator('label', { has: page.locator('text=/open water diver/i') }).first();

      // Verify course name
      expect(await courseCard.locator('text=/open water diver/i').isVisible()).toBeTruthy();

      // Verify course code
      expect(await courseCard.locator('text=OW').isVisible()).toBeTruthy();

      // Verify description
      expect(await courseCard.locator('text=/entry-level certification/i').isVisible()).toBeTruthy();

      // Verify duration
      expect(await courseCard.locator('text=/3-4 days/i').isVisible()).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test("D.1 Step 3: Preview displays after selecting courses @critical", async ({ page }) => {
    await page.goto(getTenantUrl("/app/training/import"));
    await page.waitForTimeout(1000);

    // Navigate through all steps
    const agencyDropdown = page.locator('select[name="agencyId"]');
    const options = await agencyDropdown.locator('option').count();

    if (options > 1) {
      // Step 1: Select agency
      await agencyDropdown.selectOption({ index: 1 });
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForTimeout(2000);

      // Step 2: Select a course
      const firstCheckbox = page.locator('input[name="courses"]').first();
      await firstCheckbox.click();
      await page.waitForTimeout(300);

      // Submit to go to Step 3
      const previewButton = page.locator('button[type="submit"]', { hasText: /preview import/i });
      await previewButton.click();
      await page.waitForTimeout(2000);

      // Verify we're on Step 3
      const step3Heading = page.getByRole("heading", { name: /preview.*import/i });
      expect(await step3Heading.isVisible()).toBeTruthy();

      // Verify count is shown
      const readyText = page.locator('text=/ready to import.*1.*course/i');
      expect(await readyText.isVisible()).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test("D.2 Step 3: Coming Soon notice is displayed @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/app/training/import"));
    await page.waitForTimeout(1000);

    // Navigate to Step 3
    const agencyDropdown = page.locator('select[name="agencyId"]');
    const options = await agencyDropdown.locator('option').count();

    if (options > 1) {
      await agencyDropdown.selectOption({ index: 1 });
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForTimeout(2000);

      const firstCheckbox = page.locator('input[name="courses"]').first();
      await firstCheckbox.click();
      await page.waitForTimeout(300);

      const previewButton = page.locator('button[type="submit"]', { hasText: /preview import/i });
      await previewButton.click();
      await page.waitForTimeout(2000);

      // Verify "Coming Soon" warning
      const comingSoonHeading = page.locator('text=/coming soon/i');
      expect(await comingSoonHeading.isVisible()).toBeTruthy();

      // Verify import button is disabled
      const importButton = page.locator('button[type="submit"]', { hasText: /start import/i });
      expect(await importButton.isDisabled()).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test("D.3 Step 3: What will happen section displays correctly @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/app/training/import"));
    await page.waitForTimeout(1000);

    // Navigate to Step 3
    const agencyDropdown = page.locator('select[name="agencyId"]');
    const options = await agencyDropdown.locator('option').count();

    if (options > 1) {
      await agencyDropdown.selectOption({ index: 1 });
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForTimeout(2000);

      const firstCheckbox = page.locator('input[name="courses"]').first();
      await firstCheckbox.click();
      await page.waitForTimeout(300);

      const previewButton = page.locator('button[type="submit"]', { hasText: /preview import/i });
      await previewButton.click();
      await page.waitForTimeout(2000);

      // Verify "What will happen" section
      const whatWillHappen = page.locator('text=/what will happen/i');
      expect(await whatWillHappen.isVisible()).toBeTruthy();

      // Verify key points are listed
      const templateText = page.locator('text=/course templates will be added/i');
      const customizeText = page.locator('text=/customize pricing/i');
      const preserveText = page.locator('text=/agency course information will be preserved/i');

      expect(await templateText.isVisible()).toBeTruthy();
      expect(await customizeText.isVisible()).toBeTruthy();
      expect(await preserveText.isVisible()).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test("E.1 Progress indicator shows current step @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/app/training/import"));
    await page.waitForTimeout(1000);

    // Step 1: Verify step 1 is active
    const step1Circle = page.locator('div', { has: page.locator('text=Select Agency') }).locator('div').first();
    const step1Classes = await step1Circle.getAttribute('class');
    expect(step1Classes).toContain('bg-blue-600');

    // Navigate to Step 2
    const agencyDropdown = page.locator('select[name="agencyId"]');
    const options = await agencyDropdown.locator('option').count();

    if (options > 1) {
      await agencyDropdown.selectOption({ index: 1 });
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForTimeout(2000);

      // Verify step 1 is completed (checkmark)
      const step1Completed = page.locator('div', { hasText: /Select Agency/i }).locator('text=✓');
      expect(await step1Completed.isVisible()).toBeTruthy();

      // Verify step 2 is active
      const step2Text = page.locator('span', { hasText: /Choose Courses/i });
      const step2Classes = await step2Text.getAttribute('class');
      expect(step2Classes).toContain('text-blue-600');
    } else {
      test.skip();
    }
  });

  test("E.2 Back button navigation works @smoke", async ({ page }) => {
    await page.goto(getTenantUrl("/app/training/import"));
    await page.waitForTimeout(1000);

    const agencyDropdown = page.locator('select[name="agencyId"]');
    const options = await agencyDropdown.locator('option').count();

    if (options > 1) {
      // Go to Step 2
      await agencyDropdown.selectOption({ index: 1 });
      await page.getByRole("button", { name: /next.*select courses/i }).click();
      await page.waitForTimeout(2000);

      // Click Back button
      const backButton = page.getByRole("button", { name: /back/i });
      expect(await backButton.isVisible()).toBeTruthy();

      await backButton.click();
      await page.waitForTimeout(1000);

      // Verify we're back on Step 1
      const step1Heading = page.getByRole("heading", { name: /select certification agency/i });
      expect(await step1Heading.isVisible()).toBeTruthy();
    } else {
      test.skip();
    }
  });
});

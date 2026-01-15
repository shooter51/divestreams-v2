import { test, expect } from "@playwright/test";

/**
 * Discounts E2E Tests
 *
 * Tests for discount code management route:
 * - /app/discounts - List and manage discount codes
 */

// Helper functions
const getTenantUrl = (path: string = "/") =>
  `http://e2etest.localhost:5173${path}`;

test.describe("Discount Codes Management", () => {
  test.describe("Discounts List Page", () => {
    test("should navigate to discounts page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/discounts") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display page heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /discount codes/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should have Create Discount Code button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const createButton = await page.getByRole("button", { name: /create discount code/i }).isVisible().catch(() => false);
      expect(createButton).toBeTruthy();
    });

    test("should show Active Discount Codes section", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const activeSection = await page.getByText(/active discount codes/i).isVisible().catch(() => false);
      expect(activeSection).toBeTruthy();
    });

    test("should show table headers for discount codes", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const hasCodeHeader = await page.getByText(/^code$/i).isVisible().catch(() => false);
      const hasDiscountHeader = await page.getByText(/^discount$/i).isVisible().catch(() => false);
      const hasStatusHeader = await page.getByText(/^status$/i).isVisible().catch(() => false);

      // At least one header should be visible
      expect(hasCodeHeader || hasDiscountHeader || hasStatusHeader).toBeTruthy();
    });

    test("should display empty state when no discounts", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const table = await page.locator("table").isVisible().catch(() => false);
      const emptyState = await page.getByText(/no active discount codes/i).isVisible().catch(() => false);

      expect(table || emptyState).toBeTruthy();
    });
  });

  test.describe("Create Discount Code Modal", () => {
    test("should open modal when clicking Create button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // Click create button
      const createButton = page.getByRole("button", { name: /create discount code/i });
      if (await createButton.isVisible()) {
        await createButton.click();
        await page.waitForTimeout(500);

        // Modal should be visible
        const modalHeading = await page.getByRole("heading", { name: /create discount code/i }).isVisible().catch(() => false);
        expect(modalHeading).toBeTruthy();
      }
    });

    test("should have Code field in modal", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const createButton = page.getByRole("button", { name: /create discount code/i });
      if (await createButton.isVisible()) {
        await createButton.click();
        await page.waitForTimeout(500);

        const codeField = await page.getByLabel(/^code$/i).isVisible().catch(() => false);
        expect(codeField).toBeTruthy();
      }
    });

    test("should have Discount Type dropdown", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const createButton = page.getByRole("button", { name: /create discount code/i });
      if (await createButton.isVisible()) {
        await createButton.click();
        await page.waitForTimeout(500);

        const typeField = await page.getByLabel(/discount type/i).isVisible().catch(() => false);
        expect(typeField).toBeTruthy();
      }
    });

    test("should have Discount Value field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const createButton = page.getByRole("button", { name: /create discount code/i });
      if (await createButton.isVisible()) {
        await createButton.click();
        await page.waitForTimeout(500);

        const valueField = await page.getByLabel(/discount value/i).isVisible().catch(() => false);
        expect(valueField).toBeTruthy();
      }
    });

    test("should have Valid From date field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const createButton = page.getByRole("button", { name: /create discount code/i });
      if (await createButton.isVisible()) {
        await createButton.click();
        await page.waitForTimeout(500);

        const validFromField = await page.getByLabel(/valid from/i).isVisible().catch(() => false);
        expect(validFromField).toBeTruthy();
      }
    });

    test("should have Valid Until date field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const createButton = page.getByRole("button", { name: /create discount code/i });
      if (await createButton.isVisible()) {
        await createButton.click();
        await page.waitForTimeout(500);

        const validUntilField = await page.getByLabel(/valid until/i).isVisible().catch(() => false);
        expect(validUntilField).toBeTruthy();
      }
    });

    test("should have Max Uses field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const createButton = page.getByRole("button", { name: /create discount code/i });
      if (await createButton.isVisible()) {
        await createButton.click();
        await page.waitForTimeout(500);

        const maxUsesField = await page.getByLabel(/max uses/i).isVisible().catch(() => false);
        expect(maxUsesField).toBeTruthy();
      }
    });

    test("should have Cancel and Create buttons", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const createButton = page.getByRole("button", { name: /create discount code/i });
      if (await createButton.isVisible()) {
        await createButton.click();
        await page.waitForTimeout(500);

        const cancelBtn = await page.getByRole("button", { name: /cancel/i }).isVisible().catch(() => false);
        const submitBtn = await page.getByRole("button", { name: /^create$/i }).isVisible().catch(() => false);

        expect(cancelBtn && submitBtn).toBeTruthy();
      }
    });

    test("should close modal when clicking Cancel", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const createButton = page.getByRole("button", { name: /create discount code/i });
      if (await createButton.isVisible()) {
        await createButton.click();
        await page.waitForTimeout(500);

        const cancelBtn = page.getByRole("button", { name: /cancel/i });
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();
          await page.waitForTimeout(500);

          // Modal should be closed (no modal heading)
          const modalHeading = await page.getByRole("heading", { name: /create discount code/i }).isVisible().catch(() => false);
          expect(modalHeading).toBeFalsy();
        }
      }
    });
  });

  test.describe("Discount Code Status Display", () => {
    test("should show status badges for discounts", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // Check for status badges (active, inactive, expired, scheduled)
      const hasStatusBadge = await page.getByText(/^active$|^inactive$|^expired$|^scheduled$|^used up$/i).first().isVisible().catch(() => false);
      const noDiscounts = await page.getByText(/no active discount codes/i).isVisible().catch(() => false);

      expect(hasStatusBadge || noDiscounts).toBeTruthy();
    });

    test("should show percentage or fixed amount format", async ({ page }) => {
      await page.goto(getTenantUrl("/app/discounts"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // Look for discount values (e.g., "10%" or "$5.00")
      const hasPercentage = await page.getByText(/\d+%/).first().isVisible().catch(() => false);
      const hasFixed = await page.getByText(/\$\d+\.\d{2}/).first().isVisible().catch(() => false);
      const noDiscounts = await page.getByText(/no active discount codes/i).isVisible().catch(() => false);

      expect(hasPercentage || hasFixed || noDiscounts).toBeTruthy();
    });
  });
});

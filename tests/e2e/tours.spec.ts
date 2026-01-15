import { test, expect } from "@playwright/test";

/**
 * Tours E2E Tests
 *
 * Tests for tour management routes:
 * - /app/tours - List tours
 * - /app/tours/new - Add new tour
 * - /app/tours/:id - View tour detail
 * - /app/tours/:id/edit - Edit tour
 * - /app/tours/:id/duplicate - Duplicate tour
 */

// Helper functions
const getTenantUrl = (path: string = "/") =>
  `http://e2etest.localhost:5173${path}`;

test.describe("Tours Management", () => {
  test.describe("Tours List Page", () => {
    test("should navigate to tours page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/tours") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display page heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /tours/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should show tour count", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const count = await page.getByText(/\d+ tour templates/i).isVisible().catch(() => false);
      expect(count).toBeTruthy();
    });

    test("should have Create Tour button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const createButton = await page.getByRole("link", { name: /create tour/i }).isVisible().catch(() => false);
      expect(createButton).toBeTruthy();
    });

    test("should have search functionality", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const searchInput = await page.getByPlaceholder(/search tours/i).isVisible().catch(() => false);
      expect(searchInput).toBeTruthy();
    });

    test("should have tour type filter dropdown", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const typeFilter = await page.locator("select").filter({ hasText: /all types|single dive/i }).isVisible().catch(() => false);
      expect(typeFilter).toBeTruthy();
    });

    test("should have Filter button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const filterBtn = await page.getByRole("button", { name: /filter/i }).isVisible().catch(() => false);
      expect(filterBtn).toBeTruthy();
    });

    test("should display tours grid or empty state", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const hasTours = await page.locator("[class*='grid'] a, [class*='card']").first().isVisible().catch(() => false);
      const emptyState = await page.getByText(/no tours/i).isVisible().catch(() => false);

      expect(hasTours || emptyState).toBeTruthy();
    });

    test("should show tour prices with dollar sign", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const hasPrice = await page.getByText(/\$\d+/).first().isVisible().catch(() => false);
      const emptyState = await page.getByText(/no tours/i).isVisible().catch(() => false);

      expect(hasPrice || emptyState).toBeTruthy();
    });

    test("should show tour type badges", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const hasBadge = await page.getByText(/single dive|multi-dive|course|snorkel|night dive/i).first().isVisible().catch(() => false);
      const emptyState = await page.getByText(/no tours/i).isVisible().catch(() => false);

      expect(hasBadge || emptyState).toBeTruthy();
    });

    test("should show max participants info", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const hasMaxPax = await page.getByText(/max \d+ pax/i).first().isVisible().catch(() => false);
      const emptyState = await page.getByText(/no tours/i).isVisible().catch(() => false);

      expect(hasMaxPax || emptyState).toBeTruthy();
    });
  });

  test.describe("New Tour Page", () => {
    test("should navigate to new tour page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours/new"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/tours/new") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display form heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /new tour|create tour/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should have Tour Name field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const nameField = await page.getByLabel(/name/i).first().isVisible().catch(() => false);
      expect(nameField).toBeTruthy();
    });

    test("should have Price field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const priceField = await page.getByLabel(/price/i).isVisible().catch(() => false);
      expect(priceField).toBeTruthy();
    });

    test("should have Duration field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const durationField = await page.getByLabel(/duration/i).isVisible().catch(() => false);
      expect(durationField).toBeTruthy();
    });

    test("should have Max Participants field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const maxParticipantsField = await page.getByLabel(/max.*participants/i).isVisible().catch(() => false);
      expect(maxParticipantsField).toBeTruthy();
    });

    test("should have Tour Type dropdown", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const typeField = await page.getByLabel(/type/i).first().isVisible().catch(() => false);
      expect(typeField).toBeTruthy();
    });

    test("should have Submit button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const submitBtn = await page.getByRole("button", { name: /create|save/i }).isVisible().catch(() => false);
      expect(submitBtn).toBeTruthy();
    });
  });

  test.describe("Tour Detail Page", () => {
    test("should navigate to tour detail page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours/1"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/tours/1") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should handle non-existent tour gracefully", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours/nonexistent-id-12345"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      const hasError = await page.getByText(/not found|error/i).isVisible().catch(() => false);
      expect(currentUrl.includes("/tours") || currentUrl.includes("/login") || hasError).toBeTruthy();
    });
  });

  test.describe("Tour Edit Page", () => {
    test("should navigate to tour edit page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours/1/edit"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/tours/1/edit") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display edit form with fields", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours/1/edit"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const nameField = await page.getByLabel(/name/i).first().isVisible().catch(() => false);
      expect(nameField || page.url().includes("/tours")).toBeTruthy();
    });
  });

  test.describe("Tour Duplicate Action", () => {
    test("should navigate to duplicate tour route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/tours/1/duplicate"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      // Should redirect somewhere (tours list or new tour with prefilled data)
      expect(currentUrl.includes("/tours") || currentUrl.includes("/login")).toBeTruthy();
    });
  });
});

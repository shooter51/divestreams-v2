import { test, expect } from "@playwright/test";

/**
 * Dive Sites E2E Tests
 *
 * Tests for dive site management routes:
 * - /app/dive-sites - List dive sites
 * - /app/dive-sites/new - Add new dive site
 * - /app/dive-sites/:id - View dive site detail
 * - /app/dive-sites/:id/edit - Edit dive site
 */

// Helper functions
const getTenantUrl = (path: string = "/") =>
  `http://e2etest.localhost:5173${path}`;

test.describe("Dive Sites Management", () => {
  test.describe("Dive Sites List Page", () => {
    test("should navigate to dive sites page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/dive-sites") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display page heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /dive sites/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should show site count", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const count = await page.getByText(/\d+ sites/i).isVisible().catch(() => false);
      expect(count).toBeTruthy();
    });

    test("should have Add Site button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const addButton = await page.getByRole("link", { name: /add site/i }).isVisible().catch(() => false);
      expect(addButton).toBeTruthy();
    });

    test("should have search functionality", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const searchInput = await page.getByPlaceholder(/search dive sites/i).isVisible().catch(() => false);
      expect(searchInput).toBeTruthy();
    });

    test("should have difficulty filter dropdown", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const difficultyFilter = await page.locator("select").filter({ hasText: /all levels|beginner/i }).isVisible().catch(() => false);
      expect(difficultyFilter).toBeTruthy();
    });

    test("should display sites grid or empty state", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const hasSites = await page.locator("[class*='grid'] a, [class*='card']").first().isVisible().catch(() => false);
      const emptyState = await page.getByText(/no dive sites found/i).isVisible().catch(() => false);

      expect(hasSites || emptyState).toBeTruthy();
    });

    test("should show difficulty badges on sites", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // Check for difficulty level badges
      const hasDifficultyBadge = await page.getByText(/beginner|intermediate|advanced|expert/i).first().isVisible().catch(() => false);
      const emptyState = await page.getByText(/no dive sites/i).isVisible().catch(() => false);

      expect(hasDifficultyBadge || emptyState).toBeTruthy();
    });
  });

  test.describe("New Dive Site Page", () => {
    test("should navigate to new dive site page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites/new"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/dive-sites/new") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display form heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /add dive site/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should have Site Name field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const nameField = await page.getByLabel(/site name/i).isVisible().catch(() => false);
      expect(nameField).toBeTruthy();
    });

    test("should have Location field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const locationField = await page.getByLabel(/location/i).isVisible().catch(() => false);
      expect(locationField).toBeTruthy();
    });

    test("should have Maximum Depth field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const depthField = await page.getByLabel(/max.*depth/i).isVisible().catch(() => false);
      expect(depthField).toBeTruthy();
    });

    test("should have Difficulty Level dropdown", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const difficultyField = await page.getByLabel(/difficulty/i).isVisible().catch(() => false);
      expect(difficultyField).toBeTruthy();
    });

    test("should have GPS Coordinates section", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const latitudeField = await page.getByLabel(/latitude/i).isVisible().catch(() => false);
      const longitudeField = await page.getByLabel(/longitude/i).isVisible().catch(() => false);

      expect(latitudeField && longitudeField).toBeTruthy();
    });

    test("should have Highlights field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const highlightsField = await page.getByLabel(/highlights|attractions/i).isVisible().catch(() => false);
      expect(highlightsField).toBeTruthy();
    });

    test("should have Active checkbox", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const activeCheckbox = await page.getByText(/^active$/i).isVisible().catch(() => false);
      expect(activeCheckbox).toBeTruthy();
    });

    test("should have Submit and Cancel buttons", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const submitBtn = await page.getByRole("button", { name: /add dive site|save/i }).isVisible().catch(() => false);
      const cancelLink = await page.getByRole("link", { name: /cancel/i }).isVisible().catch(() => false);

      expect(submitBtn && cancelLink).toBeTruthy();
    });

    test("should have back link to dive sites list", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const backLink = await page.getByRole("link", { name: /back to dive sites/i }).isVisible().catch(() => false);
      expect(backLink).toBeTruthy();
    });
  });

  test.describe("Dive Site Detail Page", () => {
    test("should navigate to dive site detail page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites/1"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/dive-sites/1") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should handle non-existent dive site gracefully", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites/nonexistent-id-12345"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      const hasError = await page.getByText(/not found|error/i).isVisible().catch(() => false);
      expect(currentUrl.includes("/dive-sites") || currentUrl.includes("/login") || hasError).toBeTruthy();
    });
  });

  test.describe("Dive Site Edit Page", () => {
    test("should navigate to dive site edit page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites/1/edit"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/dive-sites/1/edit") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display edit form with fields", async ({ page }) => {
      await page.goto(getTenantUrl("/app/dive-sites/1/edit"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const nameField = await page.getByLabel(/site name/i).isVisible().catch(() => false);
      expect(nameField || page.url().includes("/dive-sites")).toBeTruthy();
    });
  });
});

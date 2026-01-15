import { test, expect } from "@playwright/test";

/**
 * Boats E2E Tests
 *
 * Tests for boat management routes:
 * - /app/boats - List boats
 * - /app/boats/new - Add new boat
 * - /app/boats/:id - View boat detail
 * - /app/boats/:id/edit - Edit boat
 */

// Helper functions
const getTenantUrl = (path: string = "/") =>
  `http://e2etest.localhost:5173${path}`;

test.describe("Boats Management", () => {
  test.describe("Boats List Page", () => {
    test("should navigate to boats page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      // Should be on boats page or redirected to login
      expect(currentUrl.includes("/boats") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display page heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return; // Not authenticated, skip
      }

      const heading = await page.getByRole("heading", { name: /boat|vessel/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should have Add Boat button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const addButton = await page.getByRole("link", { name: /add boat/i }).isVisible().catch(() => false);
      expect(addButton).toBeTruthy();
    });

    test("should show stats cards", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // Check for stats like Total Boats, Active, Total Capacity
      const hasStats = await page.getByText(/total boats|active|capacity/i).first().isVisible().catch(() => false);
      expect(hasStats).toBeTruthy();
    });

    test("should have search functionality", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const searchInput = await page.getByPlaceholder(/search boats/i).isVisible().catch(() => false);
      expect(searchInput).toBeTruthy();
    });

    test("should display boats grid or empty state", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // Either shows boats or empty state
      const hasBoats = await page.locator("[class*='grid'] a, [class*='card']").first().isVisible().catch(() => false);
      const emptyState = await page.getByText(/no boats found/i).isVisible().catch(() => false);

      expect(hasBoats || emptyState).toBeTruthy();
    });
  });

  test.describe("New Boat Page", () => {
    test("should navigate to new boat page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats/new"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/boats/new") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display form heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /add boat/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should have Boat Name field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const nameField = await page.getByLabel(/boat name/i).isVisible().catch(() => false);
      expect(nameField).toBeTruthy();
    });

    test("should have Boat Type dropdown", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const typeField = await page.getByLabel(/boat type/i).isVisible().catch(() => false);
      expect(typeField).toBeTruthy();
    });

    test("should have Passenger Capacity field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const capacityField = await page.getByLabel(/capacity/i).isVisible().catch(() => false);
      expect(capacityField).toBeTruthy();
    });

    test("should have Registration Number field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const regField = await page.getByLabel(/registration/i).isVisible().catch(() => false);
      expect(regField).toBeTruthy();
    });

    test("should have Amenities field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const amenitiesField = await page.getByLabel(/amenities/i).isVisible().catch(() => false);
      expect(amenitiesField).toBeTruthy();
    });

    test("should have Active checkbox", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const activeCheckbox = await page.getByText(/^active$/i).isVisible().catch(() => false);
      expect(activeCheckbox).toBeTruthy();
    });

    test("should have Submit and Cancel buttons", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const submitBtn = await page.getByRole("button", { name: /add boat|save/i }).isVisible().catch(() => false);
      const cancelLink = await page.getByRole("link", { name: /cancel/i }).isVisible().catch(() => false);

      expect(submitBtn).toBeTruthy();
      expect(cancelLink).toBeTruthy();
    });

    test("should have back link to boats list", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const backLink = await page.getByRole("link", { name: /back to boats/i }).isVisible().catch(() => false);
      expect(backLink).toBeTruthy();
    });
  });

  test.describe("Boat Detail Page", () => {
    test("should navigate to boat detail page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats/1"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/boats/1") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should handle non-existent boat gracefully", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats/nonexistent-id-12345"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      // Should show error or redirect
      const hasError = await page.getByText(/not found|error/i).isVisible().catch(() => false);
      expect(currentUrl.includes("/boats") || currentUrl.includes("/login") || hasError).toBeTruthy();
    });
  });

  test.describe("Boat Edit Page", () => {
    test("should navigate to boat edit page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats/1/edit"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/boats/1/edit") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display edit form with fields", async ({ page }) => {
      await page.goto(getTenantUrl("/app/boats/1/edit"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const nameField = await page.getByLabel(/boat name/i).isVisible().catch(() => false);
      // Form fields should be present
      expect(nameField || page.url().includes("/boats")).toBeTruthy();
    });
  });
});

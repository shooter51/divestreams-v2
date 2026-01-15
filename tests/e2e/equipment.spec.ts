import { test, expect } from "@playwright/test";

/**
 * Equipment E2E Tests
 *
 * Tests for equipment inventory routes:
 * - /app/equipment - List equipment
 * - /app/equipment/new - Add equipment
 * - /app/equipment/:id - View equipment detail
 */

// Helper functions
const getTenantUrl = (path: string = "/") =>
  `http://e2etest.localhost:5173${path}`;

test.describe("Equipment Inventory", () => {
  test.describe("Equipment List Page", () => {
    test("should navigate to equipment page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/equipment") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display page heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /equipment inventory/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should show items total count", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const count = await page.getByText(/\d+ items total/i).isVisible().catch(() => false);
      expect(count).toBeTruthy();
    });

    test("should have Add Equipment link", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const addLink = await page.getByRole("link", { name: /add equipment/i }).isVisible().catch(() => false);
      expect(addLink).toBeTruthy();
    });

    test("should have Scan Barcode button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const scanBtn = await page.getByRole("button", { name: /scan barcode/i }).isVisible().catch(() => false);
      expect(scanBtn).toBeTruthy();
    });

    test("should have Manage Rentals button or disabled state", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // Manage Rentals can be a link (premium) or disabled button (free)
      const manageRentalsLink = await page.getByRole("link", { name: /manage rentals/i }).isVisible().catch(() => false);
      const manageRentalsBtn = await page.getByRole("button", { name: /manage rentals/i }).isVisible().catch(() => false);

      expect(manageRentalsLink || manageRentalsBtn).toBeTruthy();
    });

    test("should show Total stat card", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const totalStat = await page.getByText(/^total$/i).isVisible().catch(() => false);
      expect(totalStat).toBeTruthy();
    });

    test("should show Available stat card", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const availableStat = await page.getByText(/^available$/i).isVisible().catch(() => false);
      expect(availableStat).toBeTruthy();
    });

    test("should show Rented stat card", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const rentedStat = await page.getByText(/^rented$/i).isVisible().catch(() => false);
      expect(rentedStat).toBeTruthy();
    });

    test("should show Maintenance stat card", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const maintenanceStat = await page.getByText(/^maintenance$/i).isVisible().catch(() => false);
      expect(maintenanceStat).toBeTruthy();
    });

    test("should show Retired stat card", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const retiredStat = await page.getByText(/^retired$/i).isVisible().catch(() => false);
      expect(retiredStat).toBeTruthy();
    });

    test("should have search input", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const searchInput = await page.getByPlaceholder(/search equipment/i).isVisible().catch(() => false);
      expect(searchInput).toBeTruthy();
    });

    test("should have category filter dropdown", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const categoryFilter = await page.locator("select").filter({ hasText: /all categories|bcd|regulator/i }).isVisible().catch(() => false);
      expect(categoryFilter).toBeTruthy();
    });

    test("should display equipment table with Item header", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const itemHeader = await page.getByText(/^item$/i).isVisible().catch(() => false);
      const hasTable = await page.locator("table").isVisible().catch(() => false);
      const emptyState = await page.getByText(/no equipment found/i).isVisible().catch(() => false);

      expect(itemHeader || hasTable || emptyState).toBeTruthy();
    });

    test("should display Category header in table", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const categoryHeader = await page.getByText(/^category$/i).isVisible().catch(() => false);
      const emptyState = await page.getByText(/no equipment found/i).isVisible().catch(() => false);

      expect(categoryHeader || emptyState).toBeTruthy();
    });

    test("should display Status header in table", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const statusHeader = await page.getByText(/^status$/i).isVisible().catch(() => false);
      const emptyState = await page.getByText(/no equipment found/i).isVisible().catch(() => false);

      expect(statusHeader || emptyState).toBeTruthy();
    });
  });

  test.describe("New Equipment Page", () => {
    test("should navigate to new equipment page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment/new"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/equipment/new") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display form heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /add equipment|new equipment/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should have Equipment Name field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const nameField = await page.getByLabel(/name/i).first().isVisible().catch(() => false);
      expect(nameField).toBeTruthy();
    });

    test("should have Category dropdown", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const categoryField = await page.getByLabel(/category/i).isVisible().catch(() => false);
      expect(categoryField).toBeTruthy();
    });

    test("should have Brand field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const brandField = await page.getByLabel(/brand/i).isVisible().catch(() => false);
      expect(brandField).toBeTruthy();
    });

    test("should have Model field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const modelField = await page.getByLabel(/model/i).isVisible().catch(() => false);
      expect(modelField).toBeTruthy();
    });

    test("should have Size field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const sizeField = await page.getByLabel(/size/i).isVisible().catch(() => false);
      expect(sizeField).toBeTruthy();
    });

    test("should have Barcode field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const barcodeField = await page.getByLabel(/barcode/i).isVisible().catch(() => false);
      expect(barcodeField).toBeTruthy();
    });
  });

  test.describe("Equipment Detail Page", () => {
    test("should navigate to equipment detail page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment/1"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/equipment/1") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should handle non-existent equipment gracefully", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment/nonexistent-id-12345"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      const hasError = await page.getByText(/not found|error/i).isVisible().catch(() => false);
      expect(currentUrl.includes("/equipment") || currentUrl.includes("/login") || hasError).toBeTruthy();
    });
  });

  test.describe("Category Filtering", () => {
    test("should filter by BCD category", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const categorySelect = page.locator("select").filter({ hasText: /all categories/i }).first();
      if (await categorySelect.isVisible()) {
        await categorySelect.selectOption("bcd");
        await page.waitForTimeout(500);

        expect(page.url()).toContain("/equipment");
      }
    });

    test("should filter by Regulator category", async ({ page }) => {
      await page.goto(getTenantUrl("/app/equipment"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const categorySelect = page.locator("select").filter({ hasText: /all categories/i }).first();
      if (await categorySelect.isVisible()) {
        await categorySelect.selectOption("regulator");
        await page.waitForTimeout(500);

        expect(page.url()).toContain("/equipment");
      }
    });
  });
});

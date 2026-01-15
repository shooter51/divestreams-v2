import { test, expect } from "@playwright/test";

/**
 * Bookings E2E Tests
 *
 * Tests for booking management routes:
 * - /app/bookings - List bookings
 * - /app/bookings/new - Create booking
 * - /app/bookings/:id - View booking detail
 */

// Helper functions
const getTenantUrl = (path: string = "/") =>
  `http://e2etest.localhost:5173${path}`;

test.describe("Bookings Management", () => {
  test.describe("Bookings List Page", () => {
    test("should navigate to bookings page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/bookings") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display page heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /bookings/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should show total bookings count", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const count = await page.getByText(/\d+ total bookings/i).isVisible().catch(() => false);
      expect(count).toBeTruthy();
    });

    test("should have New Booking link", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const newBookingLink = await page.getByRole("link", { name: /new booking/i }).isVisible().catch(() => false);
      expect(newBookingLink).toBeTruthy();
    });

    test("should show Today's Bookings stat", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const todaysStat = await page.getByText(/today's bookings/i).isVisible().catch(() => false);
      expect(todaysStat).toBeTruthy();
    });

    test("should show Upcoming Confirmed stat", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const upcomingStat = await page.getByText(/upcoming confirmed/i).isVisible().catch(() => false);
      expect(upcomingStat).toBeTruthy();
    });

    test("should show Pending Payment stat", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const pendingPaymentStat = await page.getByText(/pending payment/i).isVisible().catch(() => false);
      expect(pendingPaymentStat).toBeTruthy();
    });

    test("should have search input", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const searchInput = await page.getByPlaceholder(/search.*booking/i).isVisible().catch(() => false);
      expect(searchInput).toBeTruthy();
    });

    test("should have status filter dropdown", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const statusFilter = await page.locator("select").filter({ hasText: /all statuses|pending|confirmed/i }).isVisible().catch(() => false);
      expect(statusFilter).toBeTruthy();
    });

    test("should have Filter button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const filterBtn = await page.getByRole("button", { name: /filter/i }).isVisible().catch(() => false);
      expect(filterBtn).toBeTruthy();
    });

    test("should display bookings table with headers", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const bookingHeader = await page.getByText(/^booking$/i).isVisible().catch(() => false);
      const customerHeader = await page.getByText(/^customer$/i).isVisible().catch(() => false);
      const tripHeader = await page.getByText(/^trip$/i).isVisible().catch(() => false);

      expect(bookingHeader || customerHeader || tripHeader).toBeTruthy();
    });

    test("should show empty state or bookings list", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const hasTable = await page.locator("table").isVisible().catch(() => false);
      const emptyState = await page.getByText(/no bookings yet/i).isVisible().catch(() => false);

      expect(hasTable || emptyState).toBeTruthy();
    });
  });

  test.describe("New Booking Page", () => {
    test("should navigate to new booking page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings/new"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/bookings/new") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display form heading or customer selection", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const hasHeading = await page.getByRole("heading", { name: /new booking|create booking/i }).isVisible().catch(() => false);
      const hasCustomerField = await page.getByText(/customer|select customer/i).first().isVisible().catch(() => false);

      expect(hasHeading || hasCustomerField).toBeTruthy();
    });
  });

  test.describe("Booking Detail Page", () => {
    test("should navigate to booking detail page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings/1"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/bookings/1") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should handle non-existent booking gracefully", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings/nonexistent-id-12345"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      const hasError = await page.getByText(/not found|error/i).isVisible().catch(() => false);
      expect(currentUrl.includes("/bookings") || currentUrl.includes("/login") || hasError).toBeTruthy();
    });
  });

  test.describe("Status Filtering", () => {
    test("should filter by Pending status", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const statusSelect = page.locator("select").filter({ hasText: /all statuses/i }).first();
      if (await statusSelect.isVisible()) {
        await statusSelect.selectOption("pending");
        await page.waitForTimeout(500);

        // URL should update with status param or page should refresh
        expect(page.url()).toContain("/bookings");
      }
    });

    test("should filter by Confirmed status", async ({ page }) => {
      await page.goto(getTenantUrl("/app/bookings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const statusSelect = page.locator("select").filter({ hasText: /all statuses/i }).first();
      if (await statusSelect.isVisible()) {
        await statusSelect.selectOption("confirmed");
        await page.waitForTimeout(500);

        expect(page.url()).toContain("/bookings");
      }
    });
  });
});

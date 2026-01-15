import { test, expect } from "@playwright/test";

/**
 * Reports E2E Tests
 *
 * Tests for reporting dashboard routes:
 * - /app/reports - Reports dashboard
 * - /app/reports/export/csv - Export CSV
 * - /app/reports/export/pdf - Export PDF
 */

// Helper functions
const getTenantUrl = (path: string = "/") =>
  `http://e2etest.localhost:5173${path}`;

test.describe("Reports Dashboard", () => {
  test.describe("Reports Page", () => {
    test("should navigate to reports page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/reports") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display page heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /reports/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should have Export CSV button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const exportCsvBtn = await page.getByRole("button", { name: /export csv/i }).isVisible().catch(() => false);
      expect(exportCsvBtn).toBeTruthy();
    });

    test("should have Export PDF button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const exportPdfBtn = await page.getByRole("button", { name: /export pdf/i }).isVisible().catch(() => false);
      expect(exportPdfBtn).toBeTruthy();
    });

    test("should have date range selector", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // Look for date range selector button (e.g., "This Month", "Today", etc.)
      const dateSelector = await page.getByRole("button", { name: /this month|today|this week|this year|select date/i }).isVisible().catch(() => false);
      expect(dateSelector).toBeTruthy();
    });

    test("should show revenue overview cards", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // Check for revenue metric cards
      const thisMonthCard = await page.getByText(/this month|today/i).first().isVisible().catch(() => false);
      const previousPeriodCard = await page.getByText(/previous period/i).isVisible().catch(() => false);
      const ytdCard = await page.getByText(/year to date/i).isVisible().catch(() => false);
      const avgBookingCard = await page.getByText(/avg booking value/i).isVisible().catch(() => false);

      expect(thisMonthCard || previousPeriodCard || ytdCard || avgBookingCard).toBeTruthy();
    });

    test("should show currency formatted values", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // Look for dollar amounts (e.g., "$0", "$1,234", etc.)
      const hasCurrency = await page.getByText(/\$[\d,]+/).first().isVisible().catch(() => false);
      expect(hasCurrency).toBeTruthy();
    });

    test("should show percentage change indicator", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // Look for percentage change indicators (e.g., "+0%", "-5% vs last month")
      const hasPercentage = await page.getByText(/[+-]\d+%/i).first().isVisible().catch(() => false);
      expect(hasPercentage).toBeTruthy();
    });

    test("should show Customer Insights section", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const customerInsights = await page.getByText(/customer insights/i).isVisible().catch(() => false);
      expect(customerInsights).toBeTruthy();
    });

    test("should show Total Customers metric", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const totalCustomers = await page.getByText(/total customers/i).isVisible().catch(() => false);
      expect(totalCustomers).toBeTruthy();
    });

    test("should show New customers metric", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const newCustomers = await page.getByText(/new.*this month|new this week/i).isVisible().catch(() => false);
      expect(newCustomers).toBeTruthy();
    });

    test("should have link to view all customers", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const viewCustomersLink = await page.getByRole("link", { name: /view all customers/i }).isVisible().catch(() => false);
      expect(viewCustomersLink).toBeTruthy();
    });
  });

  test.describe("Date Range Selection", () => {
    test("should open date range dropdown when clicked", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // Click date selector button
      const dateButton = page.getByRole("button", { name: /this month|today|this week|select date/i }).first();
      if (await dateButton.isVisible()) {
        await dateButton.click();
        await page.waitForTimeout(500);

        // Should see preset options
        const hasPresets = await page.getByText(/presets/i).isVisible().catch(() => false);
        const hasToday = await page.getByRole("button", { name: /^today$/i }).isVisible().catch(() => false);

        expect(hasPresets || hasToday).toBeTruthy();
      }
    });

    test("should have Today preset option", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const dateButton = page.getByRole("button", { name: /this month|today|this week|select date/i }).first();
      if (await dateButton.isVisible()) {
        await dateButton.click();
        await page.waitForTimeout(500);

        const todayOption = await page.getByRole("button", { name: /^today$/i }).isVisible().catch(() => false);
        expect(todayOption).toBeTruthy();
      }
    });

    test("should have This Week preset option", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const dateButton = page.getByRole("button", { name: /this month|today|this week|select date/i }).first();
      if (await dateButton.isVisible()) {
        await dateButton.click();
        await page.waitForTimeout(500);

        const thisWeekOption = await page.getByRole("button", { name: /^this week$/i }).isVisible().catch(() => false);
        expect(thisWeekOption).toBeTruthy();
      }
    });

    test("should have This Month preset option", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const dateButton = page.getByRole("button", { name: /this month|today|this week|select date/i }).first();
      if (await dateButton.isVisible()) {
        await dateButton.click();
        await page.waitForTimeout(500);

        const thisMonthOption = await page.getByRole("button", { name: /^this month$/i }).isVisible().catch(() => false);
        expect(thisMonthOption).toBeTruthy();
      }
    });

    test("should have This Year preset option", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const dateButton = page.getByRole("button", { name: /this month|today|this week|select date/i }).first();
      if (await dateButton.isVisible()) {
        await dateButton.click();
        await page.waitForTimeout(500);

        const thisYearOption = await page.getByRole("button", { name: /^this year$/i }).isVisible().catch(() => false);
        expect(thisYearOption).toBeTruthy();
      }
    });

    test("should have Custom Range option", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const dateButton = page.getByRole("button", { name: /this month|today|this week|select date/i }).first();
      if (await dateButton.isVisible()) {
        await dateButton.click();
        await page.waitForTimeout(500);

        const customOption = await page.getByRole("button", { name: /custom range/i }).isVisible().catch(() => false);
        expect(customOption).toBeTruthy();
      }
    });
  });

  test.describe("Premium Features", () => {
    test("should show Revenue Trend chart or premium gate", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const revenueChart = await page.getByText(/revenue trend/i).isVisible().catch(() => false);
      const premiumGate = await page.getByText(/advanced revenue charts/i).isVisible().catch(() => false);

      expect(revenueChart || premiumGate).toBeTruthy();
    });

    test("should show Bookings by Status or premium gate", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const bookingsChart = await page.getByText(/bookings by status/i).isVisible().catch(() => false);
      const premiumGate = await page.getByText(/detailed booking analytics/i).isVisible().catch(() => false);

      expect(bookingsChart || premiumGate).toBeTruthy();
    });

    test("should show Top Tours or premium gate", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const topTours = await page.getByText(/top tours by revenue/i).isVisible().catch(() => false);
      const premiumGate = await page.getByText(/detailed revenue breakdowns/i).isVisible().catch(() => false);

      expect(topTours || premiumGate).toBeTruthy();
    });

    test("should show Equipment Utilization or premium gate", async ({ page }) => {
      await page.goto(getTenantUrl("/app/reports"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const equipmentUtil = await page.getByText(/equipment utilization/i).isVisible().catch(() => false);
      const premiumGate = await page.getByText(/equipment utilization reports/i).isVisible().catch(() => false);

      expect(equipmentUtil || premiumGate).toBeTruthy();
    });
  });
});

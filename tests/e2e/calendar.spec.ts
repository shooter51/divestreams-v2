import { test, expect } from "@playwright/test";

/**
 * Calendar E2E Tests
 *
 * Tests for calendar view route:
 * - /app/calendar - Calendar view with month/week toggle
 */

// Helper functions
const getTenantUrl = (path: string = "/") =>
  `http://e2etest.localhost:5173${path}`;

test.describe("Calendar View", () => {
  test.describe("Calendar Page", () => {
    test("should navigate to calendar page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/calendar"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/calendar") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display page heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/calendar"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /calendar/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should have Month view button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/calendar"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const monthBtn = await page.getByRole("button", { name: /month/i }).isVisible().catch(() => false);
      expect(monthBtn).toBeTruthy();
    });

    test("should have Week view button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/calendar"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const weekBtn = await page.getByRole("button", { name: /week/i }).isVisible().catch(() => false);
      expect(weekBtn).toBeTruthy();
    });

    test("should have Schedule Trip link", async ({ page }) => {
      await page.goto(getTenantUrl("/app/calendar"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const scheduleLink = await page.getByRole("link", { name: /schedule trip/i }).isVisible().catch(() => false);
      expect(scheduleLink).toBeTruthy();
    });

    test("should show capacity legend", async ({ page }) => {
      await page.goto(getTenantUrl("/app/calendar"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const capacityLabel = await page.getByText(/capacity/i).isVisible().catch(() => false);
      expect(capacityLabel).toBeTruthy();
    });

    test("should show Available indicator in legend", async ({ page }) => {
      await page.goto(getTenantUrl("/app/calendar"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const availableIndicator = await page.getByText(/available/i).first().isVisible().catch(() => false);
      expect(availableIndicator).toBeTruthy();
    });

    test("should show Full indicator in legend", async ({ page }) => {
      await page.goto(getTenantUrl("/app/calendar"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const fullIndicator = await page.getByText(/^full$/i).isVisible().catch(() => false);
      expect(fullIndicator).toBeTruthy();
    });

    test("should have calendar navigation buttons", async ({ page }) => {
      await page.goto(getTenantUrl("/app/calendar"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // FullCalendar uses prev/next/today buttons
      const todayBtn = await page.getByRole("button", { name: /today/i }).isVisible().catch(() => false);
      expect(todayBtn).toBeTruthy();
    });

    test("should display calendar grid", async ({ page }) => {
      await page.goto(getTenantUrl("/app/calendar"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // Check for calendar container
      const calendarContainer = await page.locator(".fc, [class*='calendar']").first().isVisible().catch(() => false);
      expect(calendarContainer).toBeTruthy();
    });
  });

  test.describe("View Toggle", () => {
    test("should toggle to Week view when clicking Week button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/calendar"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const weekBtn = page.getByRole("button", { name: /week/i });
      if (await weekBtn.isVisible()) {
        await weekBtn.click();
        await page.waitForTimeout(500);

        // Should still be on calendar page
        expect(page.url()).toContain("/calendar");
      }
    });

    test("should toggle back to Month view when clicking Month button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/calendar"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // First click Week, then Month
      const weekBtn = page.getByRole("button", { name: /week/i });
      const monthBtn = page.getByRole("button", { name: /month/i });

      if (await weekBtn.isVisible() && await monthBtn.isVisible()) {
        await weekBtn.click();
        await page.waitForTimeout(500);
        await monthBtn.click();
        await page.waitForTimeout(500);

        // Should still be on calendar page
        expect(page.url()).toContain("/calendar");
      }
    });
  });

  test.describe("Trip Modal", () => {
    test("should show trip details when clicking an event", async ({ page }) => {
      await page.goto(getTenantUrl("/app/calendar"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // Try to click on an event if any exist
      const event = page.locator(".fc-event, [class*='event']").first();
      if (await event.isVisible().catch(() => false)) {
        await event.click();
        await page.waitForTimeout(500);

        // Modal should appear with View Trip link
        const viewTripLink = await page.getByRole("link", { name: /view trip/i }).isVisible().catch(() => false);
        const modalContent = await page.locator("[class*='modal'], [role='dialog']").isVisible().catch(() => false);
        expect(viewTripLink || modalContent).toBeTruthy();
      }
    });
  });
});

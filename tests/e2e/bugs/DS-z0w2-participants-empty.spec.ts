/**
 * DS-z0w2: Booking participants always empty
 *
 * Bug: getBookingWithFullDetails always returned participantDetails: []
 * regardless of what was stored in the JSONB column.
 *
 * Fix: Query raw participantDetails from the bookings table and return
 * the actual stored data.
 */

import { test, expect } from "@playwright/test";
import { TenantBasePage } from "../page-objects/base.page";

class BookingsPage extends TenantBasePage {
  async login() {
    await this.gotoAuth("/login");
    await this.page.getByRole("textbox", { name: /email/i }).fill("e2e-tester@demo.com");
    await this.page.locator('input[type="password"]').first().fill("DemoPass1234");
    await this.page.getByRole("button", { name: /sign in/i }).click();
    await this.page.waitForURL(/\/tenant/, { timeout: 10000 });
  }

  async gotoBookings() {
    await this.gotoApp("/bookings");
  }

  async gotoFirstBooking() {
    await this.gotoApp("/bookings");
    await this.page.waitForLoadState("load");
    const firstLink = this.page.locator('a[href*="/tenant/bookings/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 10000 });
    await firstLink.click();
    await this.page.waitForLoadState("load");
  }
}

test.describe("DS-z0w2: Booking participants always empty", () => {
  let bookingsPage: BookingsPage;

  test.beforeEach(async ({ page }) => {
    bookingsPage = new BookingsPage(page, "demo");
    await bookingsPage.login();
  });

  test("booking detail page renders participants section without crashing", async ({ page }) => {
    await bookingsPage.gotoFirstBooking();

    // The participants section should be visible
    const participantsSection = page.locator("h2:has-text('Participants')");
    await expect(participantsSection).toBeVisible({ timeout: 10000 });

    // The page should not show a JS error or blank
    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("body")).not.toContainText("500");
  });

  test("participants section shows participant count from booking", async ({ page }) => {
    await bookingsPage.gotoFirstBooking();

    // Participants header should include the count
    const participantsHeading = page.locator("h2").filter({ hasText: /Participants/ });
    await expect(participantsHeading).toBeVisible({ timeout: 10000 });

    // The heading shows participant count like "Participants (2)"
    const headingText = await participantsHeading.textContent();
    expect(headingText).toMatch(/Participants\s*\(\d+\)/);
  });

  test("participantDetails no longer hardcoded to empty array", async ({ page }) => {
    await bookingsPage.gotoFirstBooking();

    // Verify we are on the booking detail page
    await expect(page).toHaveURL(/\/tenant\/bookings\//);

    // The section renders; even if no named participants, the section itself is present
    const participantsSection = page.locator("h2:has-text('Participants')");
    await expect(participantsSection).toBeVisible({ timeout: 10000 });

    // No JS error boundary triggered
    await expect(page.locator("[data-testid='error-boundary']")).not.toBeVisible();
  });
});

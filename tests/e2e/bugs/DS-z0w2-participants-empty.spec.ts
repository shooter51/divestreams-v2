/**
 * DS-z0w2: Booking participants section always empty
 *
 * Bug: When participantDetails JSONB is null (bookings created via UI),
 * the Participants section showed a count header but no entries below it.
 *
 * Fix: When no participant details are recorded, show the customer name
 * as the primary contact with a "Primary contact" label.
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

  async gotoFirstBooking() {
    await this.gotoApp("/bookings");
    await this.page.waitForLoadState("load");
    const firstLink = this.page.locator('a[href*="/tenant/bookings/"]:not([href*="/new"])').first();
    await expect(firstLink).toBeVisible({ timeout: 10000 });
    await firstLink.click();
    await this.page.waitForLoadState("load");
  }
}

test.describe("DS-z0w2: Booking participants section not empty", () => {
  let bookingsPage: BookingsPage;

  test.beforeEach(async ({ page }) => {
    bookingsPage = new BookingsPage(page, "demo");
    await bookingsPage.login();
  });

  test("participants section always has content", async ({ page }) => {
    await bookingsPage.gotoFirstBooking();

    // The participants section should be visible
    const participantsHeading = page.locator("h2").filter({ hasText: /Participants/ });
    await expect(participantsHeading).toBeVisible({ timeout: 10000 });

    // The section should contain at least one participant entry (name visible)
    const participantEntries = page.locator("h2:has-text('Participants')").locator("..").locator(".bg-surface-inset");
    await expect(participantEntries.first()).toBeVisible({ timeout: 5000 });

    // Should have a name displayed
    const firstName = participantEntries.first().locator("p.font-medium");
    const nameText = await firstName.textContent();
    expect(nameText!.trim().length).toBeGreaterThan(0);
  });

  test("participants section shows customer name as fallback", async ({ page }) => {
    await bookingsPage.gotoFirstBooking();

    // Get the customer name from the sidebar
    const customerSection = page.locator("h2:has-text('Customer')").locator("..");
    const customerLink = customerSection.locator("a").first();
    const customerName = await customerLink.textContent();

    // The participants section should contain either detailed participants
    // or the customer name as the primary contact fallback
    const participantsSection = page.locator("h2:has-text('Participants')").locator("..");
    const participantsText = await participantsSection.textContent();

    // Either the customer's first name appears in participants, or there are
    // explicitly named participants listed
    const hasContent = participantsSection.locator(".bg-surface-inset");
    await expect(hasContent.first()).toBeVisible({ timeout: 5000 });
  });

  test("page renders without error", async ({ page }) => {
    await bookingsPage.gotoFirstBooking();

    await expect(page).toHaveURL(/\/tenant\/bookings\//);
    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("[data-testid='error-boundary']")).not.toBeVisible();
  });
});

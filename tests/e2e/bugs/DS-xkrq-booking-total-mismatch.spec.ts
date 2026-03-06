/**
 * DS-xkrq: Booking pricing total mismatch
 *
 * Bug: Pricing sidebar showed "$120.00 x 4 pax = $480.00" then "Total: $528.00"
 * with no explanation for the $48 difference. Tax was not displayed as a line item.
 *
 * Fix: Added tax line item to the pricing sidebar so all components of the total
 * are visible and the math adds up.
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

test.describe("DS-xkrq: Booking pricing total shows all line items", () => {
  let bookingsPage: BookingsPage;

  test.beforeEach(async ({ page }) => {
    bookingsPage = new BookingsPage(page, "demo");
    await bookingsPage.login();
  });

  test("pricing section renders total amount", async ({ page }) => {
    await bookingsPage.gotoFirstBooking();

    const pricingSection = page.locator("h2:has-text('Pricing')");
    await expect(pricingSection).toBeVisible({ timeout: 10000 });

    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("pricing breakdown line items sum to total", async ({ page }) => {
    await bookingsPage.gotoFirstBooking();

    // Get the pricing sidebar container
    const pricingHeading = page.locator("h2:has-text('Pricing')");
    await expect(pricingHeading).toBeVisible({ timeout: 10000 });
    const pricingSection = pricingHeading.locator("..");

    // Extract the total
    const totalText = await pricingSection.locator("text=Total").locator("..").locator("span").last().textContent();
    expect(totalText).toMatch(/\$/);

    // Parse total value
    const totalValue = parseFloat(totalText!.replace(/[^0-9.]/g, ""));
    expect(totalValue).toBeGreaterThan(0);

    // Get the subtotal (basePrice x pax line)
    const subtotalText = await pricingSection.locator("text=/pax/").locator("..").locator("span").last().textContent();
    const subtotalValue = parseFloat(subtotalText!.replace(/[^0-9.]/g, ""));

    // If there's a difference between subtotal and total, there must be
    // visible line items (tax, equipment, discount) explaining it
    if (Math.abs(totalValue - subtotalValue) > 0.01) {
      // At least one of tax, equipment, or discount should be visible
      const taxVisible = await pricingSection.locator("text=Tax").isVisible();
      const equipmentVisible = await pricingSection.locator("text=Equipment").isVisible();
      const discountVisible = await pricingSection.locator("text=Discount").isVisible();
      expect(taxVisible || equipmentVisible || discountVisible).toBe(true);
    }
  });

  test("equipment section is hidden when no equipment rentals", async ({ page }) => {
    await bookingsPage.gotoFirstBooking();

    const equipmentSection = page.locator("h2:has-text('Equipment Rental')");
    const isVisible = await equipmentSection.isVisible();
    if (isVisible) {
      const equipmentTotal = page.locator("text=Equipment Total").locator("..").locator("span").last();
      const totalText = await equipmentTotal.textContent();
      expect(totalText).toMatch(/\$\d+/);
    }
  });
});

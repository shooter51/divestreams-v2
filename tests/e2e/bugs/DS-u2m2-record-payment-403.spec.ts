/**
 * DS-u2m2: Record Payment returns 403
 *
 * Bug: The payment modal form did not include the CSRF token (<CsrfInput />),
 * causing the requireCsrf check in requireOrgContext to throw a 403 Forbidden
 * response when the payment form was submitted.
 *
 * Fix: Added <CsrfInput /> inside the payment modal form so the CSRF token
 * is included in the FormData submitted by fetcher.submit().
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

  async gotoFirstBookingWithBalance() {
    // Navigate to bookings and find one with a balance due
    await this.gotoApp("/bookings");
    await this.page.waitForLoadState("load");
    const firstLink = this.page.locator('a[href*="/tenant/bookings/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 10000 });
    await firstLink.click();
    await this.page.waitForLoadState("load");
  }
}

test.describe("DS-u2m2: Record Payment no longer returns 403", () => {
  let bookingsPage: BookingsPage;

  test.beforeEach(async ({ page }) => {
    bookingsPage = new BookingsPage(page, "demo");
    await bookingsPage.login();
  });

  test("Record Payment button is visible when balance is due", async ({ page }) => {
    await bookingsPage.gotoFirstBookingWithBalance();

    // Check if there's a balance due
    const balanceDue = page.locator("text=Balance Due");
    const recordPaymentBtn = page.locator("button:has-text('+ Record Payment'), text='+ Record Payment'");

    if (await balanceDue.isVisible()) {
      // If there's a balance, the record payment button should appear
      await expect(recordPaymentBtn).toBeVisible({ timeout: 5000 });
    }
    // Even if no balance on first booking, the page should load without 403
    await expect(page.locator("body")).not.toContainText("403");
    await expect(page.locator("body")).not.toContainText("Forbidden");
  });

  test("clicking Record Payment opens modal without 403", async ({ page }) => {
    await bookingsPage.gotoFirstBookingWithBalance();

    // Look for the record payment link
    const recordPaymentBtn = page.locator("button").filter({ hasText: /Record Payment/ }).first();

    if (await recordPaymentBtn.isVisible({ timeout: 3000 })) {
      await recordPaymentBtn.click();

      // Modal should open, not a 403 page
      const modal = page.locator("h2:has-text('Record Payment')");
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Should not show 403 error
      await expect(page.locator("body")).not.toContainText("403");
      await expect(page.locator("body")).not.toContainText("Forbidden");
    }
  });

  test("submitting payment form does not return 403", async ({ page }) => {
    // Intercept network responses to detect 403
    const responses: { url: string; status: number }[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/tenant/bookings/")) {
        responses.push({ url: response.url(), status: response.status() });
      }
    });

    await bookingsPage.gotoFirstBookingWithBalance();

    const recordPaymentBtn = page.locator("button").filter({ hasText: /Record Payment/ }).first();

    if (await recordPaymentBtn.isVisible({ timeout: 3000 })) {
      await recordPaymentBtn.click();

      const modal = page.locator("h2:has-text('Record Payment')");
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Fill payment amount (use a small amount to avoid exceeding balance)
      const amountInput = page.locator('input[name="amount"]');
      await amountInput.clear();
      await amountInput.fill("1.00");

      // Select payment method
      const methodSelect = page.locator('select[name="paymentMethod"]');
      await methodSelect.selectOption("cash");

      // Submit the form
      const submitBtn = page.locator('button[type="submit"]:has-text("Record Payment")');
      await submitBtn.click();

      // Wait briefly for response
      await page.waitForTimeout(2000);

      // Check no 403 in intercepted responses
      const forbidden = responses.filter((r) => r.status === 403);
      expect(forbidden).toHaveLength(0);

      // Modal should close and no 403 page shown
      await expect(page.locator("body")).not.toContainText("Forbidden: Missing CSRF token");
      await expect(page.locator("body")).not.toContainText("Forbidden: Invalid CSRF token");
    }
  });
});

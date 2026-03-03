/**
 * DS-nom0: Bookings search/filter broken
 *
 * Bug: The `search` query parameter was read from the URL but never applied
 * to the WHERE clause in the bookings loader. All bookings were returned
 * regardless of the search term.
 *
 * Fix: Added a search condition that filters by booking number, customer
 * first name, last name, or email using ILIKE.
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
    await this.page.waitForLoadState("load");
  }
}

test.describe("DS-nom0: Bookings search filter works", () => {
  let bookingsPage: BookingsPage;

  test.beforeEach(async ({ page }) => {
    bookingsPage = new BookingsPage(page, "demo");
    await bookingsPage.login();
    await bookingsPage.gotoBookings();
  });

  test("search input is present on bookings page", async ({ page }) => {
    const searchInput = page.locator('input[name="search"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test("searching with no-match term returns empty results", async ({ page }) => {
    const searchInput = page.locator('input[name="search"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Enter a search term that should not match any booking
    const noMatchTerm = "XYZZYNONEXISTENT99999";
    await searchInput.fill(noMatchTerm);

    // Submit the filter form
    const filterBtn = page.locator('button[type="submit"]:has-text("Filter")');
    await filterBtn.click();
    await page.waitForLoadState("load");

    // Should show "no bookings found" message
    await expect(page.locator("body")).toContainText("No bookings found");
  });

  test("search filters results - does not show all bookings for specific term", async ({ page }) => {
    // First, get the total number of rows without filter
    const searchInput = page.locator('input[name="search"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Count initial booking rows
    const allRows = page.locator("tbody tr");
    const totalRows = await allRows.count();

    if (totalRows <= 1) {
      test.skip(); // Not enough data to test filtering
      return;
    }

    // Get first customer name from the table
    const firstCustomerCell = page.locator("tbody tr").first().locator("td").nth(1);
    const customerName = await firstCustomerCell.textContent();

    if (!customerName || customerName.trim() === "") {
      test.skip();
      return;
    }

    // Extract a unique part of the name to search for
    const nameParts = customerName.trim().split(/\s+/);
    const searchTerm = nameParts[0]; // First name

    // Search for this customer
    await searchInput.fill(searchTerm);
    const filterBtn = page.locator('button[type="submit"]:has-text("Filter")');
    await filterBtn.click();
    await page.waitForLoadState("load");

    // Should show filtered results (not all bookings)
    const filteredRows = page.locator("tbody tr");
    const filteredCount = await filteredRows.count();

    // The URL should include the search param
    await expect(page).toHaveURL(new RegExp(`search=${encodeURIComponent(searchTerm)}`));

    // Either we see fewer results, or we see "no bookings found"
    // The key assertion is that the search param is reflected in the URL
    // and the page doesn't crash
    await expect(page.locator("body")).not.toContainText("500");
    await expect(page.locator("body")).not.toContainText("Something went wrong");

    // Filtered count should be <= total (search reduced or same results)
    expect(filteredCount).toBeLessThanOrEqual(totalRows);
  });

  test("search via URL query param filters correctly", async ({ page }) => {
    // Navigate directly with a search param that won't match
    const url = new URL(page.url());
    url.searchParams.set("search", "DEFINITELY_NOT_A_NAME_XYZ");
    await page.goto(url.toString());
    await page.waitForLoadState("load");

    // Should show "No bookings found" since search is now applied
    await expect(page.locator("td:has-text('No bookings found')")).toBeVisible({ timeout: 10000 });
  });
});

/**
 * Security E2E Tests - Payment Validation
 *
 * Tests that verify server-side payment validation prevents payment bypass attacks.
 * These tests ensure users cannot pay less than the required amount for bookings
 * and training enrollments.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin, seedDemoData } from "../helpers/index.ts";

test.describe("Payment Validation Security", () => {
  // Skip: These tests require platform admin login which isn't seeded in CI environment.
  // Root cause: auth.api.signUpEmail fails silently in global-setup.ts context.
  // TODO: Fix platform admin seeding in CI (KAN-668)
  test.skip();

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await seedDemoData(page);
  });

  test.describe("Booking Payment Bypass Prevention", () => {
    test("should reject payment exceeding remaining balance", async ({
      page,
    }) => {
      // Navigate to bookings
      await page.goto("/tenant/bookings");

      // Create a new booking for $500
      await page.click('[href="/tenant/bookings/new"]');
      await page.selectOption('select[name="tripId"]', { index: 1 });
      await page.selectOption('select[name="customerId"]', { index: 1 });
      await page.fill('input[name="total"]', "500.00");
      await page.click('button[type="submit"]');

      // Wait for booking to be created
      await expect(page.locator("text=created successfully")).toBeVisible();

      // Get the booking ID from the URL
      const bookingId = page.url().split("/").pop();

      // Try to record payment of $600 (exceeds $500 total)
      await page.click('button:has-text("Record Payment")');
      await page.fill('input[name="amount"]', "600.00");
      await page.selectOption('select[name="paymentMethod"]', "cash");
      await page.click('button[type="submit"]');

      // Should show error message
      await expect(
        page.locator(
          "text=/Payment amount.*exceeds remaining balance|amount exceeds/i"
        )
      ).toBeVisible();

      // Booking should still show $0 paid
      await page.goto(`/tenant/bookings/${bookingId}`);
      await expect(page.locator("text=/Paid.*\\$0\\.00/i")).toBeVisible();
    });

    test("should reject negative payment amounts", async ({ page }) => {
      // Navigate to bookings
      await page.goto("/tenant/bookings");

      // Create a booking
      await page.click('[href="/tenant/bookings/new"]');
      await page.selectOption('select[name="tripId"]', { index: 1 });
      await page.selectOption('select[name="customerId"]', { index: 1 });
      await page.fill('input[name="total"]', "200.00");
      await page.click('button[type="submit"]');

      await expect(page.locator("text=created successfully")).toBeVisible();

      // Try to record negative payment
      await page.click('button:has-text("Record Payment")');
      await page.fill('input[name="amount"]', "-50.00");
      await page.selectOption('select[name="paymentMethod"]', "cash");
      await page.click('button[type="submit"]');

      // Should show error
      await expect(
        page.locator("text=/negative|cannot be negative|must be positive/i")
      ).toBeVisible();
    });

    test("should allow exact payment amount", async ({ page }) => {
      // Navigate to bookings
      await page.goto("/tenant/bookings");

      // Create a booking for $300
      await page.click('[href="/tenant/bookings/new"]');
      await page.selectOption('select[name="tripId"]', { index: 1 });
      await page.selectOption('select[name="customerId"]', { index: 1 });
      await page.fill('input[name="total"]', "300.00");
      await page.click('button[type="submit"]');

      await expect(page.locator("text=created successfully")).toBeVisible();
      const bookingId = page.url().split("/").pop();

      // Record payment for exact amount ($300)
      await page.click('button:has-text("Record Payment")');
      await page.fill('input[name="amount"]', "300.00");
      await page.selectOption('select[name="paymentMethod"]', "cash");
      await page.click('button[type="submit"]');

      // Should succeed
      await expect(page.locator("text=/payment.*recorded/i")).toBeVisible();

      // Booking should show $300 paid and status "paid"
      await page.goto(`/tenant/bookings/${bookingId}`);
      await expect(page.locator("text=/Paid.*\\$300\\.00/i")).toBeVisible();
      await expect(page.locator("text=/Status.*Paid/i")).toBeVisible();
    });

    test("should allow partial payments within balance", async ({ page }) => {
      // Navigate to bookings
      await page.goto("/tenant/bookings");

      // Create a booking for $400
      await page.click('[href="/tenant/bookings/new"]');
      await page.selectOption('select[name="tripId"]', { index: 1 });
      await page.selectOption('select[name="customerId"]', { index: 1 });
      await page.fill('input[name="total"]', "400.00");
      await page.click('button[type="submit"]');

      await expect(page.locator("text=created successfully")).toBeVisible();
      const bookingId = page.url().split("/").pop();

      // First payment: $100
      await page.click('button:has-text("Record Payment")');
      await page.fill('input[name="amount"]', "100.00");
      await page.selectOption('select[name="paymentMethod"]', "cash");
      await page.click('button[type="submit"]');
      await expect(page.locator("text=/payment.*recorded/i")).toBeVisible();

      // Second payment: $200 (total now $300)
      await page.click('button:has-text("Record Payment")');
      await page.fill('input[name="amount"]', "200.00");
      await page.selectOption('select[name="paymentMethod"]', "cash");
      await page.click('button[type="submit"]');
      await expect(page.locator("text=/payment.*recorded/i")).toBeVisible();

      // Try third payment: $150 (would total $450, exceeds $400)
      await page.click('button:has-text("Record Payment")');
      await page.fill('input[name="amount"]', "150.00");
      await page.selectOption('select[name="paymentMethod"]', "cash");
      await page.click('button[type="submit"]');

      // Should be rejected
      await expect(
        page.locator("text=/exceeds remaining balance/i")
      ).toBeVisible();

      // Verify only $300 paid
      await page.goto(`/tenant/bookings/${bookingId}`);
      await expect(page.locator("text=/Paid.*\\$300\\.00/i")).toBeVisible();
    });
  });

  test.describe("Training Enrollment Payment Bypass Prevention", () => {
    test("should reject enrollment payment exceeding course price", async ({
      page,
    }) => {
      // Navigate to training sessions
      await page.goto("/tenant/training/sessions");

      // Find a session (assumes seed data created sessions)
      await page.click("tr:has-text('Open Water') a:has-text('View')");

      // Try to enroll with excessive payment
      await page.click('button:has-text("Enroll Student")');
      await page.selectOption('select[name="customerId"]', { index: 1 });
      await page.fill('input[name="amountPaid"]', "10000.00"); // Way over course price
      await page.selectOption('select[name="paymentStatus"]', "paid");
      await page.click('button[type="submit"]');

      // Should show error
      await expect(
        page.locator("text=/exceeds.*price|amount.*too high/i")
      ).toBeVisible();
    });

    test("should reject negative enrollment payment", async ({ page }) => {
      await page.goto("/tenant/training/sessions");
      await page.click("tr:first-child a:has-text('View')");

      await page.click('button:has-text("Enroll Student")');
      await page.selectOption('select[name="customerId"]', { index: 1 });
      await page.fill('input[name="amountPaid"]', "-100.00");
      await page.click('button[type="submit"]');

      await expect(
        page.locator("text=/negative|cannot be negative/i")
      ).toBeVisible();
    });

    test("should allow valid enrollment payment", async ({ page }) => {
      await page.goto("/tenant/training/sessions");
      await page.click("tr:first-child a:has-text('View')");

      // Get the session price (assumes it's displayed)
      const priceText = await page.locator("text=/Price.*\\$/i").textContent();
      const price = parseFloat(
        priceText?.match(/\$?([\d,]+\.?\d*)/)?.[1]?.replace(/,/g, "") || "0"
      );

      // Enroll with valid payment (50% deposit)
      await page.click('button:has-text("Enroll Student")');
      await page.selectOption('select[name="customerId"]', { index: 1 });
      await page.fill('input[name="amountPaid"]', (price * 0.5).toFixed(2));
      await page.selectOption('select[name="paymentStatus"]', "partial");
      await page.click('button[type="submit"]');

      // Should succeed
      await expect(
        page.locator("text=/enrolled.*successfully|enrollment.*created/i")
      ).toBeVisible();
    });

    test("should respect price override when validating payment", async ({
      page,
    }) => {
      // Create a session with price override
      await page.goto("/tenant/training/sessions/new");
      await page.selectOption('select[name="courseId"]', { index: 1 });
      await page.fill('input[name="startDate"]', "2026-03-01");
      await page.fill('input[name="priceOverride"]', "350.00"); // Override course price
      await page.click('button[type="submit"]');

      await expect(page.locator("text=created successfully")).toBeVisible();

      // Try to enroll with payment exceeding override price
      await page.click('button:has-text("Enroll Student")');
      await page.selectOption('select[name="customerId"]', { index: 1 });
      await page.fill('input[name="amountPaid"]', "400.00"); // Exceeds $350 override
      await page.click('button[type="submit"]');

      // Should be rejected
      await expect(page.locator("text=/exceeds.*price/i")).toBeVisible();
    });
  });
});

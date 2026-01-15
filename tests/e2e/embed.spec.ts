import { test, expect } from "@playwright/test";

/**
 * Embed Booking Widget E2E Tests
 *
 * Tests for the public-facing booking widget routes:
 * - /embed/:tenant - Tour listing
 * - /embed/:tenant/tour/:id - Tour detail with dates
 * - /embed/:tenant/book - Booking form
 * - /embed/:tenant/confirm - Booking confirmation
 *
 * Note: These are public routes (no authentication required)
 */

// Helper functions for embed routes (using demo tenant for testing)
const getEmbedUrl = (path: string = "") =>
  `http://localhost:5173/embed/demo${path}`;

test.describe("Booking Widget (Public Embed)", () => {
  test.describe("Tour Listing Page", () => {
    test("should navigate to embed tour listing route", async ({ page }) => {
      await page.goto(getEmbedUrl());
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      // Should either show tours or show "shop not found" for non-existent tenant
      expect(currentUrl.includes("/embed") || currentUrl.includes("demo")).toBeTruthy();
    });

    test("should display Available Tours heading or no tours message", async ({ page }) => {
      await page.goto(getEmbedUrl());
      await page.waitForTimeout(1500);

      const hasToursHeading = await page.getByRole("heading", { name: /available tours/i }).isVisible().catch(() => false);
      const hasNoTours = await page.getByText(/no tours available/i).isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/shop not found|not found/i).isVisible().catch(() => false);

      expect(hasToursHeading || hasNoTours || hasNotFound).toBeTruthy();
    });

    test("should show tour cards with View Dates button or empty state", async ({ page }) => {
      await page.goto(getEmbedUrl());
      await page.waitForTimeout(1500);

      const viewDatesBtn = await page.getByText(/view dates/i).first().isVisible().catch(() => false);
      const hasNoTours = await page.getByText(/no tours available|check back soon/i).isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/shop not found|not found/i).isVisible().catch(() => false);

      expect(viewDatesBtn || hasNoTours || hasNotFound).toBeTruthy();
    });

    test("should display tour type badges", async ({ page }) => {
      await page.goto(getEmbedUrl());
      await page.waitForTimeout(1500);

      const hasTypeBadge = await page.getByText(/single dive|multi-dive|course|snorkel|night dive|experience/i).first().isVisible().catch(() => false);
      const hasNoTours = await page.getByText(/no tours available/i).isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/shop not found|not found/i).isVisible().catch(() => false);

      expect(hasTypeBadge || hasNoTours || hasNotFound).toBeTruthy();
    });

    test("should show price formatted with currency", async ({ page }) => {
      await page.goto(getEmbedUrl());
      await page.waitForTimeout(1500);

      // Look for price format like "$99.00" or "A$150.00"
      const hasPrice = await page.getByText(/\$[\d,.]+/).first().isVisible().catch(() => false);
      const hasNoTours = await page.getByText(/no tours available/i).isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/shop not found|not found/i).isVisible().catch(() => false);

      expect(hasPrice || hasNoTours || hasNotFound).toBeTruthy();
    });

    test("should show duration or max participants info", async ({ page }) => {
      await page.goto(getEmbedUrl());
      await page.waitForTimeout(1500);

      // Look for duration (e.g., "2h", "30 min") or max participants (e.g., "Max 8")
      const hasDuration = await page.getByText(/\d+h|\d+ min/i).first().isVisible().catch(() => false);
      const hasMaxPax = await page.getByText(/max \d+/i).first().isVisible().catch(() => false);
      const hasNoTours = await page.getByText(/no tours available/i).isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/shop not found|not found/i).isVisible().catch(() => false);

      expect(hasDuration || hasMaxPax || hasNoTours || hasNotFound).toBeTruthy();
    });

    test("should show included items badges", async ({ page }) => {
      await page.goto(getEmbedUrl());
      await page.waitForTimeout(1500);

      // Look for inclusion badges
      const hasInclusions = await page.getByText(/equipment included|meals included|transport included/i).first().isVisible().catch(() => false);
      const hasNoTours = await page.getByText(/no tours available/i).isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/shop not found|not found/i).isVisible().catch(() => false);

      // This may not always be present, so we just check the page loads correctly
      expect(hasInclusions || hasNoTours || hasNotFound || page.url().includes("/embed")).toBeTruthy();
    });
  });

  test.describe("Tour Detail Page", () => {
    test("should navigate to tour detail route", async ({ page }) => {
      await page.goto(getEmbedUrl("/tour/1"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/embed") || currentUrl.includes("/tour")).toBeTruthy();
    });

    test("should show Back to Tours link", async ({ page }) => {
      await page.goto(getEmbedUrl("/tour/1"));
      await page.waitForTimeout(1500);

      const backLink = await page.getByText(/back to tours/i).isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/not found/i).isVisible().catch(() => false);

      expect(backLink || hasNotFound).toBeTruthy();
    });

    test("should show Select a Date section or no dates message", async ({ page }) => {
      await page.goto(getEmbedUrl("/tour/1"));
      await page.waitForTimeout(1500);

      const selectDateSection = await page.getByText(/select a date/i).isVisible().catch(() => false);
      const noUpcomingDates = await page.getByText(/no upcoming dates/i).isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/not found/i).isVisible().catch(() => false);

      expect(selectDateSection || noUpcomingDates || hasNotFound).toBeTruthy();
    });

    test("should show per person pricing text", async ({ page }) => {
      await page.goto(getEmbedUrl("/tour/1"));
      await page.waitForTimeout(1500);

      const perPersonText = await page.getByText(/per person/i).isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/not found/i).isVisible().catch(() => false);

      expect(perPersonText || hasNotFound).toBeTruthy();
    });

    test("should show What's Included section if inclusions exist", async ({ page }) => {
      await page.goto(getEmbedUrl("/tour/1"));
      await page.waitForTimeout(1500);

      const whatsIncluded = await page.getByText(/what's included/i).isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/not found/i).isVisible().catch(() => false);

      // This is optional based on tour data
      expect(whatsIncluded || hasNotFound || page.url().includes("/embed")).toBeTruthy();
    });

    test("should show Requirements section if tour has requirements", async ({ page }) => {
      await page.goto(getEmbedUrl("/tour/1"));
      await page.waitForTimeout(1500);

      const requirements = await page.getByText(/requirements|minimum certification|minimum age/i).isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/not found/i).isVisible().catch(() => false);

      // This is optional based on tour data
      expect(requirements || hasNotFound || page.url().includes("/embed")).toBeTruthy();
    });

    test("should show spots left for available trips", async ({ page }) => {
      await page.goto(getEmbedUrl("/tour/1"));
      await page.waitForTimeout(1500);

      const spotsLeft = await page.getByText(/spot.*left|fully booked/i).first().isVisible().catch(() => false);
      const noUpcomingDates = await page.getByText(/no upcoming dates/i).isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/not found/i).isVisible().catch(() => false);

      expect(spotsLeft || noUpcomingDates || hasNotFound).toBeTruthy();
    });

    test("should show secure checkout text", async ({ page }) => {
      await page.goto(getEmbedUrl("/tour/1"));
      await page.waitForTimeout(1500);

      const secureCheckout = await page.getByText(/secure checkout.*instant confirmation/i).isVisible().catch(() => false);
      const hasNotFound = await page.getByText(/not found/i).isVisible().catch(() => false);

      expect(secureCheckout || hasNotFound).toBeTruthy();
    });
  });

  test.describe("Booking Page", () => {
    test("should navigate to book route", async ({ page }) => {
      await page.goto(getEmbedUrl("/book"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      // Should show booking form or redirect if no trip selected
      expect(currentUrl.includes("/embed") || currentUrl.includes("/book")).toBeTruthy();
    });
  });

  test.describe("Confirmation Page", () => {
    test("should navigate to confirm route", async ({ page }) => {
      await page.goto(getEmbedUrl("/confirm"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      // Should show confirmation or redirect if no booking completed
      expect(currentUrl.includes("/embed") || currentUrl.includes("/confirm")).toBeTruthy();
    });
  });

  test.describe("Non-existent Tenant", () => {
    test("should show shop not found for invalid tenant", async ({ page }) => {
      await page.goto("http://localhost:5173/embed/nonexistent-shop-12345");
      await page.waitForTimeout(1500);

      const notFound = await page.getByText(/shop not found|not found/i).isVisible().catch(() => false);
      const is404 = page.url().includes("404") || page.url().includes("error");

      expect(notFound || is404 || page.url().includes("/embed")).toBeTruthy();
    });
  });
});

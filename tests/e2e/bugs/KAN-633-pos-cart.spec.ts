/**
 * E2E Test for KAN-633: POS - Rentals and Trip can't be added to cart
 *
 * Bug: When clicking on rental equipment or trip bookings in the POS system,
 * they don't get added to the cart. Only products work.
 *
 * Expected: Rentals and trips should be addable to cart just like products.
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "../page-objects/auth.page";
import { POSPage } from "../page-objects/pos.page";
import { testProducts } from "../fixtures/pos-fixtures";

test.describe("KAN-633: POS Rentals and Trips Cart @critical @pos", () => {
  let posPage: POSPage;

  test.beforeEach(async ({ page }) => {
    // Initialize page objects
    posPage = new POSPage(page, "demo");
    const loginPage = new LoginPage(page, "demo");

    // Login as demo user
    await loginPage.goto();
    await loginPage.login("e2e-tester@demo.com", "DemoPass1234");

    // Navigate to POS
    await posPage.goto();
    await posPage.expectPOSInterface();
  });

  test("BUG: should add rental equipment to cart", async () => {
    // Switch to Rentals tab
    await posPage.selectTab("rentals");
    await posPage.expectTabActive("rentals");

    // Get initial cart count
    const cartBefore = await posPage.getCartItemCount();

    // Add a rental (BCD for 1 day)
    await posPage.addRentalToCart(testProducts.rentals.bcd.name, 1);

    // Verify item added to cart
    const cartAfter = await posPage.getCartItemCount();
    expect(cartAfter).toBe(cartBefore + 1);

    // Verify it's a rental item in cart
    await posPage.expectCartItem(testProducts.rentals.bcd.name);
    const cartItem = await posPage.getCartItemByName(testProducts.rentals.bcd.name);
    expect(cartItem.details).toContain("day");
  });

  test("BUG: should add trip booking to cart", async () => {
    // Switch to Trips tab
    await posPage.selectTab("trips");
    await posPage.expectTabActive("trips");

    // Get initial cart count
    const cartBefore = await posPage.getCartItemCount();

    // Add a trip booking (1 participant)
    await posPage.addTripToCart(testProducts.trips.morningDive.tourName, 1);

    // Verify item added to cart
    const cartAfter = await posPage.getCartItemCount();
    expect(cartAfter).toBe(cartBefore + 1);

    // Verify it's a booking item in cart
    await posPage.expectCartItem(testProducts.trips.morningDive.tourName);
    const cartItem = await posPage.getCartItemByName(testProducts.trips.morningDive.tourName);
    expect(cartItem.details).toContain("participant");
  });

  test("BASELINE: should add product to cart (working case)", async () => {
    // Should default to Retail tab
    await posPage.expectTabActive("retail");

    // Get initial cart count
    const cartBefore = await posPage.getCartItemCount();

    // Add a product by index (first available)
    await posPage.addProductByIndex(0);

    // Verify item added to cart
    const cartAfter = await posPage.getCartItemCount();
    expect(cartAfter).toBe(cartBefore + 1);
  });

  test("should require customer for rentals", async () => {
    // Add a rental
    await posPage.selectTab("rentals");
    await posPage.addRentalToCart(testProducts.rentals.bcd.name, 1);

    // Verify customer required message
    await posPage.expectCustomerRequired();

    // Checkout buttons should be disabled
    await posPage.expectCheckoutButtonsDisabled();
  });

  test("should require customer for bookings", async () => {
    // Add a trip booking
    await posPage.selectTab("trips");
    await posPage.addTripToCart(testProducts.trips.morningDive.tourName, 1);

    // Verify customer required message
    await posPage.expectCustomerRequired();

    // Checkout buttons should be disabled
    await posPage.expectCheckoutButtonsDisabled();
  });

  test("should add multiple rentals with different durations", async () => {
    await posPage.selectTab("rentals");

    // Add BCD for 3 days
    await posPage.addRentalToCart(testProducts.rentals.bcd.name, 3);

    // Add Regulator for 2 days
    await posPage.addRentalToCart(testProducts.rentals.regulator.name, 2);

    // Verify both in cart
    await posPage.expectCartItem(testProducts.rentals.bcd.name);
    await posPage.expectCartItem(testProducts.rentals.regulator.name);

    const cartCount = await posPage.getCartItemCount();
    expect(cartCount).toBe(2);
  });

  test("should add multiple trip bookings with different participant counts", async () => {
    await posPage.selectTab("trips");

    // Add morning dive for 2 participants
    await posPage.addTripToCart(testProducts.trips.morningDive.tourName, 2);

    // Add night dive for 3 participants
    await posPage.addTripToCart(testProducts.trips.nightDive.tourName, 3);

    // Verify both in cart
    await posPage.expectCartItem(testProducts.trips.morningDive.tourName);
    await posPage.expectCartItem(testProducts.trips.nightDive.tourName);

    const cartCount = await posPage.getCartItemCount();
    expect(cartCount).toBe(2);
  });
});

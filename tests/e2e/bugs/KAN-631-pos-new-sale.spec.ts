/**
 * E2E Test for KAN-631: Point of Sale - New Sale button is not working
 *
 * Bug: The "New Sale" button in the POS interface doesn't respond when clicked
 * Expected: Clicking "New Sale" should clear the cart and customer selection
 * Actual: Button doesn't respond (no visual feedback, cart doesn't clear)
 *
 * Root Cause: Button onClick handler calls clearCart() which should work, but
 * testing revealed the button might not be properly responding to clicks in certain
 * scenarios (e.g., when cart has items, when customer is selected, etc.)
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/auth.page';
import { POSPage } from '../page-objects/pos.page';

test.describe('KAN-631: POS New Sale Button @critical @pos', () => {
  let posPage: POSPage;

  test.beforeEach(async ({ page }) => {
    // Initialize page objects
    posPage = new POSPage(page, 'demo');
    const loginPage = new LoginPage(page, 'demo');

    // Login as demo user
    await loginPage.goto();
    await loginPage.login('owner@demo.com', 'demo1234');

    // Navigate to POS
    await posPage.goto();
    await posPage.expectPOSInterface();
  });

  test('KAN-631.1: New Sale button should be visible and enabled', async ({ page }) => {
    const newSaleButton = page.getByRole('button', { name: /new sale/i });

    // Verify button exists
    await expect(newSaleButton).toBeVisible();

    // Verify button is enabled (not disabled)
    await expect(newSaleButton).toBeEnabled();

    // Verify button is clickable (no overlays)
    const boundingBox = await newSaleButton.boundingBox();
    expect(boundingBox).not.toBeNull();
    expect(boundingBox!.width).toBeGreaterThan(0);
    expect(boundingBox!.height).toBeGreaterThan(0);
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('KAN-631.2: New Sale button should clear cart when clicked (single product)', async ({ page }) => {
    // Add a product to cart
    await posPage.addProductByIndex(0);
    await posPage.waitForCartUpdate();

    // Verify cart is not empty
    await posPage.expectCartNotEmpty();
    const cartCount = await posPage.getCartItemCount();
    expect(cartCount).toBeGreaterThan(0);

    // Click "New Sale" button using page object method
    await posPage.clearCart();
    await posPage.waitForCartUpdate();

    // Verify cart is now empty
    await posPage.expectCartEmpty();
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('KAN-631.3: New Sale button should clear cart with multiple items', async ({ page }) => {
    // Add multiple products to cart
    await posPage.addProductByIndex(0);
    await posPage.waitForCartUpdate();
    await posPage.addProductByIndex(1);
    await posPage.waitForCartUpdate();

    // Verify cart has multiple items
    const cartCount = await posPage.getCartItemCount();
    expect(cartCount).toBeGreaterThanOrEqual(2);

    // Click "New Sale" button
    await posPage.clearCart();
    await posPage.waitForCartUpdate();

    // Verify cart is empty
    await posPage.expectCartEmpty();
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('KAN-631.4: New Sale button should work multiple times in succession', async ({ page }) => {
    // First sale - add and clear
    await posPage.addProductByIndex(0);
    await posPage.waitForCartUpdate();
    await posPage.expectCartNotEmpty();

    await posPage.clearCart();
    await posPage.waitForCartUpdate();
    await posPage.expectCartEmpty();

    // Second sale - add and clear again
    await posPage.addProductByIndex(0);
    await posPage.waitForCartUpdate();
    await posPage.expectCartNotEmpty();

    await posPage.clearCart();
    await posPage.waitForCartUpdate();
    await posPage.expectCartEmpty();

    // Third sale - verify button still works
    await posPage.addProductByIndex(0);
    await posPage.waitForCartUpdate();
    await posPage.expectCartNotEmpty();

    await posPage.clearCart();
    await posPage.waitForCartUpdate();
    await posPage.expectCartEmpty();
  });

  test('KAN-631.5: New Sale button should have correct styling (not disabled appearance)', async ({ page }) => {
    const newSaleButton = page.getByRole('button', { name: /new sale/i });

    // Get button classes
    const buttonClasses = await newSaleButton.getAttribute('class');

    // Verify it has the expected styling classes
    expect(buttonClasses).toContain('bg-surface-inset');
    expect(buttonClasses).toContain('hover:bg-surface-overlay');

    // Verify it doesn't have disabled styling
    expect(buttonClasses).not.toContain('disabled');
    expect(buttonClasses).not.toContain('cursor-not-allowed');
    expect(buttonClasses).not.toContain('opacity-50');

    // Verify button doesn't have disabled attribute
    const isDisabled = await newSaleButton.isDisabled();
    expect(isDisabled).toBe(false);
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test('KAN-631.6: New Sale button should clear cart with different item quantities', async ({ page }) => {
    // Add product and increase quantity
    await posPage.addProductByIndex(0);
    await posPage.waitForCartUpdate();
    await posPage.increaseQuantity(0);
    await posPage.increaseQuantity(0);
    await posPage.waitForCartUpdate();

    // Verify quantity was increased
    const quantity = await posPage.getItemQuantity(0);
    expect(quantity).toBeGreaterThan(1);

    // Click "New Sale"
    await posPage.clearCart();
    await posPage.waitForCartUpdate();

    // Verify cart is empty
    await posPage.expectCartEmpty();
  });
});

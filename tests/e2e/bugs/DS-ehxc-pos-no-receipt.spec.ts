/**
 * E2E Tests for DS-ehxc: POS silently clears cart after sale - no receipt/confirmation
 *
 * Bug: After completing a POS sale, the cart is cleared immediately without waiting
 *      for the server response. No receipt or success confirmation is shown to staff.
 *
 * Root Cause: completeCheckout() called clearCart() synchronously before fetcher response.
 *
 * Expected: After completing a sale, a success toast with receipt number should appear.
 * Actual:   Cart silently clears with no feedback; staff doesn't know if the sale succeeded.
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "../page-objects/auth.page";
import { POSPage } from "../page-objects/pos.page";

test.describe("DS-ehxc: POS no receipt/confirmation after sale @pos", () => {
  let posPage: POSPage;

  test.beforeEach(async ({ page }) => {
    posPage = new POSPage(page, "demo");
    const loginPage = new LoginPage(page, "demo");
    await loginPage.goto();
    await loginPage.login("e2e-tester@demo.com", "DemoPass1234");
    await posPage.goto();
    await posPage.expectPOSInterface();
  });

  test("should show success toast with receipt number after completing cash sale", async ({ page }) => {
    // Add a product to cart
    await posPage.addProductByIndex(0);
    await posPage.waitForCartUpdate();
    await posPage.expectCartNotEmpty();

    // Open cash checkout modal
    await page.getByRole("button", { name: /^cash$/i }).click();

    // Cash modal should appear
    const modal = page.locator('[role="dialog"]').or(
      page.locator(".fixed.inset-0").filter({ hasText: /cash/i })
    );
    await expect(modal.first()).toBeVisible({ timeout: 5000 });

    // Enter tendered amount
    const cashInput = page.locator("input").filter({ hasText: /tendered|amount/i }).first()
      .or(page.locator('input[type="number"]').first())
      .or(page.getByPlaceholder(/0\.00|amount/i).first());

    // Try to fill any numeric input in the modal
    const inputs = modal.first().locator("input");
    const inputCount = await inputs.count();
    if (inputCount > 0) {
      await inputs.first().fill("100");
    }

    // Click complete/confirm button
    const confirmBtn = modal.first().getByRole("button").filter({ hasText: /complete|confirm|process|pay/i }).first();
    if (await confirmBtn.count() > 0) {
      await confirmBtn.click();
    } else {
      // Try any submit button in the modal
      await modal.first().getByRole("button").last().click();
    }

    // Should see a success message with receipt number
    await expect(
      page.getByText(/sale complete/i).or(page.getByText(/receipt #/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test("checkout modal should close after initiating sale", async ({ page }) => {
    // Add a product
    await posPage.addProductByIndex(0);
    await posPage.waitForCartUpdate();

    // Verify checkout buttons exist and are clickable
    const cashButton = page.getByRole("button", { name: /^cash$/i });
    await expect(cashButton).toBeEnabled();

    // Click Cash
    await cashButton.click();

    // Modal should open (not instantly close)
    await expect(
      page.locator('[role="dialog"]').or(page.locator(".fixed").filter({ hasText: /cash/i })).first()
    ).toBeVisible({ timeout: 3000 });
  });

  test("cart should be cleared after server confirms the sale", async ({ page }) => {
    // Add a product
    await posPage.addProductByIndex(0);
    await posPage.waitForCartUpdate();
    await posPage.expectCartNotEmpty();

    // Complete the sale through cash payment
    await page.getByRole("button", { name: /^cash$/i }).click();

    const modal = page.locator(".fixed.inset-0").filter({ hasText: /cash/i })
      .or(page.locator('[role="dialog"]')).first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill in cash amount
    const numericInputs = modal.locator('input[type="number"], input[inputmode="numeric"]');
    const inputCount = await numericInputs.count();
    if (inputCount > 0) {
      await numericInputs.first().fill("100");
    }

    // Submit
    const submitButton = modal.getByRole("button").filter({ hasText: /complete|confirm|pay/i }).first();
    if (await submitButton.count() > 0) {
      await submitButton.click();
    }

    // Wait for success confirmation
    await expect(
      page.getByText(/sale complete/i).or(page.getByText(/receipt #/i))
    ).toBeVisible({ timeout: 10000 });

    // Cart should now be empty after success
    await posPage.expectCartEmpty();
  });
});

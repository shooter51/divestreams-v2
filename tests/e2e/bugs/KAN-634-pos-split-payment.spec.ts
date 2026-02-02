/**
 * KAN-634: POS - Split payment not working
 *
 * ISSUE: Split payment fails because it allows card payments but doesn't process
 * them through Stripe, causing validation errors when submitting to the backend.
 *
 * EXPECTED: Split payments work with cash-only (simplest fix)
 * ACTUAL: UI shows card option but fails on submission
 *
 * FIX: Restrict split payments to cash-only for now
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/auth.page';
import { POSPage } from '../page-objects/pos.page';

test.describe('KAN-634: POS Split Payment', () => {
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

  test('KAN-634-A: Split payment modal opens and shows correct UI', async ({ page }) => {
    // Add a product to cart (click first product)
    const firstProduct = page.locator('.grid button').first();
    await firstProduct.click();
    await page.waitForLoadState("domcontentloaded");

    // Verify item in cart
    await expect(page.locator('.w-96').getByText(/cart is empty/i)).not.toBeVisible();

    // Start split payment checkout
    await page.getByRole('button', { name: /split/i }).click();

    // Verify split modal opens and shows payment fields
    await expect(page.getByRole('heading', { name: /split payment/i })).toBeVisible();
    await expect(page.getByText(/total/i).first()).toBeVisible();
    await expect(page.getByPlaceholder(/amount/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^add$/i })).toBeVisible();
  });

  test('KAN-634-B: Cash-only split payment works', async ({ page }) => {
    // Add a product to cart
    const firstProduct = page.locator('.grid button').first();
    await firstProduct.click();
    await page.waitForLoadState("domcontentloaded");

    // Get total from cart
    const totalText = await page.locator('.w-96').locator('.font-bold').filter({ hasText: /total/i }).locator('..').locator('span').last().textContent();
    const totalAmount = parseFloat(totalText?.replace(/[^0-9.]/g, '') || '0');

    // Start split payment
    await page.getByRole('button', { name: /split/i }).click();
    await expect(page.getByText(/split payment/i)).toBeVisible();

    // Add full amount as cash
    await page.getByPlaceholder(/amount/i).fill(totalAmount.toString());
    await page.getByRole('button', { name: /^add$/i }).click();

    // Complete sale button should be enabled when full amount is paid
    const completeButton = page.getByRole('button', { name: /complete sale/i });
    await expect(completeButton).toBeEnabled();
    await completeButton.click();

    // Verify success toast appears
    await expect(page.locator('.bg-green-600')).toBeVisible({ timeout: 5000 });
  });

  test('KAN-634-C: Multiple cash payments in split mode', async ({ page }) => {
    // Add a product to cart
    const firstProduct = page.locator('.grid button').first();
    await firstProduct.click();
    await page.waitForLoadState("domcontentloaded");

    // Get total from cart
    const totalText = await page.locator('.w-96').locator('.font-bold').filter({ hasText: /total/i }).locator('..').locator('span').last().textContent();
    const totalAmount = parseFloat(totalText?.replace(/[^0-9.]/g, '') || '0');

    // Start split payment
    await page.getByRole('button', { name: /split/i }).click();
    await expect(page.getByRole('heading', { name: /split payment/i })).toBeVisible();

    // Add first payment (half of total)
    const firstPayment = Math.floor(totalAmount / 2);
    await page.getByPlaceholder(/amount/i).fill(firstPayment.toString());
    await page.getByRole('button', { name: /^add$/i }).click();

    // Verify first payment is listed
    await expect(page.getByText(`$${firstPayment.toFixed(2)}`).first()).toBeVisible();

    // Verify remaining amount is calculated
    const remaining = totalAmount - firstPayment;
    await expect(page.getByText(/remaining/i).locator('..')).toContainText(`$${remaining.toFixed(2)}`);

    // Add second payment (remaining amount)
    await page.getByRole('button', { name: /rest/i }).click(); // Use "Rest" button
    await page.getByRole('button', { name: /^add$/i }).click();

    // Complete sale button should be enabled
    const completeButton = page.getByRole('button', { name: /complete sale/i });
    await expect(completeButton).toBeEnabled();
    await completeButton.click();

    // Verify success
    await expect(page.locator('.bg-green-600')).toBeVisible({ timeout: 5000 });
  });

  test('KAN-634-D: Can remove payments from split payment', async ({ page }) => {
    // Add a product to cart
    const firstProduct = page.locator('.grid button').first();
    await firstProduct.click();
    await page.waitForLoadState("domcontentloaded");

    // Get total from cart to ensure payment doesn't exceed it
    const totalText = await page.locator('.w-96').locator('.font-bold').filter({ hasText: /total/i }).locator('..').locator('span').last().textContent();
    const totalAmount = parseFloat(totalText?.replace(/[^0-9.]/g, '') || '0');
    const paymentAmount = Math.floor(totalAmount / 3); // Use 1/3 of total

    // Start split payment
    await page.getByRole('button', { name: /split/i }).click();
    await expect(page.getByRole('heading', { name: /split payment/i })).toBeVisible();

    // Add cash payment
    await page.getByPlaceholder(/amount/i).fill(paymentAmount.toString());
    await page.getByRole('button', { name: /^add$/i }).click();

    // Verify payment is listed
    await expect(page.getByText(`$${paymentAmount.toFixed(2)}`).first()).toBeVisible();

    // Remove the payment - use first × button in payment list
    await page.locator('button').filter({ hasText: '×' }).first().click();

    // Verify payment is removed
    const paymentsList = page.locator('.bg-gray-50, .bg-surface-inset').filter({ hasText: `$${paymentAmount.toFixed(2)}` });
    await expect(paymentsList).not.toBeVisible();
  });

  test('KAN-634-E: Complete sale button disabled when amount does not match total', async ({ page }) => {
    // Add a product to cart
    const firstProduct = page.locator('.grid button').first();
    await firstProduct.click();
    await page.waitForLoadState("domcontentloaded");

    // Get total from cart
    const totalText = await page.locator('.w-96').locator('.font-bold').filter({ hasText: /total/i }).locator('..').locator('span').last().textContent();
    const totalAmount = parseFloat(totalText?.replace(/[^0-9.]/g, '') || '0');

    // Start split payment
    await page.getByRole('button', { name: /split/i }).click();
    await expect(page.getByText(/split payment/i)).toBeVisible();

    // Add less than total amount (use 50% to work with any product price)
    const partialAmount = Math.floor(totalAmount / 2);
    await page.getByPlaceholder(/amount/i).fill(partialAmount.toString());
    await page.getByRole('button', { name: /^add$/i }).click();

    // Complete sale button should be disabled
    const completeButton = page.getByRole('button', { name: /complete sale/i });
    await expect(completeButton).toBeDisabled();
  });
});

/**
 * Debug test to see what's actually on the POS page
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from './page-objects/auth.page';

test.describe('Debug POS Page Load', () => {
  test('Check what appears on POS page', async ({ page }) => {
    const loginPage = new LoginPage(page, 'demo');

    // Login
    await loginPage.goto();
    await loginPage.login('owner@demo.com', 'demo1234');

    // Navigate to POS
    await page.goto('http://demo.localhost:5173/tenant/pos');
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/pos-debug.png', fullPage: true });

    // Print page content
    const bodyText = await page.locator('body').textContent();
    console.log('==== PAGE CONTENT ====');
    console.log(bodyText);

    // Print page title
    const title = await page.title();
    console.log('==== PAGE TITLE ====');
    console.log(title);

    // Check for errors
    const errorMessage = await page.locator('[role="alert"], .error, .bg-red-').textContent().catch(() => 'No error found');
    console.log('==== ERROR MESSAGE ====');
    console.log(errorMessage);

    // Print URL
    console.log('==== CURRENT URL ====');
    console.log(page.url());
  });
});

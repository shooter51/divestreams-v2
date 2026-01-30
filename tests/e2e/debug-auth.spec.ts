/**
 * Debug test to check authentication
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from './page-objects/auth.page';

test.describe('Debug Authentication', () => {
  test('Check if login works', async ({ page }) => {
    const loginPage = new LoginPage(page, 'demo');

    // Go to login page
    await loginPage.goto();
    await page.screenshot({ path: 'test-results/01-login-page.png' });

    // Fill in credentials
    await page.getByLabel(/email/i).fill('owner@demo.com');
    await page.getByLabel(/password/i).fill('demo1234');
    await page.screenshot({ path: 'test-results/02-filled-form.png' });

    // Click sign in
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait a bit for any error messages or redirects
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/03-after-click.png' });

    // Check current URL
    console.log('==== URL AFTER LOGIN ATTEMPT ====');
    console.log(page.url());

    // Check for error messages
    const bodyText = await page.locator('body').textContent();
    console.log('==== PAGE CONTENT ====');
    console.log(bodyText?.substring(0, 500));

    // Check if there's an error alert
    const alerts = await page.locator('[role="alert"]').count();
    console.log('==== ALERT COUNT ====');
    console.log(alerts);

    if (alerts > 0) {
      const alertText = await page.locator('[role="alert"]').first().textContent();
      console.log('==== ALERT TEXT ====');
      console.log(alertText);
    }
  });
});

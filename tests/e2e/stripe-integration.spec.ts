import { test, expect } from "@playwright/test";

test.describe("Stripe Integration", () => {
  test("shows Stripe connection modal (not 'coming soon' error)", async ({ page }) => {
    // Navigate to integrations page
    await page.goto("http://localhost:5173/app/settings/integrations");
    
    // Wait for page to load
    await page.waitForLoadState("networkidle");
    
    // Find and click the Stripe Connect button
    const stripeSection = page.locator('text="Stripe"').first();
    await expect(stripeSection).toBeVisible();
    
    const connectButton = page.locator('button:has-text("Connect")').filter({
      has: page.locator(':scope', { hasText: 'Stripe' })
    }).first();
    
    // Click connect button
    await connectButton.click();
    
    // Verify modal appears with correct title (NOT "coming soon" error)
    await expect(page.locator('h2:has-text("Connect Stripe")')).toBeVisible();
    
    // Verify modal has the required fields
    await expect(page.locator('input[name="secretKey"]')).toBeVisible();
    await expect(page.locator('input[name="publishableKey"]')).toBeVisible();
    
    // Verify link to Stripe dashboard
    await expect(page.locator('a[href="https://dashboard.stripe.com/apikeys"]')).toBeVisible();
    
    // Verify submit button
    await expect(page.locator('button:has-text("Connect Stripe")')).toBeVisible();
  });
});

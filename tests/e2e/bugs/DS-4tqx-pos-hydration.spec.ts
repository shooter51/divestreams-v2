/**
 * E2E Test for DS-4tqx: React hydration error #418 on POS page
 *
 * Bug: The POS page calls new Date().toLocaleDateString() during SSR, which
 *      produces a different string than on the client (due to timezone/locale
 *      differences), triggering React hydration mismatch error #418.
 *
 * Fix: Use useState("") + useEffect(() => setCurrentDate(new Date().toLocaleDateString()))
 *      so the date is only rendered client-side, avoiding the SSR/client mismatch.
 *
 * Expected: POS page loads without any React hydration errors in console.
 * Actual:   Browser console shows "Minified React error #418" or similar hydration error.
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "../page-objects/auth.page";
import { POSPage } from "../page-objects/pos.page";

test.describe("DS-4tqx: React hydration error #418 on POS page @pos", () => {
  test("POS page should load without React hydration errors in browser console", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    const loginPage = new LoginPage(page, "demo");
    const posPage = new POSPage(page, "demo");

    await loginPage.goto();
    await loginPage.login("e2e-tester@demo.com", "DemoPass1234");

    await posPage.goto();
    await posPage.expectPOSInterface();

    // Allow any async hydration to settle
    await page.waitForLoadState("networkidle");

    // Filter for React hydration errors (error #418 = content mismatch, #423 = hydration timeout)
    const hydrationErrors = consoleErrors.filter(
      (e) =>
        e.includes("418") ||
        e.includes("hydrat") ||
        e.includes("Minified React error") ||
        e.includes("did not match")
    );

    expect(hydrationErrors, `Hydration errors found: ${hydrationErrors.join("\n")}`).toHaveLength(0);
  });

  test("POS header should display the shop name and date without errors", async ({ page }) => {
    const loginPage = new LoginPage(page, "demo");
    const posPage = new POSPage(page, "demo");

    await loginPage.goto();
    await loginPage.login("e2e-tester@demo.com", "DemoPass1234");

    await posPage.goto();
    await posPage.expectPOSInterface();

    // POS header should show shop name
    await expect(page.getByRole("heading", { name: /point of sale/i })).toBeVisible();

    // The date in the header should be rendered (not blank) after hydration
    // The date text appears next to the shop name in the header
    const headerText = await page.locator(".text-foreground-muted").filter({ hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/ }).first().textContent();
    // Date should be rendered client-side (not empty)
    expect(headerText).toBeTruthy();
    expect(headerText).toMatch(/\//); // should contain slashes like MM/DD/YYYY
  });
});

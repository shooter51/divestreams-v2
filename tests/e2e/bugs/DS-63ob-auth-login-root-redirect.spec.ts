/**
 * DS-63ob: Root domain /auth/login shows redirect instead of tenant discovery form
 *
 * Bug: Navigating to /auth/login on the root domain (no subdomain) redirects away
 * instead of showing a tenant discovery / email lookup form.
 * Expected: A form with an email input that allows finding your tenant account.
 */

import { test, expect } from "@playwright/test";
import { getBaseUrl } from "../helpers/urls";

test.describe("DS-63ob: /auth/login on root domain shows discovery form @bug", () => {
  test("should show tenant discovery form, not redirect away", async ({ page }) => {
    const loginUrl = getBaseUrl("/auth/login");
    await page.goto(loginUrl);
    await page.waitForLoadState("load");

    // Should NOT have redirected away from /auth/login
    expect(page.url()).toContain("/auth/login");

    // Should show a form with an email input
    const emailInput = page.getByRole("textbox", { name: /email/i });
    await expect(emailInput, "Should show email input for tenant discovery").toBeVisible();

    // Should have a submit button to find the account
    const submitButton = page.getByRole("button", { name: /find my account|find account|search/i });
    await expect(submitButton, "Should show a Find My Account button").toBeVisible();
  });
});

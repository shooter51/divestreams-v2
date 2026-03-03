/**
 * DS-ezbr: Login clears password field on failed attempt
 *
 * Bug: After a failed login attempt, the email field (and optionally password)
 * is cleared, requiring the user to re-enter their email.
 * Expected: The email field retains its value after a failed login attempt.
 */

import { test, expect } from "@playwright/test";
import { getTenantUrl } from "../helpers/urls";

test.describe("DS-ezbr: Login email retained after failed attempt @bug", () => {
  test("email field is NOT cleared after failed login attempt", async ({ page }) => {
    const loginUrl = getTenantUrl("demo", "/auth/login");
    await page.goto(loginUrl);
    await page.waitForLoadState("load");

    const testEmail = "wrong-user@example.com";
    const wrongPassword = "wrongpassword123";

    // Fill in email and password with incorrect credentials
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(wrongPassword);

    // Submit the form
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for the form to respond
    await page.waitForLoadState("load");

    // Email field should retain its value after failed login
    const emailInput = page.getByLabel(/email/i);
    const emailValue = await emailInput.inputValue();

    expect(emailValue, "Email field should NOT be cleared after failed login").toBe(testEmail);
  });
});

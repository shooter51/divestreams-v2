/**
 * DS-spza: Add Login link to public marketing nav
 *
 * Bug: The public marketing home page navigation does not have a "Log In" link.
 * Expected: A "Log In" link visible in the navigation on the root domain marketing page.
 */

import { test, expect } from "@playwright/test";
import { getBaseUrl } from "../helpers/urls";

test.describe("DS-spza: Login link in public marketing nav @bug", () => {
  test("should show Log In link in marketing nav on root domain", async ({ page }) => {
    await page.goto(getBaseUrl("/"));
    await page.waitForLoadState("load");

    // The marketing home page nav should have a Log In link
    const nav = page.locator("nav").first();
    const loginLink = nav.getByRole("link", { name: /log in/i });

    await expect(loginLink, "Marketing nav should have a Log In link").toBeVisible();
  });
});

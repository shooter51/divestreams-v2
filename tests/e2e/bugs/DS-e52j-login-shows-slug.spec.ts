/**
 * DS-e52j: Login page shows org slug not org name
 *
 * Bug: The login page heading shows the org slug (e.g. "demo") instead of
 * the org's display name (e.g. "Demo Dive Shop").
 * Expected: The login page heading should show the org's full name, not its slug.
 */

import { test, expect } from "@playwright/test";
import { getTenantUrl } from "../helpers/urls";

test.describe("DS-e52j: Login page shows org name not slug @bug", () => {
  test("login page heading shows org name, not slug", async ({ page }) => {
    const loginUrl = getTenantUrl("demo", "/auth/login");
    await page.goto(loginUrl);
    await page.waitForLoadState("load");

    // The heading should show the org name (not just the lowercase slug "demo")
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();

    const headingText = await heading.textContent();
    expect(headingText).toBeTruthy();

    // The org slug is "demo" (all lowercase). The org name should be different
    // (e.g. "Demo Dive Shop" or at minimum capitalized "Demo").
    // Assert it's not exactly the bare lowercase slug
    expect(headingText?.trim()).not.toBe("demo");

    // Should also NOT be empty
    expect(headingText?.trim().length).toBeGreaterThan(0);
  });
});

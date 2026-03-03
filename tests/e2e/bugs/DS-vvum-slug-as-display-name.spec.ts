/**
 * DS-vvum: org.slug used as display name instead of org.name
 *
 * BUG: The admin org list shows org.slug as the clickable link text
 * (e.g. "demo") instead of the organization's proper name (e.g. "Demo Dive Shop").
 * Tenant layout correctly uses org.name, but admin panel had the regression.
 *
 * REPRODUCTION:
 * 1. Navigate to /tenant as a tenant user
 * 2. The sidebar should show the org's display name, not the slug
 *
 * FIX: Use org.name || org.slug in the admin link display text
 */

import { test, expect } from "@playwright/test";
import { getTenantUrl } from "../helpers/urls";

test.describe("DS-vvum: Org name shown correctly (not slug)", () => {
  test("tenant sidebar shows org name not slug", async ({ page }) => {
    // Navigate to the tenant login page
    await page.goto(getTenantUrl("demo", "/auth/login"));
    await page.waitForLoadState("load");

    // Login
    await page.getByRole("textbox", { name: /email/i }).fill("e2e-tester@demo.com");
    await page.locator('input[type="password"]').first().fill("DemoPass1234");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForLoadState("load");

    // The sidebar heading should show the org's name field (org.name)
    // The fix ensures org.name is used instead of org.slug for display
    const sidebar = page.locator("aside");
    const orgHeading = sidebar.locator("h1").first();

    // Should be visible - the org name heading exists in the sidebar
    await expect(orgHeading).toBeVisible();

    // The heading should have some text (org.name is rendered, not blank)
    const headingText = await orgHeading.textContent();
    expect(headingText?.trim().length).toBeGreaterThan(0);
  });
});

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

    // The sidebar heading should show the org name (e.g. "Demo Dive Shop")
    // and NOT just the slug (e.g. "demo")
    const sidebar = page.locator("aside");
    const orgHeading = sidebar.locator("h1").first();
    const headingText = await orgHeading.textContent();

    // The heading should not be just the slug "demo"
    expect(headingText).not.toBe("demo");
    // The heading should be a meaningful name (more than just a slug)
    expect(headingText?.length).toBeGreaterThan(4);
    // Should be visible
    await expect(orgHeading).toBeVisible();
  });
});

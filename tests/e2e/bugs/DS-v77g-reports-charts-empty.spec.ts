/**
 * E2E Tests for DS-v77g + DS-v0rq: Reports premium gate blocks demo org
 *
 * Bug: ctx.isPremium is false for the demo org even though it is on a PRO subscription.
 * The isPremium check only accepted status="active" but createTenant sets status="trialing".
 *
 * Expected: Demo org (PRO plan) should see all report charts and analytics without
 *           a premium upgrade gate/overlay blocking the content.
 * Actual:   PremiumGate overlay appears on all advanced report sections.
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "../page-objects/auth.page";
import { getTenantUrl } from "../helpers/urls";

test.describe("DS-v77g: Reports premium gate blocks demo org @reports", () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page, "demo");
    await loginPage.goto();
    await loginPage.login("e2e-tester@demo.com", "DemoPass1234");
  });

  test("reports page should load without premium gate overlay", async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/tenant/reports"));
    await page.waitForLoadState("networkidle");

    // Should see the reports heading
    await expect(page.getByRole("heading", { name: /reports/i })).toBeVisible();

    // Should NOT see a premium upgrade overlay/gate
    await expect(page.getByText(/upgrade to premium/i)).not.toBeVisible();
    await expect(page.getByText(/premium feature/i)).not.toBeVisible();
  });

  test("revenue trend chart section should be visible (not behind premium gate)", async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/tenant/reports"));
    await page.waitForLoadState("networkidle");

    // Revenue Trend section should be accessible
    await expect(page.getByText(/revenue trend/i)).toBeVisible();

    // The premium overlay inside the revenue chart section should not be shown
    const premiumOverlays = page.locator(".absolute.inset-0").filter({ hasText: /upgrade to premium/i });
    await expect(premiumOverlays).toHaveCount(0);
  });

  test("bookings by status section should be visible (not behind premium gate)", async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/tenant/reports"));
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/bookings by status/i)).toBeVisible();

    // No premium overlays should be blocking content
    const premiumOverlays = page.locator(".absolute.inset-0").filter({ hasText: /upgrade to premium/i });
    await expect(premiumOverlays).toHaveCount(0);
  });

  test("equipment utilization section should be visible (not behind premium gate)", async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/tenant/reports"));
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/equipment utilization/i)).toBeVisible();

    // Should not be blocked by a premium gate
    await expect(page.getByText(/upgrade to premium/i)).not.toBeVisible();
  });

  test("top tours by revenue section should be visible (not behind premium gate)", async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/tenant/reports"));
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/top tours by revenue/i)).toBeVisible();

    // Should not be blocked by a premium gate
    await expect(page.getByText(/premium feature/i)).not.toBeVisible();
  });
});

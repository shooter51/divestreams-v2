import { test, expect, type Page } from "@playwright/test";
import { getAdminUrl } from "../helpers/urls";
import { loginToAdmin } from "../fixtures/test-fixtures";

/**
 * Smoke tests for admin panel.
 * Tests login page (no auth) and all authenticated admin routes.
 */
test.describe("Smoke: Admin pages", () => {
  test("Login page renders", async ({ page }) => {
    const response = await page.goto(getAdminUrl("/login"), {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test.describe("Authenticated routes", () => {
    let authedPage: Page;

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      authedPage = await context.newPage();
      await loginToAdmin(authedPage);
    });

    test.afterAll(async () => {
      await authedPage.context().close();
    });

    const routes = [
      { path: "/dashboard", name: "Dashboard" },
      { path: "/tenants/new", name: "New Tenant" },
      { path: "/plans", name: "Plans" },
      { path: "/coupons", name: "Coupons" },
      { path: "/settings", name: "Settings" },
      { path: "/settings/team", name: "Settings Team" },
      { path: "/contact-messages", name: "Contact Messages" },
    ];

    for (const { path, name } of routes) {
      test(`${name} (${path}) renders without error`, async () => {
        const response = await authedPage.goto(getAdminUrl(path), {
          waitUntil: "domcontentloaded",
        });
        expect(response?.status(), `${name} should return 200`).toBe(200);

        const body = await authedPage.locator("body").innerText();
        expect(body.length, `${name} should render content`).toBeGreaterThan(0);

        const errorBoundary = await authedPage
          .locator('text="Unexpected Application Error"')
          .count();
        expect(errorBoundary, `${name} should not show error boundary`).toBe(0);
      });
    }

    test("Tenant detail page renders", async () => {
      // Navigate to dashboard and extract a tenant link
      await authedPage.goto(getAdminUrl("/dashboard"), {
        waitUntil: "domcontentloaded",
      });
      const tenantLink = authedPage
        .locator('a[href*="/tenants/"]')
        .first();
      const count = await tenantLink.count();
      if (count === 0) {
        test.skip();
        return;
      }
      await tenantLink.click();
      await authedPage.waitForLoadState("domcontentloaded");
      const errorBoundary = await authedPage
        .locator('text="Unexpected Application Error"')
        .count();
      expect(errorBoundary).toBe(0);
    });

    test("Plan detail page renders", async () => {
      await authedPage.goto(getAdminUrl("/plans"), {
        waitUntil: "domcontentloaded",
      });
      const planLink = authedPage.locator('a[href*="/plans/"]').first();
      const count = await planLink.count();
      if (count === 0) {
        test.skip();
        return;
      }
      await planLink.click();
      await authedPage.waitForLoadState("domcontentloaded");
      const errorBoundary = await authedPage
        .locator('text="Unexpected Application Error"')
        .count();
      expect(errorBoundary).toBe(0);
    });
  });
});

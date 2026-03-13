import { test, expect } from "@playwright/test";
import { getTenantUrl } from "../helpers/urls";

/**
 * Smoke tests for public site pages.
 * Uses the "demo" tenant subdomain.
 * Public pages need no auth; account pages are skipped if no customer login.
 */
test.describe("Smoke: Public site pages", () => {
  const publicRoutes = [
    { path: "/site", name: "Site Home" },
    { path: "/site/about", name: "About" },
    { path: "/site/trips", name: "Trips" },
    { path: "/site/courses", name: "Courses" },
    { path: "/site/equipment", name: "Equipment" },
    { path: "/site/gallery", name: "Gallery" },
    { path: "/site/contact", name: "Contact" },
    { path: "/site/login", name: "Site Login" },
    { path: "/site/register", name: "Site Register" },
  ];

  for (const { path, name } of publicRoutes) {
    test(`${name} (${path}) renders without error`, async ({ page }) => {
      const response = await page.goto(getTenantUrl(process.env.SMOKE_TENANT || "demo", path), {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status(), `${name} should return 200`).toBe(200);

      const body = await page.locator("body").innerText();
      expect(body.length, `${name} should render content`).toBeGreaterThan(0);

      const errorBoundary = await page
        .locator('text="Unexpected Application Error"')
        .count();
      expect(errorBoundary, `${name} should not show error boundary`).toBe(0);
    });
  }

  // Dynamic public site routes — extract IDs from list pages
  test.describe("Dynamic public site pages", () => {
    test("Trip detail page renders", async ({ page }) => {
      await page.goto(getTenantUrl(process.env.SMOKE_TENANT || "demo", "/site/trips"), {
        waitUntil: "domcontentloaded",
      });
      const tripLink = page.locator('a[href*="/site/trips/"]').first();
      if ((await tripLink.count()) === 0) {
        test.skip();
        return;
      }
      await tripLink.click();
      await page.waitForLoadState("domcontentloaded");

      const errorBoundary = await page
        .locator('text="Unexpected Application Error"')
        .count();
      expect(errorBoundary).toBe(0);
    });

    test("Course detail page renders", async ({ page }) => {
      await page.goto(getTenantUrl(process.env.SMOKE_TENANT || "demo", "/site/courses"), {
        waitUntil: "domcontentloaded",
      });
      const courseLink = page.locator('a[href*="/site/courses/"]').first();
      if ((await courseLink.count()) === 0) {
        test.skip();
        return;
      }
      await courseLink.click();
      await page.waitForLoadState("domcontentloaded");

      const errorBoundary = await page
        .locator('text="Unexpected Application Error"')
        .count();
      expect(errorBoundary).toBe(0);
    });

    test("Equipment detail page renders", async ({ page }) => {
      await page.goto(getTenantUrl(process.env.SMOKE_TENANT || "demo", "/site/equipment"), {
        waitUntil: "domcontentloaded",
      });
      const eqLink = page.locator('a[href*="/site/equipment/"]').first();
      if ((await eqLink.count()) === 0) {
        test.skip();
        return;
      }
      await eqLink.click();
      await page.waitForLoadState("domcontentloaded");

      const errorBoundary = await page
        .locator('text="Unexpected Application Error"')
        .count();
      expect(errorBoundary).toBe(0);
    });
  });
});

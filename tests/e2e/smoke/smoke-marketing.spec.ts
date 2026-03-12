import { test, expect } from "@playwright/test";
import { getBaseUrl } from "../helpers/urls";

/**
 * Smoke tests for public marketing pages.
 * No auth required. Asserts each route returns 200 and renders content.
 */
test.describe("Smoke: Marketing pages", () => {
  const routes = [
    { path: "/", name: "Home" },
    { path: "/pricing", name: "Pricing" },
    { path: "/features", name: "Features" },
    { path: "/signup", name: "Signup" },
    { path: "/terms", name: "Terms" },
    { path: "/privacy", name: "Privacy" },
    { path: "/guide", name: "Guide Index" },
  ];

  for (const { path, name } of routes) {
    test(`${name} (${path}) renders without error`, async ({ page }) => {
      const response = await page.goto(getBaseUrl(path), {
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
});

import { test, expect } from "@playwright/test";
import { getEmbedUrl } from "../helpers/urls";

/**
 * Smoke tests for embed widget routes.
 * No auth required. Uses the "demo" tenant.
 */
test.describe("Smoke: Embed widget pages", () => {
  const routes = [
    { path: "", name: "Embed Index" },
    { path: "/courses", name: "Embed Courses" },
  ];

  for (const { path, name } of routes) {
    test(`${name} renders without error`, async ({ page }) => {
      const response = await page.goto(getEmbedUrl("demo", path), {
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

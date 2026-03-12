import { test, expect } from "@playwright/test";
import { getBaseUrl } from "../helpers/urls";

/**
 * Smoke test for API health endpoint.
 */
test.describe("Smoke: API", () => {
  test("GET /api/health returns 200", async ({ request }) => {
    const response = await request.get(getBaseUrl("/api/health"));
    expect(response.status()).toBe(200);
  });
});

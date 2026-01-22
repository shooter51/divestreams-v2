/**
 * Zapier Test Route Tests
 *
 * Tests the API key validation endpoint for Zapier app setup.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../app/routes/api/zapier/test";

// Mock modules
vi.mock("../../../../../lib/integrations/zapier-enhanced.server", () => ({
  validateZapierApiKey: vi.fn(),
}));

vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Import mocked modules
import { validateZapierApiKey } from "../../../../../lib/integrations/zapier-enhanced.server";
import { db } from "../../../../../lib/db";

describe("Route: api/zapier/test.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should return 401 when API key is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/test");

      // Act
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "Missing API key. Provide X-API-Key header." });
      expect(validateZapierApiKey).not.toHaveBeenCalled();
    });

    it("should return 401 when API key is invalid", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/test", {
        headers: {
          "x-api-key": "invalid-key",
        },
      });
      (validateZapierApiKey as any).mockResolvedValue(null);

      // Act
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(validateZapierApiKey).toHaveBeenCalledWith("invalid-key");
      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "Invalid API key" });
    });

    it("should return 404 when organization not found", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/test", {
        headers: {
          "x-api-key": "valid-key",
        },
      });
      (validateZapierApiKey as any).mockResolvedValue("org-nonexistent");
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // Empty array = org not found
          }),
        }),
      });

      // Act
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "Organization not found" });
    });

    it("should return success with organization details when valid", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/test", {
        headers: {
          "x-api-key": "valid-key",
        },
      });
      (validateZapierApiKey as any).mockResolvedValue("org-123");
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "org-123",
                name: "Test Organization",
                slug: "test-org",
              },
            ]),
          }),
        }),
      });

      // Act
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(validateZapierApiKey).toHaveBeenCalledWith("valid-key");
      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        message: "API key is valid",
        organization: {
          id: "org-123",
          name: "Test Organization",
          slug: "test-org",
        },
      });
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe("string");
    });
  });
});

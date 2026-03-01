import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../../app/routes/api/zapier/test";

/**
 * Integration tests for api/zapier/test route
 * Tests Zapier API key validation and connection testing
 */

// Mock Zapier validation
vi.mock("../../../../../lib/integrations/zapier-enhanced.server", () => ({
  validateZapierApiKey: vi.fn(),
}));

// Mock database
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

import { validateZapierApiKey } from "../../../../../lib/integrations/zapier-enhanced.server";
import { db } from "../../../../../lib/db";

describe("api/zapier/test route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/zapier/test", () => {
    it("returns 401 when X-API-Key header is missing", async () => {
      const request = new Request("https://divestreams.com/api/zapier/test");
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Missing API key. Provide X-API-Key header.");
    });

    it("returns 401 when API key is invalid", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue(null);

      const request = new Request("https://divestreams.com/api/zapier/test", {
        headers: { "x-api-key": "invalid-key-123" },
      });
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Invalid API key");
    });

    it("returns 404 when organization not found", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      // Mock empty DB response
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      (db.select as Mock).mockReturnValue(mockSelect);

      const request = new Request("https://divestreams.com/api/zapier/test", {
        headers: { "x-api-key": "valid-key-123" },
      });
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe("Organization not found");
    });

    it("returns 200 with organization details when API key is valid", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-abc");

      // Mock DB response with organization
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "org-abc",
            name: "Test Dive Shop",
            slug: "test-dive-shop",
          },
        ]),
      };
      (db.select as Mock).mockReturnValue(mockSelect);

      const request = new Request("https://divestreams.com/api/zapier/test", {
        headers: { "x-api-key": "valid-key-123" },
      });
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe("API key is valid");
      expect(data.organization).toEqual({
        id: "org-abc",
        name: "Test Dive Shop",
        slug: "test-dive-shop",
      });
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("validates API key using validateZapierApiKey", async () => {
      const validateMock = vi.fn().mockResolvedValue("org-123");
      (validateZapierApiKey as Mock).mockImplementation(validateMock);

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "org-123", name: "Test", slug: "test" }]),
      };
      (db.select as Mock).mockReturnValue(mockSelect);

      const request = new Request("https://divestreams.com/api/zapier/test", {
        headers: { "x-api-key": "my-api-key" },
      });
      await loader({ request, params: {}, context: {} } as unknown);

      expect(validateMock).toHaveBeenCalledWith("my-api-key");
    });

    it("includes ISO timestamp in successful response", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "org-123", name: "Test", slug: "test" }]),
      };
      (db.select as Mock).mockReturnValue(mockSelect);

      const before = new Date();
      const request = new Request("https://divestreams.com/api/zapier/test", {
        headers: { "x-api-key": "valid-key" },
      });
      const response = await loader({ request, params: {}, context: {} } as unknown);
      const after = new Date();

      const data = await response.json();
      const timestamp = new Date(data.timestamp);

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("handles case-insensitive X-API-Key header", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "org-123", name: "Test", slug: "test" }]),
      };
      (db.select as Mock).mockReturnValue(mockSelect);

      // Headers are case-insensitive in HTTP, but testing both common variations
      const request = new Request("https://divestreams.com/api/zapier/test", {
        headers: { "X-API-Key": "valid-key" },
      });
      const response = await loader({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(200);
    });

    it("returns organization with all required fields", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-xyz");

      const mockOrg = {
        id: "org-xyz",
        name: "Premium Dive Center",
        slug: "premium-dive",
      };

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockOrg]),
      };
      (db.select as Mock).mockReturnValue(mockSelect);

      const request = new Request("https://divestreams.com/api/zapier/test", {
        headers: { "x-api-key": "valid-key" },
      });
      const response = await loader({ request, params: {}, context: {} } as unknown);

      const data = await response.json();
      expect(data.organization).toHaveProperty("id");
      expect(data.organization).toHaveProperty("name");
      expect(data.organization).toHaveProperty("slug");
    });
  });
});

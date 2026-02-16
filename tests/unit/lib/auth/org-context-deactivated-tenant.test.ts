/**
 * Test suite for deactivated tenant handling in requireOrgContext
 *
 * This file tests the behavior when a tenant is deactivated,
 * ensuring proper responses for both HTML page requests and
 * data fetch requests (.data suffix for Single Fetch).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { tenants } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
}));

// Mock Better Auth
vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

describe("requireOrgContext - Deactivated Tenant Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return JSON 403 for .data requests to deactivated tenant", async () => {
    // Setup: Mock a deactivated tenant
    vi.mocked(db.limit).mockResolvedValue([{ isActive: false }]);

    // Create a .data request (Single Fetch)
    const request = new Request("https://demo.divestreams.com/tenant/settings/public-site.data", {
      headers: {
        "Host": "demo.divestreams.com",
      },
    });

    // Act & Assert
    await expect(requireOrgContext(request)).rejects.toThrow();

    try {
      await requireOrgContext(request);
    } catch (error) {
      // Verify it's a Response
      expect(error).toBeInstanceOf(Response);

      const response = error as Response;
      // Verify status code
      expect(response.status).toBe(403);

      // Verify content type is JSON
      expect(response.headers.get("Content-Type")).toBe("application/json");

      // Verify JSON body
      const body = await response.json();
      expect(body).toHaveProperty("error", "Account Deactivated");
      expect(body).toHaveProperty("message");
      expect(body.message).toContain("deactivated");
    }
  });

  it("should return JSON 403 for requests with Accept: application/json to deactivated tenant", async () => {
    // Setup: Mock a deactivated tenant
    vi.mocked(db.limit).mockResolvedValue([{ isActive: false }]);

    // Create a request with JSON Accept header
    const request = new Request("https://demo.divestreams.com/tenant/settings/public-site", {
      headers: {
        "Host": "demo.divestreams.com",
        "Accept": "application/json",
      },
    });

    // Act & Assert
    try {
      await requireOrgContext(request);
    } catch (error) {
      const response = error as Response;
      expect(response.status).toBe(403);
      expect(response.headers.get("Content-Type")).toBe("application/json");

      const body = await response.json();
      expect(body).toHaveProperty("error");
    }
  });

  it("should return HTML 403 for regular page requests to deactivated tenant", async () => {
    // Setup: Mock a deactivated tenant
    vi.mocked(db.limit).mockResolvedValue([{ isActive: false }]);

    // Create a regular page request (not .data, not JSON)
    const request = new Request("https://demo.divestreams.com/tenant/settings/public-site", {
      headers: {
        "Host": "demo.divestreams.com",
        "Accept": "text/html",
      },
    });

    // Act & Assert
    try {
      await requireOrgContext(request);
    } catch (error) {
      const response = error as Response;
      expect(response.status).toBe(403);
      expect(response.headers.get("Content-Type")).toBe("text/html");

      const body = await response.text();
      expect(body).toContain("Account Deactivated");
      expect(body).toContain("<!DOCTYPE html>");
    }
  });
});

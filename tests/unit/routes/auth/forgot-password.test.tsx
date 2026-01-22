/**
 * Auth Forgot Password Route Tests
 *
 * Tests the forgot password page with email enumeration protection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/auth/forgot-password";

// Mock modules
vi.mock("../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
  getOrgContext: vi.fn(),
}));

vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      requestPasswordReset: vi.fn(),
    },
  },
}));

vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {
    slug: "slug",
  },
}));

vi.mock("../../../../lib/utils/url", () => ({
  getAppUrl: vi.fn(() => "http://app.divestreams.com"),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
}));

// Import mocked modules
import { getSubdomainFromRequest, getOrgContext } from "../../../../lib/auth/org-context.server";
import { auth } from "../../../../lib/auth";
import { db } from "../../../../lib/db";

describe("Route: auth/forgot-password.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("meta", () => {
    it("should return correct title", async () => {
      const { meta } = await import("../../../../app/routes/auth/forgot-password");
      const result = meta({} as any);
      expect(result).toEqual([{ title: "Forgot Password - DiveStreams" }]);
    });
  });

  describe("loader", () => {
    it("should redirect to app URL when no subdomain", async () => {
      // Arrange
      const request = new Request("http://divestreams.com/auth/forgot-password");
      (getSubdomainFromRequest as any).mockReturnValue(null);

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("http://app.divestreams.com");
    });

    it("should redirect to /app when already logged in", async () => {
      // Arrange
      const request = new Request("http://test-org.divestreams.com/auth/forgot-password");
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (getOrgContext as any).mockResolvedValue({
        orgId: "org-123",
        slug: "test-org",
      });

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/app");
    });

    it("should redirect to app URL when organization does not exist", async () => {
      // Arrange
      const request = new Request("http://nonexistent.divestreams.com/auth/forgot-password");
      (getSubdomainFromRequest as any).mockReturnValue("nonexistent");
      (getOrgContext as any).mockResolvedValue(null);
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No org found
          }),
        }),
      });

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("http://app.divestreams.com");
    });

    it("should return tenant name when organization exists", async () => {
      // Arrange
      const request = new Request("http://test-org.divestreams.com/auth/forgot-password");
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (getOrgContext as any).mockResolvedValue(null);
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "org-123", name: "Test Organization", slug: "test-org" },
            ]),
          }),
        }),
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ tenantName: "Test Organization" });
    });
  });

  describe("action", () => {
    it("should redirect to app URL when no subdomain", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("email", "test@example.com");
      const request = new Request("http://divestreams.com/auth/forgot-password", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue(null);

      // Act
      const response = await action({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("http://app.divestreams.com");
    });

    it("should return error when email is missing", async () => {
      // Arrange
      const formData = new FormData();
      // No email
      const request = new Request("http://test-org.divestreams.com/auth/forgot-password", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Email is required" });
    });

    it("should return success when email is valid", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("email", "test@example.com");
      const request = new Request("http://test-org.divestreams.com/auth/forgot-password", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (auth.api.requestPasswordReset as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(auth.api.requestPasswordReset).toHaveBeenCalledWith({
        body: { email: "test@example.com", redirectTo: "/auth/reset-password" },
      });
      expect(result).toEqual({ success: true });
    });

    it("should return success even when requestPasswordReset fails (email enumeration protection)", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("email", "nonexistent@example.com");
      const request = new Request("http://test-org.divestreams.com/auth/forgot-password", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (auth.api.requestPasswordReset as any).mockRejectedValue(new Error("User not found"));

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ success: true });
    });
  });
});

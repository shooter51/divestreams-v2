/**
 * Auth Reset Password Route Tests
 *
 * Tests the password reset page with token validation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/auth/reset-password";

// Mock modules
vi.mock("../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
  getOrgContext: vi.fn(),
}));

vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      resetPassword: vi.fn(),
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

describe("Route: auth/reset-password.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("meta", () => {
    it("should return correct title", async () => {
      const { meta } = await import("../../../../app/routes/auth/reset-password");
      const result = meta({} as any);
      expect(result).toEqual([{ title: "Reset Password - DiveStreams" }]);
    });
  });

  describe("loader", () => {
    it("should redirect to app URL when no subdomain", async () => {
      // Arrange
      const request = new Request("http://divestreams.com/auth/reset-password?token=abc123");
      (getSubdomainFromRequest as any).mockReturnValue(null);

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("http://app.divestreams.com");
    });

    it("should redirect to /app when already logged in", async () => {
      // Arrange
      const request = new Request("http://test-org.divestreams.com/auth/reset-password?token=abc123");
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

    it("should redirect to forgot-password when token is missing", async () => {
      // Arrange
      const request = new Request("http://test-org.divestreams.com/auth/reset-password");
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (getOrgContext as any).mockResolvedValue(null);

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/auth/forgot-password");
    });

    it("should redirect to app URL when organization does not exist", async () => {
      // Arrange
      const request = new Request("http://nonexistent.divestreams.com/auth/reset-password?token=abc123");
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

    it("should return token and tenant name when valid", async () => {
      // Arrange
      const request = new Request("http://test-org.divestreams.com/auth/reset-password?token=abc123");
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
      expect(result).toEqual({
        token: "abc123",
        tenantName: "Test Organization",
      });
    });
  });

  describe("action", () => {
    it("should redirect to app URL when no subdomain", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("password", "newpassword123");
      formData.set("confirmPassword", "newpassword123");
      formData.set("token", "abc123");
      const request = new Request("http://divestreams.com/auth/reset-password", {
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

    it("should return error when password is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("confirmPassword", "newpassword123");
      formData.set("token", "abc123");
      const request = new Request("http://test-org.divestreams.com/auth/reset-password", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        error: "Password must be at least 8 characters",
      });
    });

    it("should return error when password is too short", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("password", "short");
      formData.set("confirmPassword", "short");
      formData.set("token", "abc123");
      const request = new Request("http://test-org.divestreams.com/auth/reset-password", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        error: "Password must be at least 8 characters",
      });
    });

    it("should return error when passwords do not match", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("password", "newpassword123");
      formData.set("confirmPassword", "differentpassword");
      formData.set("token", "abc123");
      const request = new Request("http://test-org.divestreams.com/auth/reset-password", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        error: "Passwords do not match",
      });
    });

    it("should return error when token is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("password", "newpassword123");
      formData.set("confirmPassword", "newpassword123");
      const request = new Request("http://test-org.divestreams.com/auth/reset-password", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        error: "Invalid reset token",
      });
    });

    it("should redirect to login on successful password reset", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("password", "newpassword123");
      formData.set("confirmPassword", "newpassword123");
      formData.set("token", "abc123");
      const request = new Request("http://test-org.divestreams.com/auth/reset-password", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (auth.api.resetPassword as any).mockResolvedValue(undefined);

      // Act
      const response = await action({ request, params: {}, context: {} });

      // Assert
      expect(auth.api.resetPassword).toHaveBeenCalledWith({
        body: { token: "abc123", newPassword: "newpassword123" },
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/auth/login?reset=success");
    });

    it("should return error when resetPassword fails", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("password", "newpassword123");
      formData.set("confirmPassword", "newpassword123");
      formData.set("token", "expired-token");
      const request = new Request("http://test-org.divestreams.com/auth/reset-password", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (auth.api.resetPassword as any).mockRejectedValue(new Error("Token expired"));

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        error: "Invalid or expired reset token",
      });
    });
  });
});

/**
 * Auth Login Route Tests
 *
 * Tests the login page with authentication and organization validation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/auth/login";

// Mock modules
vi.mock("../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
  getOrgContext: vi.fn(),
}));

vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      signInEmail: vi.fn(),
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

describe("Route: auth/login.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("meta", () => {
    it("should return correct title", async () => {
      const { meta } = await import("../../../../app/routes/auth/login");
      const result = meta({} as any);
      expect(result).toEqual([{ title: "Login - DiveStreams" }]);
    });
  });

  describe("loader", () => {
    it("should redirect to app URL when no subdomain", async () => {
      // Arrange
      const request = new Request("http://divestreams.com/auth/login");
      (getSubdomainFromRequest as any).mockReturnValue(null);

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("http://app.divestreams.com");
    });

    it("should redirect to /app when already logged in", async () => {
      // Arrange
      const request = new Request("http://test-org.divestreams.com/auth/login");
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
      const request = new Request("http://nonexistent.divestreams.com/auth/login");
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
      const request = new Request("http://test-org.divestreams.com/auth/login");
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
      formData.set("password", "password123");
      const request = new Request("http://divestreams.com/auth/login", {
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

    it("should redirect to app URL when organization does not exist", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "password123");
      const request = new Request("http://nonexistent.divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("nonexistent");
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No org found
          }),
        }),
      });

      // Act
      const response = await action({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("http://app.divestreams.com");
    });

    it("should return error when email is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("password", "password123");
      const request = new Request("http://test-org.divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
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
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        errors: {
          email: "Email is required",
        },
      });
    });

    it("should return error when password is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("email", "test@example.com");
      const request = new Request("http://test-org.divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
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
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        errors: {
          password: "Password is required",
        },
      });
    });

    it("should return errors for both missing email and password", async () => {
      // Arrange
      const formData = new FormData();
      const request = new Request("http://test-org.divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
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
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        errors: {
          email: "Email is required",
          password: "Password is required",
        },
      });
    });

    it("should redirect to /app on successful login", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "password123");
      const request = new Request("http://test-org.divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "org-123", name: "Test Organization", slug: "test-org" },
            ]),
          }),
        }),
      });

      const mockResponse = {
        ok: true,
        headers: new Headers({ "set-cookie": "session=abc123; Path=/; HttpOnly" }),
        json: vi.fn().mockResolvedValue({ user: { id: "user-123", email: "test@example.com" } }),
      };
      (auth.api.signInEmail as any).mockResolvedValue(mockResponse);

      // Act
      const response = await action({ request, params: {}, context: {} });

      // Assert
      expect(auth.api.signInEmail).toHaveBeenCalledWith({
        body: { email: "test@example.com", password: "password123" },
        asResponse: true,
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/app");
    });

    it("should redirect to custom redirect URL when provided", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "password123");
      const request = new Request("http://test-org.divestreams.com/auth/login?redirect=/app/tours", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "org-123", name: "Test Organization", slug: "test-org" },
            ]),
          }),
        }),
      });

      const mockResponse = {
        ok: true,
        headers: new Headers({ "set-cookie": "session=abc123; Path=/; HttpOnly" }),
        json: vi.fn().mockResolvedValue({ user: { id: "user-123", email: "test@example.com" } }),
      };
      (auth.api.signInEmail as any).mockResolvedValue(mockResponse);

      // Act
      const response = await action({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/app/tours");
    });

    it("should return error when login fails with response.ok = false", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "wrongpassword");
      const request = new Request("http://test-org.divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "org-123", name: "Test Organization", slug: "test-org" },
            ]),
          }),
        }),
      });

      const mockResponse = {
        ok: false,
        status: 401,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({ message: "Invalid credentials" }),
      };
      (auth.api.signInEmail as any).mockResolvedValue(mockResponse);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        errors: {
          form: "Invalid credentials",
        },
      });
    });

    it("should return error when login fails without user in response", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "wrongpassword");
      const request = new Request("http://test-org.divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "org-123", name: "Test Organization", slug: "test-org" },
            ]),
          }),
        }),
      });

      const mockResponse = {
        ok: true,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({ user: null }),
      };
      (auth.api.signInEmail as any).mockResolvedValue(mockResponse);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        errors: {
          form: "Invalid email or password",
        },
      });
    });

    it("should handle signInEmail exception", async () => {
      // Arrange
      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "password123");
      const request = new Request("http://test-org.divestreams.com/auth/login", {
        method: "POST",
        body: formData,
      });
      (getSubdomainFromRequest as any).mockReturnValue("test-org");
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "org-123", name: "Test Organization", slug: "test-org" },
            ]),
          }),
        }),
      });
      (auth.api.signInEmail as any).mockRejectedValue(new Error("Network error"));

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        errors: {
          form: "Invalid email or password",
        },
      });
    });
  });
});

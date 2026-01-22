/**
 * Tenant Login Route Tests
 *
 * Tests login with membership checking and join functionality.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/tenant/login";

// Mock auth
vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      signInEmail: vi.fn(),
    },
  },
}));

// Mock subdomain helper
vi.mock("../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
}));

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

// Import mocked modules
import { auth } from "../../../../lib/auth";
import { getSubdomainFromRequest } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";

describe("Route: tenant/login.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should redirect to /app if user is already logged in", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/login");
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "user-123", email: "test@example.com" },
      });

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect.fail("Expected redirect to be thrown");
      } catch (response: any) {
        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/app");
      }
    });

    it("should redirect to custom path if redirect param present", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/login?redirect=/app/bookings");
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "user-123", email: "test@example.com" },
      });

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect.fail("Expected redirect to be thrown");
      } catch (response: any) {
        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/app/bookings");
      }
    });

    it("should load org info from subdomain", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/login");
      (auth.api.getSession as any).mockResolvedValue(null);
      (getSubdomainFromRequest as any).mockReturnValue("diveshop");

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "org-123", name: "Dive Shop ABC" },
            ]),
          }),
        }),
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.orgName).toBe("Dive Shop ABC");
      expect(result.orgId).toBe("org-123");
      expect(result.subdomain).toBe("diveshop");
    });

    it("should default to 'this shop' if org not found", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/login");
      (auth.api.getSession as any).mockResolvedValue(null);
      (getSubdomainFromRequest as any).mockReturnValue("nonexistent");

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.orgName).toBe("this shop");
      expect(result.orgId).toBeNull();
      expect(result.subdomain).toBe("nonexistent");
    });

    it("should default to 'this shop' if no subdomain", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/login");
      (auth.api.getSession as any).mockResolvedValue(null);
      (getSubdomainFromRequest as any).mockReturnValue(null);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.orgName).toBe("this shop");
      expect(result.orgId).toBeNull();
      expect(result.subdomain).toBeNull();
    });
  });

  describe("action - join intent", () => {
    it("should add user as customer member", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "join");
      formData.append("userId", "user-123");
      formData.append("orgId", "org-456");
      formData.append("redirectTo", "/app");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Mock: not already a member
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockValues = vi.fn();
      (db.insert as any).mockReturnValue({
        values: mockValues,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert - redirect returns Response
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/app");

      // Verify insert was called
      expect(mockValues).toHaveBeenCalledWith({
        id: expect.any(String),
        userId: "user-123",
        organizationId: "org-456",
        role: "customer",
        createdAt: expect.any(Date),
      });
    });

    it("should not insert if user is already a member", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "join");
      formData.append("userId", "user-123");
      formData.append("orgId", "org-456");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Mock: already a member
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "member-123", userId: "user-123", organizationId: "org-456", role: "customer" },
            ]),
          }),
        }),
      });

      const mockValues = vi.fn();
      (db.insert as any).mockReturnValue({
        values: mockValues,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert - redirect returns Response
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(302);

      // Verify insert was NOT called
      expect(mockValues).not.toHaveBeenCalled();
    });

    it("should return error for missing userId", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "join");
      // userId missing
      formData.append("orgId", "org-456");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Missing user or organization information" });
    });

    it("should return error for missing orgId", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "join");
      formData.append("userId", "user-123");
      // orgId missing

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Missing user or organization information" });
    });

    it("should return error on database failure", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "join");
      formData.append("userId", "user-123");
      formData.append("orgId", "org-456");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error("DB error")),
          }),
        }),
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Failed to join organization. Please try again." });
    });
  });

  describe("action - login with membership check", () => {
    it("should login and redirect for member user", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "user@example.com");
      formData.append("password", "password123");
      formData.append("redirectTo", "/app");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue("diveshop");

      // Mock auth success with real Response object
      const mockResponse = new Response(
        JSON.stringify({ user: { id: "user-123", email: "user@example.com" } }),
        {
          status: 200,
          headers: { "Set-Cookie": "session=abc123" },
        }
      );
      (auth.api.signInEmail as any).mockResolvedValue(mockResponse);

      // Mock org lookup
      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "org-456", name: "Dive Shop ABC" },
              ]),
            }),
          }),
        })
        // Mock member check - is a member
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "member-123", userId: "user-123", organizationId: "org-456" },
              ]),
            }),
          }),
        });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert - redirect returns Response
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/app");
      // Note: Set-Cookie header forwarding is tested in integration tests
    });

    it("should return notMember data if user is not a member", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "user@example.com");
      formData.append("password", "password123");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue("diveshop");

      // Mock auth success with real Response object
      const mockResponse = new Response(
        JSON.stringify({ user: { id: "user-123", email: "user@example.com" } }),
        {
          status: 200,
          headers: { "Set-Cookie": "session=abc123" },
        }
      );
      (auth.api.signInEmail as any).mockResolvedValue(mockResponse);

      // Mock org lookup
      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "org-456", name: "Dive Shop ABC" },
              ]),
            }),
          }),
        })
        // Mock member check - not a member
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert - result is a Response object with JSON body
      expect(result).toBeInstanceOf(Response);
      const resultResponse = result as Response;
      // Note: Set-Cookie header forwarding is tested in integration tests

      const resultData = await resultResponse.json();
      expect(resultData.notMember).toEqual({
        orgName: "Dive Shop ABC",
        orgId: "org-456",
        userId: "user-123",
        email: "user@example.com",
      });
    });

    it("should return error for invalid email format", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "notanemail");
      formData.append("password", "password123");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Please enter a valid email address" });
      expect(auth.api.signInEmail).not.toHaveBeenCalled();
    });

    it("should return error for empty email", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "");
      formData.append("password", "password123");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Please enter a valid email address" });
    });

    it("should return error for missing password", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "user@example.com");
      // password missing

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Password is required" });
    });

    it("should return error for empty password", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "user@example.com");
      formData.append("password", "");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Password is required" });
    });

    it("should return error for invalid credentials", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "user@example.com");
      formData.append("password", "wrongpassword");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Mock auth failure
      const mockResponse = {
        ok: false,
        headers: new Headers(),
        json: async () => ({ message: "Invalid email or password" }),
      };
      (auth.api.signInEmail as any).mockResolvedValue(mockResponse);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Invalid email or password" });
    });

    it("should handle auth error gracefully", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "user@example.com");
      formData.append("password", "password123");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (auth.api.signInEmail as any).mockRejectedValue(new Error("Network error"));

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "An error occurred during login. Please try again." });
    });

    it("should handle custom redirectTo parameter", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "user@example.com");
      formData.append("password", "password123");
      formData.append("redirectTo", "/app/bookings");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue("diveshop");

      // Mock auth success with real Response object
      const mockResponse = new Response(
        JSON.stringify({ user: { id: "user-123", email: "user@example.com" } }),
        {
          status: 200,
          headers: { "Set-Cookie": "session=abc123" },
        }
      );
      (auth.api.signInEmail as any).mockResolvedValue(mockResponse);

      // Mock org lookup and member check
      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "org-456", name: "Dive Shop ABC" },
              ]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "member-123", userId: "user-123", organizationId: "org-456" },
              ]),
            }),
          }),
        });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert - redirect returns Response
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/app/bookings");
    });

    it("should skip membership check if no subdomain", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "user@example.com");
      formData.append("password", "password123");

      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue(null); // No subdomain

      // Mock auth success
      const mockResponse = {
        ok: true,
        headers: new Headers({ "set-cookie": "session=abc123" }),
        json: async () => ({ user: { id: "user-123", email: "user@example.com" } }),
      };
      (auth.api.signInEmail as any).mockResolvedValue(mockResponse);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert - should redirect without membership check
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/app");

      // Verify no db queries for org/membership
      expect(db.select).not.toHaveBeenCalled();
    });
  });
});

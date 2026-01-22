/**
 * Admin Login Route Tests
 *
 * Tests the admin login route with loader, action, and component rendering.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { action, loader, meta } from "../../../../app/routes/admin/login";
import { renderRoute } from "../../../utils/route-test-helpers.js";

// Mock modules
vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      signInEmail: vi.fn(),
    },
  },
}));

vi.mock("../../../../lib/auth/platform-context.server", () => ({
  getPlatformContext: vi.fn(),
  PLATFORM_ORG_SLUG: "platform",
  isAdminSubdomain: vi.fn(),
}));

vi.mock("../../../../lib/auth/org-context.server", () => ({
  isAdminSubdomain: vi.fn(),
}));

vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {},
  member: {},
}));

vi.mock("../../../../lib/utils/url", () => ({
  getAppUrl: vi.fn(() => "https://app.divestreams.com"),
}));

// Import mocked modules
import { auth } from "../../../../lib/auth";
import { getPlatformContext } from "../../../../lib/auth/platform-context.server";
import { isAdminSubdomain } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { organization, member } from "../../../../lib/db/schema/auth";

describe("Route: admin/login.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("meta", () => {
    it("should return correct page title", () => {
      const result = meta();
      expect(result).toEqual([{ title: "Admin Login - DiveStreams" }]);
    });
  });

  describe("loader", () => {
    it("should redirect to app URL if not on admin subdomain", async () => {
      // Arrange
      (isAdminSubdomain as any).mockReturnValue(false);

      const request = new Request("http://notadmin.divestreams.com/login");

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "https://app.divestreams.com"
      );
    });

    it("should redirect to /dashboard if already authenticated", async () => {
      // Arrange
      (isAdminSubdomain as any).mockReturnValue(true);
      (getPlatformContext as any).mockResolvedValue({
        user: { id: "user123", email: "admin@example.com" },
        org: { id: "org123", slug: "platform" },
        membership: { role: "owner" },
      });

      const request = new Request("http://admin.divestreams.com/login");

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/dashboard");
    });

    it("should return null if on admin subdomain and not authenticated", async () => {
      // Arrange
      (isAdminSubdomain as any).mockReturnValue(true);
      (getPlatformContext as any).mockResolvedValue(null);

      const request = new Request("http://admin.divestreams.com/login");

      // Act
      const response = await loader({ request, params: {}, context: {} });

      // Assert
      expect(response).toBeNull();
    });
  });

  describe("action", () => {
    const platformOrg = {
      id: "platform-org-id",
      name: "Platform",
      slug: "platform",
    };

    beforeEach(() => {
      // Setup default mocks for db queries
      (db.select as any).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([platformOrg])),
          })),
        })),
      });
    });

    describe("Validation", () => {
      it("should reject invalid email format", async () => {
        // Arrange
        const formData = new FormData();
        formData.append("email", "notanemail");
        formData.append("password", "password123");

        const request = new Request("http://admin.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        // Act
        const response = await action({ request, params: {}, context: {} });

        // Assert
        expect(response).toEqual({
          error: "Please enter a valid email address",
        });
      });

      it("should reject empty email", async () => {
        // Arrange
        const formData = new FormData();
        formData.append("email", "");
        formData.append("password", "password123");

        const request = new Request("http://admin.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        // Act
        const response = await action({ request, params: {}, context: {} });

        // Assert
        expect(response).toEqual({
          error: "Please enter a valid email address",
        });
      });

      it("should reject missing email", async () => {
        // Arrange
        const formData = new FormData();
        formData.append("password", "password123");

        const request = new Request("http://admin.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        // Act
        const response = await action({ request, params: {}, context: {} });

        // Assert
        expect(response).toEqual({
          error: "Please enter a valid email address",
        });
      });

      it("should reject empty password", async () => {
        // Arrange
        const formData = new FormData();
        formData.append("email", "test@example.com");
        formData.append("password", "");

        const request = new Request("http://admin.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        // Act
        const response = await action({ request, params: {}, context: {} });

        // Assert
        expect(response).toEqual({ error: "Password is required" });
      });

      it("should reject missing password", async () => {
        // Arrange
        const formData = new FormData();
        formData.append("email", "test@example.com");

        const request = new Request("http://admin.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        // Act
        const response = await action({ request, params: {}, context: {} });

        // Assert
        expect(response).toEqual({ error: "Password is required" });
      });
    });

    describe("Authentication", () => {
      it("should sign in platform member and redirect to dashboard", async () => {
        // Arrange
        const mockCookies = "session=abc123; HttpOnly";
        const mockAuthResponse = {
          ok: true,
          headers: new Headers({ "set-cookie": mockCookies }),
          json: async () => ({
            user: { id: "user123", email: "admin@example.com" },
          }),
        };
        (auth.api.signInEmail as any).mockResolvedValue(mockAuthResponse);

        // Mock platform membership check
        const platformMember = {
          userId: "user123",
          organizationId: "platform-org-id",
          role: "owner",
        };
        (db.select as any)
          .mockReturnValueOnce({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([platformOrg])),
              })),
            })),
          })
          .mockReturnValueOnce({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([platformMember])),
              })),
            })),
          });

        const formData = new FormData();
        formData.append("email", "admin@example.com");
        formData.append("password", "password123");
        formData.append("redirectTo", "/dashboard");

        const request = new Request("http://admin.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        // Act
        const response = await action({ request, params: {}, context: {} });

        // Assert
        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/dashboard");
        expect(auth.api.signInEmail).toHaveBeenCalledWith({
          body: { email: "admin@example.com", password: "password123" },
          asResponse: true,
        });
      });

      it("should handle invalid credentials", async () => {
        // Arrange
        const mockAuthResponse = {
          ok: false,
          headers: new Headers(),
          json: async () => ({ message: "Invalid credentials" }),
        };
        (auth.api.signInEmail as any).mockResolvedValue(mockAuthResponse);

        const formData = new FormData();
        formData.append("email", "admin@example.com");
        formData.append("password", "wrongpassword");

        const request = new Request("http://admin.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        // Act
        const response = await action({ request, params: {}, context: {} });

        // Assert
        expect(response).toEqual({ error: "Invalid credentials" });
      });

      it("should return error if user not a platform member", async () => {
        // Arrange
        const mockCookies = "session=abc123; HttpOnly";
        const mockAuthResponse = {
          ok: true,
          headers: new Headers({ "set-cookie": mockCookies }),
          json: async () => ({
            user: { id: "user123", email: "user@example.com" },
          }),
        };
        (auth.api.signInEmail as any).mockResolvedValue(mockAuthResponse);

        // Mock no platform membership
        (db.select as any)
          .mockReturnValueOnce({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([platformOrg])),
              })),
            })),
          })
          .mockReturnValueOnce({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([])), // No membership
              })),
            })),
          });

        const formData = new FormData();
        formData.append("email", "user@example.com");
        formData.append("password", "password123");

        const request = new Request("http://admin.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        // Act
        const response = await action({ request, params: {}, context: {} });

        // Assert
        const jsonResponse = await response.json();
        expect(jsonResponse).toEqual({
          notPlatformMember: { email: "user@example.com" },
        });
      });

      it("should handle platform organization not found", async () => {
        // Arrange
        const mockAuthResponse = {
          ok: true,
          headers: new Headers(),
          json: async () => ({
            user: { id: "user123", email: "admin@example.com" },
          }),
        };
        (auth.api.signInEmail as any).mockResolvedValue(mockAuthResponse);

        // Mock platform org not found
        (db.select as any).mockReturnValue({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([])), // No platform org
            })),
          })),
        });

        const formData = new FormData();
        formData.append("email", "admin@example.com");
        formData.append("password", "password123");

        const request = new Request("http://admin.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        // Act
        const response = await action({ request, params: {}, context: {} });

        // Assert
        expect(response).toEqual({
          error: "Platform configuration error. Please contact support.",
        });
      });

      it("should handle missing user ID from auth response", async () => {
        // Arrange
        const mockAuthResponse = {
          ok: true,
          headers: new Headers(),
          json: async () => ({
            user: null, // No user in response
          }),
        };
        (auth.api.signInEmail as any).mockResolvedValue(mockAuthResponse);

        const formData = new FormData();
        formData.append("email", "admin@example.com");
        formData.append("password", "password123");

        const request = new Request("http://admin.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        // Act
        const response = await action({ request, params: {}, context: {} });

        // Assert
        expect(response).toEqual({
          error: "Failed to get user information",
        });
      });

      it("should handle sign in errors", async () => {
        // Arrange
        (auth.api.signInEmail as any).mockRejectedValue(
          new Error("Network error")
        );

        const formData = new FormData();
        formData.append("email", "admin@example.com");
        formData.append("password", "password123");

        const request = new Request("http://admin.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        // Act
        const response = await action({ request, params: {}, context: {} });

        // Assert
        expect(response).toEqual({
          error: "An error occurred during login. Please try again.",
        });
      });
    });

    describe("Redirect Handling", () => {
      it("should use custom redirectTo parameter", async () => {
        // Arrange
        const mockCookies = "session=abc123; HttpOnly";
        const mockAuthResponse = {
          ok: true,
          headers: new Headers({ "set-cookie": mockCookies }),
          json: async () => ({
            user: { id: "user123", email: "admin@example.com" },
          }),
        };
        (auth.api.signInEmail as any).mockResolvedValue(mockAuthResponse);

        const platformMember = {
          userId: "user123",
          organizationId: "platform-org-id",
        };
        (db.select as any)
          .mockReturnValueOnce({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([platformOrg])),
              })),
            })),
          })
          .mockReturnValueOnce({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([platformMember])),
              })),
            })),
          });

        const formData = new FormData();
        formData.append("email", "admin@example.com");
        formData.append("password", "password123");
        formData.append("redirectTo", "/custom-page");

        const request = new Request("http://admin.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        // Act
        const response = await action({ request, params: {}, context: {} });

        // Assert
        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/custom-page");
      });

      it("should default to /dashboard if redirectTo not provided", async () => {
        // Arrange
        const mockCookies = "session=abc123; HttpOnly";
        const mockAuthResponse = {
          ok: true,
          headers: new Headers({ "set-cookie": mockCookies }),
          json: async () => ({
            user: { id: "user123", email: "admin@example.com" },
          }),
        };
        (auth.api.signInEmail as any).mockResolvedValue(mockAuthResponse);

        const platformMember = {
          userId: "user123",
          organizationId: "platform-org-id",
        };
        (db.select as any)
          .mockReturnValueOnce({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([platformOrg])),
              })),
            })),
          })
          .mockReturnValueOnce({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve([platformMember])),
              })),
            })),
          });

        const formData = new FormData();
        formData.append("email", "admin@example.com");
        formData.append("password", "password123");
        // No redirectTo

        const request = new Request("http://admin.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        // Act
        const response = await action({ request, params: {}, context: {} });

        // Assert
        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/dashboard");
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle malformed form data", async () => {
      // Arrange
      const request = new Request("http://admin.divestreams.com/login", {
        method: "POST",
        body: "not-form-data",
        headers: { "content-type": "text/plain" },
      });

      // Act & Assert
      await expect(
        action({ request, params: {}, context: {} })
      ).rejects.toThrow();
    });

    it("should validate email with various formats", async () => {
      const testCases = [
        { email: "test@example", valid: false },
        { email: "@example.com", valid: false },
        { email: "test.example.com", valid: false },
        { email: "test@example.com", valid: true },
        { email: "test.user+tag@example.co.uk", valid: true },
      ];

      for (const { email, valid } of testCases) {
        const formData = new FormData();
        formData.append("email", email);
        formData.append("password", "password123");

        const request = new Request("http://admin.divestreams.com/login", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} });

        if (!valid) {
          expect(response).toEqual({
            error: "Please enter a valid email address",
          });
        }
      }
    });
  });
});

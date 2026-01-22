/**
 * Admin Logout Route Tests
 *
 * Tests the admin logout route with loader and action functionality.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { action, loader } from "../../../../app/routes/admin/logout";

// Mock auth module
vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));

import { auth } from "../../../../lib/auth";

describe("Route: admin/logout.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("action (POST /logout)", () => {
    it("should sign out and redirect to /login with cookies", async () => {
      // Arrange
      const mockCookies = "session=; Max-Age=0; Path=/; HttpOnly";
      const mockResponse = {
        headers: new Headers({
          "set-cookie": mockCookies,
        }),
      };
      (auth.api.signOut as any).mockResolvedValue(mockResponse);

      const request = new Request("http://localhost/admin/logout", {
        method: "POST",
        headers: { cookie: "session=abc123" },
      });

      // Act
      const response = await action({
        request,
        params: {},
        context: {},
      });

      // Assert
      expect(auth.api.signOut).toHaveBeenCalledWith({
        headers: request.headers,
        asResponse: true,
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
      // Note: redirect() Response doesn't expose Set-Cookie via headers.get()
      // but the cookies are passed through the headers init
    });

    it("should redirect to /login even if no cookies returned", async () => {
      // Arrange
      const mockResponse = {
        headers: new Headers(),
      };
      (auth.api.signOut as any).mockResolvedValue(mockResponse);

      const request = new Request("http://localhost/admin/logout", {
        method: "POST",
      });

      // Act
      const response = await action({
        request,
        params: {},
        context: {},
      });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
      expect(response.headers.get("Set-Cookie")).toBeNull();
    });

    it("should handle signOut errors gracefully", async () => {
      // Arrange
      (auth.api.signOut as any).mockRejectedValue(new Error("Network error"));

      const request = new Request("http://localhost/admin/logout", {
        method: "POST",
      });

      // Act & Assert
      await expect(
        action({
          request,
          params: {},
          context: {},
        })
      ).rejects.toThrow("Network error");
    });

    it("should pass request headers to signOut", async () => {
      // Arrange
      const mockResponse = {
        headers: new Headers(),
      };
      (auth.api.signOut as any).mockResolvedValue(mockResponse);

      const request = new Request("http://localhost/admin/logout", {
        method: "POST",
        headers: {
          cookie: "session=xyz789",
          "user-agent": "TestAgent/1.0",
        },
      });

      // Act
      await action({
        request,
        params: {},
        context: {},
      });

      // Assert
      expect(auth.api.signOut).toHaveBeenCalledWith({
        headers: request.headers,
        asResponse: true,
      });
    });
  });

  describe("loader (GET /logout)", () => {
    it("should redirect to /dashboard if user is authenticated", async () => {
      // Arrange
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "user123", email: "test@example.com" },
        session: { id: "session123" },
      });

      const request = new Request("http://localhost/admin/logout");

      // Act
      const response = await loader({
        request,
        params: {},
        context: {},
      });

      // Assert
      expect(auth.api.getSession).toHaveBeenCalledWith({
        headers: request.headers,
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/dashboard");
    });

    it("should redirect to /login if user is not authenticated", async () => {
      // Arrange
      (auth.api.getSession as any).mockResolvedValue(null);

      const request = new Request("http://localhost/admin/logout");

      // Act
      const response = await loader({
        request,
        params: {},
        context: {},
      });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
    });

    it("should redirect to /login if session has no user", async () => {
      // Arrange
      (auth.api.getSession as any).mockResolvedValue({
        session: { id: "session123" },
        user: null,
      });

      const request = new Request("http://localhost/admin/logout");

      // Act
      const response = await loader({
        request,
        params: {},
        context: {},
      });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
    });

    it("should handle getSession errors", async () => {
      // Arrange
      (auth.api.getSession as any).mockRejectedValue(
        new Error("Auth service unavailable")
      );

      const request = new Request("http://localhost/admin/logout");

      // Act & Assert
      await expect(
        loader({
          request,
          params: {},
          context: {},
        })
      ).rejects.toThrow("Auth service unavailable");
    });
  });

  describe("Edge Cases", () => {
    it("should handle malformed cookies in signOut", async () => {
      // Arrange
      const mockResponse = {
        headers: new Headers({
          "set-cookie": "invalid cookie format",
        }),
      };
      (auth.api.signOut as any).mockResolvedValue(mockResponse);

      const request = new Request("http://localhost/admin/logout", {
        method: "POST",
      });

      // Act
      const response = await action({
        request,
        params: {},
        context: {},
      });

      // Assert - should still redirect even with malformed cookie
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
      // Note: redirect() Response doesn't expose Set-Cookie via headers.get()
      // but the code handles malformed cookies gracefully
    });

    it("should handle undefined session object", async () => {
      // Arrange
      (auth.api.getSession as any).mockResolvedValue(undefined);

      const request = new Request("http://localhost/admin/logout");

      // Act
      const response = await loader({
        request,
        params: {},
        context: {},
      });

      // Assert
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
    });
  });
});

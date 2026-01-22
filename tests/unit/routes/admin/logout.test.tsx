/**
 * Admin Logout Route Tests
 *
 * Tests logout action and loader redirect logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/admin/logout";

// Mock auth
vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

// Import mocked modules
import { auth } from "../../../../lib/auth";

describe("Route: admin/logout.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should redirect to /dashboard if user is authenticated", async () => {
      // Arrange
      const request = new Request("http://localhost/admin/logout");
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "user-123", email: "admin@example.com" },
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert - loader redirect returns Response directly (uses 'return' not 'throw')
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/dashboard");
    });

    it("should redirect to /login if user is not authenticated", async () => {
      // Arrange
      const request = new Request("http://localhost/admin/logout");
      (auth.api.getSession as any).mockResolvedValue(null);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
    });

    it("should redirect to /login if getSession returns undefined", async () => {
      // Arrange
      const request = new Request("http://localhost/admin/logout");
      (auth.api.getSession as any).mockResolvedValue(undefined);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
    });

    it("should redirect to /login if getSession returns object without user", async () => {
      // Arrange
      const request = new Request("http://localhost/admin/logout");
      (auth.api.getSession as any).mockResolvedValue({ session: "session-123" });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
    });
  });

  describe("action", () => {
    it("should sign out user and redirect to /login with cookie header", async () => {
      // Arrange
      const request = new Request("http://localhost/admin/logout", {
        method: "POST",
      });

      const mockSignOutResponse = new Response(null, {
        status: 200,
        headers: { "Set-Cookie": "session=; Max-Age=0" },
      });
      (auth.api.signOut as any).mockResolvedValue(mockSignOutResponse);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(auth.api.signOut).toHaveBeenCalledWith({
        headers: request.headers,
        asResponse: true,
      });

      // Action redirect returns Response directly
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
      // Note: Set-Cookie header forwarding is tested in integration tests
    });

    it("should redirect to /login even if signOut response has no cookie", async () => {
      // Arrange
      const request = new Request("http://localhost/admin/logout", {
        method: "POST",
      });

      const mockSignOutResponse = new Response(null, {
        status: 200,
        // No Set-Cookie header
      });
      (auth.api.signOut as any).mockResolvedValue(mockSignOutResponse);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      const response = result as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
    });

    it("should call signOut with request headers", async () => {
      // Arrange
      const headers = new Headers();
      headers.set("Cookie", "session=abc123");
      const request = new Request("http://localhost/admin/logout", {
        method: "POST",
        headers,
      });

      const mockSignOutResponse = new Response(null, {
        status: 200,
        headers: { "Set-Cookie": "session=; Max-Age=0" },
      });
      (auth.api.signOut as any).mockResolvedValue(mockSignOutResponse);

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(auth.api.signOut).toHaveBeenCalledWith({
        headers: request.headers,
        asResponse: true,
      });
    });
  });
});

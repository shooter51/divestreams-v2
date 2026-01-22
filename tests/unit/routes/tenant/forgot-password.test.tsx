/**
 * Tenant Forgot Password Route Tests
 *
 * Tests password reset request with email validation and security behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/tenant/forgot-password";

// Mock auth
vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      requestPasswordReset: vi.fn(),
    },
  },
}));

// Mock subdomain helper
vi.mock("../../../../lib/auth/org-context.server", () => ({
  getSubdomainFromRequest: vi.fn(),
}));

// Import mocked modules
import { auth } from "../../../../lib/auth";
import { getSubdomainFromRequest } from "../../../../lib/auth/org-context.server";

describe("Route: tenant/forgot-password.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should redirect to /app if user is already logged in", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/forgot-password");
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "user-123", email: "test@example.com" },
      });

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        // Should not reach here
        expect.fail("Expected redirect to be thrown");
      } catch (response: any) {
        // Redirect throws a Response object
        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/app");
      }
    });

    it("should return empty object if not logged in", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/forgot-password");
      (auth.api.getSession as any).mockResolvedValue(null);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({});
    });

    it("should return empty object if getSession returns undefined", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/forgot-password");
      (auth.api.getSession as any).mockResolvedValue(undefined);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({});
    });

    it("should return empty object if getSession returns object without user", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/forgot-password");
      (auth.api.getSession as any).mockResolvedValue({ session: "session-123" });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({});
    });
  });

  describe("action", () => {
    it("should request password reset for valid email", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "user@example.com");
      const request = {
        formData: () => Promise.resolve(formData),
        url: "http://demo.localhost:3000/forgot-password",
        headers: new Headers(),
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue("demo");
      (auth.api.requestPasswordReset as any).mockResolvedValue({});

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(auth.api.requestPasswordReset).toHaveBeenCalledWith({
        body: {
          email: "user@example.com",
          redirectTo: "http://demo.localhost:3000/reset-password",
        },
      });
      expect(result).toEqual({ success: true, email: "user@example.com" });
    });

    it("should construct redirectTo URL from request URL", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "test@example.com");
      const request = {
        formData: () => Promise.resolve(formData),
        url: "https://myshop.divestreams.com/forgot-password",
        headers: new Headers(),
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue("myshop");
      (auth.api.requestPasswordReset as any).mockResolvedValue({});

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(auth.api.requestPasswordReset).toHaveBeenCalledWith({
        body: {
          email: "test@example.com",
          redirectTo: "https://myshop.divestreams.com/reset-password",
        },
      });
    });

    it("should return error for empty email", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Please enter a valid email address" });
      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
    });

    it("should return error for missing email field", async () => {
      // Arrange
      const formData = new FormData();
      // email not appended
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Please enter a valid email address" });
      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
    });

    it("should return error for invalid email format (no @)", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "notanemail");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Please enter a valid email address" });
      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
    });

    it("should return error for invalid email format (no domain)", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "user@");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Please enter a valid email address" });
      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
    });

    it("should return error for invalid email format (no TLD)", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "user@domain");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Please enter a valid email address" });
      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
    });

    it("should return error for invalid email format (spaces)", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "user @example.com");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Please enter a valid email address" });
      expect(auth.api.requestPasswordReset).not.toHaveBeenCalled();
    });

    it("should return success even if requestPasswordReset throws error (security feature)", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "user@example.com");
      const request = {
        formData: () => Promise.resolve(formData),
        url: "http://demo.localhost:3000/forgot-password",
        headers: new Headers(),
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue("demo");
      (auth.api.requestPasswordReset as any).mockRejectedValue(
        new Error("Email not found")
      );

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      // Should still return success to prevent email enumeration
      expect(result).toEqual({ success: true, email: "user@example.com" });
    });

    it("should return success for valid email format regardless of API response", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "nonexistent@example.com");
      const request = {
        formData: () => Promise.resolve(formData),
        url: "http://demo.localhost:3000/forgot-password",
        headers: new Headers(),
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue("demo");
      (auth.api.requestPasswordReset as any).mockResolvedValue({});

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      // Always returns success for security (prevent email enumeration)
      expect(result).toEqual({ success: true, email: "nonexistent@example.com" });
    });

    it("should accept various valid email formats", async () => {
      const validEmails = [
        "user@example.com",
        "test.user@example.com",
        "user+tag@example.co.uk",
        "user123@sub.example.com",
        "a@b.c",
      ];

      for (const email of validEmails) {
        // Arrange
        const formData = new FormData();
        formData.append("email", email);
        const request = {
          formData: () => Promise.resolve(formData),
          url: "http://demo.localhost:3000/forgot-password",
          headers: new Headers(),
        } as Request;

        (getSubdomainFromRequest as any).mockReturnValue("demo");
        (auth.api.requestPasswordReset as any).mockResolvedValue({});

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(result).toEqual({ success: true, email });
      }
    });
  });
});

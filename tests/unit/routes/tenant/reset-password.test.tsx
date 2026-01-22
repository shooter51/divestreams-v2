/**
 * Tenant Reset Password Route Tests
 *
 * Tests password reset flow with comprehensive validation and auto-login.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/tenant/reset-password";

// Mock auth
vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      resetPassword: vi.fn(),
      signInEmail: vi.fn(),
    },
  },
}));

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock schema
vi.mock("../../../../lib/db/schema", () => ({
  verification: {},
}));

// Import mocked modules
import { auth } from "../../../../lib/auth";
import { db } from "../../../../lib/db";

describe("Route: tenant/reset-password.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should redirect to forgot-password if no token provided", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/reset-password");
      (auth.api.getSession as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect.fail("Expected redirect to be thrown");
      } catch (response: any) {
        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/forgot-password");
      }
    });

    it("should redirect to /app if user is already logged in", async () => {
      // Arrange
      const request = new Request(
        "http://localhost/tenant/reset-password?token=valid-token"
      );
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: "user-123", email: "user@example.com" },
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

    it("should look up email from verification table with valid token", async () => {
      // Arrange
      const request = new Request(
        "http://localhost/tenant/reset-password?token=valid-token-123"
      );
      (auth.api.getSession as any).mockResolvedValue(null);

      const mockLimit = vi.fn().mockResolvedValue([
        {
          identifier: "user@example.com",
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      (db.select as any).mockReturnValue({ from: mockFrom });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.hasToken).toBe(true);
      expect(result.email).toBe("user@example.com");
      expect(db.select).toHaveBeenCalled();
    });

    it("should return empty email if token not found in verification table", async () => {
      // Arrange
      const request = new Request(
        "http://localhost/tenant/reset-password?token=invalid-token"
      );
      (auth.api.getSession as any).mockResolvedValue(null);

      const mockLimit = vi.fn().mockResolvedValue([]); // No verification record
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      (db.select as any).mockReturnValue({ from: mockFrom });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.hasToken).toBe(true);
      expect(result.email).toBe(""); // Empty string, not error
    });

    it("should return email even if verification record exists (no expiration check in loader)", async () => {
      // Arrange
      const request = new Request(
        "http://localhost/tenant/reset-password?token=some-token"
      );
      (auth.api.getSession as any).mockResolvedValue(null);

      const mockLimit = vi.fn().mockResolvedValue([
        {
          identifier: "user@example.com",
        },
      ]);
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      (db.select as any).mockReturnValue({ from: mockFrom });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.hasToken).toBe(true);
      expect(result.email).toBe("user@example.com");
    });

    it("should handle database errors during verification lookup", async () => {
      // Arrange
      const request = new Request(
        "http://localhost/tenant/reset-password?token=test-token"
      );
      (auth.api.getSession as any).mockResolvedValue(null);

      const mockLimit = vi.fn().mockRejectedValue(new Error("Database error"));
      const mockWhere = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      (db.select as any).mockReturnValue({ from: mockFrom });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.hasToken).toBe(true);
      expect(result.email).toBe(""); // Empty on error
    });
  });

  describe("action", () => {
    it("should validate password is at least 8 characters", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("password", "Short1");
      formData.append("confirmPassword", "Short1");
      formData.append("token", "valid-token");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.password).toBe(
        "Password must be at least 8 characters"
      );
      expect(auth.api.resetPassword).not.toHaveBeenCalled();
    });

    it("should validate password contains uppercase letter", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("password", "lowercase123");
      formData.append("confirmPassword", "lowercase123");
      formData.append("token", "valid-token");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.password).toBe(
        "Password must contain at least one uppercase letter"
      );
      expect(auth.api.resetPassword).not.toHaveBeenCalled();
    });

    it("should validate password contains lowercase letter", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("password", "UPPERCASE123");
      formData.append("confirmPassword", "UPPERCASE123");
      formData.append("token", "valid-token");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.password).toBe(
        "Password must contain at least one lowercase letter"
      );
      expect(auth.api.resetPassword).not.toHaveBeenCalled();
    });

    it("should validate password contains number", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("password", "NoNumbersHere");
      formData.append("confirmPassword", "NoNumbersHere");
      formData.append("token", "valid-token");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.password).toBe(
        "Password must contain at least one number"
      );
      expect(auth.api.resetPassword).not.toHaveBeenCalled();
    });

    it("should validate passwords match", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "DifferentPass123");
      formData.append("token", "valid-token");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.confirmPassword).toBe("Passwords do not match");
      expect(auth.api.resetPassword).not.toHaveBeenCalled();
    });

    it("should return error for missing token", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      // token not provided
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.form).toBe(
        "Invalid or missing reset token. Please request a new password reset link."
      );
      expect(auth.api.resetPassword).not.toHaveBeenCalled();
    });

    it("should successfully reset password with valid inputs", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      formData.append("token", "valid-token-123");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockResetResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
      });
      Object.defineProperty(mockResetResponse, "ok", { value: true });
      (auth.api.resetPassword as any).mockResolvedValue(mockResetResponse);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(auth.api.resetPassword).toHaveBeenCalledWith({
        body: { newPassword: "ValidPass123", token: "valid-token-123" },
        asResponse: true,
      });
      expect(result.success).toBe(true);
    });

    it("should attempt auto-login after successful password reset", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      formData.append("token", "valid-token-123");
      formData.append("email", "user@example.com");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockResetResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
      });
      Object.defineProperty(mockResetResponse, "ok", { value: true });
      (auth.api.resetPassword as any).mockResolvedValue(mockResetResponse);

      const mockSignInResponse = new Response(
        JSON.stringify({ user: { id: "user-123", email: "user@example.com" } }),
        {
          status: 200,
          headers: { "Set-Cookie": "session=abc123" },
        }
      );
      Object.defineProperty(mockSignInResponse, "ok", { value: true });
      (auth.api.signInEmail as any).mockResolvedValue(mockSignInResponse);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert - action redirect returns Response directly
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/app");

      expect(auth.api.signInEmail).toHaveBeenCalledWith({
        body: { email: "user@example.com", password: "ValidPass123" },
        asResponse: true,
      });
    });

    it("should return success state if auto-login fails", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      formData.append("token", "valid-token-123");
      formData.append("email", "user@example.com");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockResetResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
      });
      Object.defineProperty(mockResetResponse, "ok", { value: true });
      (auth.api.resetPassword as any).mockResolvedValue(mockResetResponse);

      (auth.api.signInEmail as any).mockRejectedValue(
        new Error("Auto-login failed")
      );

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.success).toBe(true);
      expect(auth.api.signInEmail).toHaveBeenCalled();
    });

    it("should handle resetPassword API error", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      formData.append("token", "invalid-token");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      (auth.api.resetPassword as any).mockRejectedValue(
        new Error("Invalid token")
      );

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.form).toBe(
        "An error occurred. Please try again or request a new reset link."
      );
    });

    it("should handle null password input", async () => {
      // Arrange
      const formData = new FormData();
      // password not appended (null)
      formData.append("confirmPassword", "ValidPass123");
      formData.append("token", "valid-token");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.password).toBe(
        "Password must be at least 8 characters"
      );
    });

    it("should handle empty password input", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("password", "");
      formData.append("confirmPassword", "ValidPass123");
      formData.append("token", "valid-token");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.password).toBe(
        "Password must be at least 8 characters"
      );
    });

    it("should accept password with all requirements met", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("password", "ComplexPassword123!");
      formData.append("confirmPassword", "ComplexPassword123!");
      formData.append("token", "valid-token");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockResetResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
      });
      Object.defineProperty(mockResetResponse, "ok", { value: true });
      (auth.api.resetPassword as any).mockResolvedValue(mockResetResponse);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(auth.api.resetPassword).toHaveBeenCalledWith({
        body: { newPassword: "ComplexPassword123!", token: "valid-token" },
        asResponse: true,
      });
      expect(result.success).toBe(true);
    });

    it("should handle whitespace-only password", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("password", "        ");
      formData.append("confirmPassword", "        ");
      formData.append("token", "valid-token");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.password).toBe(
        "Password must contain at least one uppercase letter"
      );
    });

    it("should validate exactly 8 character password with requirements", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("password", "Valid123"); // Exactly 8 chars
      formData.append("confirmPassword", "Valid123");
      formData.append("token", "valid-token");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      const mockResetResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
      });
      Object.defineProperty(mockResetResponse, "ok", { value: true });
      (auth.api.resetPassword as any).mockResolvedValue(mockResetResponse);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(auth.api.resetPassword).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });
});

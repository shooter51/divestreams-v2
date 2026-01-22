/**
 * Site Login Route Tests
 *
 * Tests the login page loader and action with authentication and validation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/site/login";

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock customer auth
vi.mock("../../../../lib/auth/customer-auth.server", () => ({
  loginCustomer: vi.fn(),
  getCustomerBySession: vi.fn(),
}));

// Import mocked modules
import { db } from "../../../../lib/db";
import { loginCustomer, getCustomerBySession } from "../../../../lib/auth/customer-auth.server";

describe("Route: site/login.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOrganization = {
    id: "org-123",
  };

  describe("loader", () => {
    it("should throw 404 when organization not found", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/login");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should return organization ID when not logged in", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/login");
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getCustomerBySession as any).mockResolvedValue(null);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ organizationId: "org-123" });
    });

    it("should redirect to account when already logged in", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/login",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getCustomerBySession as any).mockResolvedValue({
        id: "cust-123",
        email: "john@example.com",
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/site/account");
    });

    it("should redirect to custom URL when already logged in", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/login?redirect=/site/trips/123",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (getCustomerBySession as any).mockResolvedValue({
        id: "cust-123",
        email: "john@example.com",
      });

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/site/trips/123");
    });
  });

  describe("action", () => {
    it("should throw 404 when organization not found", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "john@example.com");
      formData.append("password", "password123");
      const request = {
        url: "http://demo.localhost:5173/site/login",
        formData: () => Promise.resolve(formData),
      } as Request;
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Act & Assert
      try {
        await action({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(404);
      }
    });

    it("should return error when email is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "");
      formData.append("password", "password123");
      const request = {
        url: "http://demo.localhost:5173/site/login",
        formData: () => Promise.resolve(formData),
      } as Request;
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        errors: { email: "Email is required" },
        email: "",
      });
    });

    it("should return error when email is invalid", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "invalid-email");
      formData.append("password", "password123");
      const request = {
        url: "http://demo.localhost:5173/site/login",
        formData: () => Promise.resolve(formData),
      } as Request;
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        errors: { email: "Please enter a valid email address" },
        email: "invalid-email",
      });
    });

    it("should return error when password is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "john@example.com");
      formData.append("password", "");
      const request = {
        url: "http://demo.localhost:5173/site/login",
        formData: () => Promise.resolve(formData),
      } as Request;
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        errors: { password: "Password is required" },
        email: "john@example.com",
      });
    });

    it("should login successfully and redirect to account", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "john@example.com");
      formData.append("password", "password123");
      const request = {
        url: "http://demo.localhost:5173/site/login",
        formData: () => Promise.resolve(formData),
      } as Request;
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (loginCustomer as any).mockResolvedValue({
        token: "session-token-123",
        customerId: "cust-123",
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(loginCustomer).toHaveBeenCalledWith("org-123", "john@example.com", "password123");
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/site/account");
    });

    it("should login successfully and redirect to custom URL", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "john@example.com");
      formData.append("password", "password123");
      const request = {
        url: "http://demo.localhost:5173/site/login?redirect=/site/trips/123",
        formData: () => Promise.resolve(formData),
      } as Request;
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (loginCustomer as any).mockResolvedValue({
        token: "session-token-123",
        customerId: "cust-123",
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/site/trips/123");
    });

    it("should login successfully with remember me checkbox", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "john@example.com");
      formData.append("password", "password123");
      formData.append("rememberMe", "on");
      const request = {
        url: "http://demo.localhost:5173/site/login",
        formData: () => Promise.resolve(formData),
      } as Request;
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (loginCustomer as any).mockResolvedValue({
        token: "session-token-123",
        customerId: "cust-123",
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(loginCustomer).toHaveBeenCalledWith("org-123", "john@example.com", "password123");
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/site/account");
    });

    it("should return error on login failure", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("email", "john@example.com");
      formData.append("password", "wrongpassword");
      const request = {
        url: "http://demo.localhost:5173/site/login",
        formData: () => Promise.resolve(formData),
      } as Request;
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockOrganization]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockWhere.mockReturnValue({
        limit: mockLimit,
      });
      (loginCustomer as any).mockRejectedValue(new Error("Invalid credentials"));

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        errors: { form: "Invalid email or password" },
        email: "john@example.com",
      });
    });
  });
});

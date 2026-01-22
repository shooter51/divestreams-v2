/**
 * Site Register Route Tests
 *
 * Tests the registration page action with field validation, account creation, and auto-login.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../../app/routes/site/register";

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock customer auth
vi.mock("../../../../lib/auth/customer-auth.server", () => ({
  registerCustomer: vi.fn(),
  loginCustomer: vi.fn(),
}));

// Import mocked modules
import { db } from "../../../../lib/db";
import { registerCustomer, loginCustomer } from "../../../../lib/auth/customer-auth.server";

describe("Route: site/register.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOrganization = {
    id: "org-123",
    slug: "demo",
  };

  const validFormData = {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "+1234567890",
    password: "Password123",
    confirmPassword: "Password123",
    terms: "on",
  };

  describe("action", () => {
    it("should return error when subdomain cannot be determined", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries(validFormData).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://localhost:5173/site/register",
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Unable to determine organization" });
    });

    it("should return error when organization not found", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries(validFormData).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Organization not found" });
    });

    it("should return error when first name is missing", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, firstName: "" }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { firstName: "First name is required" },
      });
    });

    it("should return error when first name is too long", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, firstName: "a".repeat(101) }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { firstName: "First name must be 100 characters or less" },
      });
    });

    it("should return error when last name is missing", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, lastName: "" }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { lastName: "Last name is required" },
      });
    });

    it("should return error when last name is too long", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, lastName: "a".repeat(101) }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { lastName: "Last name must be 100 characters or less" },
      });
    });

    it("should return error when email is missing", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, email: "" }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { email: "Please enter a valid email address" },
      });
    });

    it("should return error when email is invalid", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, email: "invalid-email" }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { email: "Please enter a valid email address" },
      });
    });

    it("should return error when email is too long", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, email: "a".repeat(250) + "@test.com" }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { email: "Email must be 255 characters or less" },
      });
    });

    it("should return error when phone format is invalid", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, phone: "invalid-phone!!!" }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { phone: "Please enter a valid phone number" },
      });
    });

    it("should return error when phone is too long", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, phone: "1".repeat(21) }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { phone: "Phone number must be 20 characters or less" },
      });
    });

    it("should return error when password is missing", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, password: "", confirmPassword: "" }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: {
          password: "Password is required",
          confirmPassword: "Please confirm your password",
        },
      });
    });

    it("should return error when password is too short", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, password: "Pass1", confirmPassword: "Pass1" }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { password: "Password must contain at least 8 characters" },
      });
    });

    it("should return error when password has no uppercase letter", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, password: "password123", confirmPassword: "password123" }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { password: "Password must contain one uppercase letter" },
      });
    });

    it("should return error when password has no lowercase letter", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, password: "PASSWORD123", confirmPassword: "PASSWORD123" }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { password: "Password must contain one lowercase letter" },
      });
    });

    it("should return error when password has no number", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, password: "Password", confirmPassword: "Password" }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { password: "Password must contain one number" },
      });
    });

    it("should return error when confirm password is missing", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, confirmPassword: "" }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { confirmPassword: "Please confirm your password" },
      });
    });

    it("should return error when passwords do not match", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, confirmPassword: "DifferentPassword123" }).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { confirmPassword: "Passwords do not match" },
      });
    });

    it("should return error when terms are not accepted", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries({ ...validFormData, terms: "" }).forEach(([key, value]) => {
        if (key !== "terms") {
          formData.append(key, value);
        }
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
        success: false,
        errors: { terms: "You must accept the Terms of Service" },
      });
    });

    it("should return error when email is already registered", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries(validFormData).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
      (registerCustomer as any).mockRejectedValue(new Error("Email already registered"));

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        success: false,
        errors: { email: "This email is already registered. Please sign in instead." },
      });
    });

    it("should successfully register and redirect to account", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries(validFormData).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
      (registerCustomer as any).mockResolvedValue({
        customer: { id: "cust-123", email: "john@example.com" },
        verificationToken: "token-123",
      });
      (loginCustomer as any).mockResolvedValue({
        token: "session-token-123",
        expiresAt: new Date("2024-12-31T00:00:00Z"),
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(registerCustomer).toHaveBeenCalledWith("org-123", {
        email: "john@example.com",
        password: "Password123",
        firstName: "John",
        lastName: "Doe",
        phone: "+1234567890",
      });
      expect(loginCustomer).toHaveBeenCalledWith("org-123", "john@example.com", "Password123");
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/site/account");
    });

    it("should successfully register without phone", async () => {
      // Arrange
      const formData = new FormData();
      const dataWithoutPhone = { ...validFormData };
      delete (dataWithoutPhone as any).phone;
      Object.entries(dataWithoutPhone).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
      (registerCustomer as any).mockResolvedValue({
        customer: { id: "cust-123", email: "john@example.com" },
        verificationToken: "token-123",
      });
      (loginCustomer as any).mockResolvedValue({
        token: "session-token-123",
        expiresAt: new Date("2024-12-31T00:00:00Z"),
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(registerCustomer).toHaveBeenCalledWith("org-123", {
        email: "john@example.com",
        password: "Password123",
        firstName: "John",
        lastName: "Doe",
        phone: undefined,
      });
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/site/account");
    });

    it("should redirect to login when auto-login fails", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries(validFormData).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
      (registerCustomer as any).mockResolvedValue({
        customer: { id: "cust-123", email: "john@example.com" },
        verificationToken: "token-123",
      });
      (loginCustomer as any).mockRejectedValue(new Error("Login failed"));

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/site/login?registered=true");
    });

    it("should return error when registration fails", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries(validFormData).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
      (registerCustomer as any).mockRejectedValue(new Error("Database error"));

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        success: false,
        error: "Database error",
      });
    });

    it("should return generic error when registration fails with non-Error", async () => {
      // Arrange
      const formData = new FormData();
      Object.entries(validFormData).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const request = {
        url: "http://demo.localhost:5173/site/register",
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
      (registerCustomer as any).mockRejectedValue("Unknown error");

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        success: false,
        error: "Registration failed. Please try again.",
      });
    });
  });
});

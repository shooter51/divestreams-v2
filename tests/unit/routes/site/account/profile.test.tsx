/**
 * Site Account Profile Route Tests
 *
 * Tests the profile page with update profile, change password, and logout actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../../app/routes/site/account/profile";

// Mock database
vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock customer auth
vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  getCustomerBySession: vi.fn(),
  logoutCustomer: vi.fn(),
}));

// Mock bcrypt
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

// Import mocked modules
import { db } from "../../../../../lib/db";
import { getCustomerBySession, logoutCustomer } from "../../../../../lib/auth/customer-auth.server";
import bcrypt from "bcryptjs";

describe("Route: site/account/profile.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCustomer = {
    id: "cust-123",
    organizationId: "org-123",
    email: "john@example.com",
    firstName: "John",
    lastName: "Doe",
    phone: "+1234567890",
  };

  describe("loader", () => {
    it("should return 401 when no session cookie", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/account/profile");

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.status).toBe(401);
      }
    });

    it("should return 401 when getCustomerBySession returns null", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account/profile",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=invalid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(getCustomerBySession).toHaveBeenCalledWith("invalid-token");
        expect(error.status).toBe(401);
      }
    });

    it("should return customer profile data", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account/profile",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getCustomerBySession).toHaveBeenCalledWith("valid-token");
      expect(result).toEqual({
        customer: {
          id: "cust-123",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phone: "+1234567890",
        },
      });
    });
  });

  describe("action", () => {
    it("should return error when no session token", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/account/profile", {
        method: "POST",
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Not authenticated", type: "profile" });
    });

    it("should return error when getCustomerBySession returns null", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "update-profile");
      const request = {
        url: "http://demo.localhost:5173/site/account/profile",
        method: "POST",
        formData: () => Promise.resolve(formData),
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=invalid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(null);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({ error: "Not authenticated", type: "profile" });
    });

    it("should handle logout intent", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "logout");
      const request = {
        url: "http://demo.localhost:5173/site/account/profile",
        method: "POST",
        formData: () => Promise.resolve(formData),
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);
      (logoutCustomer as any).mockResolvedValue(undefined);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(logoutCustomer).toHaveBeenCalledWith("valid-token");
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe("/site/login");
    });

    it("should return error when firstName is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "update-profile");
      formData.append("firstName", "");
      formData.append("lastName", "Doe");
      const request = {
        url: "http://demo.localhost:5173/site/account/profile",
        method: "POST",
        formData: () => Promise.resolve(formData),
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        error: "First name is required",
        field: "firstName",
        type: "profile",
      });
    });

    it("should return error when lastName is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "update-profile");
      formData.append("firstName", "John");
      formData.append("lastName", "");
      const request = {
        url: "http://demo.localhost:5173/site/account/profile",
        method: "POST",
        formData: () => Promise.resolve(formData),
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        error: "Last name is required",
        field: "lastName",
        type: "profile",
      });
    });

    it("should update profile successfully", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "update-profile");
      formData.append("firstName", "Jane");
      formData.append("lastName", "Smith");
      formData.append("phone", "+9876543210");
      const request = {
        url: "http://demo.localhost:5173/site/account/profile",
        method: "POST",
        formData: () => Promise.resolve(formData),
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      (db.update as any).mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhere,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(db.update).toHaveBeenCalled();
      expect(result).toEqual({ success: true, type: "profile" });
    });

    it("should return error when current password is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "change-password");
      formData.append("currentPassword", "");
      formData.append("newPassword", "newpass123");
      formData.append("confirmPassword", "newpass123");
      const request = {
        url: "http://demo.localhost:5173/site/account/profile",
        method: "POST",
        formData: () => Promise.resolve(formData),
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        error: "Current password is required",
        field: "currentPassword",
        type: "password",
      });
    });

    it("should return error when new password is missing", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "change-password");
      formData.append("currentPassword", "oldpass123");
      formData.append("newPassword", "");
      formData.append("confirmPassword", "");
      const request = {
        url: "http://demo.localhost:5173/site/account/profile",
        method: "POST",
        formData: () => Promise.resolve(formData),
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        error: "New password is required",
        field: "newPassword",
        type: "password",
      });
    });

    it("should return error when new password is too short", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "change-password");
      formData.append("currentPassword", "oldpass123");
      formData.append("newPassword", "short");
      formData.append("confirmPassword", "short");
      const request = {
        url: "http://demo.localhost:5173/site/account/profile",
        method: "POST",
        formData: () => Promise.resolve(formData),
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        error: "Password must be at least 8 characters",
        field: "newPassword",
        type: "password",
      });
    });

    it("should return error when passwords do not match", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "change-password");
      formData.append("currentPassword", "oldpass123");
      formData.append("newPassword", "newpass123");
      formData.append("confirmPassword", "different");
      const request = {
        url: "http://demo.localhost:5173/site/account/profile",
        method: "POST",
        formData: () => Promise.resolve(formData),
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result).toEqual({
        error: "Passwords do not match",
        field: "confirmPassword",
        type: "password",
      });
    });

    it("should return error when current password is incorrect", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "change-password");
      formData.append("currentPassword", "wrongpass");
      formData.append("newPassword", "newpass123");
      formData.append("confirmPassword", "newpass123");
      const request = {
        url: "http://demo.localhost:5173/site/account/profile",
        method: "POST",
        formData: () => Promise.resolve(formData),
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([
        { id: "creds-123", passwordHash: "$2a$12$hashedpassword" },
      ]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      (bcrypt.compare as any).mockResolvedValue(false);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith("wrongpass", "$2a$12$hashedpassword");
      expect(result).toEqual({
        error: "Current password is incorrect",
        field: "currentPassword",
        type: "password",
      });
    });

    it("should change password successfully", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("intent", "change-password");
      formData.append("currentPassword", "oldpass123");
      formData.append("newPassword", "newpass123");
      formData.append("confirmPassword", "newpass123");
      const request = {
        url: "http://demo.localhost:5173/site/account/profile",
        method: "POST",
        formData: () => Promise.resolve(formData),
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([
        { id: "creds-123", passwordHash: "$2a$12$hashedpassword" },
      ]);
      (db.select as any).mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      (bcrypt.compare as any).mockResolvedValue(true);
      (bcrypt.hash as any).mockResolvedValue("$2a$12$newhashed");
      const mockSet = vi.fn().mockReturnThis();
      const mockWhereUpdate = vi.fn().mockResolvedValue(undefined);
      (db.update as any).mockReturnValue({
        set: mockSet,
      });
      mockSet.mockReturnValue({
        where: mockWhereUpdate,
      });

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith("oldpass123", "$2a$12$hashedpassword");
      expect(bcrypt.hash).toHaveBeenCalledWith("newpass123", 12);
      expect(db.update).toHaveBeenCalled();
      expect(result).toEqual({ success: true, type: "password" });
    });
  });
});

/**
 * Tenant Signup Route Tests
 *
 * Tests user signup with comprehensive validation and org member creation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../../../../app/routes/tenant/signup";

// Mock auth
vi.mock("../../../../lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      signUpEmail: vi.fn(),
    },
  },
}));

// Mock org context
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

// Mock schema
vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: {},
  member: {},
}));

// Import mocked modules
import { auth } from "../../../../lib/auth";
import { getSubdomainFromRequest } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";

describe("Route: tenant/signup.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should redirect to /app if user is already logged in", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/signup");
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

    it("should redirect to custom redirect param if logged in", async () => {
      // Arrange
      const request = new Request(
        "http://localhost/tenant/signup?redirect=/dashboard"
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
        expect(response.headers.get("Location")).toBe("/dashboard");
      }
    });

    it("should look up org by subdomain and return org name", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/signup");
      (auth.api.getSession as any).mockResolvedValue(null);
      (getSubdomainFromRequest as any).mockReturnValue("diveshop");

      const mockLimit = vi.fn().mockResolvedValue([
        { id: "org-123", name: "Dive Shop ABC" },
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
      expect(result.orgName).toBe("Dive Shop ABC");
      expect(result.orgId).toBe("org-123");
      expect(result.subdomain).toBe("diveshop");
    });

    it("should return default org name if no subdomain", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/signup");
      (auth.api.getSession as any).mockResolvedValue(null);
      (getSubdomainFromRequest as any).mockReturnValue(null);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(result.orgName).toBe("this shop");
      expect(result.orgId).toBeNull();
      expect(result.subdomain).toBeNull();
    });

    it("should return default org name if org not found", async () => {
      // Arrange
      const request = new Request("http://localhost/tenant/signup");
      (auth.api.getSession as any).mockResolvedValue(null);
      (getSubdomainFromRequest as any).mockReturnValue("nonexistent");

      const mockLimit = vi.fn().mockResolvedValue([]); // No org found
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
      expect(result.orgName).toBe("this shop");
      expect(result.orgId).toBeNull();
      expect(result.subdomain).toBe("nonexistent");
    });
  });

  describe("action", () => {
    it("should validate name is at least 2 characters", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "A");
      formData.append("email", "user@example.com");
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.name).toBe("Name must be at least 2 characters");
      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    it("should validate email format", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "invalid-email");
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.email).toBe("Please enter a valid email address");
      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    it("should validate password is at least 8 characters", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "user@example.com");
      formData.append("password", "Short1");
      formData.append("confirmPassword", "Short1");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.password).toBe(
        "Password must be at least 8 characters"
      );
      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    it("should validate password contains uppercase letter", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "user@example.com");
      formData.append("password", "lowercase123");
      formData.append("confirmPassword", "lowercase123");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.password).toBe(
        "Password must contain at least one uppercase letter"
      );
      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    it("should validate password contains lowercase letter", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "user@example.com");
      formData.append("password", "UPPERCASE123");
      formData.append("confirmPassword", "UPPERCASE123");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.password).toBe(
        "Password must contain at least one lowercase letter"
      );
      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    it("should validate password contains number", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "user@example.com");
      formData.append("password", "NoNumbersHere");
      formData.append("confirmPassword", "NoNumbersHere");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.password).toBe(
        "Password must contain at least one number"
      );
      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    it("should validate passwords match", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "user@example.com");
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "DifferentPass123");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.confirmPassword).toBe("Passwords do not match");
      expect(auth.api.signUpEmail).not.toHaveBeenCalled();
    });

    it("should successfully sign up user with valid inputs", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "user@example.com");
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      const request = {
        formData: () => Promise.resolve(formData),
        url: "http://localhost/tenant/signup",
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue(null); // No subdomain

      const mockSignUpResponse = new Response(
        JSON.stringify({ user: { id: "user-123", email: "user@example.com" } }),
        {
          status: 200,
          headers: { "Set-Cookie": "session=abc123" },
        }
      );
      Object.defineProperty(mockSignUpResponse, "ok", { value: true });
      (auth.api.signUpEmail as any).mockResolvedValue(mockSignUpResponse);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(auth.api.signUpEmail).toHaveBeenCalledWith({
        body: {
          name: "John Doe",
          email: "user@example.com",
          password: "ValidPass123",
        },
        asResponse: true,
      });

      // Action redirect returns Response directly
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/app");
    });

    it("should add user as customer member to org after signup", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "user@example.com");
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      const request = {
        formData: () => Promise.resolve(formData),
        url: "http://diveshop.localhost/tenant/signup",
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue("diveshop");

      const mockSignUpResponse = new Response(
        JSON.stringify({ user: { id: "user-456", email: "user@example.com" } }),
        {
          status: 200,
          headers: { "Set-Cookie": "session=xyz789" },
        }
      );
      Object.defineProperty(mockSignUpResponse, "ok", { value: true });
      (auth.api.signUpEmail as any).mockResolvedValue(mockSignUpResponse);

      // Mock org lookup
      const mockOrgLimit = vi.fn().mockResolvedValue([{ id: "org-789" }]);
      const mockOrgWhere = vi.fn().mockReturnValue({
        limit: mockOrgLimit,
      });
      const mockOrgFrom = vi.fn().mockReturnValue({
        where: mockOrgWhere,
      });

      // Mock member check (not exists)
      const mockMemberLimit = vi.fn().mockResolvedValue([]); // No existing member
      const mockMemberWhere = vi.fn().mockReturnValue({
        limit: mockMemberLimit,
      });
      const mockMemberFrom = vi.fn().mockReturnValue({
        where: mockMemberWhere,
      });

      // Setup select mock to return different queries
      (db.select as any)
        .mockReturnValueOnce({ from: mockOrgFrom }) // First call: org lookup
        .mockReturnValueOnce({ from: mockMemberFrom }); // Second call: member check

      const mockValues = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnValue({
        values: mockValues,
      });
      (db.insert as any).mockReturnValue(mockInsert());

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(db.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-456",
          organizationId: "org-789",
          role: "customer",
        })
      );
    });

    it("should not add user as member if already exists in org", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "user@example.com");
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      const request = {
        formData: () => Promise.resolve(formData),
        url: "http://diveshop.localhost/tenant/signup",
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue("diveshop");

      const mockSignUpResponse = new Response(
        JSON.stringify({ user: { id: "user-456", email: "user@example.com" } }),
        {
          status: 200,
          headers: { "Set-Cookie": "session=xyz789" },
        }
      );
      Object.defineProperty(mockSignUpResponse, "ok", { value: true });
      (auth.api.signUpEmail as any).mockResolvedValue(mockSignUpResponse);

      // Mock org lookup
      const mockOrgLimit = vi.fn().mockResolvedValue([{ id: "org-789" }]);
      const mockOrgWhere = vi.fn().mockReturnValue({
        limit: mockOrgLimit,
      });
      const mockOrgFrom = vi.fn().mockReturnValue({
        where: mockOrgWhere,
      });

      // Mock member check (already exists)
      const mockMemberLimit = vi.fn().mockResolvedValue([
        { id: "member-123", userId: "user-456", organizationId: "org-789" },
      ]);
      const mockMemberWhere = vi.fn().mockReturnValue({
        limit: mockMemberLimit,
      });
      const mockMemberFrom = vi.fn().mockReturnValue({
        where: mockMemberWhere,
      });

      // Setup select mock to return different queries
      (db.select as any)
        .mockReturnValueOnce({ from: mockOrgFrom }) // First call: org lookup
        .mockReturnValueOnce({ from: mockMemberFrom }); // Second call: member check

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(db.insert).not.toHaveBeenCalled();
    });

    it("should handle signup API error", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "user@example.com");
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      const request = {
        formData: () => Promise.resolve(formData),
        url: "http://localhost/tenant/signup",
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue(null);

      (auth.api.signUpEmail as any).mockRejectedValue(
        new Error("Email already in use")
      );

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.form).toBe(
        "An error occurred during signup. Please try again."
      );
      expect(result.values?.name).toBe("John Doe");
      expect(result.values?.email).toBe("user@example.com");
    });

    it("should handle non-ok signup response", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "user@example.com");
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      const request = {
        formData: () => Promise.resolve(formData),
        url: "http://localhost/tenant/signup",
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue(null);

      const mockSignUpResponse = new Response(
        JSON.stringify({ message: "Email already exists" }),
        { status: 400 }
      );
      Object.defineProperty(mockSignUpResponse, "ok", { value: false });
      (auth.api.signUpEmail as any).mockResolvedValue(mockSignUpResponse);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.form).toBe("Email already exists");
      expect(result.values?.name).toBe("John Doe");
      expect(result.values?.email).toBe("user@example.com");
    });

    it("should trim name before signup", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "  John Doe  ");
      formData.append("email", "user@example.com");
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      const request = {
        formData: () => Promise.resolve(formData),
        url: "http://localhost/tenant/signup",
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue(null);

      const mockSignUpResponse = new Response(
        JSON.stringify({ user: { id: "user-123" } }),
        { status: 200 }
      );
      Object.defineProperty(mockSignUpResponse, "ok", { value: true });
      (auth.api.signUpEmail as any).mockResolvedValue(mockSignUpResponse);

      // Act
      await action({ request, params: {}, context: {} });

      // Assert
      expect(auth.api.signUpEmail).toHaveBeenCalledWith({
        body: {
          name: "John Doe", // Trimmed
          email: "user@example.com",
          password: "ValidPass123",
        },
        asResponse: true,
      });
    });

    it("should handle missing name field", async () => {
      // Arrange
      const formData = new FormData();
      // name not appended
      formData.append("email", "user@example.com");
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.name).toBe("Name must be at least 2 characters");
    });

    it("should handle whitespace-only name", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "   ");
      formData.append("email", "user@example.com");
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      const request = {
        formData: () => Promise.resolve(formData),
      } as Request;

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      expect(result.errors?.name).toBe("Name must be at least 2 characters");
    });

    it("should use custom redirectTo param", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "user@example.com");
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      formData.append("redirectTo", "/custom-page");
      const request = {
        formData: () => Promise.resolve(formData),
        url: "http://localhost/tenant/signup",
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue(null);

      const mockSignUpResponse = new Response(
        JSON.stringify({ user: { id: "user-123" } }),
        { status: 200 }
      );
      Object.defineProperty(mockSignUpResponse, "ok", { value: true });
      (auth.api.signUpEmail as any).mockResolvedValue(mockSignUpResponse);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      const response = result as Response;
      expect(response.headers.get("Location")).toBe("/custom-page");
    });

    it("should default redirectTo to /app if not provided", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "user@example.com");
      formData.append("password", "ValidPass123");
      formData.append("confirmPassword", "ValidPass123");
      // redirectTo not provided
      const request = {
        formData: () => Promise.resolve(formData),
        url: "http://localhost/tenant/signup",
      } as Request;

      (getSubdomainFromRequest as any).mockReturnValue(null);

      const mockSignUpResponse = new Response(
        JSON.stringify({ user: { id: "user-123" } }),
        { status: 200 }
      );
      Object.defineProperty(mockSignUpResponse, "ok", { value: true });
      (auth.api.signUpEmail as any).mockResolvedValue(mockSignUpResponse);

      // Act
      const result = await action({ request, params: {}, context: {} });

      // Assert
      const response = result as Response;
      expect(response.headers.get("Location")).toBe("/app");
    });

    it("should accept various valid email formats", async () => {
      const validEmails = [
        "user@example.com",
        "test.user@example.com",
        "user+tag@example.co.uk",
        "user123@sub.example.com",
      ];

      for (const email of validEmails) {
        // Arrange
        const formData = new FormData();
        formData.append("name", "John Doe");
        formData.append("email", email);
        formData.append("password", "ValidPass123");
        formData.append("confirmPassword", "ValidPass123");
        const request = {
          formData: () => Promise.resolve(formData),
          url: "http://localhost/tenant/signup",
        } as Request;

        (getSubdomainFromRequest as any).mockReturnValue(null);

        const mockSignUpResponse = new Response(
          JSON.stringify({ user: { id: "user-123" } }),
          { status: 200 }
        );
        Object.defineProperty(mockSignUpResponse, "ok", { value: true });
        (auth.api.signUpEmail as any).mockResolvedValue(mockSignUpResponse);

        // Act
        await action({ request, params: {}, context: {} });

        // Assert
        expect(auth.api.signUpEmail).toHaveBeenCalledWith({
          body: {
            name: "John Doe",
            email,
            password: "ValidPass123",
          },
          asResponse: true,
        });

        vi.clearAllMocks();
      }
    });

    it("should reject invalid email formats", async () => {
      const invalidEmails = ["notanemail", "user@", "user@domain", "@example.com"];

      for (const email of invalidEmails) {
        // Arrange
        const formData = new FormData();
        formData.append("name", "John Doe");
        formData.append("email", email);
        formData.append("password", "ValidPass123");
        formData.append("confirmPassword", "ValidPass123");
        const request = {
          formData: () => Promise.resolve(formData),
        } as Request;

        // Act
        const result = await action({ request, params: {}, context: {} });

        // Assert
        expect(result.errors?.email).toBe("Please enter a valid email address");
        expect(auth.api.signUpEmail).not.toHaveBeenCalled();

        vi.clearAllMocks();
      }
    });
  });
});

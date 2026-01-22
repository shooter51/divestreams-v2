/**
 * Site Account Layout Route Tests
 *
 * Tests the account layout with auth guard that protects account pages.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../app/routes/site/account/_layout";

// Mock customer auth
vi.mock("../../../../../lib/auth/customer-auth.server", () => ({
  getCustomerBySession: vi.fn(),
}));

// Import mocked module
import { getCustomerBySession } from "../../../../../lib/auth/customer-auth.server";

describe("Route: site/account/_layout.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    const mockCustomer = {
      id: "cust-123",
      organizationId: "org-123",
      email: "john@example.com",
      firstName: "John",
      lastName: "Doe",
      phone: "+1234567890",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    };

    it("should redirect to login when no session cookie", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/account");

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(302);
        expect(error.headers.get("Location")).toBe("/site/login?redirect=/site/account");
      }
    });

    it("should redirect to login when session cookie is empty", async () => {
      // Arrange
      const request = new Request("http://demo.localhost:5173/site/account", {
        headers: {
          Cookie: "customer_session=",
        },
      });

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.status).toBe(302);
        expect(error.headers.get("Location")).toBe("/site/login?redirect=/site/account");
      }
    });

    it("should redirect to login when getCustomerBySession returns null", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=invalid-token" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(null);

      // Act & Assert
      try {
        await loader({ request, params: {}, context: {} });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(getCustomerBySession).toHaveBeenCalledWith("invalid-token");
        expect(error.status).toBe(302);
        expect(error.headers.get("Location")).toBe("/site/login?redirect=/site/account");
      }
    });

    it("should return customer when valid session", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=valid-token-123" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getCustomerBySession).toHaveBeenCalledWith("valid-token-123");
      expect(result).toEqual({ customer: mockCustomer });
    });

    it("should parse session cookie from multiple cookies", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account",
        headers: {
          get: (name: string) =>
            name === "Cookie"
              ? "other_cookie=value1; customer_session=valid-token-456; another_cookie=value2"
              : null,
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getCustomerBySession).toHaveBeenCalledWith("valid-token-456");
      expect(result).toEqual({ customer: mockCustomer });
    });

    it("should handle cookie with equals sign in value", async () => {
      // Arrange
      const request = {
        url: "http://demo.localhost:5173/site/account",
        headers: {
          get: (name: string) => (name === "Cookie" ? "customer_session=token=with=equals" : null),
        },
      } as Request;
      (getCustomerBySession as any).mockResolvedValue(mockCustomer);

      // Act
      const result = await loader({ request, params: {}, context: {} });

      // Assert
      expect(getCustomerBySession).toHaveBeenCalledWith("token=with=equals");
      expect(result).toEqual({ customer: mockCustomer });
    });
  });
});

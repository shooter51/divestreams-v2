/**
 * Zapier Update Customer Action Tests
 *
 * Tests the action endpoint that updates customers via Zapier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../../../../app/routes/api/zapier/actions/update-customer";

// Mock modules
vi.mock("../../../../../../lib/integrations/zapier-enhanced.server", () => ({
  validateZapierApiKey: vi.fn(),
}));

vi.mock("../../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

// Import mocked modules
import { validateZapierApiKey } from "../../../../../../lib/integrations/zapier-enhanced.server";
import { db } from "../../../../../../lib/db";

describe("Route: api/zapier/actions/update-customer.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("action", () => {
    it("should return 405 for non-POST methods", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/actions/update-customer", {
        method: "GET",
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(405);
      expect(data).toEqual({ error: "Method not allowed" });
    });

    it("should return 401 when API key is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com", first_name: "John" }),
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "Missing API key. Provide X-API-Key header." });
      expect(validateZapierApiKey).not.toHaveBeenCalled();
    });

    it("should return 401 when API key is invalid", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "invalid-key",
        },
        body: JSON.stringify({ email: "test@example.com", first_name: "John" }),
      });
      (validateZapierApiKey as any).mockResolvedValue(null);

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(validateZapierApiKey).toHaveBeenCalledWith("invalid-key");
      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "Invalid API key" });
    });

    it("should return 400 when email is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "valid-key",
        },
        body: JSON.stringify({ first_name: "John" }), // Missing email
      });
      (validateZapierApiKey as any).mockResolvedValue("org-123");

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Missing required field: email" });
    });

    it("should return 404 when customer not found", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "valid-key",
        },
        body: JSON.stringify({ email: "nonexistent@example.com", first_name: "John" }),
      });
      (validateZapierApiKey as any).mockResolvedValue("org-456");
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // Customer not found
          }),
        }),
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "Customer not found with this email" });
    });

    it("should update customer with all fields", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "valid-key",
        },
        body: JSON.stringify({
          email: "existing@example.com",
          first_name: "Jane",
          last_name: "Smith",
          phone: "+1234567890",
          emergency_contact: "John Smith",
          emergency_phone: "+0987654321",
          certification_level: "Advanced Open Water",
          notes: "Prefers morning dives",
        }),
      });
      (validateZapierApiKey as any).mockResolvedValue("org-789");

      const mockCustomer = {
        id: "cust-123",
        email: "existing@example.com",
        firstName: "Jane",
        lastName: "Doe",
        certifications: [],
      };
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCustomer]),
          }),
        }),
      });

      const mockUpdated = {
        id: "cust-123",
        email: "existing@example.com",
        firstName: "Jane",
        lastName: "Smith",
        phone: "+1234567890",
        updatedAt: "2024-01-15T10:00:00Z",
      };
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdated]),
          }),
        }),
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: "cust-123",
        email: "existing@example.com",
        first_name: "Jane",
        last_name: "Smith",
        phone: "+1234567890",
        updated_at: "2024-01-15T10:00:00Z",
      });
    });

    it("should update customer with partial fields", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "valid-key",
        },
        body: JSON.stringify({
          email: "partial@example.com",
          phone: "+1111111111",
        }),
      });
      (validateZapierApiKey as any).mockResolvedValue("org-999");

      const mockCustomer = {
        id: "cust-456",
        email: "partial@example.com",
        firstName: "Bob",
        lastName: "Jones",
        certifications: null,
      };
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCustomer]),
          }),
        }),
      });

      const mockUpdated = {
        id: "cust-456",
        email: "partial@example.com",
        firstName: "Bob",
        lastName: "Jones",
        phone: "+1111111111",
        updatedAt: "2024-01-16T14:30:00Z",
      };
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdated]),
          }),
        }),
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: "cust-456",
        email: "partial@example.com",
        first_name: "Bob",
        last_name: "Jones",
        phone: "+1111111111",
        updated_at: "2024-01-16T14:30:00Z",
      });
    });

    it("should return 500 when database operation fails with Error", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "valid-key",
        },
        body: JSON.stringify({ email: "error@example.com", first_name: "Error" }),
      });
      (validateZapierApiKey as any).mockResolvedValue("org-111");
      (db.select as any).mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Database connection failed" });
    });

    it("should return 500 with generic error for non-Error exceptions", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/actions/update-customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "valid-key",
        },
        body: JSON.stringify({ email: "error@example.com", first_name: "Error" }),
      });
      (validateZapierApiKey as any).mockResolvedValue("org-222");
      (db.select as any).mockImplementation(() => {
        throw "String error";
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Failed to update customer" });
    });
  });
});

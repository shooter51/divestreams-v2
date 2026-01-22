/**
 * Zapier Create Booking Action Tests
 *
 * Tests the action endpoint that creates bookings via Zapier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../../../../app/routes/api/zapier/actions/create-booking";

// Mock modules
vi.mock("../../../../../../lib/integrations/zapier-enhanced.server", () => ({
  validateZapierApiKey: vi.fn(),
}));

vi.mock("../../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

// Import mocked modules
import { validateZapierApiKey } from "../../../../../../lib/integrations/zapier-enhanced.server";
import { db } from "../../../../../../lib/db";

describe("Route: api/zapier/actions/create-booking.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("action", () => {
    it("should return 405 for non-POST methods", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/actions/create-booking", {
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
      const request = new Request("http://test.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: "trip-123", customer_email: "test@example.com", participants: 2 }),
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
      const request = new Request("http://test.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "invalid-key",
        },
        body: JSON.stringify({ trip_id: "trip-123", customer_email: "test@example.com", participants: 2 }),
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

    it("should return 400 when required fields are missing", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "valid-key",
        },
        body: JSON.stringify({ trip_id: "trip-123" }), // Missing customer_email and participants
      });
      (validateZapierApiKey as any).mockResolvedValue("org-123");

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Missing required fields: trip_id, customer_email, participants" });
    });

    it("should return 404 when trip not found", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "valid-key",
        },
        body: JSON.stringify({
          trip_id: "trip-nonexistent",
          customer_email: "test@example.com",
          participants: 2,
        }),
      });
      (validateZapierApiKey as any).mockResolvedValue("org-456");
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // Trip not found
          }),
        }),
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "Trip not found" });
    });

    it("should create booking with existing customer", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "valid-key",
        },
        body: JSON.stringify({
          trip_id: "trip-789",
          customer_email: "existing@example.com",
          participants: 3,
          notes: "VIP customer",
        }),
      });
      (validateZapierApiKey as any).mockResolvedValue("org-789");

      // Mock trip found
      const mockTrip = { id: "trip-789", organizationId: "org-789", name: "Reef Dive" };
      // Mock existing customer found
      const mockCustomer = { id: "cust-123", email: "existing@example.com", organizationId: "org-789" };
      // Mock booking created
      const mockBooking = {
        id: "book-abc123",
        tripId: "trip-789",
        customerId: "cust-123",
        status: "pending",
        participants: 3,
        createdAt: "2024-01-15T10:00:00Z",
      };

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(
              selectCallCount++ === 0 ? [mockTrip] : [mockCustomer]
            ),
          }),
        }),
      }));

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockBooking]),
        }),
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: "book-abc123",
        booking_number: "BK-book-abc",
        trip_id: "trip-789",
        customer_id: "cust-123",
        status: "pending",
        participants: 3,
        created_at: "2024-01-15T10:00:00Z",
      });
    });

    it("should create booking with new customer", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "valid-key",
        },
        body: JSON.stringify({
          trip_id: "trip-999",
          customer_email: "new@example.com",
          customer_first_name: "John",
          customer_last_name: "Doe",
          customer_phone: "+1234567890",
          participants: 1,
        }),
      });
      (validateZapierApiKey as any).mockResolvedValue("org-999");

      // Mock trip found
      const mockTrip = { id: "trip-999", organizationId: "org-999", name: "Wreck Dive" };
      // Mock customer NOT found (empty array)
      const mockNewCustomer = {
        id: "cust-new456",
        email: "new@example.com",
        firstName: "John",
        lastName: "Doe",
        phone: "+1234567890",
      };
      // Mock booking created
      const mockBooking = {
        id: "book-xyz789",
        tripId: "trip-999",
        customerId: "cust-new456",
        status: "pending",
        participants: 1,
        createdAt: "2024-01-16T14:30:00Z",
      };

      let selectCallCount = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(
              selectCallCount++ === 0 ? [mockTrip] : [] // Trip found, customer not found
            ),
          }),
        }),
      }));

      let insertCallCount = 0;
      (db.insert as any).mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(
            insertCallCount++ === 0 ? [mockNewCustomer] : [mockBooking]
          ),
        }),
      }));

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: "book-xyz789",
        booking_number: "BK-book-xyz",
        trip_id: "trip-999",
        customer_id: "cust-new456",
        status: "pending",
        participants: 1,
        created_at: "2024-01-16T14:30:00Z",
      });
    });

    it("should return 500 when database operation fails with Error", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "valid-key",
        },
        body: JSON.stringify({
          trip_id: "trip-111",
          customer_email: "test@example.com",
          participants: 2,
        }),
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
      const request = new Request("http://test.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "valid-key",
        },
        body: JSON.stringify({
          trip_id: "trip-222",
          customer_email: "test@example.com",
          participants: 2,
        }),
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
      expect(data).toEqual({ error: "Failed to create booking" });
    });
  });
});

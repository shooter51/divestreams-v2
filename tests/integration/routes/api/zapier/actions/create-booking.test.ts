import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { action } from "../../../../../../app/routes/api/zapier/actions/create-booking";

/**
 * Integration tests for api/zapier/actions/create-booking route
 * Tests Zapier booking creation with validation and plan limits
 */

// Mock Zapier validation
vi.mock("../../../../../../lib/integrations/zapier-enhanced.server", () => ({
  validateZapierApiKey: vi.fn(),
}));

// Mock database
vi.mock("../../../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

// Mock plan features
vi.mock("../../../../../../lib/plan-features", () => ({
  DEFAULT_PLAN_LIMITS: {
    free: {
      toursPerMonth: 10,
    },
  },
}));

import { validateZapierApiKey } from "../../../../../../lib/integrations/zapier-enhanced.server";
import { db } from "../../../../../../lib/db";

describe("api/zapier/actions/create-booking route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/zapier/actions/create-booking", () => {
    it("returns 405 for non-POST requests", async () => {
      const request = new Request("https://divestreams.com/api/zapier/actions/create-booking", {
        method: "GET",
      });
      const response = await action({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(405);

      const data = await response.json();
      expect(data.error).toBe("Method not allowed");
    });

    it("returns 401 when X-API-Key header is missing", async () => {
      const request = new Request("https://divestreams.com/api/zapier/actions/create-booking", {
        method: "POST",
        body: JSON.stringify({
          trip_id: "trip-1",
          customer_email: "test@example.com",
          participants: 2,
        }),
      });
      const response = await action({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Missing API key. Provide X-API-Key header.");
    });

    it("returns 401 when API key is invalid", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue(null);

      const request = new Request("https://divestreams.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: { "x-api-key": "invalid-key" },
        body: JSON.stringify({
          trip_id: "trip-1",
          customer_email: "test@example.com",
          participants: 2,
        }),
      });
      const response = await action({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Invalid API key");
    });

    it("returns 400 when trip_id is missing", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          customer_email: "test@example.com",
          participants: 2,
        }),
      });
      const response = await action({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Missing required fields: trip_id, customer_email, participants");
    });

    it("returns 400 when customer_email is missing", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          trip_id: "trip-1",
          participants: 2,
        }),
      });
      const response = await action({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Missing required fields: trip_id, customer_email, participants");
    });

    it("returns 400 when participants is missing", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          trip_id: "trip-1",
          customer_email: "test@example.com",
        }),
      });
      const response = await action({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Missing required fields: trip_id, customer_email, participants");
    });

    it("returns 404 when trip not found", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      // Mock subscription check (premium plan to skip limits)
      const mockSubSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ plan: "premium", status: "active", planId: "plan-1" }]),
      };

      // Mock plan details check
      const mockPlanSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ monthlyPrice: 99, isActive: true }]),
      };

      // Mock trip query (not found)
      const mockTripSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      (db.select as Mock)
        .mockReturnValueOnce(mockSubSelect)
        .mockReturnValueOnce(mockPlanSelect)
        .mockReturnValueOnce(mockTripSelect);

      const request = new Request("https://divestreams.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          trip_id: "nonexistent-trip",
          customer_email: "test@example.com",
          participants: 2,
        }),
      });
      const response = await action({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe("Trip not found");
    });

    it("creates booking with existing customer", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      // Mock subscription (premium)
      const mockSubSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ plan: "premium", status: "active", planId: "plan-1" }]),
      };

      // Mock plan details
      const mockPlanSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ monthlyPrice: 99, isActive: true }]),
      };

      // Mock trip query
      const mockTripSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "trip-1", organizationId: "org-123" }]),
      };

      // Mock customer query (existing)
      const mockCustomerSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "cust-1", email: "existing@example.com" }]),
      };

      // Mock booking insert
      const mockBookingInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: "booking-abc123",
          tripId: "trip-1",
          customerId: "cust-1",
          participants: 2,
          status: "pending",
          createdAt: new Date("2024-01-15T10:00:00Z"),
        }]),
      };

      (db.select as Mock)
        .mockReturnValueOnce(mockSubSelect)
        .mockReturnValueOnce(mockPlanSelect)
        .mockReturnValueOnce(mockTripSelect)
        .mockReturnValueOnce(mockCustomerSelect);

      (db.insert as Mock).mockReturnValue(mockBookingInsert);

      const request = new Request("https://divestreams.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          trip_id: "trip-1",
          customer_email: "existing@example.com",
          participants: 2,
          notes: "Test booking",
        }),
      });
      const response = await action({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe("booking-abc123");
      expect(data.trip_id).toBe("trip-1");
      expect(data.customer_id).toBe("cust-1");
      expect(data.status).toBe("pending");
      expect(data.participants).toBe(2);
    });

    it("creates booking and new customer when customer does not exist", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      // Mock subscription (premium)
      const mockSubSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ plan: "premium", status: "active", planId: "plan-1" }]),
      };

      const mockPlanSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ monthlyPrice: 99, isActive: true }]),
      };

      const mockTripSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "trip-1", organizationId: "org-123" }]),
      };

      // Mock customer query (not found)
      const mockCustomerSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      // Mock customer insert
      const mockCustomerInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: "new-cust-1",
          email: "new@example.com",
          firstName: "Jane",
          lastName: "Doe",
        }]),
      };

      // Mock booking insert
      const mockBookingInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: "booking-xyz789",
          tripId: "trip-1",
          customerId: "new-cust-1",
          participants: 3,
          status: "pending",
          createdAt: new Date("2024-01-15T10:00:00Z"),
        }]),
      };

      (db.select as Mock)
        .mockReturnValueOnce(mockSubSelect)
        .mockReturnValueOnce(mockPlanSelect)
        .mockReturnValueOnce(mockTripSelect)
        .mockReturnValueOnce(mockCustomerSelect);

      (db.insert as Mock)
        .mockReturnValueOnce(mockCustomerInsert)
        .mockReturnValueOnce(mockBookingInsert);

      const request = new Request("https://divestreams.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          trip_id: "trip-1",
          customer_email: "new@example.com",
          customer_first_name: "Jane",
          customer_last_name: "Doe",
          customer_phone: "+1234567890",
          participants: 3,
        }),
      });
      const response = await action({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe("booking-xyz789");
      expect(data.customer_id).toBe("new-cust-1");
      expect(data.participants).toBe(3);
    });

    it("returns 403 when free plan booking limit is reached", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      // Mock subscription (free plan)
      const mockSubSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ plan: "free", status: "active", planId: null }]),
      };

      // Mock plan query (free plan with limits)
      const mockPlanSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          monthlyPrice: 0,
          isActive: true,
          limits: { toursPerMonth: 10 },
        }]),
      };

      // Mock booking count (at limit) - returns count result directly
      const mockCountQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 10 }]),
      };

      (db.select as Mock)
        .mockReturnValueOnce(mockSubSelect)
        .mockReturnValueOnce(mockPlanSelect)
        .mockReturnValueOnce(mockCountQuery);

      const request = new Request("https://divestreams.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          trip_id: "trip-1",
          customer_email: "test@example.com",
          participants: 2,
        }),
      });
      const response = await action({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toContain("Booking limit reached");
      expect(data.error).toContain("Upgrade to premium");
    });

    it("includes booking_number in response", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const mockSubSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ plan: "premium", status: "active", planId: "plan-1" }]),
      };

      const mockPlanSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ monthlyPrice: 99, isActive: true }]),
      };

      const mockTripSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "trip-1", organizationId: "org-123" }]),
      };

      const mockCustomerSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "cust-1", email: "test@example.com" }]),
      };

      const mockBookingInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: "booking-abcd1234efgh5678",
          tripId: "trip-1",
          customerId: "cust-1",
          participants: 1,
          status: "pending",
          createdAt: new Date(),
        }]),
      };

      (db.select as Mock)
        .mockReturnValueOnce(mockSubSelect)
        .mockReturnValueOnce(mockPlanSelect)
        .mockReturnValueOnce(mockTripSelect)
        .mockReturnValueOnce(mockCustomerSelect);

      (db.insert as Mock).mockReturnValue(mockBookingInsert);

      const request = new Request("https://divestreams.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          trip_id: "trip-1",
          customer_email: "test@example.com",
          participants: 1,
        }),
      });
      const response = await action({ request, params: {}, context: {} } as unknown);

      const data = await response.json();
      expect(data.booking_number).toBe("BK-booking-");
      expect(data.created_at).toBeDefined();
    });
  });
});

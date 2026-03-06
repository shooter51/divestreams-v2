import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { action } from "../../../../../../app/routes/api/zapier/actions/create-booking";

/**
 * Integration tests for api/zapier/actions/create-booking route
 * Tests Zapier booking creation with validation, plan limits, capacity checks
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

// Mock rate limiting to avoid Redis dependency in unit tests
vi.mock("../../../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 }),
}));

// Mock getNextBookingNumber to return a sequential number without hitting DB
vi.mock("../../../../../../lib/db/queries/bookings.server", () => ({
  getNextBookingNumber: vi.fn().mockResolvedValue("BK-1000"),
}));

import { validateZapierApiKey } from "../../../../../../lib/integrations/zapier-enhanced.server";
import { db } from "../../../../../../lib/db";

/** Helper: creates a mock for premium subscription check (2 selects) */
function mockPremiumSubscription() {
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
  return [mockSubSelect, mockPlanSelect];
}

/** Helper: creates a mock for trip query (now uses innerJoin) */
function mockTripQuery(tripData: Record<string, unknown> | null) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(tripData ? [tripData] : []),
  };
}

/** Helper: creates a mock for capacity check */
function mockCapacityCheck(bookedTotal: number) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ total: bookedTotal }]),
  };
}

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

      const [mockSubSelect, mockPlanSelect] = mockPremiumSubscription();
      (db.select as Mock)
        .mockReturnValueOnce(mockSubSelect)
        .mockReturnValueOnce(mockPlanSelect);

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

      const [mockSubSelect, mockPlanSelect] = mockPremiumSubscription();
      (db.select as Mock)
        .mockReturnValueOnce(mockSubSelect)
        .mockReturnValueOnce(mockPlanSelect);

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

      const [mockSubSelect, mockPlanSelect] = mockPremiumSubscription();
      (db.select as Mock)
        .mockReturnValueOnce(mockSubSelect)
        .mockReturnValueOnce(mockPlanSelect);

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

      const [mockSubSelect, mockPlanSelect] = mockPremiumSubscription();

      (db.select as Mock)
        .mockReturnValueOnce(mockSubSelect)
        .mockReturnValueOnce(mockPlanSelect)
        .mockReturnValueOnce(mockTripQuery(null));

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

      const [mockSubSelect, mockPlanSelect] = mockPremiumSubscription();

      const mockCustomerSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "cust-1", email: "existing@example.com" }]),
      };

      const mockBookingInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: "booking-abc123",
          bookingNumber: "BK-1000",
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
        .mockReturnValueOnce(mockTripQuery({
          id: "trip-1",
          tripPrice: "50.00",
          tourPrice: "50.00",
          currency: "USD",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
        }))
        .mockReturnValueOnce(mockCapacityCheck(2))
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

      const [mockSubSelect, mockPlanSelect] = mockPremiumSubscription();

      const mockCustomerSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      const mockCustomerInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: "new-cust-1",
          email: "new@example.com",
          firstName: "Jane",
          lastName: "Doe",
        }]),
      };

      const mockBookingInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: "booking-xyz789",
          bookingNumber: "BK-1000",
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
        .mockReturnValueOnce(mockTripQuery({
          id: "trip-1",
          tripPrice: "75.00",
          tourPrice: "75.00",
          currency: "USD",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
        }))
        .mockReturnValueOnce(mockCapacityCheck(0))
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

      const mockSubSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ plan: "free", status: "active", planId: null }]),
      };

      const mockPlanSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          monthlyPrice: 0,
          isActive: true,
          limits: { toursPerMonth: 10 },
        }]),
      };

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

      const [mockSubSelect, mockPlanSelect] = mockPremiumSubscription();

      const mockCustomerSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "cust-1", email: "test@example.com" }]),
      };

      const mockBookingInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{
          id: "booking-abcd1234efgh5678",
          bookingNumber: "BK-1000",
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
        .mockReturnValueOnce(mockTripQuery({
          id: "trip-1",
          tripPrice: "100.00",
          tourPrice: "100.00",
          currency: "USD",
          tripMaxParticipants: 10,
          tourMaxParticipants: 10,
        }))
        .mockReturnValueOnce(mockCapacityCheck(0))
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
      expect(data.booking_number).toMatch(/^BK-\d+$/);
      expect(data.created_at).toBeDefined();
    });

    it("returns 409 when trip is at capacity (DS-260b)", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const [mockSubSelect, mockPlanSelect] = mockPremiumSubscription();

      (db.select as Mock)
        .mockReturnValueOnce(mockSubSelect)
        .mockReturnValueOnce(mockPlanSelect)
        .mockReturnValueOnce(mockTripQuery({
          id: "trip-1",
          tripPrice: "50.00",
          tourPrice: "50.00",
          currency: "USD",
          tripMaxParticipants: 6,
          tourMaxParticipants: 6,
        }))
        .mockReturnValueOnce(mockCapacityCheck(5));

      const request = new Request("https://divestreams.com/api/zapier/actions/create-booking", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          trip_id: "trip-1",
          customer_email: "test@example.com",
          participants: 3,
        }),
      });
      const response = await action({ request, params: {}, context: {} } as unknown);

      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data.error).toContain("Only 1 spots available");
    });
  });
});

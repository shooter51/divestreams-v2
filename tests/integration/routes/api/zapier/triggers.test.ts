import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../../app/routes/api/zapier/triggers";

/**
 * Integration tests for api/zapier/triggers route
 * Tests Zapier trigger discovery and sample data
 */

// Mock Zapier validation
vi.mock("../../../../../lib/integrations/zapier-enhanced.server", () => ({
  validateZapierApiKey: vi.fn(),
}));

// Mock Zapier triggers
vi.mock("../../../../../lib/integrations/zapier.server", () => ({
  ZAPIER_TRIGGERS: ["booking.created", "customer.created", "trip.scheduled"],
  ZAPIER_TRIGGER_DESCRIPTIONS: {
    "booking.created": "Triggered when a new booking is created",
    "customer.created": "Triggered when a new customer is added",
    "trip.scheduled": "Triggered when a new trip is scheduled",
  },
  getSampleTriggerData: vi.fn((trigger) => {
    const samples: Record<string, any> = {
      "booking.created": {
        id: 123,
        booking_number: "BK001",
        customer_id: 1,
        trip_id: 5,
        participants: 2,
        total: 300.0,
        status: "confirmed",
      },
      "customer.created": {
        id: 1,
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
      },
      "trip.scheduled": {
        id: 5,
        tour_id: 10,
        date: "2024-12-25",
        time: "14:00:00",
        available_spots: 8,
        status: "scheduled",
      },
    };
    return samples[trigger];
  }),
}));

import { validateZapierApiKey } from "../../../../../lib/integrations/zapier-enhanced.server";
import { getSampleTriggerData } from "../../../../../lib/integrations/zapier.server";

describe("api/zapier/triggers route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/zapier/triggers", () => {
    it("returns 401 when X-API-Key header is missing", async () => {
      const request = new Request("https://divestreams.com/api/zapier/triggers");
      const response = await loader({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Missing API key. Provide X-API-Key header.");
    });

    it("returns 401 when API key is invalid", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue(null);

      const request = new Request("https://divestreams.com/api/zapier/triggers", {
        headers: { "x-api-key": "invalid-key" },
      });
      const response = await loader({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Invalid API key");
    });

    it("returns 200 with list of triggers when API key is valid", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/triggers", {
        headers: { "x-api-key": "valid-key" },
      });
      const response = await loader({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.triggers).toBeInstanceOf(Array);
      expect(data.count).toBe(3);
    });

    it("includes trigger details with key, name, description, and sample", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/triggers", {
        headers: { "x-api-key": "valid-key" },
      });
      const response = await loader({ request, params: {}, context: {} } as any);

      const data = await response.json();
      const trigger = data.triggers[0];

      expect(trigger).toHaveProperty("key");
      expect(trigger).toHaveProperty("name");
      expect(trigger).toHaveProperty("description");
      expect(trigger).toHaveProperty("sample");
    });

    it("formats trigger key into human-readable name", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/triggers", {
        headers: { "x-api-key": "valid-key" },
      });
      const response = await loader({ request, params: {}, context: {} } as any);

      const data = await response.json();
      const bookingTrigger = data.triggers.find((t: any) => t.key === "booking.created");

      expect(bookingTrigger.name).toBe("Booking Created");
    });

    it("includes sample data for each trigger", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/triggers", {
        headers: { "x-api-key": "valid-key" },
      });
      const response = await loader({ request, params: {}, context: {} } as any);

      const data = await response.json();
      const bookingTrigger = data.triggers.find((t: any) => t.key === "booking.created");

      expect(bookingTrigger.sample).toBeDefined();
      expect(bookingTrigger.sample).toHaveProperty("id");
      expect(bookingTrigger.sample).toHaveProperty("booking_number");
    });

    it("includes descriptions from ZAPIER_TRIGGER_DESCRIPTIONS", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/triggers", {
        headers: { "x-api-key": "valid-key" },
      });
      const response = await loader({ request, params: {}, context: {} } as any);

      const data = await response.json();
      const bookingTrigger = data.triggers.find((t: any) => t.key === "booking.created");

      expect(bookingTrigger.description).toBe("Triggered when a new booking is created");
    });

    it("calls getSampleTriggerData for each trigger", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/triggers", {
        headers: { "x-api-key": "valid-key" },
      });
      await loader({ request, params: {}, context: {} } as any);

      expect(getSampleTriggerData).toHaveBeenCalledWith("booking.created");
      expect(getSampleTriggerData).toHaveBeenCalledWith("customer.created");
      expect(getSampleTriggerData).toHaveBeenCalledWith("trip.scheduled");
    });

    it("returns count matching number of triggers", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/triggers", {
        headers: { "x-api-key": "valid-key" },
      });
      const response = await loader({ request, params: {}, context: {} } as any);

      const data = await response.json();
      expect(data.count).toBe(data.triggers.length);
    });

    it("validates API key before returning triggers", async () => {
      const validateMock = vi.fn().mockResolvedValue("org-123");
      (validateZapierApiKey as Mock).mockImplementation(validateMock);

      const request = new Request("https://divestreams.com/api/zapier/triggers", {
        headers: { "x-api-key": "test-key-456" },
      });
      await loader({ request, params: {}, context: {} } as any);

      expect(validateMock).toHaveBeenCalledWith("test-key-456");
    });

    it("includes all three triggers in response", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/triggers", {
        headers: { "x-api-key": "valid-key" },
      });
      const response = await loader({ request, params: {}, context: {} } as any);

      const data = await response.json();
      const triggerKeys = data.triggers.map((t: any) => t.key);

      expect(triggerKeys).toContain("booking.created");
      expect(triggerKeys).toContain("customer.created");
      expect(triggerKeys).toContain("trip.scheduled");
    });
  });
});

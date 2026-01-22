/**
 * Zapier Triggers Route Tests
 *
 * Tests the triggers list endpoint that provides available triggers and sample data.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../../../../../app/routes/api/zapier/triggers";

// Mock modules
vi.mock("../../../../../lib/integrations/zapier.server", () => ({
  ZAPIER_TRIGGERS: ["new.booking", "booking.confirmed", "customer.created"],
  ZAPIER_TRIGGER_DESCRIPTIONS: {
    "new.booking": "Triggers when a new booking is created",
    "booking.confirmed": "Triggers when a booking is confirmed",
    "customer.created": "Triggers when a new customer is added",
  },
  getSampleTriggerData: vi.fn((trigger: string) => {
    const samples: Record<string, any> = {
      "new.booking": { id: "book-123", customer: "John Doe", date: "2024-01-15" },
      "booking.confirmed": { id: "book-456", status: "confirmed" },
      "customer.created": { id: "cust-789", name: "Jane Smith", email: "jane@example.com" },
    };
    return samples[trigger] || {};
  }),
}));

vi.mock("../../../../../lib/integrations/zapier-enhanced.server", () => ({
  validateZapierApiKey: vi.fn(),
}));

// Import mocked modules
import { validateZapierApiKey } from "../../../../../lib/integrations/zapier-enhanced.server";
import {
  ZAPIER_TRIGGERS,
  ZAPIER_TRIGGER_DESCRIPTIONS,
  getSampleTriggerData,
} from "../../../../../lib/integrations/zapier.server";

describe("Route: api/zapier/triggers.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("should return 401 when API key is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/triggers");

      // Act
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "Missing API key. Provide X-API-Key header." });
      expect(validateZapierApiKey).not.toHaveBeenCalled();
    });

    it("should return 401 when API key is invalid", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/triggers", {
        headers: {
          "x-api-key": "invalid-key",
        },
      });
      (validateZapierApiKey as any).mockResolvedValue(null);

      // Act
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(validateZapierApiKey).toHaveBeenCalledWith("invalid-key");
      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "Invalid API key" });
    });

    it("should return list of triggers with sample data", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/triggers", {
        headers: {
          "x-api-key": "valid-key",
        },
      });
      (validateZapierApiKey as any).mockResolvedValue("org-123");

      // Act
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(validateZapierApiKey).toHaveBeenCalledWith("valid-key");
      expect(response.status).toBe(200);
      expect(data.count).toBe(3);
      expect(data.triggers).toHaveLength(3);

      // Verify first trigger
      expect(data.triggers[0]).toEqual({
        key: "new.booking",
        name: "New Booking",
        description: "Triggers when a new booking is created",
        sample: { id: "book-123", customer: "John Doe", date: "2024-01-15" },
      });

      // Verify second trigger
      expect(data.triggers[1]).toEqual({
        key: "booking.confirmed",
        name: "Booking Confirmed",
        description: "Triggers when a booking is confirmed",
        sample: { id: "book-456", status: "confirmed" },
      });

      // Verify third trigger
      expect(data.triggers[2]).toEqual({
        key: "customer.created",
        name: "Customer Created",
        description: "Triggers when a new customer is added",
        sample: { id: "cust-789", name: "Jane Smith", email: "jane@example.com" },
      });

      // Verify getSampleTriggerData was called for each trigger
      expect(getSampleTriggerData).toHaveBeenCalledTimes(3);
      expect(getSampleTriggerData).toHaveBeenCalledWith("new.booking");
      expect(getSampleTriggerData).toHaveBeenCalledWith("booking.confirmed");
      expect(getSampleTriggerData).toHaveBeenCalledWith("customer.created");
    });
  });
});

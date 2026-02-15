import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { action } from "../../../../../app/routes/api/zapier/subscribe";

/**
 * Integration tests for api/zapier/subscribe route
 * Tests Zapier webhook subscription and unsubscription (REST Hooks pattern)
 */

// Mock Zapier functions
vi.mock("../../../../../lib/integrations/zapier-enhanced.server", () => ({
  validateZapierApiKey: vi.fn(),
  subscribeWebhook: vi.fn(),
  unsubscribeWebhook: vi.fn(),
}));

import {
  validateZapierApiKey,
  subscribeWebhook,
  unsubscribeWebhook,
} from "../../../../../lib/integrations/zapier-enhanced.server";

describe("api/zapier/subscribe route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/zapier/subscribe", () => {
    it("returns 401 when X-API-Key header is missing", async () => {
      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "POST",
        body: JSON.stringify({ event_type: "booking.created", target_url: "https://hooks.zapier.com/123" }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Missing API key. Provide X-API-Key header.");
    });

    it("returns 401 when API key is invalid", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue(null);

      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "POST",
        headers: { "x-api-key": "invalid-key" },
        body: JSON.stringify({ event_type: "booking.created", target_url: "https://hooks.zapier.com/123" }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Invalid API key");
    });

    it("returns 400 when event_type is missing", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({ target_url: "https://hooks.zapier.com/123" }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Missing required fields: event_type, target_url");
    });

    it("returns 400 when target_url is missing", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({ event_type: "booking.created" }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Missing required fields: event_type, target_url");
    });

    it("creates subscription and returns subscription details", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");
      (subscribeWebhook as Mock).mockResolvedValue({
        id: "sub-xyz",
        eventType: "booking.created",
        targetUrl: "https://hooks.zapier.com/123",
        createdAt: new Date("2024-01-15T10:00:00Z"),
      });

      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          event_type: "booking.created",
          target_url: "https://hooks.zapier.com/123",
        }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.id).toBe("sub-xyz");
      expect(data.event_type).toBe("booking.created");
      expect(data.target_url).toBe("https://hooks.zapier.com/123");
      expect(data.created_at).toBeDefined();
    });

    it("calls subscribeWebhook with correct parameters", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-abc");
      (subscribeWebhook as Mock).mockResolvedValue({
        id: "sub-1",
        eventType: "customer.created",
        targetUrl: "https://hooks.zapier.com/456",
        createdAt: new Date(),
      });

      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "POST",
        headers: { "x-api-key": "test-key" },
        body: JSON.stringify({
          event_type: "customer.created",
          target_url: "https://hooks.zapier.com/456",
        }),
      });
      await action({ request, params: {}, context: {} } as any);

      expect(subscribeWebhook).toHaveBeenCalledWith(
        "org-abc",
        "customer.created",
        "https://hooks.zapier.com/456"
      );
    });

    it("returns 500 when subscription fails", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");
      (subscribeWebhook as Mock).mockRejectedValue(new Error("Database error"));

      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({
          event_type: "booking.created",
          target_url: "https://hooks.zapier.com/123",
        }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe("Database error");
    });
  });

  describe("DELETE /api/zapier/subscribe", () => {
    it("returns 401 when X-API-Key header is missing", async () => {
      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "DELETE",
        body: JSON.stringify({ target_url: "https://hooks.zapier.com/123" }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Missing API key. Provide X-API-Key header.");
    });

    it("returns 401 when API key is invalid", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue(null);

      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "DELETE",
        headers: { "x-api-key": "invalid-key" },
        body: JSON.stringify({ target_url: "https://hooks.zapier.com/123" }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe("Invalid API key");
    });

    it("returns 400 when target_url is missing", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "DELETE",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({}),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Missing required field: target_url");
    });

    it("returns success when unsubscription succeeds", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");
      (unsubscribeWebhook as Mock).mockResolvedValue(true);

      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "DELETE",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({ target_url: "https://hooks.zapier.com/123" }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it("calls unsubscribeWebhook with correct parameters", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-xyz");
      (unsubscribeWebhook as Mock).mockResolvedValue(true);

      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "DELETE",
        headers: { "x-api-key": "test-key" },
        body: JSON.stringify({
          target_url: "https://hooks.zapier.com/789",
          event_type: "trip.scheduled",
        }),
      });
      await action({ request, params: {}, context: {} } as any);

      expect(unsubscribeWebhook).toHaveBeenCalledWith(
        "org-xyz",
        "https://hooks.zapier.com/789",
        "trip.scheduled"
      );
    });

    it("returns 404 when subscription not found", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");
      (unsubscribeWebhook as Mock).mockResolvedValue(false);

      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "DELETE",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({ target_url: "https://hooks.zapier.com/nonexistent" }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe("Subscription not found");
    });

    it("returns 500 when unsubscription fails with error", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");
      (unsubscribeWebhook as Mock).mockRejectedValue(new Error("Database connection lost"));

      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "DELETE",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({ target_url: "https://hooks.zapier.com/123" }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe("Database connection lost");
    });
  });

  describe("Unsupported methods", () => {
    it("returns 405 for GET requests", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "GET",
        headers: { "x-api-key": "valid-key" },
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(405);

      const data = await response.json();
      expect(data.error).toBe("Method not allowed");
    });

    it("returns 405 for PUT requests", async () => {
      (validateZapierApiKey as Mock).mockResolvedValue("org-123");

      const request = new Request("https://divestreams.com/api/zapier/subscribe", {
        method: "PUT",
        headers: { "x-api-key": "valid-key" },
        body: JSON.stringify({ event_type: "booking.created", target_url: "https://hooks.zapier.com/123" }),
      });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(405);

      const data = await response.json();
      expect(data.error).toBe("Method not allowed");
    });
  });
});

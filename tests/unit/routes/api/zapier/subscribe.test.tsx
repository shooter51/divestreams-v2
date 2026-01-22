/**
 * Zapier Subscribe Route Tests
 *
 * Tests the webhook subscription endpoint for Zapier instant triggers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../../../app/routes/api/zapier/subscribe";

// Mock modules
vi.mock("../../../../../lib/integrations/zapier-enhanced.server", () => ({
  validateZapierApiKey: vi.fn(),
  subscribeWebhook: vi.fn(),
  unsubscribeWebhook: vi.fn(),
}));

// Import mocked modules
import {
  validateZapierApiKey,
  subscribeWebhook,
  unsubscribeWebhook,
} from "../../../../../lib/integrations/zapier-enhanced.server";

describe("Route: api/zapier/subscribe.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("action", () => {
    it("should return 401 when API key is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "new_booking", target_url: "https://hooks.zapier.com/123" }),
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
      const request = new Request("http://test.com/api/zapier/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "invalid-key",
        },
        body: JSON.stringify({ event_type: "new_booking", target_url: "https://hooks.zapier.com/123" }),
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

    describe("POST - Subscribe", () => {
      it("should return 400 when event_type is missing", async () => {
        // Arrange
        const request = new Request("http://test.com/api/zapier/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "valid-key",
          },
          body: JSON.stringify({ target_url: "https://hooks.zapier.com/123" }),
        });
        (validateZapierApiKey as any).mockResolvedValue("org-123");

        // Act
        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(data).toEqual({ error: "Missing required fields: event_type, target_url" });
      });

      it("should return 400 when target_url is missing", async () => {
        // Arrange
        const request = new Request("http://test.com/api/zapier/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "valid-key",
          },
          body: JSON.stringify({ event_type: "new_booking" }),
        });
        (validateZapierApiKey as any).mockResolvedValue("org-123");

        // Act
        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(data).toEqual({ error: "Missing required fields: event_type, target_url" });
      });

      it("should create subscription and return details", async () => {
        // Arrange
        const request = new Request("http://test.com/api/zapier/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "valid-key",
          },
          body: JSON.stringify({
            event_type: "new_booking",
            target_url: "https://hooks.zapier.com/123",
          }),
        });
        (validateZapierApiKey as any).mockResolvedValue("org-456");
        (subscribeWebhook as any).mockResolvedValue({
          id: "sub-123",
          eventType: "new_booking",
          targetUrl: "https://hooks.zapier.com/123",
          createdAt: "2024-01-01T00:00:00Z",
        });

        // Act
        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        // Assert
        expect(subscribeWebhook).toHaveBeenCalledWith("org-456", "new_booking", "https://hooks.zapier.com/123");
        expect(response.status).toBe(200);
        expect(data).toEqual({
          id: "sub-123",
          event_type: "new_booking",
          target_url: "https://hooks.zapier.com/123",
          created_at: "2024-01-01T00:00:00Z",
        });
      });

      it("should return 500 when subscription fails with Error", async () => {
        // Arrange
        const request = new Request("http://test.com/api/zapier/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "valid-key",
          },
          body: JSON.stringify({
            event_type: "new_booking",
            target_url: "https://hooks.zapier.com/123",
          }),
        });
        (validateZapierApiKey as any).mockResolvedValue("org-789");
        (subscribeWebhook as any).mockRejectedValue(new Error("Database connection failed"));

        // Act
        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(500);
        expect(data).toEqual({ error: "Database connection failed" });
      });

      it("should return 500 with generic error for non-Error exceptions", async () => {
        // Arrange
        const request = new Request("http://test.com/api/zapier/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "valid-key",
          },
          body: JSON.stringify({
            event_type: "new_booking",
            target_url: "https://hooks.zapier.com/123",
          }),
        });
        (validateZapierApiKey as any).mockResolvedValue("org-999");
        (subscribeWebhook as any).mockRejectedValue("String error");

        // Act
        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(500);
        expect(data).toEqual({ error: "Failed to subscribe" });
      });
    });

    describe("DELETE - Unsubscribe", () => {
      it("should return 400 when target_url is missing", async () => {
        // Arrange
        const request = new Request("http://test.com/api/zapier/subscribe", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "valid-key",
          },
          body: JSON.stringify({ event_type: "new_booking" }),
        });
        (validateZapierApiKey as any).mockResolvedValue("org-123");

        // Act
        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(400);
        expect(data).toEqual({ error: "Missing required field: target_url" });
      });

      it("should unsubscribe and return success", async () => {
        // Arrange
        const request = new Request("http://test.com/api/zapier/subscribe", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "valid-key",
          },
          body: JSON.stringify({
            target_url: "https://hooks.zapier.com/123",
            event_type: "new_booking",
          }),
        });
        (validateZapierApiKey as any).mockResolvedValue("org-456");
        (unsubscribeWebhook as any).mockResolvedValue(true);

        // Act
        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        // Assert
        expect(unsubscribeWebhook).toHaveBeenCalledWith("org-456", "https://hooks.zapier.com/123", "new_booking");
        expect(response.status).toBe(200);
        expect(data).toEqual({ success: true });
      });

      it("should return 404 when subscription not found", async () => {
        // Arrange
        const request = new Request("http://test.com/api/zapier/subscribe", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "valid-key",
          },
          body: JSON.stringify({
            target_url: "https://hooks.zapier.com/999",
          }),
        });
        (validateZapierApiKey as any).mockResolvedValue("org-789");
        (unsubscribeWebhook as any).mockResolvedValue(false);

        // Act
        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(404);
        expect(data).toEqual({ error: "Subscription not found" });
      });

      it("should return 500 when unsubscribe fails with Error", async () => {
        // Arrange
        const request = new Request("http://test.com/api/zapier/subscribe", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "valid-key",
          },
          body: JSON.stringify({
            target_url: "https://hooks.zapier.com/123",
          }),
        });
        (validateZapierApiKey as any).mockResolvedValue("org-111");
        (unsubscribeWebhook as any).mockRejectedValue(new Error("Database error"));

        // Act
        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(500);
        expect(data).toEqual({ error: "Database error" });
      });

      it("should return 500 with generic error for non-Error exceptions", async () => {
        // Arrange
        const request = new Request("http://test.com/api/zapier/subscribe", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "valid-key",
          },
          body: JSON.stringify({
            target_url: "https://hooks.zapier.com/123",
          }),
        });
        (validateZapierApiKey as any).mockResolvedValue("org-222");
        (unsubscribeWebhook as any).mockRejectedValue("String error");

        // Act
        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        // Assert
        expect(response.status).toBe(500);
        expect(data).toEqual({ error: "Failed to unsubscribe" });
      });
    });

    it("should return 405 for unsupported methods", async () => {
      // Arrange
      const request = new Request("http://test.com/api/zapier/subscribe", {
        method: "GET",
        headers: {
          "x-api-key": "valid-key",
        },
      });
      (validateZapierApiKey as any).mockResolvedValue("org-123");

      // Act
      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(405);
      expect(data).toEqual({ error: "Method not allowed" });
    });
  });
});

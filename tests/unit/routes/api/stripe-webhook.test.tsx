/**
 * Stripe Webhook Route Tests
 *
 * Tests the webhook handler that processes Stripe events.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../../../../app/routes/api/stripe-webhook";

// Mock modules
vi.mock("../../../../lib/stripe/webhook.server", () => ({
  handleStripeWebhook: vi.fn(),
}));

// Import mocked modules
import { handleStripeWebhook } from "../../../../lib/stripe/webhook.server";

describe("Route: api/stripe-webhook.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("action", () => {
    it("should return 405 for non-POST methods", async () => {
      // Arrange
      const request = new Request("http://test.com/api/stripe-webhook", {
        method: "GET",
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const text = await response.text();

      // Assert
      expect(response.status).toBe(405);
      expect(text).toBe("Method not allowed");
    });

    it("should return 400 when signature is missing", async () => {
      // Arrange
      const request = new Request("http://test.com/api/stripe-webhook", {
        method: "POST",
        body: JSON.stringify({ type: "test.event" }),
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const text = await response.text();

      // Assert
      expect(response.status).toBe(400);
      expect(text).toBe("No signature");
      expect(handleStripeWebhook).not.toHaveBeenCalled();
    });

    it("should return 200 on successful webhook processing", async () => {
      // Arrange
      const webhookPayload = JSON.stringify({
        id: "evt_test123",
        type: "customer.subscription.created",
        data: { object: {} },
      });
      const request = new Request("http://test.com/api/stripe-webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "t=1234567890,v1=signature_hash",
        },
        body: webhookPayload,
      });
      (handleStripeWebhook as any).mockResolvedValue({
        success: true,
        message: "Webhook processed successfully",
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const text = await response.text();

      // Assert
      expect(handleStripeWebhook).toHaveBeenCalledWith(
        webhookPayload,
        "t=1234567890,v1=signature_hash"
      );
      expect(response.status).toBe(200);
      expect(text).toBe("Webhook processed successfully");
    });

    it("should return 400 when webhook processing fails", async () => {
      // Arrange
      const webhookPayload = JSON.stringify({
        id: "evt_test456",
        type: "charge.failed",
        data: { object: {} },
      });
      const request = new Request("http://test.com/api/stripe-webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "t=9876543210,v1=another_signature",
        },
        body: webhookPayload,
      });
      (handleStripeWebhook as any).mockResolvedValue({
        success: false,
        message: "Invalid signature",
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const text = await response.text();

      // Assert
      expect(handleStripeWebhook).toHaveBeenCalledWith(
        webhookPayload,
        "t=9876543210,v1=another_signature"
      );
      expect(response.status).toBe(400);
      expect(text).toBe("Invalid signature");
    });

    it("should handle different webhook event types", async () => {
      // Arrange
      const webhookPayload = JSON.stringify({
        id: "evt_test789",
        type: "payment_intent.succeeded",
        data: { object: { amount: 5000 } },
      });
      const request = new Request("http://test.com/api/stripe-webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "t=1111111111,v1=valid_signature",
        },
        body: webhookPayload,
      });
      (handleStripeWebhook as any).mockResolvedValue({
        success: true,
        message: "Payment intent processed",
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const text = await response.text();

      // Assert
      expect(handleStripeWebhook).toHaveBeenCalledWith(
        webhookPayload,
        "t=1111111111,v1=valid_signature"
      );
      expect(response.status).toBe(200);
      expect(text).toBe("Payment intent processed");
    });

    it("should handle empty request body", async () => {
      // Arrange
      const request = new Request("http://test.com/api/stripe-webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "t=2222222222,v1=sig",
        },
        body: "",
      });
      (handleStripeWebhook as any).mockResolvedValue({
        success: false,
        message: "Empty payload",
      });

      // Act
      const response = await action({ request, params: {}, context: {} });
      const text = await response.text();

      // Assert
      expect(handleStripeWebhook).toHaveBeenCalledWith("", "t=2222222222,v1=sig");
      expect(response.status).toBe(400);
      expect(text).toBe("Empty payload");
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock the stripe webhook handler
vi.mock("../../../../lib/stripe/webhook.server", () => ({
  handleStripeWebhook: vi.fn(),
}));

import { action } from "../../../../app/routes/api/stripe-webhook";
import { handleStripeWebhook } from "../../../../lib/stripe/webhook.server";

describe("api/stripe-webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("action", () => {
    it("rejects non-POST methods", async () => {
      const request = new Request("https://divestreams.com/api/stripe-webhook", {
        method: "GET",
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(405);
      expect(await response.text()).toBe("Method not allowed");
    });

    it("rejects PUT method", async () => {
      const request = new Request("https://divestreams.com/api/stripe-webhook", {
        method: "PUT",
        body: "{}",
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response.status).toBe(405);
    });

    it("rejects requests without stripe signature", async () => {
      const request = new Request("https://divestreams.com/api/stripe-webhook", {
        method: "POST",
        body: JSON.stringify({ type: "checkout.session.completed" }),
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(400);
      expect(await response.text()).toBe("No signature");
    });

    it("calls handleStripeWebhook with payload and signature", async () => {
      const payload = JSON.stringify({ type: "checkout.session.completed", data: {} });
      const signature = "whsec_test_signature_123";

      (handleStripeWebhook as Mock).mockResolvedValue({ success: true, message: "Event processed" });

      const request = new Request("https://divestreams.com/api/stripe-webhook", {
        method: "POST",
        headers: {
          "stripe-signature": signature,
          "content-type": "application/json",
        },
        body: payload,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(handleStripeWebhook).toHaveBeenCalledWith(payload, signature);
    });

    it("returns success response when webhook handled successfully", async () => {
      const payload = JSON.stringify({ type: "checkout.session.completed" });

      (handleStripeWebhook as Mock).mockResolvedValue({
        success: true,
        message: "Subscription created",
      });

      const request = new Request("https://divestreams.com/api/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: payload,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("Subscription created");
    });

    it("returns error response when webhook handling fails", async () => {
      const payload = JSON.stringify({ type: "invalid.event" });

      (handleStripeWebhook as Mock).mockResolvedValue({
        success: false,
        message: "Signature verification failed",
      });

      const request = new Request("https://divestreams.com/api/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": "invalid_sig" },
        body: payload,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe("Signature verification failed");
    });

    it("handles checkout.session.completed event", async () => {
      const payload = JSON.stringify({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            customer: "cus_123",
            subscription: "sub_123",
            metadata: { tenantId: "tenant-1" },
          },
        },
      });

      (handleStripeWebhook as Mock).mockResolvedValue({
        success: true,
        message: "Checkout completed",
      });

      const request = new Request("https://divestreams.com/api/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: payload,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response.status).toBe(200);
    });

    it("handles invoice.paid event", async () => {
      const payload = JSON.stringify({
        type: "invoice.paid",
        data: {
          object: {
            id: "in_test_123",
            customer: "cus_123",
            subscription: "sub_123",
            amount_paid: 9900,
          },
        },
      });

      (handleStripeWebhook as Mock).mockResolvedValue({
        success: true,
        message: "Invoice processed",
      });

      const request = new Request("https://divestreams.com/api/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: payload,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response.status).toBe(200);
    });

    it("handles customer.subscription.updated event", async () => {
      const payload = JSON.stringify({
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            status: "active",
            current_period_end: 1735689600,
          },
        },
      });

      (handleStripeWebhook as Mock).mockResolvedValue({
        success: true,
        message: "Subscription updated",
      });

      const request = new Request("https://divestreams.com/api/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: payload,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response.status).toBe(200);
    });

    it("handles customer.subscription.deleted event", async () => {
      const payload = JSON.stringify({
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_123",
            status: "canceled",
          },
        },
      });

      (handleStripeWebhook as Mock).mockResolvedValue({
        success: true,
        message: "Subscription canceled",
      });

      const request = new Request("https://divestreams.com/api/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: payload,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response.status).toBe(200);
    });

    it("handles empty request body", async () => {
      (handleStripeWebhook as Mock).mockResolvedValue({
        success: false,
        message: "Invalid payload",
      });

      const request = new Request("https://divestreams.com/api/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: "",
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(response.status).toBe(400);
    });
  });
});

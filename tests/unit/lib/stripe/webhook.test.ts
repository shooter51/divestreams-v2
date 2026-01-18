/**
 * Stripe Webhook Handler Tests
 *
 * Tests for Stripe webhook event handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

// Mock the Stripe module and its index exports
const mockConstructEvent = vi.fn();
const mockHandleSubscriptionUpdated = vi.fn().mockResolvedValue(undefined);
const mockHandleSubscriptionDeleted = vi.fn().mockResolvedValue(undefined);
const mockSetDefaultPaymentMethod = vi.fn().mockResolvedValue(undefined);
const mockRetrieveSetupIntent = vi.fn();

vi.mock("../../../../lib/stripe/index", () => ({
  stripe: {
    webhooks: {
      constructEvent: mockConstructEvent,
    },
    setupIntents: {
      retrieve: mockRetrieveSetupIntent,
    },
  },
  handleSubscriptionUpdated: mockHandleSubscriptionUpdated,
  handleSubscriptionDeleted: mockHandleSubscriptionDeleted,
  setDefaultPaymentMethod: mockSetDefaultPaymentMethod,
}));

describe("Stripe Webhook Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test123";
  });

  describe("handleStripeWebhook", () => {
    it("exports handleStripeWebhook function", async () => {
      const webhookModule = await import("../../../../lib/stripe/webhook.server");
      expect(typeof webhookModule.handleStripeWebhook).toBe("function");
    });

    it("returns error when Stripe is not configured", async () => {
      // Remove webhook secret
      const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
      delete process.env.STRIPE_WEBHOOK_SECRET;

      vi.resetModules();

      // Re-mock with stripe as null
      vi.doMock("../../../../lib/stripe/index", () => ({
        stripe: null,
        handleSubscriptionUpdated: mockHandleSubscriptionUpdated,
        handleSubscriptionDeleted: mockHandleSubscriptionDeleted,
        setDefaultPaymentMethod: mockSetDefaultPaymentMethod,
      }));

      const { handleStripeWebhook } = await import("../../../../lib/stripe/webhook.server");

      const result = await handleStripeWebhook("payload", "sig_test");

      expect(result.success).toBe(false);
      expect(result.message).toContain("not configured");

      // Restore
      process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
    });

    it("returns error on invalid signature", async () => {
      vi.resetModules();
      mockConstructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      vi.doMock("../../../../lib/stripe/index", () => ({
        stripe: {
          webhooks: {
            constructEvent: mockConstructEvent,
          },
        },
        handleSubscriptionUpdated: mockHandleSubscriptionUpdated,
        handleSubscriptionDeleted: mockHandleSubscriptionDeleted,
        setDefaultPaymentMethod: mockSetDefaultPaymentMethod,
      }));

      const { handleStripeWebhook } = await import("../../../../lib/stripe/webhook.server");

      const result = await handleStripeWebhook("payload", "invalid_sig");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Webhook error");
    });

    it("handles customer.subscription.created event", async () => {
      vi.resetModules();

      const mockEvent: Partial<Stripe.Event> = {
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_123",
            customer: "cus_123",
            status: "active",
            metadata: {
              organizationId: "org_test",
            },
            items: {
              data: [{
                price: {
                  id: "price_test",
                  unit_amount: 4900,
                  currency: "usd",
                } as any,
              }] as any,
            } as any,
          } as Stripe.Subscription,
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      vi.doMock("../../../../lib/stripe/index", () => ({
        stripe: {
          webhooks: {
            constructEvent: mockConstructEvent,
          },
        },
        handleSubscriptionUpdated: mockHandleSubscriptionUpdated,
        handleSubscriptionDeleted: mockHandleSubscriptionDeleted,
        setDefaultPaymentMethod: mockSetDefaultPaymentMethod,
      }));

      const { handleStripeWebhook } = await import("../../../../lib/stripe/webhook.server");

      const result = await handleStripeWebhook("payload", "sig_valid");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Webhook handled successfully");
      expect(mockHandleSubscriptionUpdated).toHaveBeenCalled();
    });

    it("handles customer.subscription.updated event", async () => {
      vi.resetModules();

      const mockEvent: Partial<Stripe.Event> = {
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_456",
            customer: "cus_456",
            status: "active",
            metadata: {
              organizationId: "org_test",
            },
            items: {
              data: [{
                price: {
                  id: "price_test",
                  unit_amount: 4900,
                  currency: "usd",
                } as any,
              }] as any,
            } as any,
          } as Stripe.Subscription,
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      vi.doMock("../../../../lib/stripe/index", () => ({
        stripe: {
          webhooks: {
            constructEvent: mockConstructEvent,
          },
        },
        handleSubscriptionUpdated: mockHandleSubscriptionUpdated,
        handleSubscriptionDeleted: mockHandleSubscriptionDeleted,
        setDefaultPaymentMethod: mockSetDefaultPaymentMethod,
      }));

      const { handleStripeWebhook } = await import("../../../../lib/stripe/webhook.server");

      const result = await handleStripeWebhook("payload", "sig_valid");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Webhook handled successfully");
      expect(mockHandleSubscriptionUpdated).toHaveBeenCalled();
    });

    it("handles customer.subscription.deleted event", async () => {
      vi.resetModules();

      const mockEvent: Partial<Stripe.Event> = {
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_789",
            customer: "cus_789",
            status: "canceled",
            metadata: {
              organizationId: "org_test",
            },
            items: {
              data: [{
                price: {
                  id: "price_test",
                  unit_amount: 4900,
                  currency: "usd",
                } as any,
              }] as any,
            } as any,
          } as Stripe.Subscription,
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      vi.doMock("../../../../lib/stripe/index", () => ({
        stripe: {
          webhooks: {
            constructEvent: mockConstructEvent,
          },
        },
        handleSubscriptionUpdated: mockHandleSubscriptionUpdated,
        handleSubscriptionDeleted: mockHandleSubscriptionDeleted,
        setDefaultPaymentMethod: mockSetDefaultPaymentMethod,
      }));

      const { handleStripeWebhook } = await import("../../../../lib/stripe/webhook.server");

      const result = await handleStripeWebhook("payload", "sig_valid");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Webhook handled successfully");
      expect(mockHandleSubscriptionDeleted).toHaveBeenCalled();
    });

    it("handles invoice.payment_succeeded event", async () => {
      vi.resetModules();

      const mockEvent: Partial<Stripe.Event> = {
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "inv_123",
            customer: "cus_123",
          } as Stripe.Invoice,
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      vi.doMock("../../../../lib/stripe/index", () => ({
        stripe: {
          webhooks: {
            constructEvent: mockConstructEvent,
          },
        },
        handleSubscriptionUpdated: mockHandleSubscriptionUpdated,
        handleSubscriptionDeleted: mockHandleSubscriptionDeleted,
        setDefaultPaymentMethod: mockSetDefaultPaymentMethod,
      }));

      const { handleStripeWebhook } = await import("../../../../lib/stripe/webhook.server");

      const result = await handleStripeWebhook("payload", "sig_valid");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Webhook handled successfully");
    });

    it("handles invoice.payment_failed event", async () => {
      vi.resetModules();

      const mockEvent: Partial<Stripe.Event> = {
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "inv_456",
            customer: "cus_456",
          } as Stripe.Invoice,
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      vi.doMock("../../../../lib/stripe/index", () => ({
        stripe: {
          webhooks: {
            constructEvent: mockConstructEvent,
          },
        },
        handleSubscriptionUpdated: mockHandleSubscriptionUpdated,
        handleSubscriptionDeleted: mockHandleSubscriptionDeleted,
        setDefaultPaymentMethod: mockSetDefaultPaymentMethod,
      }));

      const { handleStripeWebhook } = await import("../../../../lib/stripe/webhook.server");

      const result = await handleStripeWebhook("payload", "sig_valid");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Webhook handled successfully");
    });

    it("handles checkout.session.completed event for setup mode", async () => {
      vi.resetModules();

      mockRetrieveSetupIntent.mockResolvedValue({
        payment_method: "pm_123",
      });

      const mockEvent: Partial<Stripe.Event> = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_123",
            mode: "setup",
            setup_intent: "seti_123",
            customer: "cus_123",
          } as Stripe.Checkout.Session,
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      vi.doMock("../../../../lib/stripe/index", () => ({
        stripe: {
          webhooks: {
            constructEvent: mockConstructEvent,
          },
          setupIntents: {
            retrieve: mockRetrieveSetupIntent,
          },
        },
        handleSubscriptionUpdated: mockHandleSubscriptionUpdated,
        handleSubscriptionDeleted: mockHandleSubscriptionDeleted,
        setDefaultPaymentMethod: mockSetDefaultPaymentMethod,
      }));

      const { handleStripeWebhook } = await import("../../../../lib/stripe/webhook.server");

      const result = await handleStripeWebhook("payload", "sig_valid");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Webhook handled successfully");
    });

    it("handles unhandled event types gracefully", async () => {
      vi.resetModules();

      const mockEvent: Partial<Stripe.Event> = {
        type: "unknown.event.type" as any,
        data: {
          object: {},
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      vi.doMock("../../../../lib/stripe/index", () => ({
        stripe: {
          webhooks: {
            constructEvent: mockConstructEvent,
          },
        },
        handleSubscriptionUpdated: mockHandleSubscriptionUpdated,
        handleSubscriptionDeleted: mockHandleSubscriptionDeleted,
        setDefaultPaymentMethod: mockSetDefaultPaymentMethod,
      }));

      const { handleStripeWebhook } = await import("../../../../lib/stripe/webhook.server");

      const result = await handleStripeWebhook("payload", "sig_valid");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Webhook handled successfully");
    });
  });
});

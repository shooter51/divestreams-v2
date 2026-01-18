/**
 * Tests for Stripe Billing Integration
 *
 * Comprehensive test suite for Stripe subscription, payment, and invoice management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Stripe from "stripe";
import {
  syncSubscriptionToDatabase,
  syncInvoiceToDatabase,
  syncPaymentToDatabase,
  getInvoiceHistory,
  getPaymentHistory,
  getCurrentSubscription,
  getOrCreateStripeCustomer,
} from "../../../../lib/stripe/stripe-billing.server";

// Mock Stripe
vi.mock("stripe");

// Mock database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

describe("Stripe Billing Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getOrCreateStripeCustomer", () => {
    it("should return existing customer ID if customer exists", async () => {
      const mockCustomerId = "cus_test123";
      const orgId = "org_test";

      // Mock database response
      const { db } = await import("../../../../lib/db");
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { stripeCustomerId: mockCustomerId },
            ]),
          }),
        }),
      });

      // Note: This test will return the existing customer ID
      const result = await getOrCreateStripeCustomer(orgId);
      expect(result).toBe(mockCustomerId);
    });

    it("should return null when no customer exists and Stripe not configured", async () => {
      const orgId = "org_test";

      const { db } = await import("../../../../lib/db");

      // Mock existing customer check (none found)
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Expect null since Stripe is not initialized in test env
      const result = await getOrCreateStripeCustomer(orgId);
      expect(result).toBeNull();
    });
  });

  describe("syncSubscriptionToDatabase", () => {
    it("should insert new subscription if it does not exist", async () => {
      const mockSubscription: Partial<Stripe.Subscription> = {
        id: "sub_test123",
        customer: "cus_test123",
        status: "active",
        metadata: {
          organizationId: "org_test",
          planName: "Professional",
        },
        current_period_start: 1700000000,
        current_period_end: 1702678400,
        cancel_at_period_end: false,
        items: {
          data: [
            {
              id: "si_test",
              price: {
                id: "price_test",
                unit_amount: 4900,
                currency: "usd",
                nickname: "Professional Monthly",
                recurring: { interval: "month" },
              } as any,
            } as any,
          ],
        } as any,
      };

      const { db } = await import("../../../../lib/db");

      // Mock existing check (none found)
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock insert
      const mockInsert = vi.fn().mockResolvedValue(undefined);
      (db.insert as any).mockReturnValue({
        values: mockInsert,
      });

      await syncSubscriptionToDatabase(mockSubscription as Stripe.Subscription);

      expect(mockInsert).toHaveBeenCalled();
    });

    it("should update existing subscription if it exists", async () => {
      const mockSubscription: Partial<Stripe.Subscription> = {
        id: "sub_test123",
        customer: "cus_test123",
        status: "active",
        metadata: {
          organizationId: "org_test",
        },
        items: {
          data: [
            {
              price: {
                id: "price_test",
                unit_amount: 4900,
                currency: "usd",
              } as any,
            } as any,
          ],
        } as any,
      };

      const { db } = await import("../../../../lib/db");

      // Mock existing check (found)
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "existing_id", stripeSubscriptionId: "sub_test123" },
            ]),
          }),
        }),
      });

      // Mock update
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockUpdate,
        }),
      });

      await syncSubscriptionToDatabase(mockSubscription as Stripe.Subscription);

      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe("syncInvoiceToDatabase", () => {
    it("should sync invoice data correctly", async () => {
      const mockInvoice: Partial<Stripe.Invoice> = {
        id: "in_test123",
        customer: "cus_test123",
        subscription: "sub_test123",
        number: "INV-001",
        amount_due: 4900,
        amount_paid: 4900,
        amount_remaining: 0,
        subtotal: 4900,
        total: 4900,
        tax: 0,
        currency: "usd",
        status: "paid",
        paid: true,
        attempt_count: 1,
        hosted_invoice_url: "https://invoice.stripe.com/test",
        invoice_pdf: "https://invoice.stripe.com/test.pdf",
        lines: {
          data: [
            {
              description: "Professional Plan",
              amount: 4900,
              quantity: 1,
              currency: "usd",
            } as any,
          ],
        } as any,
        metadata: {},
      };

      const { db } = await import("../../../../lib/db");

      // Mock customer lookup
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { organizationId: "org_test", stripeCustomerId: "cus_test123" },
            ]),
          }),
        }),
      });

      // Mock existing invoice check
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Mock insert
      const mockInsert = vi.fn().mockResolvedValue(undefined);
      (db.insert as any).mockReturnValue({
        values: mockInsert,
      });

      await syncInvoiceToDatabase(mockInvoice as Stripe.Invoice);

      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe("getInvoiceHistory", () => {
    it("should retrieve invoice history for organization", async () => {
      const orgId = "org_test";
      const mockInvoices = [
        {
          id: "uuid1",
          organizationId: orgId,
          stripeInvoiceId: "in_test1",
          total: 4900,
          status: "paid",
          createdAt: new Date(),
        },
        {
          id: "uuid2",
          organizationId: orgId,
          stripeInvoiceId: "in_test2",
          total: 9900,
          status: "paid",
          createdAt: new Date(),
        },
      ];

      const { db } = await import("../../../../lib/db");

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockInvoices),
            }),
          }),
        }),
      });

      const result = await getInvoiceHistory(orgId);

      expect(result).toEqual(mockInvoices);
    });
  });

  describe("getCurrentSubscription", () => {
    it("should return active subscription for organization", async () => {
      const orgId = "org_test";
      const mockSubscription = {
        id: "uuid1",
        organizationId: orgId,
        stripeSubscriptionId: "sub_test",
        status: "active",
      };

      const { db } = await import("../../../../lib/db");

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockSubscription]),
            }),
          }),
        }),
      });

      const result = await getCurrentSubscription(orgId);

      expect(result).toEqual(mockSubscription);
    });

    it("should return null if no active subscription exists", async () => {
      const orgId = "org_test";

      const { db } = await import("../../../../lib/db");

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const result = await getCurrentSubscription(orgId);

      expect(result).toBeNull();
    });
  });
});

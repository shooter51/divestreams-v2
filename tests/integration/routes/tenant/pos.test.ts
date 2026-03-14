import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/tenant/pos";

// Mock the org-context module
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

// Mock the main database module
vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ taxRate: "8.25" }]),
  },
}));

// Mock the schema module
vi.mock("../../../../lib/db/schema", () => ({
  organizationSettings: { organizationId: "organizationId" },
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
}));

// Mock require-feature.server - requireFeature is a no-op in tests
vi.mock("../../../../lib/require-feature.server", () => ({
  requireFeature: vi.fn(),
}));

vi.mock("../../../../lib/plan-features", () => ({
  PLAN_FEATURES: { HAS_POS: "has_pos" },
}));

// Mock the tenant database module
vi.mock("../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(),
}));

// Mock the POS server functions
vi.mock("../../../../lib/db/pos.server", () => ({
  getPOSProducts: vi.fn(),
  getPOSEquipment: vi.fn(),
  getPOSTrips: vi.fn(),
  searchPOSCustomers: vi.fn(),
  processPOSCheckout: vi.fn(),
  generateAgreementNumber: vi.fn(),
  getProductByBarcode: vi.fn(),
  getTransactionById: vi.fn(),
  processPOSRefund: vi.fn(),
}));

// Mock the Stripe integration functions
vi.mock("../../../../lib/integrations/stripe.server", () => ({
  getStripeSettings: vi.fn(),
  getStripePublishableKey: vi.fn(),
  createPOSPaymentIntent: vi.fn(),
  createTerminalConnectionToken: vi.fn(),
  listTerminalReaders: vi.fn(),
  createStripeRefund: vi.fn(),
}));

import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { getTenantDb } from "../../../../lib/db/tenant.server";
import {
  getPOSProducts,
  getPOSEquipment,
  getPOSTrips,
  searchPOSCustomers,
  processPOSCheckout,
  generateAgreementNumber,
  getProductByBarcode,
  getTransactionById,
  processPOSRefund,
} from "../../../../lib/db/pos.server";
import {
  getStripeSettings,
  getStripePublishableKey,
  createPOSPaymentIntent,
  createTerminalConnectionToken,
  listTerminalReaders,
  createStripeRefund,
} from "../../../../lib/integrations/stripe.server";

describe("tenant/pos route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
    membership: { role: "owner" },
    subscription: null,
    limits: { customers: 50, tours: 3, bookingsPerMonth: 20, teamMembers: 5 },
    usage: { customers: 0, tours: 0, bookingsThisMonth: 0 },
    canAddCustomer: true,
    canAddTour: true,
    canAddBooking: true,
    isPremium: true,
  };

  const mockTenantDb = {
    schema: { products: {}, equipment: {}, trips: {}, customers: {} },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getTenantDb as Mock).mockReturnValue(mockTenantDb);
    // Default Stripe mocks - no Stripe connected
    (getStripeSettings as Mock).mockResolvedValue(null);
    (getStripePublishableKey as Mock).mockResolvedValue(null);
    (listTerminalReaders as Mock).mockResolvedValue(null);
  });

  describe("loader", () => {
    it("requires tenant context", async () => {
      (getPOSProducts as Mock).mockResolvedValue([]);
      (getPOSEquipment as Mock).mockResolvedValue([]);
      (getPOSTrips as Mock).mockResolvedValue([]);
      (generateAgreementNumber as Mock).mockResolvedValue("RA-2024-0001");

      const request = new Request("https://demo.divestreams.com/tenant/pos");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });

    it("fetches products, equipment, and trips", async () => {
      (getPOSProducts as Mock).mockResolvedValue([]);
      (getPOSEquipment as Mock).mockResolvedValue([]);
      (getPOSTrips as Mock).mockResolvedValue([]);
      (generateAgreementNumber as Mock).mockResolvedValue("RA-2024-0001");

      const request = new Request("https://demo.divestreams.com/tenant/pos");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(getPOSProducts).toHaveBeenCalled();
      expect(getPOSEquipment).toHaveBeenCalled();
      expect(getPOSTrips).toHaveBeenCalled();
    });

    it("returns POS data", async () => {
      const mockProducts = [
        { id: "p1", name: "Mask", price: "50.00", category: "gear" },
      ];
      const mockEquipment = [
        { id: "e1", name: "BCD Rental", rentalPrice: "25.00", category: "rental" },
      ];
      const mockTrips = [
        { id: "t1", tour: { name: "Morning Dive", price: "99.00" } },
      ];

      (getPOSProducts as Mock).mockResolvedValue(mockProducts);
      (getPOSEquipment as Mock).mockResolvedValue(mockEquipment);
      (getPOSTrips as Mock).mockResolvedValue(mockTrips);
      (generateAgreementNumber as Mock).mockResolvedValue("RA-2024-0001");

      const request = new Request("https://demo.divestreams.com/tenant/pos");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.products).toEqual(mockProducts);
      expect(result.equipment).toEqual(mockEquipment);
      expect(result.trips).toEqual(mockTrips);
      expect(result.tenant).toBeDefined();
      expect(result.agreementNumber).toBe("RA-2024-0001");
    });

    it("handles agreement number generation error gracefully", async () => {
      (getPOSProducts as Mock).mockResolvedValue([]);
      (getPOSEquipment as Mock).mockResolvedValue([]);
      (getPOSTrips as Mock).mockResolvedValue([]);
      (generateAgreementNumber as Mock).mockRejectedValue(new Error("Table not found"));

      const request = new Request("https://demo.divestreams.com/tenant/pos");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      // Should use default agreement number pattern
      expect(result.agreementNumber).toMatch(/^RA-\d{4}-0001$/);
    });

    it("returns stripeConnected false when Stripe not configured", async () => {
      (getPOSProducts as Mock).mockResolvedValue([]);
      (getPOSEquipment as Mock).mockResolvedValue([]);
      (getPOSTrips as Mock).mockResolvedValue([]);
      (generateAgreementNumber as Mock).mockResolvedValue("RA-2024-0001");
      (getStripeSettings as Mock).mockResolvedValue(null);

      const request = new Request("https://demo.divestreams.com/tenant/pos");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.stripeConnected).toBe(false);
      expect(result.stripePublishableKey).toBeNull();
      expect(result.hasTerminalReaders).toBe(false);
    });

    it("returns stripeConnected true when Stripe is configured", async () => {
      (getPOSProducts as Mock).mockResolvedValue([]);
      (getPOSEquipment as Mock).mockResolvedValue([]);
      (getPOSTrips as Mock).mockResolvedValue([]);
      (generateAgreementNumber as Mock).mockResolvedValue("RA-2024-0001");
      (getStripeSettings as Mock).mockResolvedValue({
        connected: true,
        chargesEnabled: true,
        accountId: "acct_123",
      });
      (getStripePublishableKey as Mock).mockResolvedValue("pk_test_123");
      (listTerminalReaders as Mock).mockResolvedValue([
        { id: "tmr_1", label: "Reader 1", deviceType: "bbpos_wisepos_e", status: "online" },
      ]);

      const request = new Request("https://demo.divestreams.com/tenant/pos");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.stripeConnected).toBe(true);
      expect(result.stripePublishableKey).toBe("pk_test_123");
      expect(result.hasTerminalReaders).toBe(true);
    });

    // DS-zkvi: Loader must return taxName and currency for ReceiptModal organization data
    it("DS-zkvi: returns taxName and currency from organization settings for receipt modal", async () => {
      (getPOSProducts as Mock).mockResolvedValue([]);
      (getPOSEquipment as Mock).mockResolvedValue([]);
      (getPOSTrips as Mock).mockResolvedValue([]);
      (generateAgreementNumber as Mock).mockResolvedValue("RA-2024-0001");
      (getStripeSettings as Mock).mockResolvedValue(null);

      const { db } = await import("../../../../lib/db/index");
      (db.select as Mock).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ taxRate: "8.25", taxName: "Sales Tax", currency: "USD" }]),
          }),
        }),
      });

      const request = new Request("https://demo.divestreams.com/tenant/pos");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.taxName).toBe("Sales Tax");
      expect(result.currency).toBe("USD");
    });

    it("returns hasTerminalReaders false when no readers registered", async () => {
      (getPOSProducts as Mock).mockResolvedValue([]);
      (getPOSEquipment as Mock).mockResolvedValue([]);
      (getPOSTrips as Mock).mockResolvedValue([]);
      (generateAgreementNumber as Mock).mockResolvedValue("RA-2024-0001");
      (getStripeSettings as Mock).mockResolvedValue({
        connected: true,
        chargesEnabled: true,
      });
      (getStripePublishableKey as Mock).mockResolvedValue("pk_test_123");
      (listTerminalReaders as Mock).mockResolvedValue([]);

      const request = new Request("https://demo.divestreams.com/tenant/pos");
      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0]);

      expect(result.stripeConnected).toBe(true);
      expect(result.hasTerminalReaders).toBe(false);
    });
  });

  describe("action", () => {
    describe("search-customers intent", () => {
      it("searches customers by query", async () => {
        const mockCustomers = [
          { id: "c1", firstName: "John", lastName: "Doe", email: "john@example.com" },
        ];
        (searchPOSCustomers as Mock).mockResolvedValue(mockCustomers);

        const formData = new FormData();
        formData.append("intent", "search-customers");
        formData.append("query", "john");

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(searchPOSCustomers).toHaveBeenCalledWith(
          mockTenantDb.schema,
          "org-uuid",
          "john"
        );
        expect(result).toEqual({ customers: mockCustomers });
      });
    });

    describe("scan-barcode intent", () => {
      it("returns scanned product when found", async () => {
        const mockProduct = {
          id: "p1",
          name: "Diving Mask",
          price: "50.00",
          stockQuantity: 10,
        };
        (getProductByBarcode as Mock).mockResolvedValue(mockProduct);

        const formData = new FormData();
        formData.append("intent", "scan-barcode");
        formData.append("barcode", "123456789");

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(getProductByBarcode).toHaveBeenCalledWith(
          mockTenantDb.schema,
          "org-uuid",
          "123456789"
        );
        expect(result).toMatchObject({
          scannedProduct: {
            id: "p1",
            name: "Diving Mask",
            price: "50.00",
            stockQuantity: 10,
          },
        });
      });

      it("returns not found when barcode does not exist", async () => {
        (getProductByBarcode as Mock).mockResolvedValue(null);

        const formData = new FormData();
        formData.append("intent", "scan-barcode");
        formData.append("barcode", "nonexistent");

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toMatchObject({
          barcodeNotFound: true,
          scannedBarcode: "nonexistent",
        });
      });
    });

    describe("checkout intent", () => {
      it("processes checkout successfully", async () => {
        (processPOSCheckout as Mock).mockResolvedValue({ receiptNumber: "R-0001" });

        const checkoutData = {
          items: [{ type: "product", productId: "00000000-0000-0000-0000-000000000001", name: "Tank", quantity: 2, unitPrice: 50, total: 100 }],
          customerId: "00000000-0000-0000-0000-000000000002",
          payments: [{ method: "card", amount: 100, stripePaymentIntentId: "pi_test" }],
          subtotal: 100,
          tax: 0,
          total: 100,
          notes: "",
        };

        const formData = new FormData();
        formData.append("intent", "checkout");
        formData.append("data", JSON.stringify(checkoutData));

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(processPOSCheckout).toHaveBeenCalled();
        expect(result).toMatchObject({
          success: true,
          receiptNumber: "R-0001",
        });
      });

      // DS-zkvi: Receipt not printing after POS sale
      // The action must return transaction data so the UI can open the ReceiptModal and trigger window.print()
      it("DS-zkvi: checkout response includes transaction data for receipt modal", async () => {
        const mockTransaction = {
          id: "txn-00000000-0000-0000-0000-000000000001",
          type: "sale",
          amount: "100.00",
          paymentMethod: "cash",
          customerId: null,
          userId: "user-1",
          items: [{ description: "Tank", quantity: 2, unitPrice: 50, total: 100 }],
          createdAt: new Date("2026-03-10T10:00:00Z"),
          stripePaymentId: null,
          refundedTransactionId: null,
        };
        (processPOSCheckout as Mock).mockResolvedValue({
          receiptNumber: "R-0002",
          transaction: mockTransaction,
        });

        const checkoutData = {
          items: [{ type: "product", productId: "00000000-0000-0000-0000-000000000001", name: "Tank", quantity: 2, unitPrice: 50, total: 100 }],
          payments: [{ method: "cash", amount: 100, tendered: 100, change: 0 }],
          subtotal: 100,
          tax: 0,
          total: 100,
        };

        const formData = new FormData();
        formData.append("intent", "checkout");
        formData.append("data", JSON.stringify(checkoutData));

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toMatchObject({
          success: true,
          receiptNumber: "R-0002",
          transaction: expect.objectContaining({
            id: "R-0002",
            amount: 100,
            paymentMethod: "cash",
          }),
        });
      });

      it("returns error when checkout fails", async () => {
        (processPOSCheckout as Mock).mockRejectedValue(new Error("Insufficient stock"));

        const checkoutData = {
          items: [{ type: "product", productId: "00000000-0000-0000-0000-000000000001", name: "Tank", quantity: 100, unitPrice: 50, total: 5000 }],
          payments: [{ method: "cash", amount: 5000, tendered: 5000, change: 0 }],
          subtotal: 5000,
          tax: 0,
          total: 5000,
        };

        const formData = new FormData();
        formData.append("intent", "checkout");
        formData.append("data", JSON.stringify(checkoutData));

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({ error: "Insufficient stock" });
      });

      it("returns generic error for non-Error exceptions", async () => {
        (processPOSCheckout as Mock).mockRejectedValue("Unknown error");

        const checkoutData = {
          items: [{ type: "product", productId: "00000000-0000-0000-0000-000000000001", name: "Tank", quantity: 1, unitPrice: 10, total: 10 }],
          payments: [{ method: "cash", amount: 10, tendered: 10, change: 0 }],
          subtotal: 10,
          tax: 0,
          total: 10,
        };

        const formData = new FormData();
        formData.append("intent", "checkout");
        formData.append("data", JSON.stringify(checkoutData));

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({ error: "Checkout failed" });
      });
    });

    it("returns error for invalid intent", async () => {
      const formData = new FormData();
      formData.append("intent", "unknown");

      const request = new Request("https://demo.divestreams.com/tenant/pos", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

      expect(result).toEqual({ error: "Invalid intent" });
    });

    describe("create-payment-intent intent", () => {
      it("creates payment intent when Stripe is connected", async () => {
        (createPOSPaymentIntent as Mock).mockResolvedValue({
          clientSecret: "pi_123_secret_abc",
          paymentIntentId: "pi_123",
        });

        const formData = new FormData();
        formData.append("intent", "create-payment-intent");
        formData.append("amount", "5000");
        formData.append("customerId", "cust-1");

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(createPOSPaymentIntent).toHaveBeenCalledWith(
          "org-uuid",
          5000,
          expect.objectContaining({
            customerId: "cust-1",
          })
        );
        expect(result).toEqual({
          clientSecret: "pi_123_secret_abc",
          paymentIntentId: "pi_123",
        });
      });

      it("returns error when Stripe is not connected", async () => {
        (createPOSPaymentIntent as Mock).mockResolvedValue(null);

        const formData = new FormData();
        formData.append("intent", "create-payment-intent");
        formData.append("amount", "5000");

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({ error: "Stripe not connected. Please connect Stripe in Settings → Integrations." });
      });

      it("returns error when amount is missing or invalid", async () => {
        const formData = new FormData();
        formData.append("intent", "create-payment-intent");

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({ error: "Invalid payment amount" });
      });

      it("handles payment intent creation errors", async () => {
        (createPOSPaymentIntent as Mock).mockRejectedValue(new Error("Card declined"));

        const formData = new FormData();
        formData.append("intent", "create-payment-intent");
        formData.append("amount", "5000");

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({ error: "Card declined" });
      });
    });

    describe("connection-token intent", () => {
      it("creates connection token when Stripe is connected", async () => {
        (createTerminalConnectionToken as Mock).mockResolvedValue({
          secret: "pst_test_secret_123",
        });

        const formData = new FormData();
        formData.append("intent", "connection-token");

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(createTerminalConnectionToken).toHaveBeenCalledWith("org-uuid");
        expect(result).toEqual({ secret: "pst_test_secret_123" });
      });

      it("returns error when Stripe is not connected", async () => {
        (createTerminalConnectionToken as Mock).mockResolvedValue(null);

        const formData = new FormData();
        formData.append("intent", "connection-token");

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({ error: "Stripe not connected" });
      });
    });

    describe("process-refund", () => {
      it("refunds a payment-type transaction (booking refund)", async () => {
        const mockRefundResult = {
          refundTransaction: {
            id: "refund-txn-001",
            type: "refund",
            amount: "-259.00",
            bookingId: "booking-001",
          },
          originalTransaction: {
            id: "txn-001",
            type: "payment",
            amount: "259.00",
            bookingId: "booking-001",
          },
        };
        (processPOSRefund as Mock).mockResolvedValue(mockRefundResult);

        const refundData = {
          originalTransactionId: "00000000-0000-0000-0000-000000000001",
          paymentMethod: "cash",
          refundReason: "Service Cancellation",
        };

        const formData = new FormData();
        formData.append("intent", "process-refund");
        formData.append("data", JSON.stringify(refundData));

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(processPOSRefund).toHaveBeenCalledWith(
          mockTenantDb.schema,
          "org-uuid",
          {
            originalTransactionId: "00000000-0000-0000-0000-000000000001",
            userId: "user-1",
            refundReason: "Service Cancellation",
            stripeRefundId: undefined,
          }
        );
        expect(result).toEqual({
          success: true,
          refundId: "refund-txn-001",
          amount: 259,
        });
      });

      it("refunds a sale-type transaction", async () => {
        const mockRefundResult = {
          refundTransaction: {
            id: "refund-txn-002",
            type: "refund",
            amount: "-50.00",
          },
          originalTransaction: {
            id: "txn-002",
            type: "sale",
            amount: "50.00",
          },
        };
        (processPOSRefund as Mock).mockResolvedValue(mockRefundResult);

        const refundData = {
          originalTransactionId: "00000000-0000-0000-0000-000000000002",
          paymentMethod: "cash",
          refundReason: "Defective product",
        };

        const formData = new FormData();
        formData.append("intent", "process-refund");
        formData.append("data", JSON.stringify(refundData));

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({
          success: true,
          refundId: "refund-txn-002",
          amount: 50,
        });
      });

      it("processes Stripe refund for card payment transactions", async () => {
        (createStripeRefund as Mock).mockResolvedValue({ refundId: "re_stripe_001" });

        const mockRefundResult = {
          refundTransaction: {
            id: "refund-txn-003",
            type: "refund",
            amount: "-100.00",
          },
          originalTransaction: {
            id: "txn-003",
            type: "payment",
            amount: "100.00",
          },
        };
        (processPOSRefund as Mock).mockResolvedValue(mockRefundResult);

        const refundData = {
          originalTransactionId: "00000000-0000-0000-0000-000000000003",
          paymentMethod: "card",
          stripePaymentId: "pi_stripe_original",
          refundReason: "Trip cancelled",
        };

        const formData = new FormData();
        formData.append("intent", "process-refund");
        formData.append("data", JSON.stringify(refundData));

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(createStripeRefund).toHaveBeenCalledWith("org-uuid", "pi_stripe_original", {
          reason: "requested_by_customer",
          metadata: {
            originalTransactionId: "00000000-0000-0000-0000-000000000003",
            refundReason: "Trip cancelled",
          },
        });
        expect(processPOSRefund).toHaveBeenCalledWith(
          mockTenantDb.schema,
          "org-uuid",
          expect.objectContaining({
            stripeRefundId: "re_stripe_001",
          })
        );
        expect(result).toEqual({
          success: true,
          refundId: "refund-txn-003",
          amount: 100,
        });
      });

      it("returns error when refund reason is missing", async () => {
        const refundData = {
          originalTransactionId: "00000000-0000-0000-0000-000000000001",
          paymentMethod: "cash",
          refundReason: "",
        };

        const formData = new FormData();
        formData.append("intent", "process-refund");
        formData.append("data", JSON.stringify(refundData));

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({ error: "Refund reason is required" });
      });

      it("returns error when processPOSRefund throws", async () => {
        (processPOSRefund as Mock).mockRejectedValue(new Error("Transaction has already been refunded"));

        const refundData = {
          originalTransactionId: "00000000-0000-0000-0000-000000000001",
          paymentMethod: "cash",
          refundReason: "Customer request",
        };

        const formData = new FormData();
        formData.append("intent", "process-refund");
        formData.append("data", JSON.stringify(refundData));

        const request = new Request("https://demo.divestreams.com/tenant/pos", {
          method: "POST",
          body: formData,
        });

        const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof action>[0]);

        expect(result).toEqual({ error: "Transaction has already been refunded" });
      });
    });
  });
});

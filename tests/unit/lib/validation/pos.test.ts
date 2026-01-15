/**
 * POS Validation Tests
 *
 * Tests for POS cart items, payments, and checkout validation schemas.
 */

import { describe, it, expect } from "vitest";
import {
  cartProductSchema,
  cartRentalSchema,
  cartBookingSchema,
  cartItemSchema,
  cashPaymentSchema,
  cardPaymentSchema,
  paymentSchema,
  checkoutSchema,
  rentalAgreementSchema,
  type CartItem,
  type Payment,
} from "../../../../lib/validation/pos";

describe("POS Validation Schemas", () => {
  // ============================================================================
  // Cart Product Schema Tests
  // ============================================================================
  describe("cartProductSchema", () => {
    it("validates a valid product item", () => {
      const data = {
        type: "product",
        productId: "550e8400-e29b-41d4-a716-446655440000",
        name: "Dive Mask",
        quantity: 2,
        unitPrice: 49.99,
        total: 99.98,
      };
      const result = cartProductSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects invalid product type", () => {
      const data = {
        type: "rental",
        productId: "550e8400-e29b-41d4-a716-446655440000",
        name: "Dive Mask",
        quantity: 2,
        unitPrice: 49.99,
        total: 99.98,
      };
      const result = cartProductSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects invalid productId (not UUID)", () => {
      const data = {
        type: "product",
        productId: "not-a-uuid",
        name: "Dive Mask",
        quantity: 2,
        unitPrice: 49.99,
        total: 99.98,
      };
      const result = cartProductSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects negative quantity", () => {
      const data = {
        type: "product",
        productId: "550e8400-e29b-41d4-a716-446655440000",
        name: "Dive Mask",
        quantity: -1,
        unitPrice: 49.99,
        total: 99.98,
      };
      const result = cartProductSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects zero quantity", () => {
      const data = {
        type: "product",
        productId: "550e8400-e29b-41d4-a716-446655440000",
        name: "Dive Mask",
        quantity: 0,
        unitPrice: 49.99,
        total: 99.98,
      };
      const result = cartProductSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects non-integer quantity", () => {
      const data = {
        type: "product",
        productId: "550e8400-e29b-41d4-a716-446655440000",
        name: "Dive Mask",
        quantity: 1.5,
        unitPrice: 49.99,
        total: 99.98,
      };
      const result = cartProductSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects negative unit price", () => {
      const data = {
        type: "product",
        productId: "550e8400-e29b-41d4-a716-446655440000",
        name: "Dive Mask",
        quantity: 2,
        unitPrice: -49.99,
        total: 99.98,
      };
      const result = cartProductSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Cart Rental Schema Tests
  // ============================================================================
  describe("cartRentalSchema", () => {
    it("validates a valid rental item", () => {
      const data = {
        type: "rental",
        equipmentId: "550e8400-e29b-41d4-a716-446655440000",
        name: "BCD",
        days: 3,
        dailyRate: 25.00,
        total: 75.00,
      };
      const result = cartRentalSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates rental item with optional size", () => {
      const data = {
        type: "rental",
        equipmentId: "550e8400-e29b-41d4-a716-446655440000",
        name: "Wetsuit",
        size: "L",
        days: 2,
        dailyRate: 15.00,
        total: 30.00,
      };
      const result = cartRentalSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.size).toBe("L");
      }
    });

    it("rejects zero days", () => {
      const data = {
        type: "rental",
        equipmentId: "550e8400-e29b-41d4-a716-446655440000",
        name: "BCD",
        days: 0,
        dailyRate: 25.00,
        total: 75.00,
      };
      const result = cartRentalSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects negative daily rate", () => {
      const data = {
        type: "rental",
        equipmentId: "550e8400-e29b-41d4-a716-446655440000",
        name: "BCD",
        days: 3,
        dailyRate: -25.00,
        total: 75.00,
      };
      const result = cartRentalSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Cart Booking Schema Tests
  // ============================================================================
  describe("cartBookingSchema", () => {
    it("validates a valid booking item", () => {
      const data = {
        type: "booking",
        tripId: "550e8400-e29b-41d4-a716-446655440000",
        tourName: "Morning Dive",
        participants: 2,
        unitPrice: 99.00,
        total: 198.00,
      };
      const result = cartBookingSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects zero participants", () => {
      const data = {
        type: "booking",
        tripId: "550e8400-e29b-41d4-a716-446655440000",
        tourName: "Morning Dive",
        participants: 0,
        unitPrice: 99.00,
        total: 198.00,
      };
      const result = cartBookingSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects invalid tripId", () => {
      const data = {
        type: "booking",
        tripId: "invalid",
        tourName: "Morning Dive",
        participants: 2,
        unitPrice: 99.00,
        total: 198.00,
      };
      const result = cartBookingSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Cart Item Schema (Discriminated Union) Tests
  // ============================================================================
  describe("cartItemSchema", () => {
    it("validates product type", () => {
      const data: CartItem = {
        type: "product",
        productId: "550e8400-e29b-41d4-a716-446655440000",
        name: "Dive Mask",
        quantity: 1,
        unitPrice: 49.99,
        total: 49.99,
      };
      const result = cartItemSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates rental type", () => {
      const data: CartItem = {
        type: "rental",
        equipmentId: "550e8400-e29b-41d4-a716-446655440000",
        name: "BCD",
        days: 2,
        dailyRate: 25.00,
        total: 50.00,
      };
      const result = cartItemSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates booking type", () => {
      const data: CartItem = {
        type: "booking",
        tripId: "550e8400-e29b-41d4-a716-446655440000",
        tourName: "Sunset Dive",
        participants: 3,
        unitPrice: 79.00,
        total: 237.00,
      };
      const result = cartItemSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects unknown type", () => {
      const data = {
        type: "unknown",
        name: "Something",
        total: 100.00,
      };
      const result = cartItemSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Cash Payment Schema Tests
  // ============================================================================
  describe("cashPaymentSchema", () => {
    it("validates valid cash payment", () => {
      const data = {
        method: "cash",
        amount: 100.00,
        tendered: 120.00,
        change: 20.00,
      };
      const result = cashPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates exact payment (no change)", () => {
      const data = {
        method: "cash",
        amount: 100.00,
        tendered: 100.00,
        change: 0,
      };
      const result = cashPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects negative amount", () => {
      const data = {
        method: "cash",
        amount: -100.00,
        tendered: 120.00,
        change: 20.00,
      };
      const result = cashPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects negative change", () => {
      const data = {
        method: "cash",
        amount: 100.00,
        tendered: 80.00,
        change: -20.00,
      };
      const result = cashPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Card Payment Schema Tests
  // ============================================================================
  describe("cardPaymentSchema", () => {
    it("validates valid card payment", () => {
      const data = {
        method: "card",
        amount: 100.00,
        stripePaymentIntentId: "pi_1234567890",
      };
      const result = cardPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects missing stripe payment intent ID", () => {
      const data = {
        method: "card",
        amount: 100.00,
      };
      const result = cardPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects negative amount", () => {
      const data = {
        method: "card",
        amount: -100.00,
        stripePaymentIntentId: "pi_1234567890",
      };
      const result = cardPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Payment Schema (Discriminated Union) Tests
  // ============================================================================
  describe("paymentSchema", () => {
    it("validates cash payment", () => {
      const data: Payment = {
        method: "cash",
        amount: 50.00,
        tendered: 50.00,
        change: 0,
      };
      const result = paymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates card payment", () => {
      const data: Payment = {
        method: "card",
        amount: 50.00,
        stripePaymentIntentId: "pi_abc123",
      };
      const result = paymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects invalid method", () => {
      const data = {
        method: "check",
        amount: 50.00,
      };
      const result = paymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Checkout Schema Tests
  // ============================================================================
  describe("checkoutSchema", () => {
    const validProduct: CartItem = {
      type: "product",
      productId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Dive Mask",
      quantity: 1,
      unitPrice: 49.99,
      total: 49.99,
    };

    const validCashPayment: Payment = {
      method: "cash",
      amount: 54.99,
      tendered: 60.00,
      change: 5.01,
    };

    it("validates complete checkout", () => {
      const data = {
        items: [validProduct],
        payments: [validCashPayment],
        subtotal: 49.99,
        tax: 5.00,
        total: 54.99,
      };
      const result = checkoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates checkout with customer", () => {
      const data = {
        items: [validProduct],
        customerId: "550e8400-e29b-41d4-a716-446655440001",
        payments: [validCashPayment],
        subtotal: 49.99,
        tax: 5.00,
        total: 54.99,
      };
      const result = checkoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates checkout with notes", () => {
      const data = {
        items: [validProduct],
        payments: [validCashPayment],
        subtotal: 49.99,
        tax: 5.00,
        total: 54.99,
        notes: "Gift wrap requested",
      };
      const result = checkoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects empty cart", () => {
      const data = {
        items: [],
        payments: [validCashPayment],
        subtotal: 0,
        tax: 0,
        total: 0,
      };
      const result = checkoutSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Cart cannot be empty");
      }
    });

    it("rejects checkout without payment", () => {
      const data = {
        items: [validProduct],
        payments: [],
        subtotal: 49.99,
        tax: 5.00,
        total: 54.99,
      };
      const result = checkoutSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("At least one payment required");
      }
    });

    it("validates split payment checkout", () => {
      const cardPayment: Payment = {
        method: "card",
        amount: 30.00,
        stripePaymentIntentId: "pi_abc123",
      };
      const cashPayment: Payment = {
        method: "cash",
        amount: 24.99,
        tendered: 25.00,
        change: 0.01,
      };
      const data = {
        items: [validProduct],
        payments: [cardPayment, cashPayment],
        subtotal: 49.99,
        tax: 5.00,
        total: 54.99,
      };
      const result = checkoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates checkout with zero tax", () => {
      const data = {
        items: [validProduct],
        payments: [{
          method: "cash" as const,
          amount: 49.99,
          tendered: 50.00,
          change: 0.01,
        }],
        subtotal: 49.99,
        tax: 0,
        total: 49.99,
      };
      const result = checkoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates checkout with multiple items", () => {
      const rental: CartItem = {
        type: "rental",
        equipmentId: "550e8400-e29b-41d4-a716-446655440002",
        name: "BCD",
        days: 1,
        dailyRate: 25.00,
        total: 25.00,
      };
      const data = {
        items: [validProduct, rental],
        payments: [validCashPayment],
        subtotal: 74.99,
        tax: 7.50,
        total: 82.49,
      };
      const result = checkoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Rental Agreement Schema Tests
  // ============================================================================
  describe("rentalAgreementSchema", () => {
    it("validates valid rental agreement", () => {
      const data = {
        rentalItems: [
          {
            equipmentId: "550e8400-e29b-41d4-a716-446655440000",
            days: 3,
            dueAt: "2025-01-20T17:00:00.000Z",
          },
        ],
        customerId: "550e8400-e29b-41d4-a716-446655440001",
        agreementSignedBy: "John Staff",
      };
      const result = rentalAgreementSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates agreement with multiple items", () => {
      const data = {
        rentalItems: [
          {
            equipmentId: "550e8400-e29b-41d4-a716-446655440000",
            days: 2,
            dueAt: "2025-01-19T17:00:00.000Z",
          },
          {
            equipmentId: "550e8400-e29b-41d4-a716-446655440001",
            days: 2,
            dueAt: "2025-01-19T17:00:00.000Z",
          },
        ],
        customerId: "550e8400-e29b-41d4-a716-446655440002",
        agreementSignedBy: "Jane Manager",
      };
      const result = rentalAgreementSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects empty staff name", () => {
      const data = {
        rentalItems: [
          {
            equipmentId: "550e8400-e29b-41d4-a716-446655440000",
            days: 3,
            dueAt: "2025-01-20T17:00:00.000Z",
          },
        ],
        customerId: "550e8400-e29b-41d4-a716-446655440001",
        agreementSignedBy: "",
      };
      const result = rentalAgreementSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Staff name required");
      }
    });

    it("rejects invalid customer UUID", () => {
      const data = {
        rentalItems: [
          {
            equipmentId: "550e8400-e29b-41d4-a716-446655440000",
            days: 3,
            dueAt: "2025-01-20T17:00:00.000Z",
          },
        ],
        customerId: "not-a-uuid",
        agreementSignedBy: "John Staff",
      };
      const result = rentalAgreementSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects zero days", () => {
      const data = {
        rentalItems: [
          {
            equipmentId: "550e8400-e29b-41d4-a716-446655440000",
            days: 0,
            dueAt: "2025-01-20T17:00:00.000Z",
          },
        ],
        customerId: "550e8400-e29b-41d4-a716-446655440001",
        agreementSignedBy: "John Staff",
      };
      const result = rentalAgreementSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});

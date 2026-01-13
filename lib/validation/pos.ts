/**
 * POS Validation Schemas
 */

import { z } from "zod";

// Cart item types
export const cartProductSchema = z.object({
  type: z.literal("product"),
  productId: z.string().uuid(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  total: z.number().positive(),
});

export const cartRentalSchema = z.object({
  type: z.literal("rental"),
  equipmentId: z.string().uuid(),
  name: z.string(),
  size: z.string().optional(),
  days: z.number().int().positive(),
  dailyRate: z.number().positive(),
  total: z.number().positive(),
});

export const cartBookingSchema = z.object({
  type: z.literal("booking"),
  tripId: z.string().uuid(),
  tourName: z.string(),
  participants: z.number().int().positive(),
  unitPrice: z.number().positive(),
  total: z.number().positive(),
});

export const cartItemSchema = z.discriminatedUnion("type", [
  cartProductSchema,
  cartRentalSchema,
  cartBookingSchema,
]);

export type CartItem = z.infer<typeof cartItemSchema>;
export type CartProduct = z.infer<typeof cartProductSchema>;
export type CartRental = z.infer<typeof cartRentalSchema>;
export type CartBooking = z.infer<typeof cartBookingSchema>;

// Payment schemas
export const cashPaymentSchema = z.object({
  method: z.literal("cash"),
  amount: z.number().positive(),
  tendered: z.number().positive(),
  change: z.number().min(0),
});

export const cardPaymentSchema = z.object({
  method: z.literal("card"),
  amount: z.number().positive(),
  stripePaymentIntentId: z.string(),
});

export const paymentSchema = z.discriminatedUnion("method", [
  cashPaymentSchema,
  cardPaymentSchema,
]);

export type Payment = z.infer<typeof paymentSchema>;

// Checkout schema
export const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Cart cannot be empty"),
  customerId: z.string().uuid().optional(),
  payments: z.array(paymentSchema).min(1, "At least one payment required"),
  subtotal: z.number().positive(),
  tax: z.number().min(0),
  total: z.number().positive(),
  notes: z.string().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// Rental agreement confirmation
export const rentalAgreementSchema = z.object({
  rentalItems: z.array(z.object({
    equipmentId: z.string().uuid(),
    days: z.number().int().positive(),
    dueAt: z.string().datetime(),
  })),
  customerId: z.string().uuid(),
  agreementSignedBy: z.string().min(1, "Staff name required"),
});

export type RentalAgreementInput = z.infer<typeof rentalAgreementSchema>;

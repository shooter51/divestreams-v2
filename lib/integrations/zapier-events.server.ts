/**
 * Zapier Event Triggers
 *
 * Functions to trigger Zapier webhooks when events occur in the application.
 * These should be called from business logic (booking creation, payment processing, etc.)
 */

import { triggerWebhookEvent } from "./zapier-enhanced.server";
import type { ZapierTriggerType } from "./zapier.server";

// ============================================================================
// BOOKING EVENTS
// ============================================================================

export async function triggerBookingCreated(
  orgId: string,
  booking: {
    id: string;
    bookingNumber: string;
    tripName: string;
    tripDate: string;
    customerName: string;
    customerEmail: string;
    participants: number;
    totalAmount: number;
    currency: string;
    status: string;
  }
): Promise<void> {
  await triggerWebhookEvent(orgId, "booking.created", {
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    tripName: booking.tripName,
    tripDate: booking.tripDate,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    participants: booking.participants,
    totalAmount: booking.totalAmount,
    currency: booking.currency,
    status: booking.status,
  });
}

export async function triggerBookingUpdated(
  orgId: string,
  booking: {
    id: string;
    bookingNumber: string;
    tripName: string;
    tripDate: string;
    customerName: string;
    customerEmail: string;
    participants: number;
    totalAmount: number;
    currency: string;
    status: string;
    previousStatus?: string;
  }
): Promise<void> {
  await triggerWebhookEvent(orgId, "booking.updated", {
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    tripName: booking.tripName,
    tripDate: booking.tripDate,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    participants: booking.participants,
    totalAmount: booking.totalAmount,
    currency: booking.currency,
    status: booking.status,
    previousStatus: booking.previousStatus,
  });
}

export async function triggerBookingCancelled(
  orgId: string,
  booking: {
    id: string;
    bookingNumber: string;
    tripName: string;
    tripDate: string;
    customerName: string;
    customerEmail: string;
    cancellationReason?: string;
  }
): Promise<void> {
  await triggerWebhookEvent(orgId, "booking.cancelled", {
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    tripName: booking.tripName,
    tripDate: booking.tripDate,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    cancellationReason: booking.cancellationReason,
  });
}

// ============================================================================
// CUSTOMER EVENTS
// ============================================================================

export async function triggerCustomerCreated(
  orgId: string,
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
  }
): Promise<void> {
  await triggerWebhookEvent(orgId, "customer.created", {
    customerId: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    totalBookings: 0,
    lifetimeValue: 0,
  });
}

export async function triggerCustomerUpdated(
  orgId: string,
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    totalBookings: number;
    lifetimeValue: number;
  }
): Promise<void> {
  await triggerWebhookEvent(orgId, "customer.updated", {
    customerId: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    totalBookings: customer.totalBookings,
    lifetimeValue: customer.lifetimeValue,
  });
}

// ============================================================================
// PAYMENT EVENTS
// ============================================================================

export async function triggerPaymentReceived(
  orgId: string,
  payment: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    bookingNumber: string;
    customerEmail: string;
    paymentMethod: string;
  }
): Promise<void> {
  await triggerWebhookEvent(orgId, "payment.received", {
    paymentId: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    bookingNumber: payment.bookingNumber,
    customerEmail: payment.customerEmail,
    paymentMethod: payment.paymentMethod,
  });
}

export async function triggerPaymentRefunded(
  orgId: string,
  payment: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    bookingNumber: string;
    customerEmail: string;
    refundReason?: string;
  }
): Promise<void> {
  await triggerWebhookEvent(orgId, "payment.refunded", {
    paymentId: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    bookingNumber: payment.bookingNumber,
    customerEmail: payment.customerEmail,
    refundReason: payment.refundReason,
  });
}

// ============================================================================
// TRIP EVENTS
// ============================================================================

export async function triggerTripCreated(
  orgId: string,
  trip: {
    id: string;
    name: string;
    date: string;
    startTime: string;
    endTime: string;
    capacity: number;
    bookedSpots: number;
    status: string;
  }
): Promise<void> {
  await triggerWebhookEvent(orgId, "trip.created", {
    tripId: trip.id,
    tripName: trip.name,
    date: trip.date,
    startTime: trip.startTime,
    endTime: trip.endTime,
    capacity: trip.capacity,
    bookedSpots: trip.bookedSpots,
    status: trip.status,
  });
}

export async function triggerTripCompleted(
  orgId: string,
  trip: {
    id: string;
    name: string;
    date: string;
    startTime: string;
    endTime: string;
    capacity: number;
    bookedSpots: number;
    status: string;
  }
): Promise<void> {
  await triggerWebhookEvent(orgId, "trip.completed", {
    tripId: trip.id,
    tripName: trip.name,
    date: trip.date,
    startTime: trip.startTime,
    endTime: trip.endTime,
    capacity: trip.capacity,
    bookedSpots: trip.bookedSpots,
    status: trip.status,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Trigger a custom event (for future extensibility)
 */
export async function triggerCustomEvent(
  orgId: string,
  eventType: ZapierTriggerType,
  eventData: Record<string, unknown>
): Promise<void> {
  await triggerWebhookEvent(orgId, eventType, eventData);
}

/**
 * Booking Queries
 *
 * All booking-related database operations including CRUD, payments,
 * and full detail lookups.
 */

import { desc, eq, gte, and, sql } from "drizzle-orm";
import { db } from "../index";
import * as schema from "../schema";
import { dbLogger } from "../../logger";
import { mapBooking } from "./mappers";
import { formatRelativeTime } from "./formatters";
import { getOrganizationById } from "./reports.server";
import { getCustomerById } from "./customers.server";
import { getTripById } from "./trips.server";

// ============================================================================
// Dashboard Booking Queries
// ============================================================================

export async function getRecentBookings(organizationId: string, limit = 5) {
  const bookings = await db
    .select({
      id: schema.bookings.id,
      status: schema.bookings.status,
      total: schema.bookings.total,
      createdAt: schema.bookings.createdAt,
      firstName: schema.customers.firstName,
      lastName: schema.customers.lastName,
      tourName: schema.tours.name,
    })
    .from(schema.bookings)
    .innerJoin(schema.customers, eq(schema.bookings.customerId, schema.customers.id))
    .innerJoin(schema.trips, eq(schema.bookings.tripId, schema.trips.id))
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(eq(schema.bookings.organizationId, organizationId))
    .orderBy(desc(schema.bookings.createdAt))
    .limit(limit);

  return bookings.map((booking) => ({
    id: booking.id,
    customer: `${booking.firstName} ${booking.lastName}`,
    trip: booking.tourName,
    date: formatRelativeTime(booking.createdAt),
    status: booking.status,
    amount: Number(booking.total || 0),
  }));
}

// ============================================================================
// Booking CRUD Queries
// ============================================================================

export async function getBookings(
  organizationId: string,
  options: { status?: string; tripId?: string; customerId?: string; limit?: number; offset?: number } = {}
) {
  const { status, tripId, customerId, limit = 50, offset = 0 } = options;

  const whereConditions = [eq(schema.bookings.organizationId, organizationId)];
  if (status) whereConditions.push(eq(schema.bookings.status, status));
  if (tripId) whereConditions.push(eq(schema.bookings.tripId, tripId));
  if (customerId) whereConditions.push(eq(schema.bookings.customerId, customerId));

  const bookings = await db
    .select({
      booking: schema.bookings,
      firstName: schema.customers.firstName,
      lastName: schema.customers.lastName,
      customerEmail: schema.customers.email,
      customerPhone: schema.customers.phone,
      tourName: schema.tours.name,
      tripDate: schema.trips.date,
      tripTime: schema.trips.startTime,
    })
    .from(schema.bookings)
    .innerJoin(schema.customers, eq(schema.bookings.customerId, schema.customers.id))
    .innerJoin(schema.trips, eq(schema.bookings.tripId, schema.trips.id))
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(and(...whereConditions))
    .orderBy(desc(schema.bookings.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.bookings)
    .where(and(...whereConditions));

  return {
    bookings: bookings.map((row) => mapBooking({
      ...row.booking,
      first_name: row.firstName,
      last_name: row.lastName,
      customer_email: row.customerEmail,
      customer_phone: row.customerPhone,
      tour_name: row.tourName,
      trip_date: row.tripDate,
      trip_time: row.tripTime,
    })),
    total: Number(countResult[0]?.count || 0),
  };
}

export async function getBookingById(organizationId: string, id: string) {
  const [result] = await db
    .select({
      booking: schema.bookings,
      firstName: schema.customers.firstName,
      lastName: schema.customers.lastName,
      customerEmail: schema.customers.email,
      customerPhone: schema.customers.phone,
      tourName: schema.tours.name,
      tripDate: schema.trips.date,
      tripTime: schema.trips.startTime,
    })
    .from(schema.bookings)
    .innerJoin(schema.customers, eq(schema.bookings.customerId, schema.customers.id))
    .innerJoin(schema.trips, eq(schema.bookings.tripId, schema.trips.id))
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(and(
      eq(schema.bookings.organizationId, organizationId),
      eq(schema.bookings.id, id)
    ))
    .limit(1);

  if (!result) return null;

  return mapBooking({
    ...result.booking,
    first_name: result.firstName,
    last_name: result.lastName,
    customer_email: result.customerEmail,
    customer_phone: result.customerPhone,
    tour_name: result.tourName,
    trip_date: result.tripDate,
    trip_time: result.tripTime,
  });
}

export async function createBooking(organizationId: string, data: {
  tripId: string;
  customerId: string;
  participants?: number;
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  currency?: string;
  specialRequests?: string;
  source?: string;
}) {
  const bookingNumber = `BK${Date.now().toString(36).toUpperCase()}`;

  const [booking] = await db
    .insert(schema.bookings)
    .values({
      organizationId,
      bookingNumber,
      tripId: data.tripId,
      customerId: data.customerId,
      participants: data.participants || 1,
      subtotal: String(data.subtotal),
      discount: String(data.discount || 0),
      tax: String(data.tax || 0),
      total: String(data.total),
      currency: data.currency || "USD",
      specialRequests: data.specialRequests || null,
      source: data.source || "direct",
    })
    .returning();

  // Sync booking to Google Calendar if integration is active
  // Run async to not block booking creation
  import("../../integrations/google-calendar-bookings.server")
    .then(({ syncBookingToCalendar }) => {
      const org = getOrganizationById(organizationId);
      const timezone = org.then((o: any) => o?.timezone || "UTC");
      timezone.then((tz: string) =>
        syncBookingToCalendar(organizationId, data.tripId, tz).catch((error) =>
          dbLogger.error({ err: error, bookingId: booking.id, organizationId }, "Google Calendar booking sync failed")
        )
      );
    })
    .catch((error) => dbLogger.error({ err: error }, "Failed to load Google Calendar module"));

  return booking;
}

export async function updateBookingStatus(organizationId: string, id: string, status: string) {
  const [booking] = await db
    .update(schema.bookings)
    .set({ status, updatedAt: new Date() })
    .where(and(
      eq(schema.bookings.organizationId, organizationId),
      eq(schema.bookings.id, id)
    ))
    .returning();

  // Sync booking cancellation to Google Calendar if status is cancelled
  if (booking && (status === "cancelled" || status === "no_show")) {
    import("../../integrations/google-calendar-bookings.server")
      .then(({ syncBookingCancellationToCalendar }) => {
        const org = getOrganizationById(organizationId);
        const timezone = org.then((o: any) => o?.timezone || "UTC");
        timezone.then((tz: string) =>
          syncBookingCancellationToCalendar(organizationId, booking.tripId, tz).catch((error) =>
            dbLogger.error({ err: error, bookingId: booking.id, organizationId }, "Google Calendar booking cancellation sync failed")
          )
        );
      })
      .catch((error) => dbLogger.error({ err: error }, "Failed to load Google Calendar module"));
  }

  return booking;
}

// ============================================================================
// Booking Status Report
// ============================================================================

export interface BookingsByStatus {
  status: string;
  count: number;
}

export async function getBookingsByStatus(organizationId: string): Promise<BookingsByStatus[]> {
  const result = await db
    .select({
      status: schema.bookings.status,
      count: sql<number>`count(*)`,
    })
    .from(schema.bookings)
    .where(eq(schema.bookings.organizationId, organizationId))
    .groupBy(schema.bookings.status);

  return result.map((row) => ({
    status: row.status,
    count: Number(row.count),
  }));
}

// ============================================================================
// Booking Detail Queries
// ============================================================================

export async function getBookingWithFullDetails(organizationId: string, id: string) {
  const booking = await getBookingById(organizationId, id);
  if (!booking) return null;

  const customer = await getCustomerById(organizationId, booking.customerId);
  const trip = await getTripById(organizationId, booking.tripId);

  // Calculate pricing structure expected by UI
  const basePrice = trip?.price || booking.total / (booking.participants || 1);
  const balanceDue = (booking.total - booking.paidAmount).toFixed(2);

  return {
    ...booking,
    customer: {
      id: customer?.id || booking.customerId,
      firstName: customer?.firstName || "Unknown",
      lastName: customer?.lastName || "Customer",
      email: customer?.email || "",
      phone: customer?.phone || "",
    },
    trip: {
      id: trip?.id || booking.tripId,
      tourId: trip?.tourId || "",
      tourName: trip?.tourName || "Unknown Trip",
      date: trip?.date || "",
      startTime: trip?.startTime || "",
      endTime: trip?.endTime || "",
      boatName: trip?.boatName || "",
    },
    pricing: {
      basePrice: basePrice.toFixed(2),
      participants: booking.participants,
      subtotal: booking.subtotal.toFixed(2),
      equipmentTotal: "0.00",
      discount: booking.discount.toFixed(2),
      total: booking.total.toFixed(2),
    },
    paidAmount: booking.paidAmount.toFixed(2),
    balanceDue,
    participantDetails: [],
    equipmentRental: [],
    internalNotes: null,
  };
}

export async function getPaymentsByBookingId(organizationId: string, bookingId: string) {
  const payments = await db
    .select()
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.organizationId, organizationId),
      eq(schema.transactions.bookingId, bookingId)
    ))
    .orderBy(desc(schema.transactions.createdAt));

  return payments.map((p) => ({
    id: p.id,
    type: p.type,
    amount: Number(p.amount),
    method: p.paymentMethod,
    date: p.createdAt,
    note: p.notes,
  }));
}

export async function recordPayment(organizationId: string, data: {
  bookingId: string;
  amount: number;
  paymentMethod: string;
  notes?: string;
}) {
  const { bookingId, amount, paymentMethod, notes } = data;

  // SECURITY: Validate payment amount doesn't exceed remaining balance
  const [booking] = await db
    .select({
      total: schema.bookings.total,
      paidAmount: schema.bookings.paidAmount,
    })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId));

  if (!booking) {
    throw new Error("Booking not found");
  }

  const totalDue = Number(booking.total);
  const alreadyPaid = Number(booking.paidAmount || 0);
  const remainingBalance = totalDue - alreadyPaid;

  // Allow overpayment by max 1 cent (for rounding)
  if (amount > remainingBalance + 0.01) {
    throw new Error(
      `Payment amount ($${amount.toFixed(2)}) exceeds remaining balance ($${remainingBalance.toFixed(2)})`
    );
  }

  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  // Create the transaction record
  const [transaction] = await db
    .insert(schema.transactions)
    .values({
      organizationId,
      bookingId,
      type: "payment",
      amount: String(amount),
      paymentMethod,
      notes,
    })
    .returning();

  // Update the booking's paid amount
  const updatedPaidAmount = alreadyPaid + amount;
  await db
    .update(schema.bookings)
    .set({
      paidAmount: String(updatedPaidAmount),
      paymentStatus: updatedPaidAmount >= totalDue - 0.01 ? "paid" : "partial",
      updatedAt: new Date(),
    })
    .where(eq(schema.bookings.id, bookingId));

  if (booking) {
    const newPaidAmount = Number(booking.paidAmount || 0) + amount;
    await db
      .update(schema.bookings)
      .set({
        paidAmount: String(newPaidAmount),
        paymentStatus: "partial", // Will be updated to "paid" if full
        updatedAt: new Date(),
      })
      .where(eq(schema.bookings.id, bookingId));

    // Check if fully paid and update status
    const [updatedBooking] = await db
      .select({ total: schema.bookings.total, paidAmount: schema.bookings.paidAmount })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId));

    if (updatedBooking && Number(updatedBooking.paidAmount) >= Number(updatedBooking.total)) {
      await db
        .update(schema.bookings)
        .set({ paymentStatus: "paid" })
        .where(eq(schema.bookings.id, bookingId));
    }
  }

  return transaction;
}

// ============================================================================
// Monthly Booking Count (billing)
// ============================================================================

export async function getMonthlyBookingCount(organizationId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.bookings)
    .where(and(
      eq(schema.bookings.organizationId, organizationId),
      gte(schema.bookings.createdAt, startOfMonth)
    ));

  return Number(result[0]?.count || 0);
}

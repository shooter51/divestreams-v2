/**
 * Public Mutations for Booking Widget
 *
 * These mutations are used by the embed widget to create bookings.
 * All mutations filter by organizationId to support organization-based multi-tenancy.
 */

import { db } from "./index";
import { eq, and, sql } from "drizzle-orm";
import * as schema from "./schema";
import { nanoid } from "nanoid";

// Generate a unique booking number
function generateBookingNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = nanoid(4).toUpperCase();
  return `BK-${timestamp}-${random}`;
}

export interface CreateWidgetBookingInput {
  tripId: string;
  participants: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  specialRequests?: string;
}

export interface WidgetBookingResult {
  id: string;
  bookingNumber: string;
  tripId: string;
  customerId: string;
  participants: number;
  total: string;
  currency: string;
  status: string;
  paymentStatus: string;
}

export async function createWidgetBooking(
  organizationId: string,
  input: CreateWidgetBookingInput
): Promise<WidgetBookingResult> {
  // Get trip details and verify availability
  const tripData = await db
    .select({
      id: schema.trips.id,
      tourId: schema.trips.tourId,
      tripMaxParticipants: schema.trips.maxParticipants,
      tourMaxParticipants: schema.tours.maxParticipants,
      tripPrice: schema.trips.price,
      tourPrice: schema.tours.price,
      currency: schema.tours.currency,
      date: schema.trips.date,
      status: schema.trips.status,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(
      and(
        eq(schema.trips.organizationId, organizationId),
        eq(schema.trips.id, input.tripId),
        eq(schema.trips.status, "scheduled"),
        eq(schema.tours.isActive, true)
      )
    )
    .limit(1);

  if (tripData.length === 0) {
    throw new Error("Trip not found or not available");
  }

  const trip = tripData[0];

  // Get current booking count for the trip
  const bookingCount = await db
    .select({ total: sql<number>`COALESCE(SUM(participants), 0)` })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.tripId, input.tripId),
        sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
      )
    );

  const maxParticipants = Number(trip.tripMaxParticipants || trip.tourMaxParticipants);
  const bookedParticipants = Number(bookingCount[0]?.total || 0);
  const availableSpots = maxParticipants - bookedParticipants;

  if (input.participants > availableSpots) {
    throw new Error(`Only ${availableSpots} spots available`);
  }

  // Check if trip is in the future
  const tripDate = new Date(trip.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (tripDate < today) {
    throw new Error("Cannot book past trips");
  }

  // Find or create customer
  const existingCustomers = await db
    .select({ id: schema.customers.id })
    .from(schema.customers)
    .where(
      and(
        eq(schema.customers.organizationId, organizationId),
        eq(schema.customers.email, input.email.toLowerCase())
      )
    )
    .limit(1);

  let customerId: string;

  if (existingCustomers.length > 0) {
    customerId = existingCustomers[0].id;

    // Update customer info
    await db
      .update(schema.customers)
      .set({
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.customers.id, customerId));
  } else {
    // Create new customer
    const newCustomer = await db
      .insert(schema.customers)
      .values({
        organizationId,
        email: input.email.toLowerCase(),
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || null,
      })
      .returning({ id: schema.customers.id });

    customerId = newCustomer[0].id;
  }

  // Calculate pricing
  const pricePerPerson = parseFloat(trip.tripPrice || trip.tourPrice);
  const subtotal = pricePerPerson * input.participants;
  const tax = 0; // Tax calculation can be added later
  const total = subtotal + tax;

  // Generate booking number
  const bookingNumber = generateBookingNumber();

  // Create booking
  const newBooking = await db
    .insert(schema.bookings)
    .values({
      organizationId,
      bookingNumber,
      tripId: input.tripId,
      customerId,
      participants: input.participants,
      status: "pending",
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      currency: trip.currency,
      paymentStatus: "pending",
      specialRequests: input.specialRequests || null,
      source: "widget",
    })
    .returning({
      id: schema.bookings.id,
      bookingNumber: schema.bookings.bookingNumber,
      tripId: schema.bookings.tripId,
      customerId: schema.bookings.customerId,
      participants: schema.bookings.participants,
      total: schema.bookings.total,
      currency: schema.bookings.currency,
      status: schema.bookings.status,
      paymentStatus: schema.bookings.paymentStatus,
    });

  const booking = newBooking[0];

  return {
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    tripId: booking.tripId,
    customerId: booking.customerId,
    participants: Number(booking.participants),
    total: booking.total,
    currency: booking.currency,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
  };
}

// Get booking details for confirmation page
export interface BookingDetails {
  id: string;
  bookingNumber: string;
  status: string;
  paymentStatus: string;
  participants: number;
  subtotal: string;
  tax: string;
  total: string;
  currency: string;
  specialRequests: string | null;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  trip: {
    id: string;
    date: string;
    startTime: string;
    endTime: string | null;
    tourName: string;
    tourDescription: string | null;
    primaryImage: string | null;
  };
  createdAt: string;
}

export async function getBookingDetails(
  organizationId: string,
  bookingId: string,
  bookingNumber: string
): Promise<BookingDetails | null> {
  // Get booking with customer and trip info
  const bookings = await db
    .select({
      id: schema.bookings.id,
      bookingNumber: schema.bookings.bookingNumber,
      status: schema.bookings.status,
      paymentStatus: schema.bookings.paymentStatus,
      participants: schema.bookings.participants,
      subtotal: schema.bookings.subtotal,
      tax: schema.bookings.tax,
      total: schema.bookings.total,
      currency: schema.bookings.currency,
      specialRequests: schema.bookings.specialRequests,
      createdAt: schema.bookings.createdAt,
      // Customer
      customerFirstName: schema.customers.firstName,
      customerLastName: schema.customers.lastName,
      customerEmail: schema.customers.email,
      customerPhone: schema.customers.phone,
      // Trip
      tripId: schema.trips.id,
      tripDate: schema.trips.date,
      tripStartTime: schema.trips.startTime,
      tripEndTime: schema.trips.endTime,
      // Tour
      tourId: schema.tours.id,
      tourName: schema.tours.name,
      tourDescription: schema.tours.description,
    })
    .from(schema.bookings)
    .innerJoin(schema.customers, eq(schema.bookings.customerId, schema.customers.id))
    .innerJoin(schema.trips, eq(schema.bookings.tripId, schema.trips.id))
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(
      and(
        eq(schema.bookings.organizationId, organizationId),
        eq(schema.bookings.id, bookingId),
        eq(schema.bookings.bookingNumber, bookingNumber)
      )
    )
    .limit(1);

  if (bookings.length === 0) {
    return null;
  }

  const b = bookings[0];

  // Get primary image for the tour
  const images = await db
    .select({ url: schema.images.url })
    .from(schema.images)
    .where(
      and(
        eq(schema.images.organizationId, organizationId),
        eq(schema.images.entityType, "tour"),
        eq(schema.images.entityId, b.tourId),
        eq(schema.images.isPrimary, true)
      )
    )
    .limit(1);

  return {
    id: b.id,
    bookingNumber: b.bookingNumber,
    status: b.status,
    paymentStatus: b.paymentStatus,
    participants: Number(b.participants),
    subtotal: b.subtotal,
    tax: b.tax ?? "0",
    total: b.total,
    currency: b.currency,
    specialRequests: b.specialRequests,
    customer: {
      firstName: b.customerFirstName,
      lastName: b.customerLastName,
      email: b.customerEmail,
      phone: b.customerPhone,
    },
    trip: {
      id: b.tripId,
      date: b.tripDate,
      startTime: b.tripStartTime,
      endTime: b.tripEndTime,
      tourName: b.tourName,
      tourDescription: b.tourDescription,
      primaryImage: images[0]?.url || null,
    },
    createdAt: b.createdAt.toISOString(),
  };
}

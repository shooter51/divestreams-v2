/**
 * Public Mutations for Booking Widget
 *
 * These mutations are used by the embed widget to create bookings.
 */

import postgres from "postgres";
import { nanoid } from "nanoid";

function getClient(schemaName: string) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }
  return postgres(connectionString);
}

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
  schemaName: string,
  input: CreateWidgetBookingInput
): Promise<WidgetBookingResult> {
  const client = getClient(schemaName);

  try {
    // Get trip details and verify availability
    const trips = await client.unsafe(`
      SELECT
        t.id,
        t.tour_id,
        COALESCE(t.max_participants, tr.max_participants) as max_participants,
        COALESCE(t.price, tr.price) as price,
        tr.currency,
        t.date,
        t.status,
        (
          SELECT COALESCE(SUM(b.participants), 0)
          FROM "${schemaName}".bookings b
          WHERE b.trip_id = t.id AND b.status NOT IN ('canceled', 'no_show')
        ) as booked_participants
      FROM "${schemaName}".trips t
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      WHERE t.id = '${input.tripId}'
        AND t.status = 'scheduled'
        AND tr.is_active = true
    `);

    if (trips.length === 0) {
      throw new Error("Trip not found or not available");
    }

    const trip = trips[0];
    const maxParticipants = Number(trip.max_participants);
    const bookedParticipants = Number(trip.booked_participants || 0);
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
    const existingCustomers = await client.unsafe(`
      SELECT id FROM "${schemaName}".customers
      WHERE email = '${input.email.replace(/'/g, "''")}'
      LIMIT 1
    `);

    let customerId: string;

    if (existingCustomers.length > 0) {
      customerId = existingCustomers[0].id;

      // Update customer info
      await client.unsafe(`
        UPDATE "${schemaName}".customers
        SET
          first_name = '${input.firstName.replace(/'/g, "''")}',
          last_name = '${input.lastName.replace(/'/g, "''")}',
          phone = ${input.phone ? `'${input.phone.replace(/'/g, "''")}'` : "phone"},
          updated_at = NOW()
        WHERE id = '${customerId}'
      `);
    } else {
      // Create new customer
      const newCustomer = await client.unsafe(`
        INSERT INTO "${schemaName}".customers (
          email,
          first_name,
          last_name,
          phone
        ) VALUES (
          '${input.email.replace(/'/g, "''")}',
          '${input.firstName.replace(/'/g, "''")}',
          '${input.lastName.replace(/'/g, "''")}',
          ${input.phone ? `'${input.phone.replace(/'/g, "''")}'` : "NULL"}
        )
        RETURNING id
      `);

      customerId = newCustomer[0].id;
    }

    // Calculate pricing
    const pricePerPerson = parseFloat(trip.price);
    const subtotal = pricePerPerson * input.participants;
    const tax = 0; // Tax calculation can be added later
    const total = subtotal + tax;

    // Generate booking number
    const bookingNumber = generateBookingNumber();

    // Create booking
    const bookings = await client.unsafe(`
      INSERT INTO "${schemaName}".bookings (
        booking_number,
        trip_id,
        customer_id,
        participants,
        status,
        subtotal,
        tax,
        total,
        currency,
        payment_status,
        special_requests,
        source
      ) VALUES (
        '${bookingNumber}',
        '${input.tripId}',
        '${customerId}',
        ${input.participants},
        'pending',
        ${subtotal.toFixed(2)},
        ${tax.toFixed(2)},
        ${total.toFixed(2)},
        '${trip.currency}',
        'pending',
        ${input.specialRequests ? `'${input.specialRequests.replace(/'/g, "''")}'` : "NULL"},
        'widget'
      )
      RETURNING id, booking_number, trip_id, customer_id, participants, total, currency, status, payment_status
    `);

    const booking = bookings[0];

    return {
      id: booking.id,
      bookingNumber: booking.booking_number,
      tripId: booking.trip_id,
      customerId: booking.customer_id,
      participants: Number(booking.participants),
      total: booking.total,
      currency: booking.currency,
      status: booking.status,
      paymentStatus: booking.payment_status,
    };
  } finally {
    await client.end();
  }
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
  schemaName: string,
  bookingId: string,
  bookingNumber: string
): Promise<BookingDetails | null> {
  const client = getClient(schemaName);

  try {
    const bookings = await client.unsafe(`
      SELECT
        b.id,
        b.booking_number,
        b.status,
        b.payment_status,
        b.participants,
        b.subtotal,
        b.tax,
        b.total,
        b.currency,
        b.special_requests,
        b.created_at,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        t.id as trip_id,
        t.date,
        t.start_time,
        t.end_time,
        tr.name as tour_name,
        tr.description as tour_description,
        (
          SELECT url FROM "${schemaName}".images
          WHERE entity_type = 'tour' AND entity_id = tr.id AND is_primary = true
          LIMIT 1
        ) as primary_image
      FROM "${schemaName}".bookings b
      JOIN "${schemaName}".customers c ON b.customer_id = c.id
      JOIN "${schemaName}".trips t ON b.trip_id = t.id
      JOIN "${schemaName}".tours tr ON t.tour_id = tr.id
      WHERE b.id = '${bookingId}' AND b.booking_number = '${bookingNumber}'
    `);

    if (bookings.length === 0) {
      return null;
    }

    const b = bookings[0];

    return {
      id: b.id,
      bookingNumber: b.booking_number,
      status: b.status,
      paymentStatus: b.payment_status,
      participants: Number(b.participants),
      subtotal: b.subtotal,
      tax: b.tax,
      total: b.total,
      currency: b.currency,
      specialRequests: b.special_requests,
      customer: {
        firstName: b.first_name,
        lastName: b.last_name,
        email: b.email,
        phone: b.phone,
      },
      trip: {
        id: b.trip_id,
        date: b.date,
        startTime: b.start_time,
        endTime: b.end_time,
        tourName: b.tour_name,
        tourDescription: b.tour_description,
        primaryImage: b.primary_image,
      },
      createdAt: b.created_at,
    };
  } finally {
    await client.end();
  }
}

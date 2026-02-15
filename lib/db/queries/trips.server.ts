/**
 * Trip Queries
 *
 * All trip-related database operations including calendar views, detail lookups,
 * revenue calculations, and participant counts.
 */

import { desc, eq, gte, lte, and, sql, inArray } from "drizzle-orm";
import { db } from "../index";
import * as schema from "../schema";
import { dbLogger } from "../../logger";
import { mapTrip } from "./mappers";
import { formatRelativeDate, formatTime, formatDateString, formatTimeString } from "./formatters";
import { getOrganizationById } from "./reports.server";
import { getBookings } from "./bookings.server";
import { getTourById } from "./tours.server";
import { getBoatById } from "./boats.server";
import { getDiveSitesForTour } from "./dive-sites.server";

// ============================================================================
// Dashboard Trip Queries
// ============================================================================

export async function getUpcomingTrips(organizationId: string, limit = 5) {
  const today = new Date().toISOString().split("T")[0];

  const trips = await db
    .select({
      id: schema.trips.id,
      name: schema.tours.name,
      date: schema.trips.date,
      startTime: schema.trips.startTime,
      maxParticipants: sql<number>`COALESCE(${schema.trips.maxParticipants}, ${schema.tours.maxParticipants})`,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(and(
      eq(schema.trips.organizationId, organizationId),
      gte(schema.trips.date, today),
      eq(schema.trips.status, "scheduled")
    ))
    .orderBy(schema.trips.date, schema.trips.startTime)
    .limit(limit);

  // Get participant counts in a single batch query
  if (trips.length === 0) return [];

  const tripIds = trips.map(t => t.id);
  const participantCounts = await db
    .select({
      tripId: schema.bookings.tripId,
      total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)`,
    })
    .from(schema.bookings)
    .where(and(
      inArray(schema.bookings.tripId, tripIds),
      sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
    ))
    .groupBy(schema.bookings.tripId);

  const countMap = new Map(participantCounts.map(p => [p.tripId, Number(p.total)]));

  return trips.map(trip => ({
    id: trip.id,
    name: trip.name,
    date: formatRelativeDate(trip.date),
    time: formatTime(trip.startTime),
    participants: countMap.get(trip.id) || 0,
    maxParticipants: Number(trip.maxParticipants || 0),
  }));
}

// ============================================================================
// Trip CRUD Queries
// ============================================================================

export async function getTrips(
  organizationId: string,
  options: { fromDate?: string; toDate?: string; status?: string; limit?: number } = {}
) {
  const { fromDate, toDate, status, limit = 50 } = options;

  const whereConditions = [eq(schema.trips.organizationId, organizationId)];
  if (fromDate) whereConditions.push(gte(schema.trips.date, fromDate));
  if (toDate) whereConditions.push(lte(schema.trips.date, toDate));
  if (status) whereConditions.push(eq(schema.trips.status, status));

  const trips = await db
    .select({
      trip: schema.trips,
      tourName: schema.tours.name,
      tourType: schema.tours.type,
      boatName: schema.boats.name,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .leftJoin(schema.boats, eq(schema.trips.boatId, schema.boats.id))
    .where(and(...whereConditions))
    .orderBy(schema.trips.date, schema.trips.startTime)
    .limit(limit);

  // Get booked participants in a single batch query
  if (trips.length === 0) return [];

  const tripIds = trips.map(r => r.trip.id);
  const participantCounts = await db
    .select({
      tripId: schema.bookings.tripId,
      total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)`,
    })
    .from(schema.bookings)
    .where(and(
      inArray(schema.bookings.tripId, tripIds),
      sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
    ))
    .groupBy(schema.bookings.tripId);

  const countMap = new Map(participantCounts.map(p => [p.tripId, Number(p.total)]));

  return trips.map(row => mapTrip({
    ...row.trip,
    tour_name: row.tourName,
    tour_type: row.tourType,
    boat_name: row.boatName,
    booked_participants: countMap.get(row.trip.id) || 0,
  }));
}

export async function getTripById(organizationId: string, id: string) {
  const [result] = await db
    .select({
      trip: schema.trips,
      tourName: schema.tours.name,
      tourType: schema.tours.type,
      tourPrice: schema.tours.price,
      tourMaxParticipants: schema.tours.maxParticipants,
      boatName: schema.boats.name,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .leftJoin(schema.boats, eq(schema.trips.boatId, schema.boats.id))
    .where(and(
      eq(schema.trips.organizationId, organizationId),
      eq(schema.trips.id, id)
    ))
    .limit(1);

  if (!result) return null;

  return mapTrip({
    ...result.trip,
    tour_name: result.tourName,
    tour_type: result.tourType,
    tour_price: result.tourPrice,
    tour_max_participants: result.tourMaxParticipants,
    boat_name: result.boatName,
  });
}

// ============================================================================
// Calendar Queries
// ============================================================================

export interface CalendarTrip {
  id: string;
  tourId: string;
  tourName: string;
  tourType: string;
  date: string;
  startTime: string;
  endTime: string | null;
  boatName: string | null;
  maxParticipants: number;
  bookedParticipants: number;
  status: string;
}

export async function getCalendarTrips(
  organizationId: string,
  options: { fromDate: string; toDate: string }
): Promise<CalendarTrip[]> {
  const { fromDate, toDate } = options;

  const trips = await db
    .select({
      id: schema.trips.id,
      tourId: schema.trips.tourId,
      tourName: schema.tours.name,
      tourType: schema.tours.type,
      date: schema.trips.date,
      startTime: schema.trips.startTime,
      endTime: schema.trips.endTime,
      boatName: schema.boats.name,
      maxParticipants: sql<number>`COALESCE(${schema.trips.maxParticipants}, ${schema.tours.maxParticipants})`,
      status: schema.trips.status,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .leftJoin(schema.boats, eq(schema.trips.boatId, schema.boats.id))
    .where(and(
      eq(schema.trips.organizationId, organizationId),
      gte(schema.trips.date, fromDate),
      lte(schema.trips.date, toDate)
    ))
    .orderBy(schema.trips.date, schema.trips.startTime);

  // Get booked participants in a single batch query
  if (trips.length === 0) return [];

  const tripIds = trips.map(t => t.id);
  const participantCounts = await db
    .select({
      tripId: schema.bookings.tripId,
      total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)`,
    })
    .from(schema.bookings)
    .where(and(
      inArray(schema.bookings.tripId, tripIds),
      sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
    ))
    .groupBy(schema.bookings.tripId);

  const countMap = new Map(participantCounts.map(p => [p.tripId, Number(p.total)]));

  return trips.map(trip => ({
    id: trip.id,
    tourId: trip.tourId,
    tourName: trip.tourName,
    tourType: trip.tourType,
    date: formatDateString(trip.date),
    startTime: formatTimeString(trip.startTime),
    endTime: trip.endTime ? formatTimeString(trip.endTime) : null,
    boatName: trip.boatName,
    maxParticipants: Number(trip.maxParticipants || 0),
    bookedParticipants: countMap.get(trip.id) || 0,
    status: trip.status,
  }));
}

// ============================================================================
// Trip Create/Update
// ============================================================================

export async function createTrip(organizationId: string, data: {
  tourId: string;
  boatId?: string;
  date: string;
  startTime: string;
  endTime?: string;
  maxParticipants?: number;
  price?: number;
  notes?: string;
  isPublic?: boolean;
}) {
  const [trip] = await db
    .insert(schema.trips)
    .values({
      organizationId,
      tourId: data.tourId,
      boatId: data.boatId || null,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime || null,
      maxParticipants: data.maxParticipants || null,
      price: data.price ? String(data.price) : null,
      notes: data.notes || null,
      isPublic: data.isPublic ?? false,
    })
    .returning();

  // Sync to Google Calendar if integration is active
  // Run async to not block trip creation
  import("../../integrations/google-calendar.server")
    .then(({ syncTripToCalendar }) => {
      const org = getOrganizationById(organizationId);
      const timezone = org.then((o: any) => o?.timezone || "UTC");
      timezone.then((tz: string) =>
        syncTripToCalendar(organizationId, trip.id, tz).catch((error) =>
          dbLogger.error({ err: error, tripId: trip.id, organizationId }, "Google Calendar sync failed for trip")
        )
      );
    })
    .catch((error) => dbLogger.error({ err: error }, "Failed to load Google Calendar module"));

  return trip;
}

export async function updateTripStatus(organizationId: string, id: string, status: string) {
  const [trip] = await db
    .update(schema.trips)
    .set({ status, updatedAt: new Date() })
    .where(and(
      eq(schema.trips.organizationId, organizationId),
      eq(schema.trips.id, id)
    ))
    .returning();

  // Sync updated trip to Google Calendar if integration is active
  if (trip) {
    import("../../integrations/google-calendar.server")
      .then(({ syncTripToCalendar }) => {
        const org = getOrganizationById(organizationId);
        const timezone = org.then((o: any) => o?.timezone || "UTC");
        timezone.then((tz: string) =>
          syncTripToCalendar(organizationId, trip.id, tz).catch((error) =>
            dbLogger.error({ err: error, tripId: trip.id, organizationId }, "Google Calendar sync failed for trip")
          )
        );
      })
      .catch((error) => dbLogger.error({ err: error }, "Failed to load Google Calendar module"));
  }

  return trip ? mapTrip(trip) : null;
}

// ============================================================================
// Trip Detail Queries
// ============================================================================

export async function getTripWithFullDetails(organizationId: string, id: string) {
  const trip = await getTripById(organizationId, id);
  if (!trip) return null;

  const [tour, boat, diveSites] = await Promise.all([
    getTourById(organizationId, trip.tourId),
    trip.boatId ? getBoatById(organizationId, trip.boatId) : null,
    getDiveSitesForTour(organizationId, trip.tourId, 10),
  ]);

  return {
    ...trip,
    tour: tour ? { id: tour.id, name: tour.name } : { id: trip.tourId, name: trip.tourName || "" },
    boat: boat ? { id: boat.id, name: boat.name } : { id: "", name: "No boat assigned" },
    diveSites: diveSites || [],
    staff: [] as Array<{ id: string; name: string; role: string }>, // No trip-specific staff assignments in schema yet
    weatherNotes: trip.weatherNotes || null,
  };
}

export async function getTripBookings(organizationId: string, tripId: string) {
  const { bookings } = await getBookings(organizationId, { tripId, limit: 100 });
  // Transform to structure expected by trip detail page
  return bookings.map((b) => ({
    id: b.id,
    bookingNumber: b.bookingNumber,
    participants: b.participants,
    total: b.total,
    paidInFull: b.paidAmount >= b.total,
    customer: {
      id: b.customerId,
      email: b.customerEmail,
      firstName: b.firstName,
      lastName: b.lastName,
    },
  }));
}

export async function getTripRevenue(organizationId: string, tripId: string) {
  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(CAST(${schema.bookings.total} AS DECIMAL)), 0)`,
      paid: sql<number>`COALESCE(SUM(CAST(${schema.bookings.paidAmount} AS DECIMAL)), 0)`,
    })
    .from(schema.bookings)
    .where(and(
      eq(schema.bookings.tripId, tripId),
      sql`${schema.bookings.status} NOT IN ('canceled', 'refunded')`
    ));

  const bookingsTotal = Number(result[0]?.total || 0).toFixed(2);
  const paidTotal = Number(result[0]?.paid || 0);
  const pendingTotal = (Number(result[0]?.total || 0) - paidTotal).toFixed(2);

  return { bookingsTotal, pendingTotal };
}

export async function getTripBookedParticipants(organizationId: string, tripId: string) {
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)` })
    .from(schema.bookings)
    .where(and(
      eq(schema.bookings.tripId, tripId),
      sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
    ));

  return Number(result[0]?.total || 0);
}

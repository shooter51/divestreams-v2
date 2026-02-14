/**
 * Boat Queries
 *
 * All boat-related database operations including CRUD, stats, and trip history.
 */

import { desc, eq, gte, and, sql } from "drizzle-orm";
import { db } from "../index";
import * as schema from "../schema";
import { mapBoat } from "./mappers";
import { formatDateString, formatTimeString } from "./formatters";

// ============================================================================
// Boat CRUD Queries
// ============================================================================

export async function getBoats(
  organizationId: string,
  options: { activeOnly?: boolean; search?: string } = {}
) {
  const { activeOnly = false, search } = options;

  const whereConditions = [eq(schema.boats.organizationId, organizationId)];
  if (activeOnly) whereConditions.push(eq(schema.boats.isActive, true));
  if (search) {
    whereConditions.push(sql`${schema.boats.name} ILIKE ${'%' + search + '%'}`);
  }

  const boats = await db
    .select()
    .from(schema.boats)
    .where(and(...whereConditions))
    .orderBy(schema.boats.name);

  return boats.map(mapBoat);
}

export async function getAllBoats(organizationId: string) {
  const boats = await db
    .select({
      id: schema.boats.id,
      name: schema.boats.name,
      capacity: schema.boats.capacity,
    })
    .from(schema.boats)
    .where(and(
      eq(schema.boats.organizationId, organizationId),
      eq(schema.boats.isActive, true)
    ))
    .orderBy(schema.boats.name);

  return boats;
}

export async function getBoatById(organizationId: string, id: string) {
  const [boat] = await db
    .select()
    .from(schema.boats)
    .where(and(
      eq(schema.boats.organizationId, organizationId),
      eq(schema.boats.id, id)
    ))
    .limit(1);

  return boat ? mapBoat(boat) : null;
}

export async function createBoat(organizationId: string, data: {
  name: string;
  description?: string;
  capacity: number;
  type?: string;
  registrationNumber?: string;
  amenities?: string[];
  isActive?: boolean;
}) {
  const [boat] = await db
    .insert(schema.boats)
    .values({
      organizationId,
      name: data.name,
      description: data.description || null,
      capacity: data.capacity,
      type: data.type || null,
      registrationNumber: data.registrationNumber || null,
      amenities: data.amenities || null,
      isActive: data.isActive ?? true,
    })
    .returning();

  return mapBoat(boat);
}

// ============================================================================
// Boat Detail Queries
// ============================================================================

export async function getBoatRecentTrips(organizationId: string, boatId: string, limit = 5) {
  const trips = await db
    .select({
      id: schema.trips.id,
      date: schema.trips.date,
      tourName: schema.tours.name,
      status: schema.trips.status,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(and(
      eq(schema.trips.boatId, boatId),
      eq(schema.trips.organizationId, organizationId)
    ))
    .orderBy(desc(schema.trips.date))
    .limit(limit);

  const result = [];
  for (const trip of trips) {
    const bookingsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)`,
        revenue: sql<number>`COALESCE(SUM(CAST(${schema.bookings.total} AS NUMERIC)), 0)`
      })
      .from(schema.bookings)
      .where(and(
        eq(schema.bookings.tripId, trip.id),
        sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
      ));

    result.push({
      id: trip.id,
      date: formatDateString(trip.date),
      tourName: trip.tourName,
      participants: Number(bookingsResult[0]?.total || 0),
      revenue: `$${Number(bookingsResult[0]?.revenue || 0).toFixed(2)}`,
      status: trip.status,
    });
  }

  return result;
}

export async function getBoatUpcomingTrips(organizationId: string, boatId: string, limit = 5) {
  const today = new Date().toISOString().split("T")[0];

  const trips = await db
    .select({
      id: schema.trips.id,
      date: schema.trips.date,
      startTime: schema.trips.startTime,
      tourName: schema.tours.name,
      maxParticipants: sql<number>`COALESCE(${schema.trips.maxParticipants}, ${schema.tours.maxParticipants})`,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(and(
      eq(schema.trips.boatId, boatId),
      eq(schema.trips.organizationId, organizationId),
      gte(schema.trips.date, today),
      eq(schema.trips.status, "scheduled")
    ))
    .orderBy(schema.trips.date, schema.trips.startTime)
    .limit(limit);

  const result = [];
  for (const trip of trips) {
    const participantsResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)` })
      .from(schema.bookings)
      .where(and(
        eq(schema.bookings.tripId, trip.id),
        sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
      ));

    result.push({
      id: trip.id,
      date: formatDateString(trip.date),
      time: formatTimeString(trip.startTime),
      tourName: trip.tourName,
      bookedParticipants: Number(participantsResult[0]?.total || 0),
      maxParticipants: Number(trip.maxParticipants || 0),
    });
  }

  return result;
}

export async function getBoatStats(organizationId: string, boatId: string) {
  // Get total trips
  const tripCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.trips)
    .where(eq(schema.trips.boatId, boatId));

  // Get completed trips
  const completedResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.trips)
    .where(and(
      eq(schema.trips.boatId, boatId),
      eq(schema.trips.status, "completed")
    ));

  // Get total passengers and revenue
  const bookingsResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)`,
      revenue: sql<number>`COALESCE(SUM(CAST(${schema.bookings.total} AS NUMERIC)), 0)`
    })
    .from(schema.bookings)
    .innerJoin(schema.trips, eq(schema.bookings.tripId, schema.trips.id))
    .where(and(
      eq(schema.trips.boatId, boatId),
      sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
    ));

  // Get boat capacity for avg occupancy calculation
  const [boat] = await db
    .select({ capacity: schema.boats.capacity })
    .from(schema.boats)
    .where(eq(schema.boats.id, boatId))
    .limit(1);

  const totalTrips = Number(tripCountResult[0]?.count || 0);
  const totalPassengers = Number(bookingsResult[0]?.total || 0);
  const capacity = Number(boat?.capacity || 10);
  const avgOccupancy = totalTrips > 0 ? Math.round((totalPassengers / (totalTrips * capacity)) * 100) : 0;

  return {
    totalTrips,
    completedTrips: Number(completedResult[0]?.count || 0),
    totalPassengers,
    totalRevenue: `$${Number(bookingsResult[0]?.revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    avgOccupancy,
  };
}

export async function updateBoatActiveStatus(organizationId: string, id: string, isActive: boolean) {
  const [boat] = await db
    .update(schema.boats)
    .set({ isActive, updatedAt: new Date() })
    .where(and(
      eq(schema.boats.organizationId, organizationId),
      eq(schema.boats.id, id)
    ))
    .returning();

  return boat ? mapBoat(boat) : null;
}

export async function deleteBoat(organizationId: string, id: string) {
  // Actually delete the boat instead of just deactivating
  await db
    .delete(schema.boats)
    .where(and(
      eq(schema.boats.organizationId, organizationId),
      eq(schema.boats.id, id)
    ));
  return true;
}

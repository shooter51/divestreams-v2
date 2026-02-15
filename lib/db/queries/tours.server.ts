/**
 * Tour Queries
 *
 * All tour-related database operations including CRUD, stats, and dive site associations.
 */

import { desc, eq, gte, and, sql, asc, inArray } from "drizzle-orm";
import { db } from "../index";
import * as schema from "../schema";
import { mapTour } from "./mappers";
import { formatDateString, formatTimeString } from "./formatters";

// ============================================================================
// Tour Queries
// ============================================================================

export async function getTours(
  organizationId: string,
  options: { activeOnly?: boolean; search?: string; type?: string } = {}
) {
  const { activeOnly = false, search, type } = options;

  const whereConditions = [eq(schema.tours.organizationId, organizationId)];
  if (activeOnly) whereConditions.push(eq(schema.tours.isActive, true));
  if (type) whereConditions.push(eq(schema.tours.type, type));
  if (search) {
    whereConditions.push(sql`${schema.tours.name} ILIKE ${'%' + search + '%'}`);
  }

  const tours = await db
    .select()
    .from(schema.tours)
    .where(and(...whereConditions))
    .orderBy(schema.tours.name);

  // Get trip counts in a single batch query
  if (tours.length === 0) return [];

  const tourIds = tours.map(t => t.id);
  const tripCounts = (await db
    .select({
      tourId: schema.trips.tourId,
      count: sql<number>`count(*)`,
    })
    .from(schema.trips)
    .where(inArray(schema.trips.tourId, tourIds))
    .groupBy(schema.trips.tourId)) || [];

  const tripCountMap = new Map(tripCounts.map(tc => [tc.tourId, Number(tc.count)]));

  return tours.map(tour => ({
    ...mapTour(tour),
    tripCount: tripCountMap.get(tour.id) || 0,
  }));
}

export async function getAllTours(organizationId: string) {
  const tours = await db
    .select({
      id: schema.tours.id,
      name: schema.tours.name,
    })
    .from(schema.tours)
    .where(and(
      eq(schema.tours.organizationId, organizationId),
      eq(schema.tours.isActive, true)
    ))
    .orderBy(schema.tours.name);

  return tours;
}

export async function getTourById(organizationId: string, id: string) {
  const [tour] = await db
    .select()
    .from(schema.tours)
    .where(and(
      eq(schema.tours.organizationId, organizationId),
      eq(schema.tours.id, id)
    ))
    .limit(1);

  return tour ? mapTour(tour) : null;
}

export async function createTour(organizationId: string, data: {
  name: string;
  description?: string;
  type: string;
  duration?: number;
  maxParticipants: number;
  minParticipants?: number;
  price: number;
  currency?: string;
  includesEquipment?: boolean;
  includesMeals?: boolean;
  includesTransport?: boolean;
  minCertLevel?: string;
  minAge?: number;
}) {
  const [tour] = await db
    .insert(schema.tours)
    .values({
      organizationId,
      name: data.name,
      description: data.description || null,
      type: data.type,
      duration: data.duration || null,
      maxParticipants: data.maxParticipants,
      minParticipants: data.minParticipants || 1,
      price: String(data.price),
      currency: data.currency || "USD",
      includesEquipment: data.includesEquipment || false,
      includesMeals: data.includesMeals || false,
      includesTransport: data.includesTransport || false,
      minCertLevel: data.minCertLevel || null,
      minAge: data.minAge || null,
    })
    .returning();

  return mapTour(tour);
}

export async function duplicateTour(organizationId: string, sourceTourId: string) {
  // Fetch the source tour
  const sourceTour = await getTourById(organizationId, sourceTourId);

  if (!sourceTour) {
    throw new Error("Tour not found");
  }

  // Generate new name
  const newName = `${sourceTour.name} (Copy)`;

  // Create duplicate with all fields copied
  const [tour] = await db
    .insert(schema.tours)
    .values({
      organizationId,
      name: newName,
      description: sourceTour.description || null,
      type: sourceTour.type,
      duration: sourceTour.duration || null,
      maxParticipants: sourceTour.maxParticipants,
      minParticipants: sourceTour.minParticipants || 1,
      price: String(sourceTour.price),
      currency: sourceTour.currency || "USD",
      includesEquipment: sourceTour.includesEquipment || false,
      includesMeals: sourceTour.includesMeals || false,
      includesTransport: sourceTour.includesTransport || false,
      inclusions: sourceTour.inclusions && sourceTour.inclusions.length > 0 ? sourceTour.inclusions : null,
      exclusions: sourceTour.exclusions && sourceTour.exclusions.length > 0 ? sourceTour.exclusions : null,
      minCertLevel: sourceTour.minCertLevel || null,
      minAge: sourceTour.minAge || null,
      requirements: sourceTour.requirements && sourceTour.requirements.length > 0 ? sourceTour.requirements : null,
      isActive: true,
    })
    .returning();

  // Copy tour images
  const sourceImages = await db
    .select()
    .from(schema.images)
    .where(
      and(
        eq(schema.images.organizationId, organizationId),
        eq(schema.images.entityType, "tour"),
        eq(schema.images.entityId, sourceTourId)
      )
    );

  if (sourceImages.length > 0) {
    await db.insert(schema.images).values(
      sourceImages.map((image) => ({
        organizationId,
        entityType: "tour" as const,
        entityId: tour.id,
        url: image.url,
        thumbnailUrl: image.thumbnailUrl,
        filename: image.filename,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        width: image.width,
        height: image.height,
        alt: image.alt,
        sortOrder: image.sortOrder,
        isPrimary: image.isPrimary,
      }))
    );
  }

  return mapTour(tour);
}

export async function updateTourActiveStatus(organizationId: string, id: string, isActive: boolean) {
  const [tour] = await db
    .update(schema.tours)
    .set({ isActive, updatedAt: new Date() })
    .where(and(
      eq(schema.tours.organizationId, organizationId),
      eq(schema.tours.id, id)
    ))
    .returning();

  return tour ? mapTour(tour) : null;
}

export async function deleteTour(organizationId: string, id: string) {
  // Check if there are any trips using this tour
  const [tripCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.trips)
    .where(and(
      eq(schema.trips.organizationId, organizationId),
      eq(schema.trips.tourId, id)
    ));

  if (tripCount && tripCount.count > 0) {
    throw new Error(`Cannot delete tour: ${tripCount.count} trip(s) are using this tour. Please delete or reassign the trips first.`);
  }

  // Check if there are any tour dive site mappings
  await db
    .delete(schema.tourDiveSites)
    .where(and(
      eq(schema.tourDiveSites.organizationId, organizationId),
      eq(schema.tourDiveSites.tourId, id)
    ));

  // Now delete the tour
  await db
    .delete(schema.tours)
    .where(and(
      eq(schema.tours.organizationId, organizationId),
      eq(schema.tours.id, id)
    ));
  return true;
}

// ============================================================================
// Tour Detail Queries
// ============================================================================

export async function getTourStats(organizationId: string, tourId: string) {
  // Get trip count
  const tripCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.trips)
    .where(and(eq(schema.trips.tourId, tourId), eq(schema.trips.organizationId, organizationId)));

  // Get total revenue from bookings on trips for this tour
  const revenueResult = await db
    .select({ total: sql<number>`COALESCE(SUM(CAST(${schema.bookings.total} AS DECIMAL)), 0)` })
    .from(schema.bookings)
    .innerJoin(schema.trips, eq(schema.bookings.tripId, schema.trips.id))
    .where(and(
      eq(schema.trips.tourId, tourId),
      eq(schema.trips.organizationId, organizationId),
      sql`${schema.bookings.status} NOT IN ('canceled', 'refunded')`
    ));

  return {
    tripCount: Number(tripCountResult[0]?.count || 0),
    totalRevenue: Number(revenueResult[0]?.total || 0),
    averageRating: null,
  };
}

export async function getUpcomingTripsForTour(organizationId: string, tourId: string, limit = 5) {
  const today = new Date().toISOString().split("T")[0];

  const trips = await db
    .select({
      id: schema.trips.id,
      date: schema.trips.date,
      startTime: schema.trips.startTime,
      boatName: schema.boats.name,
      maxParticipants: sql<number>`COALESCE(${schema.trips.maxParticipants}, ${schema.tours.maxParticipants})`,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .leftJoin(schema.boats, eq(schema.trips.boatId, schema.boats.id))
    .where(and(
      eq(schema.trips.tourId, tourId),
      gte(schema.trips.date, today),
      eq(schema.trips.status, "scheduled")
    ))
    .orderBy(schema.trips.date, schema.trips.startTime)
    .limit(limit);

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
    date: formatDateString(trip.date),
    time: formatTimeString(trip.startTime),
    boatName: trip.boatName,
    bookedParticipants: countMap.get(trip.id) || 0,
    maxParticipants: Number(trip.maxParticipants || 0),
  }));
}

// ============================================================================
// Tour Top Tours (report)
// ============================================================================

export interface TopTour {
  id: string;
  name: string;
  bookings: number;
  revenue: number;
}

export async function getTopTours(organizationId: string, limit: number = 5): Promise<TopTour[]> {
  const result = await db
    .select({
      id: schema.tours.id,
      name: schema.tours.name,
      bookings: sql<number>`count(${schema.bookings.id})`,
      revenue: sql<number>`COALESCE(SUM(CAST(${schema.bookings.total} AS DECIMAL)), 0)`,
    })
    .from(schema.tours)
    .leftJoin(schema.trips, eq(schema.tours.id, schema.trips.tourId))
    .leftJoin(schema.bookings, eq(schema.trips.id, schema.bookings.tripId))
    .where(eq(schema.tours.organizationId, organizationId))
    .groupBy(schema.tours.id, schema.tours.name)
    .orderBy(sql`count(${schema.bookings.id}) DESC`)
    .limit(limit);

  return result.map((row) => ({
    id: row.id,
    name: row.name,
    bookings: Number(row.bookings),
    revenue: Number(row.revenue),
  }));
}

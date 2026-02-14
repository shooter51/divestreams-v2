/**
 * Dive Site Queries
 *
 * All dive site-related database operations including CRUD, stats,
 * and tour associations.
 */

import { desc, eq, and, sql, asc } from "drizzle-orm";
import { db } from "../index";
import * as schema from "../schema";
import { mapDiveSite } from "./mappers";

// ============================================================================
// Dive Site CRUD Queries
// ============================================================================

export async function getDiveSites(
  organizationId: string,
  options: { activeOnly?: boolean; search?: string; difficulty?: string } = {}
) {
  const { activeOnly = false, search, difficulty } = options;

  const whereConditions = [eq(schema.diveSites.organizationId, organizationId)];
  if (activeOnly) whereConditions.push(eq(schema.diveSites.isActive, true));
  if (difficulty) whereConditions.push(eq(schema.diveSites.difficulty, difficulty));
  if (search) {
    whereConditions.push(sql`${schema.diveSites.name} ILIKE ${'%' + search + '%'}`);
  }

  const sites = await db
    .select()
    .from(schema.diveSites)
    .where(and(...whereConditions))
    .orderBy(schema.diveSites.name);

  return sites.map(mapDiveSite);
}

export async function getDiveSiteById(organizationId: string, id: string) {
  const [site] = await db
    .select()
    .from(schema.diveSites)
    .where(and(
      eq(schema.diveSites.organizationId, organizationId),
      eq(schema.diveSites.id, id)
    ))
    .limit(1);

  return site ? mapDiveSite(site) : null;
}

export async function updateDiveSiteActiveStatus(organizationId: string, id: string, isActive: boolean) {
  const [site] = await db
    .update(schema.diveSites)
    .set({ isActive, updatedAt: new Date() })
    .where(and(
      eq(schema.diveSites.organizationId, organizationId),
      eq(schema.diveSites.id, id)
    ))
    .returning();

  return site ? mapDiveSite(site) : null;
}

export async function deleteDiveSite(organizationId: string, id: string) {
  // Check if there are any tours using this dive site
  const [tourCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.tourDiveSites)
    .where(and(
      eq(schema.tourDiveSites.organizationId, organizationId),
      eq(schema.tourDiveSites.diveSiteId, id)
    ));

  if (tourCount && tourCount.count > 0) {
    throw new Error(`Cannot delete dive site: ${tourCount.count} tour(s) are using this site. Please remove it from tours first.`);
  }

  // Delete the dive site
  await db
    .delete(schema.diveSites)
    .where(and(
      eq(schema.diveSites.organizationId, organizationId),
      eq(schema.diveSites.id, id)
    ));
  return true;
}

export async function createDiveSite(organizationId: string, data: {
  name: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  maxDepth?: number;
  minDepth?: number;
  difficulty?: string;
  currentStrength?: string;
  visibility?: string;
  highlights?: string[];
}) {
  const [site] = await db
    .insert(schema.diveSites)
    .values({
      organizationId,
      name: data.name,
      description: data.description || null,
      latitude: data.latitude ? String(data.latitude) : null,
      longitude: data.longitude ? String(data.longitude) : null,
      maxDepth: data.maxDepth || null,
      minDepth: data.minDepth || null,
      difficulty: data.difficulty || null,
      currentStrength: data.currentStrength || null,
      visibility: data.visibility || null,
      highlights: data.highlights || null,
    })
    .returning();

  return mapDiveSite(site);
}

// ============================================================================
// Dive Site Detail Queries
// ============================================================================

export async function getDiveSiteStats(organizationId: string, siteId: string) {
  // Get total trips that visited this site (through tour -> tourDiveSites)
  const tripCountResult = await db
    .select({ count: sql<number>`count(DISTINCT ${schema.trips.id})` })
    .from(schema.trips)
    .innerJoin(schema.tourDiveSites, eq(schema.trips.tourId, schema.tourDiveSites.tourId))
    .where(and(
      eq(schema.tourDiveSites.diveSiteId, siteId),
      eq(schema.trips.organizationId, organizationId)
    ));

  // Get total divers who visited this site
  const diversResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.bookings.participants}), 0)` })
    .from(schema.bookings)
    .innerJoin(schema.trips, eq(schema.bookings.tripId, schema.trips.id))
    .innerJoin(schema.tourDiveSites, eq(schema.trips.tourId, schema.tourDiveSites.tourId))
    .where(and(
      eq(schema.tourDiveSites.diveSiteId, siteId),
      eq(schema.trips.organizationId, organizationId),
      sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
    ));

  return {
    totalTrips: Number(tripCountResult[0]?.count || 0),
    totalDivers: Number(diversResult[0]?.total || 0),
    avgRating: null,
  };
}

export async function getRecentTripsForDiveSite(organizationId: string, siteId: string, limit = 5) {
  const trips = await db
    .select({
      id: schema.trips.id,
      date: schema.trips.date,
      tourName: schema.tours.name,
      conditions: schema.trips.notes,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .innerJoin(schema.tourDiveSites, eq(schema.tours.id, schema.tourDiveSites.tourId))
    .where(and(
      eq(schema.tourDiveSites.diveSiteId, siteId),
      eq(schema.trips.organizationId, organizationId)
    ))
    .orderBy(desc(schema.trips.date))
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
      date: trip.date,
      tourName: trip.tourName,
      participants: Number(participantsResult[0]?.total || 0),
      conditions: trip.conditions,
    });
  }

  return result;
}

export async function getToursUsingDiveSite(organizationId: string, siteId: string, limit = 5) {
  const tours = await db
    .select({
      id: schema.tours.id,
      name: schema.tours.name,
    })
    .from(schema.tours)
    .innerJoin(schema.tourDiveSites, eq(schema.tours.id, schema.tourDiveSites.tourId))
    .where(and(
      eq(schema.tourDiveSites.diveSiteId, siteId),
      eq(schema.tours.organizationId, organizationId),
      eq(schema.tours.isActive, true)
    ))
    .limit(limit);

  return tours;
}

export async function getDiveSitesForTour(organizationId: string, tourId: string, limit = 10) {
  const sites = await db
    .select({
      id: schema.diveSites.id,
      name: schema.diveSites.name,
      maxDepth: schema.diveSites.maxDepth,
      difficulty: schema.diveSites.difficulty,
    })
    .from(schema.diveSites)
    .innerJoin(schema.tourDiveSites, eq(schema.diveSites.id, schema.tourDiveSites.diveSiteId))
    .where(and(
      eq(schema.tourDiveSites.tourId, tourId),
      eq(schema.diveSites.organizationId, organizationId)
    ))
    .orderBy(asc(schema.tourDiveSites.order))
    .limit(limit);

  return sites;
}

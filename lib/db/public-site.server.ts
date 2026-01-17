/**
 * Public Site Server Functions
 *
 * Server-side functions for retrieving and updating public site data.
 * These functions are used by tenant public-facing sites to display
 * publicly visible content like trips, courses, and equipment.
 */

import { eq, and, sql } from "drizzle-orm";
import { db } from "./index";
import {
  organization,
  trips,
  tours,
  equipment,
  type PublicSiteSettings,
} from "./schema";

// ============================================================================
// Types
// ============================================================================

export interface PaginationOptions {
  limit?: number;
  page?: number;
}

export interface PaginatedResult<T> {
  total: number;
}

export interface PaginatedTripsResult extends PaginatedResult<unknown> {
  trips: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string | null;
    maxParticipants: number | null;
    price: string | null;
    status: string;
    tour: {
      id: string;
      name: string;
      description: string | null;
      type: string;
      duration: number | null;
      price: string;
      currency: string;
      includesEquipment: boolean | null;
      includesMeals: boolean | null;
      includesTransport: boolean | null;
    } | null;
  }>;
}

export interface PaginatedCoursesResult extends PaginatedResult<unknown> {
  courses: Array<{
    id: string;
    name: string;
    description: string | null;
    price: string | null;
    duration: number | null;
    isPublic: boolean;
  }>;
}

export interface PaginatedEquipmentResult extends PaginatedResult<unknown> {
  equipment: Array<{
    id: string;
    category: string;
    name: string;
    brand: string | null;
    model: string | null;
    status: string;
    condition: string | null;
    rentalPrice: string | null;
    isRentable: boolean | null;
  }>;
}

// ============================================================================
// Public Site Settings Functions
// ============================================================================

/**
 * Get public site settings for an organization
 */
export async function getPublicSiteSettings(
  organizationId: string
): Promise<PublicSiteSettings | null> {
  const result = await db
    .select({
      publicSiteSettings: organization.publicSiteSettings,
    })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  if (!result[0]) {
    return null;
  }

  return result[0].publicSiteSettings ?? null;
}

/**
 * Update public site settings for an organization
 */
export async function updatePublicSiteSettings(
  organizationId: string,
  settings: Partial<PublicSiteSettings>
): Promise<PublicSiteSettings | null> {
  // First get existing settings
  const existing = await getPublicSiteSettings(organizationId);

  // Merge with existing settings (if any)
  const mergedSettings = existing
    ? { ...existing, ...settings }
    : (settings as PublicSiteSettings);

  const result = await db
    .update(organization)
    .set({
      publicSiteSettings: mergedSettings,
      updatedAt: new Date(),
    })
    .where(eq(organization.id, organizationId))
    .returning({
      id: organization.id,
      publicSiteSettings: organization.publicSiteSettings,
    });

  if (!result[0]) {
    return null;
  }

  return result[0].publicSiteSettings ?? null;
}

// ============================================================================
// Public Content Functions
// ============================================================================

/**
 * Get public trips for an organization
 * Returns only trips where isPublic = true
 */
export async function getPublicTrips(
  organizationId: string,
  options: PaginationOptions = {}
): Promise<PaginatedTripsResult> {
  const { limit = 20, page = 1 } = options;
  const offset = (page - 1) * limit;

  // Get public trips with tour information
  const tripsData = await db
    .select({
      trip: {
        id: trips.id,
        date: trips.date,
        startTime: trips.startTime,
        endTime: trips.endTime,
        maxParticipants: trips.maxParticipants,
        price: trips.price,
        status: trips.status,
      },
      tour: {
        id: tours.id,
        name: tours.name,
        description: tours.description,
        type: tours.type,
        duration: tours.duration,
        price: tours.price,
        currency: tours.currency,
        includesEquipment: tours.includesEquipment,
        includesMeals: tours.includesMeals,
        includesTransport: tours.includesTransport,
      },
    })
    .from(trips)
    .leftJoin(tours, eq(trips.tourId, tours.id))
    .where(
      and(
        eq(trips.organizationId, organizationId),
        eq(trips.isPublic, true),
        eq(trips.status, "scheduled")
      )
    )
    .orderBy(trips.date, trips.startTime)
    .limit(limit)
    .offset(offset);

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(trips)
    .where(
      and(
        eq(trips.organizationId, organizationId),
        eq(trips.isPublic, true),
        eq(trips.status, "scheduled")
      )
    );

  const total = Number(countResult[0]?.count ?? 0);

  return {
    trips: tripsData.map((row) => ({
      id: row.trip.id,
      date: row.trip.date,
      startTime: row.trip.startTime,
      endTime: row.trip.endTime,
      maxParticipants: row.trip.maxParticipants,
      price: row.trip.price,
      status: row.trip.status,
      tour: row.tour
        ? {
            id: row.tour.id,
            name: row.tour.name,
            description: row.tour.description,
            type: row.tour.type,
            duration: row.tour.duration,
            price: row.tour.price,
            currency: row.tour.currency,
            includesEquipment: row.tour.includesEquipment,
            includesMeals: row.tour.includesMeals,
            includesTransport: row.tour.includesTransport,
          }
        : null,
    })),
    total,
  };
}

/**
 * Get public courses for an organization
 * Note: Training courses table may need to be created.
 * For now, this returns tours of type 'course' as a fallback.
 * Returns only courses where isPublic = true (when trainingCourses table exists)
 */
export async function getPublicCourses(
  organizationId: string,
  options: PaginationOptions = {}
): Promise<PaginatedCoursesResult> {
  const { limit = 20, page = 1 } = options;
  const offset = (page - 1) * limit;

  // Since trainingCourses table doesn't exist yet, return tours of type 'course'
  // This can be updated when trainingCourses table is added
  const coursesData = await db
    .select({
      id: tours.id,
      name: tours.name,
      description: tours.description,
      price: tours.price,
      duration: tours.duration,
      isActive: tours.isActive,
    })
    .from(tours)
    .where(
      and(
        eq(tours.organizationId, organizationId),
        eq(tours.type, "course"),
        eq(tours.isActive, true)
      )
    )
    .orderBy(tours.name)
    .limit(limit)
    .offset(offset);

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(tours)
    .where(
      and(
        eq(tours.organizationId, organizationId),
        eq(tours.type, "course"),
        eq(tours.isActive, true)
      )
    );

  const total = Number(countResult[0]?.count ?? 0);

  return {
    courses: coursesData.map((course) => ({
      id: course.id,
      name: course.name,
      description: course.description,
      price: course.price,
      duration: course.duration,
      isPublic: course.isActive ?? false,
    })),
    total,
  };
}

/**
 * Get public equipment for an organization
 * Returns only equipment where isPublic = true
 */
export async function getPublicEquipment(
  organizationId: string,
  options: PaginationOptions = {}
): Promise<PaginatedEquipmentResult> {
  const { limit = 20, page = 1 } = options;
  const offset = (page - 1) * limit;

  // Get public equipment
  const equipmentData = await db
    .select({
      id: equipment.id,
      category: equipment.category,
      name: equipment.name,
      brand: equipment.brand,
      model: equipment.model,
      status: equipment.status,
      condition: equipment.condition,
      rentalPrice: equipment.rentalPrice,
      isRentable: equipment.isRentable,
    })
    .from(equipment)
    .where(
      and(
        eq(equipment.organizationId, organizationId),
        eq(equipment.isPublic, true)
      )
    )
    .orderBy(equipment.category, equipment.name)
    .limit(limit)
    .offset(offset);

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(equipment)
    .where(
      and(
        eq(equipment.organizationId, organizationId),
        eq(equipment.isPublic, true)
      )
    );

  const total = Number(countResult[0]?.count ?? 0);

  return {
    equipment: equipmentData.map((item) => ({
      id: item.id,
      category: item.category,
      name: item.name,
      brand: item.brand,
      model: item.model,
      status: item.status,
      condition: item.condition,
      rentalPrice: item.rentalPrice,
      isRentable: item.isRentable,
    })),
    total,
  };
}

// ============================================================================
// Custom Domain Resolution
// ============================================================================

/**
 * Get organization by custom domain
 * Used for resolving tenant from custom domain requests
 */
export async function getOrganizationByCustomDomain(
  domain: string
): Promise<{
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  publicSiteSettings: PublicSiteSettings | null;
} | null> {
  // Normalize domain to lowercase for case-insensitive comparison
  const normalizedDomain = domain.toLowerCase();

  const result = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      customDomain: organization.customDomain,
      publicSiteSettings: organization.publicSiteSettings,
    })
    .from(organization)
    .where(sql`LOWER(${organization.customDomain}) = ${normalizedDomain}`)
    .limit(1);

  if (!result[0]) {
    return null;
  }

  return {
    id: result[0].id,
    name: result[0].name,
    slug: result[0].slug,
    customDomain: result[0].customDomain,
    publicSiteSettings: result[0].publicSiteSettings ?? null,
  };
}

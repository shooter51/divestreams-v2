/**
 * Public Site Server Functions
 *
 * Server-side functions for retrieving and updating public site data.
 * These functions are used by tenant public-facing sites to display
 * publicly visible content like trips, courses, and equipment.
 */

import { eq, and, sql, inArray, asc, or, gte } from "drizzle-orm";
import { db } from "./index";
import {
  organization,
  trips,
  tours,
  equipment,
  trainingCourses,
  trainingSessions,
  certificationAgencies,
  certificationLevels,
  images,
  type PublicSiteSettings,
} from "./schema";

// ============================================================================
// Types
// ============================================================================

export interface PaginationOptions {
  limit?: number;
  page?: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface PaginatedResult<_T = unknown> {
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
    price: string;
    currency: string;
    durationDays: number;
    maxStudents: number;
    minAge: number | null;
    prerequisites: string | null;
    materialsIncluded: boolean | null;
    equipmentIncluded: boolean | null;
    images: string[] | null;
    agencyName: string | null;
    levelName: string | null;
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
// Helper Functions
// ============================================================================

/**
 * Get images for courses from the images table
 * Returns a map of courseId -> array of image URLs (primary first)
 */
async function getCourseImagesMap(
  organizationId: string,
  courseIds: string[]
): Promise<Map<string, string[]>> {
  if (courseIds.length === 0) {
    return new Map();
  }

  const courseImages = await db
    .select({
      entityId: images.entityId,
      url: images.url,
      isPrimary: images.isPrimary,
      sortOrder: images.sortOrder,
    })
    .from(images)
    .where(
      and(
        eq(images.organizationId, organizationId),
        eq(images.entityType, "course"),
        inArray(images.entityId, courseIds)
      )
    )
    .orderBy(images.entityId, asc(images.sortOrder));

  const imageMap = new Map<string, string[]>();

  for (const img of courseImages) {
    const courseId = img.entityId;
    if (!imageMap.has(courseId)) {
      imageMap.set(courseId, []);
    }
    const urls = imageMap.get(courseId)!;
    // Put primary image first
    if (img.isPrimary) {
      urls.unshift(img.url);
    } else {
      urls.push(img.url);
    }
  }

  return imageMap;
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
 * Returns only courses where isPublic = true and isActive = true
 */
export async function getPublicCourses(
  organizationId: string,
  options: PaginationOptions = {}
): Promise<PaginatedCoursesResult> {
  const { limit = 20, page = 1 } = options;
  const offset = (page - 1) * limit;

  // Query from trainingCourses table with agency and level joins
  const coursesData = await db
    .select({
      id: trainingCourses.id,
      name: trainingCourses.name,
      description: trainingCourses.description,
      price: trainingCourses.price,
      currency: trainingCourses.currency,
      durationDays: trainingCourses.durationDays,
      maxStudents: trainingCourses.maxStudents,
      minAge: trainingCourses.minAge,
      prerequisites: trainingCourses.prerequisites,
      materialsIncluded: trainingCourses.materialsIncluded,
      equipmentIncluded: trainingCourses.equipmentIncluded,
      agencyName: certificationAgencies.name,
      levelName: certificationLevels.name,
    })
    .from(trainingCourses)
    .leftJoin(certificationAgencies, eq(trainingCourses.agencyId, certificationAgencies.id))
    .leftJoin(certificationLevels, eq(trainingCourses.levelId, certificationLevels.id))
    .where(
      and(
        eq(trainingCourses.organizationId, organizationId),
        eq(trainingCourses.isPublic, true),
        eq(trainingCourses.isActive, true)
      )
    )
    .orderBy(trainingCourses.sortOrder, trainingCourses.name)
    .limit(limit)
    .offset(offset);

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(trainingCourses)
    .where(
      and(
        eq(trainingCourses.organizationId, organizationId),
        eq(trainingCourses.isPublic, true),
        eq(trainingCourses.isActive, true)
      )
    );

  const total = Number(countResult[0]?.count ?? 0);

  // Get images from images table for all courses
  const courseIds = coursesData.map((c) => c.id);
  const imageMap = await getCourseImagesMap(organizationId, courseIds);

  return {
    courses: coursesData.map((course) => ({
      id: course.id,
      name: course.name,
      description: course.description,
      price: course.price,
      currency: course.currency,
      durationDays: course.durationDays,
      maxStudents: course.maxStudents,
      minAge: course.minAge,
      prerequisites: course.prerequisites,
      materialsIncluded: course.materialsIncluded,
      equipmentIncluded: course.equipmentIncluded,
      images: imageMap.get(course.id) || null,
      agencyName: course.agencyName,
      levelName: course.levelName,
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

/**
 * Get a single public course by ID for an organization
 * Returns training course where isPublic = true and isActive = true
 */
export async function getPublicCourseById(
  organizationId: string,
  courseId: string
): Promise<{
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  classroomHours: number | null;
  poolHours: number | null;
  openWaterDives: number | null;
  maxStudents: number;
  minStudents: number | null;
  price: string;
  currency: string;
  depositRequired: boolean | null;
  depositAmount: string | null;
  materialsIncluded: boolean | null;
  equipmentIncluded: boolean | null;
  includedItems: string[] | null;
  requiredItems: string[] | null;
  minAge: number | null;
  prerequisites: string | null;
  medicalRequirements: string | null;
  images: string[] | null;
  agencyName: string | null;
  levelName: string | null;
} | null> {
  const [course] = await db
    .select({
      id: trainingCourses.id,
      name: trainingCourses.name,
      description: trainingCourses.description,
      durationDays: trainingCourses.durationDays,
      classroomHours: trainingCourses.classroomHours,
      poolHours: trainingCourses.poolHours,
      openWaterDives: trainingCourses.openWaterDives,
      maxStudents: trainingCourses.maxStudents,
      minStudents: trainingCourses.minStudents,
      price: trainingCourses.price,
      currency: trainingCourses.currency,
      depositRequired: trainingCourses.depositRequired,
      depositAmount: trainingCourses.depositAmount,
      materialsIncluded: trainingCourses.materialsIncluded,
      equipmentIncluded: trainingCourses.equipmentIncluded,
      includedItems: trainingCourses.includedItems,
      requiredItems: trainingCourses.requiredItems,
      minAge: trainingCourses.minAge,
      prerequisites: trainingCourses.prerequisites,
      medicalRequirements: trainingCourses.medicalRequirements,
      images: trainingCourses.images,
      agencyName: certificationAgencies.name,
      levelName: certificationLevels.name,
    })
    .from(trainingCourses)
    .leftJoin(certificationAgencies, eq(trainingCourses.agencyId, certificationAgencies.id))
    .leftJoin(certificationLevels, eq(trainingCourses.levelId, certificationLevels.id))
    .where(
      and(
        eq(trainingCourses.organizationId, organizationId),
        eq(trainingCourses.id, courseId),
        eq(trainingCourses.isPublic, true),
        eq(trainingCourses.isActive, true)
      )
    )
    .limit(1);

  if (!course) {
    return null;
  }

  // Get images from images table (for custom uploaded images)
  const imageMap = await getCourseImagesMap(organizationId, [courseId]);
  const customImages = imageMap.get(courseId) || null;

  // Use custom images if available, otherwise use template images from course
  return {
    ...course,
    images: customImages && customImages.length > 0 ? customImages : course.images,
  };
}

/**
 * Get scheduled trips for a specific course/tour
 * Returns upcoming sessions for course enrollment
 */
export async function getCourseScheduledTrips(
  organizationId: string,
  courseId: string,
  options: PaginationOptions = {}
): Promise<{
  trips: Array<{
    id: string;
    date: string;
    startTime: string | null;
    endTime: string | null;
    maxParticipants: number | null;
    price: string | null;
    status: string;
  }>;
  total: number;
}> {
  const { limit = 10, page = 1 } = options;
  const offset = (page - 1) * limit;

  // Query training sessions instead of trips (training courses use trainingSessions table)
  const sessionsData = await db
    .select({
      id: trainingSessions.id,
      date: trainingSessions.startDate,
      startTime: trainingSessions.startTime,
      endTime: sql<string | null>`null`, // Training sessions don't have separate end_time
      maxParticipants: trainingSessions.maxStudents,
      price: trainingSessions.priceOverride,
      status: trainingSessions.status,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.courseId, courseId),
        eq(trainingSessions.organizationId, organizationId),
        or(
          eq(trainingSessions.status, "scheduled"),
          eq(trainingSessions.status, "open")
        ),
        gte(trainingSessions.startDate, new Date().toISOString().split("T")[0])
      )
    )
    .orderBy(trainingSessions.startDate, trainingSessions.startTime)
    .limit(limit)
    .offset(offset);

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.courseId, courseId),
        eq(trainingSessions.organizationId, organizationId),
        or(
          eq(trainingSessions.status, "scheduled"),
          eq(trainingSessions.status, "open")
        ),
        gte(trainingSessions.startDate, new Date().toISOString().split("T")[0])
      )
    );

  const total = Number(countResult[0]?.count ?? 0);

  return {
    trips: sessionsData.map((session) => ({
      id: session.id,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      maxParticipants: session.maxParticipants,
      price: session.price,
      status: session.status,
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

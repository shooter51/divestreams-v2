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
  agencyCourseTemplates,
  images,
  type PublicSiteSettings,
} from "./schema";
import { AGENCY_METADATA } from "./training-templates.server";
import { getCached, setCache } from "../cache/public-site.server";

// ============================================================================
// Types
// ============================================================================

export interface PaginationOptions {
  limit?: number;
  page?: number;
  onlyWithUpcomingSessions?: boolean;
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
  const cached = await getCached<PublicSiteSettings>(organizationId, "settings");
  if (cached) return cached;

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

  const settings = result[0].publicSiteSettings ?? null;
  if (settings) {
    await setCache(organizationId, "settings", settings);
  }
  return settings;
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

  const cacheResource = `trips:${page}:${limit}`;
  const cached = await getCached<PaginatedTripsResult>(organizationId, cacheResource);
  if (cached) return cached;

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

  const result: PaginatedTripsResult = {
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

  await setCache(organizationId, cacheResource, result);
  return result;
}

/**
 * Get public courses for an organization
 * Returns only courses where isPublic = true and isActive = true
 */
export async function getPublicCourses(
  organizationId: string,
  options: PaginationOptions = {}
): Promise<PaginatedCoursesResult> {
  const { limit = 20, page = 1, onlyWithUpcomingSessions = false } = options;
  const offset = (page - 1) * limit;

  const cacheResource = `courses:${page}:${limit}:${onlyWithUpcomingSessions}`;
  const cached = await getCached<PaginatedCoursesResult>(organizationId, cacheResource);
  if (cached) return cached;

  const today = new Date().toISOString().split("T")[0];

  // Build WHERE conditions
  const baseConditions = and(
    eq(trainingCourses.organizationId, organizationId),
    eq(trainingCourses.isPublic, true),
    eq(trainingCourses.isActive, true)
  );

  // When filtering by upcoming sessions, use EXISTS subquery
  const whereCondition = onlyWithUpcomingSessions
    ? and(
        baseConditions,
        sql`EXISTS (
          SELECT 1 FROM training_sessions ts
          WHERE ts.course_id = ${trainingCourses.id}
            AND ts.organization_id = ${trainingCourses.organizationId}
            AND ts.start_date >= ${today}
            AND ts.status IN ('scheduled', 'open')
        )`
      )
    : baseConditions;

  // Query from trainingCourses with template JOIN for read-through
  const coursesData = await db
    .select({
      id: trainingCourses.id,
      courseName: trainingCourses.name,
      courseDescription: trainingCourses.description,
      courseImages: trainingCourses.images,
      courseDurationDays: trainingCourses.durationDays,
      courseMinAge: trainingCourses.minAge,
      coursePrerequisites: trainingCourses.prerequisites,
      courseMaterialsIncluded: trainingCourses.materialsIncluded,
      // Template fields (read-through)
      templateName: agencyCourseTemplates.name,
      templateDescription: agencyCourseTemplates.description,
      templateImages: agencyCourseTemplates.images,
      templateDurationDays: agencyCourseTemplates.durationDays,
      templateMinAge: agencyCourseTemplates.minAge,
      templatePrerequisites: agencyCourseTemplates.prerequisites,
      templateMaterialsIncluded: agencyCourseTemplates.materialsIncluded,
      templateAgencyCode: agencyCourseTemplates.agencyCode,
      templateLevelCode: agencyCourseTemplates.levelCode,
      // Tenant-owned
      imageOverride: trainingCourses.imageOverride,
      price: trainingCourses.price,
      currency: trainingCourses.currency,
      maxStudents: trainingCourses.maxStudents,
      equipmentIncluded: trainingCourses.equipmentIncluded,
      agencyName: certificationAgencies.name,
      levelName: certificationLevels.name,
    })
    .from(trainingCourses)
    .leftJoin(agencyCourseTemplates, eq(trainingCourses.templateId, agencyCourseTemplates.id))
    .leftJoin(certificationAgencies, eq(trainingCourses.agencyId, certificationAgencies.id))
    .leftJoin(certificationLevels, eq(trainingCourses.levelId, certificationLevels.id))
    .where(whereCondition)
    .orderBy(trainingCourses.sortOrder, trainingCourses.name)
    .limit(limit)
    .offset(offset);

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(trainingCourses)
    .where(whereCondition);

  const total = Number(countResult[0]?.count ?? 0);

  // Get images from images table for all courses
  const courseIds = coursesData.map((c) => c.id);
  const imageMap = await getCourseImagesMap(organizationId, courseIds);

  const result: PaginatedCoursesResult = {
    courses: coursesData.map((course) => {
      const resolvedImages = course.imageOverride ?? course.templateImages ?? course.courseImages;
      return {
        id: course.id,
        name: course.templateName ?? course.courseName,
        description: course.templateDescription ?? course.courseDescription,
        price: course.price,
        currency: course.currency,
        durationDays: course.templateDurationDays ?? course.courseDurationDays,
        maxStudents: course.maxStudents,
        minAge: course.templateMinAge ?? course.courseMinAge,
        prerequisites: course.templatePrerequisites ?? course.coursePrerequisites,
        materialsIncluded: course.templateMaterialsIncluded ?? course.courseMaterialsIncluded,
        equipmentIncluded: course.equipmentIncluded,
        images: imageMap.get(course.id) || resolvedImages || null,
        agencyName: course.agencyName ?? (course.templateAgencyCode ? AGENCY_METADATA[course.templateAgencyCode]?.name : null),
        levelName: course.levelName ?? course.templateLevelCode,
      };
    }),
    total,
  };

  await setCache(organizationId, cacheResource, result);
  return result;
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

  const cacheResource = `equipment:${page}:${limit}`;
  const cached = await getCached<PaginatedEquipmentResult>(organizationId, cacheResource);
  if (cached) return cached;

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

  const result: PaginatedEquipmentResult = {
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

  await setCache(organizationId, cacheResource, result);
  return result;
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
  const [row] = await db
    .select({
      id: trainingCourses.id,
      // Course fields
      courseName: trainingCourses.name,
      courseDescription: trainingCourses.description,
      courseImages: trainingCourses.images,
      courseDurationDays: trainingCourses.durationDays,
      courseClassroomHours: trainingCourses.classroomHours,
      coursePoolHours: trainingCourses.poolHours,
      courseOpenWaterDives: trainingCourses.openWaterDives,
      courseMinAge: trainingCourses.minAge,
      coursePrerequisites: trainingCourses.prerequisites,
      courseMedicalRequirements: trainingCourses.medicalRequirements,
      courseRequiredItems: trainingCourses.requiredItems,
      courseMaterialsIncluded: trainingCourses.materialsIncluded,
      // Template fields
      templateName: agencyCourseTemplates.name,
      templateDescription: agencyCourseTemplates.description,
      templateImages: agencyCourseTemplates.images,
      templateDurationDays: agencyCourseTemplates.durationDays,
      templateClassroomHours: agencyCourseTemplates.classroomHours,
      templatePoolHours: agencyCourseTemplates.poolHours,
      templateOpenWaterDives: agencyCourseTemplates.openWaterDives,
      templateMinAge: agencyCourseTemplates.minAge,
      templatePrerequisites: agencyCourseTemplates.prerequisites,
      templateMedicalRequirements: agencyCourseTemplates.medicalRequirements,
      templateRequiredItems: agencyCourseTemplates.requiredItems,
      templateMaterialsIncluded: agencyCourseTemplates.materialsIncluded,
      templateAgencyCode: agencyCourseTemplates.agencyCode,
      templateLevelCode: agencyCourseTemplates.levelCode,
      // Tenant-owned fields
      imageOverride: trainingCourses.imageOverride,
      maxStudents: trainingCourses.maxStudents,
      minStudents: trainingCourses.minStudents,
      price: trainingCourses.price,
      currency: trainingCourses.currency,
      depositRequired: trainingCourses.depositRequired,
      depositAmount: trainingCourses.depositAmount,
      equipmentIncluded: trainingCourses.equipmentIncluded,
      includedItems: trainingCourses.includedItems,
      agencyName: certificationAgencies.name,
      levelName: certificationLevels.name,
    })
    .from(trainingCourses)
    .leftJoin(agencyCourseTemplates, eq(trainingCourses.templateId, agencyCourseTemplates.id))
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

  if (!row) {
    return null;
  }

  const resolvedImages = row.imageOverride ?? row.templateImages ?? row.courseImages;

  // Get images from images table (for custom uploaded images)
  const imageMap = await getCourseImagesMap(organizationId, [courseId]);
  const customImages = imageMap.get(courseId) || null;

  return {
    id: row.id,
    name: row.templateName ?? row.courseName,
    description: row.templateDescription ?? row.courseDescription,
    durationDays: row.templateDurationDays ?? row.courseDurationDays,
    classroomHours: row.templateClassroomHours ?? row.courseClassroomHours,
    poolHours: row.templatePoolHours ?? row.coursePoolHours,
    openWaterDives: row.templateOpenWaterDives ?? row.courseOpenWaterDives,
    maxStudents: row.maxStudents,
    minStudents: row.minStudents,
    price: row.price,
    currency: row.currency,
    depositRequired: row.depositRequired,
    depositAmount: row.depositAmount,
    materialsIncluded: row.templateMaterialsIncluded ?? row.courseMaterialsIncluded,
    equipmentIncluded: row.equipmentIncluded,
    includedItems: row.includedItems,
    requiredItems: row.templateRequiredItems ?? row.courseRequiredItems,
    minAge: row.templateMinAge ?? row.courseMinAge,
    prerequisites: row.templatePrerequisites ?? row.coursePrerequisites,
    medicalRequirements: row.templateMedicalRequirements ?? row.courseMedicalRequirements,
    images: customImages && customImages.length > 0 ? customImages : resolvedImages,
    agencyName: row.agencyName ?? (row.templateAgencyCode ? AGENCY_METADATA[row.templateAgencyCode]?.name : null),
    levelName: row.levelName ?? row.templateLevelCode,
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

/**
 * Public Queries for Booking Widget
 *
 * These queries are used by the embed widget and do not require authentication.
 * They only return publicly-visible information.
 *
 * All queries filter by organizationId to support organization-based multi-tenancy.
 */

import { db } from "./index";
import { eq, and, asc, gte, sql } from "drizzle-orm";
import * as schema from "./schema";
import { organization } from "./schema/auth";

// ============================================================================
// Organization Lookup for Embed Routes
// ============================================================================

/**
 * Get organization by slug (subdomain) for embed widget
 */
export async function getOrganizationBySlug(slug: string) {
  const result = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  return result[0] ?? null;
}

// ============================================================================
// Public Tour Queries
// ============================================================================

export interface PublicTour {
  id: string;
  name: string;
  description: string | null;
  type: string;
  duration: number;
  maxParticipants: number;
  price: string;
  currency: string;
  includesEquipment: boolean;
  includesMeals: boolean;
  includesTransport: boolean;
  inclusions: string[];
  minCertLevel: string | null;
  minAge: number | null;
  primaryImage: string | null;
  thumbnailImage: string | null;
  imageCount: number;
}

export async function getPublicTours(organizationId: string): Promise<PublicTour[]> {
  // Get active tours for this organization
  const tours = await db
    .select({
      id: schema.tours.id,
      name: schema.tours.name,
      description: schema.tours.description,
      type: schema.tours.type,
      duration: schema.tours.duration,
      maxParticipants: schema.tours.maxParticipants,
      price: schema.tours.price,
      currency: schema.tours.currency,
      includesEquipment: schema.tours.includesEquipment,
      includesMeals: schema.tours.includesMeals,
      includesTransport: schema.tours.includesTransport,
      inclusions: schema.tours.inclusions,
      minCertLevel: schema.tours.minCertLevel,
      minAge: schema.tours.minAge,
    })
    .from(schema.tours)
    .where(
      and(
        eq(schema.tours.organizationId, organizationId),
        eq(schema.tours.isActive, true)
      )
    )
    .orderBy(schema.tours.name);

  // Get images for each tour
  const toursWithImages = await Promise.all(
    tours.map(async (tour) => {
      const images = await db
        .select({
          url: schema.images.url,
          thumbnailUrl: schema.images.thumbnailUrl,
        })
        .from(schema.images)
        .where(
          and(
            eq(schema.images.organizationId, organizationId),
            eq(schema.images.entityType, "tour"),
            eq(schema.images.entityId, tour.id),
            eq(schema.images.isPrimary, true)
          )
        )
        .limit(1);

      const imageCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.images)
        .where(
          and(
            eq(schema.images.organizationId, organizationId),
            eq(schema.images.entityType, "tour"),
            eq(schema.images.entityId, tour.id)
          )
        );

      return {
        id: tour.id,
        name: tour.name,
        description: tour.description,
        type: tour.type,
        duration: Number(tour.duration || 0),
        maxParticipants: Number(tour.maxParticipants),
        price: tour.price,
        currency: tour.currency,
        includesEquipment: tour.includesEquipment || false,
        includesMeals: tour.includesMeals || false,
        includesTransport: tour.includesTransport || false,
        inclusions: tour.inclusions || [],
        minCertLevel: tour.minCertLevel,
        minAge: tour.minAge ? Number(tour.minAge) : null,
        primaryImage: images[0]?.url || null,
        thumbnailImage: images[0]?.thumbnailUrl || null,
        imageCount: Number(imageCount[0]?.count || 0),
      };
    })
  );

  return toursWithImages;
}

// ============================================================================
// Public Trip Queries (Available dates)
// ============================================================================

export interface PublicTrip {
  id: string;
  tourId: string;
  tourName: string;
  date: string;
  startTime: string;
  endTime: string | null;
  maxParticipants: number;
  availableSpots: number;
  price: string;
  currency: string;
  status: string;
}

export async function getPublicTrips(
  organizationId: string,
  options: {
    tourId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  } = {}
): Promise<PublicTrip[]> {
  const { tourId, fromDate, toDate, limit = 30 } = options;

  // Default to today if no fromDate
  const startDate = fromDate || new Date().toISOString().split("T")[0];

  // Build query conditions
  const conditions = [
    eq(schema.trips.organizationId, organizationId),
    eq(schema.trips.status, "scheduled"),
    gte(schema.trips.date, startDate),
  ];

  if (tourId) {
    conditions.push(eq(schema.trips.tourId, tourId));
  }

  // Get trips with tour info
  const trips = await db
    .select({
      id: schema.trips.id,
      tourId: schema.trips.tourId,
      tourName: schema.tours.name,
      date: schema.trips.date,
      startTime: schema.trips.startTime,
      endTime: schema.trips.endTime,
      tripMaxParticipants: schema.trips.maxParticipants,
      tourMaxParticipants: schema.tours.maxParticipants,
      tripPrice: schema.trips.price,
      tourPrice: schema.tours.price,
      currency: schema.tours.currency,
      status: schema.trips.status,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(and(...conditions, eq(schema.tours.isActive, true)))
    .orderBy(asc(schema.trips.date), asc(schema.trips.startTime))
    .limit(limit);

  // Get booking counts for each trip
  const tripsWithAvailability = await Promise.all(
    trips.map(async (trip) => {
      const bookingCount = await db
        .select({ total: sql<number>`COALESCE(SUM(participants), 0)` })
        .from(schema.bookings)
        .where(
          and(
            eq(schema.bookings.tripId, trip.id),
            sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
          )
        );

      const maxParticipants = Number(trip.tripMaxParticipants || trip.tourMaxParticipants);
      const bookedParticipants = Number(bookingCount[0]?.total || 0);

      return {
        id: trip.id,
        tourId: trip.tourId,
        tourName: trip.tourName,
        date: trip.date,
        startTime: trip.startTime,
        endTime: trip.endTime,
        maxParticipants,
        availableSpots: Math.max(0, maxParticipants - bookedParticipants),
        price: trip.tripPrice || trip.tourPrice,
        currency: trip.currency,
        status: bookedParticipants >= maxParticipants ? "full" : trip.status,
      };
    })
  );

  return tripsWithAvailability;
}

// ============================================================================
// Public Tour Detail
// ============================================================================

export interface PublicTourDetail extends PublicTour {
  images: Array<{
    id: string;
    url: string;
    thumbnailUrl: string | null;
    alt: string | null;
    sortOrder: number;
  }>;
  upcomingTrips: PublicTrip[];
}

export async function getPublicTourById(
  organizationId: string,
  tourId: string
): Promise<PublicTourDetail | null> {
  // Get tour details
  const tours = await db
    .select()
    .from(schema.tours)
    .where(
      and(
        eq(schema.tours.organizationId, organizationId),
        eq(schema.tours.id, tourId),
        eq(schema.tours.isActive, true)
      )
    )
    .limit(1);

  if (tours.length === 0) {
    return null;
  }

  const tour = tours[0];

  // Get images
  const images = await db
    .select({
      id: schema.images.id,
      url: schema.images.url,
      thumbnailUrl: schema.images.thumbnailUrl,
      alt: schema.images.alt,
      sortOrder: schema.images.sortOrder,
      isPrimary: schema.images.isPrimary,
    })
    .from(schema.images)
    .where(
      and(
        eq(schema.images.organizationId, organizationId),
        eq(schema.images.entityType, "tour"),
        eq(schema.images.entityId, tourId)
      )
    )
    .orderBy(sql`${schema.images.isPrimary} DESC`, asc(schema.images.sortOrder));

  // Get upcoming trips
  const upcomingTrips = await getPublicTrips(organizationId, {
    tourId,
    limit: 10,
  });

  return {
    id: tour.id,
    name: tour.name,
    description: tour.description,
    type: tour.type,
    duration: Number(tour.duration || 0),
    maxParticipants: Number(tour.maxParticipants),
    price: tour.price,
    currency: tour.currency,
    includesEquipment: tour.includesEquipment || false,
    includesMeals: tour.includesMeals || false,
    includesTransport: tour.includesTransport || false,
    inclusions: tour.inclusions || [],
    minCertLevel: tour.minCertLevel,
    minAge: tour.minAge ? Number(tour.minAge) : null,
    primaryImage: images[0]?.url || null,
    thumbnailImage: images[0]?.thumbnailUrl || null,
    imageCount: images.length,
    images: images.map((img) => ({
      id: img.id,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl,
      alt: img.alt,
      sortOrder: Number(img.sortOrder),
    })),
    upcomingTrips,
  };
}

// ============================================================================
// Public Trip Detail (for booking)
// ============================================================================

export interface PublicTripDetail {
  id: string;
  tourId: string;
  tourName: string;
  tourDescription: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  maxParticipants: number;
  availableSpots: number;
  price: string;
  currency: string;
  includesEquipment: boolean;
  includesMeals: boolean;
  includesTransport: boolean;
  minCertLevel: string | null;
  minAge: number | null;
  primaryImage: string | null;
}

// ============================================================================
// Public Course Queries (for Embed Widget)
// ============================================================================

export interface PublicCourse {
  id: string;
  name: string;
  description: string | null;
  agencyName: string;
  agencyCode: string;
  agencyLogo: string | null;
  levelName: string;
  levelCode: string;
  price: string;
  depositAmount: string | null;
  currency: string;
  maxStudents: number;
  totalSessions: number;
  hasExam: boolean;
  minOpenWaterDives: number;
  scheduleType: string;
}

export async function getPublicCourses(
  organizationId: string
): Promise<PublicCourse[]> {
  const courses = await db
    .select({
      id: schema.trainingCourses.id,
      name: schema.trainingCourses.name,
      description: schema.trainingCourses.description,
      agencyName: schema.certificationAgencies.name,
      agencyCode: schema.certificationAgencies.code,
      agencyLogo: schema.certificationAgencies.logoUrl,
      levelName: schema.certificationLevels.name,
      levelCode: schema.certificationLevels.code,
      price: schema.trainingCourses.price,
      depositAmount: schema.trainingCourses.depositAmount,
      maxStudents: schema.trainingCourses.maxStudents,
      totalSessions: schema.trainingCourses.totalSessions,
      hasExam: schema.trainingCourses.hasExam,
      minOpenWaterDives: schema.trainingCourses.minOpenWaterDives,
      scheduleType: schema.trainingCourses.scheduleType,
    })
    .from(schema.trainingCourses)
    .innerJoin(
      schema.certificationAgencies,
      eq(schema.trainingCourses.agencyId, schema.certificationAgencies.id)
    )
    .innerJoin(
      schema.certificationLevels,
      eq(schema.trainingCourses.levelId, schema.certificationLevels.id)
    )
    .where(
      and(
        eq(schema.trainingCourses.organizationId, organizationId),
        eq(schema.trainingCourses.isActive, true),
        eq(schema.certificationAgencies.isActive, true),
        eq(schema.certificationLevels.isActive, true)
      )
    )
    .orderBy(asc(schema.certificationAgencies.name), asc(schema.certificationLevels.level));

  // Get organization settings for currency
  const orgSettings = await db
    .select({ currency: schema.organizationSettings.currency })
    .from(schema.organizationSettings)
    .where(eq(schema.organizationSettings.organizationId, organizationId))
    .limit(1);

  const currency = orgSettings[0]?.currency || "USD";

  return courses.map((course) => ({
    id: course.id,
    name: course.name,
    description: course.description,
    agencyName: course.agencyName,
    agencyCode: course.agencyCode,
    agencyLogo: course.agencyLogo,
    levelName: course.levelName,
    levelCode: course.levelCode,
    price: course.price,
    depositAmount: course.depositAmount,
    currency,
    maxStudents: course.maxStudents,
    totalSessions: course.totalSessions,
    hasExam: course.hasExam,
    minOpenWaterDives: course.minOpenWaterDives ?? 0,
    scheduleType: course.scheduleType,
  }));
}

export interface PublicCourseDetail extends PublicCourse {
  upcomingSessions: Array<{
    id: string;
    sessionType: string;
    sessionNumber: number;
    scheduledDate: string;
    startTime: string;
    endTime: string | null;
    location: string | null;
    availableSpots: number;
  }>;
}

export async function getPublicCourseById(
  organizationId: string,
  courseId: string
): Promise<PublicCourseDetail | null> {
  const courses = await db
    .select({
      id: schema.trainingCourses.id,
      name: schema.trainingCourses.name,
      description: schema.trainingCourses.description,
      agencyName: schema.certificationAgencies.name,
      agencyCode: schema.certificationAgencies.code,
      agencyLogo: schema.certificationAgencies.logoUrl,
      levelName: schema.certificationLevels.name,
      levelCode: schema.certificationLevels.code,
      price: schema.trainingCourses.price,
      depositAmount: schema.trainingCourses.depositAmount,
      maxStudents: schema.trainingCourses.maxStudents,
      totalSessions: schema.trainingCourses.totalSessions,
      hasExam: schema.trainingCourses.hasExam,
      minOpenWaterDives: schema.trainingCourses.minOpenWaterDives,
      scheduleType: schema.trainingCourses.scheduleType,
    })
    .from(schema.trainingCourses)
    .innerJoin(
      schema.certificationAgencies,
      eq(schema.trainingCourses.agencyId, schema.certificationAgencies.id)
    )
    .innerJoin(
      schema.certificationLevels,
      eq(schema.trainingCourses.levelId, schema.certificationLevels.id)
    )
    .where(
      and(
        eq(schema.trainingCourses.organizationId, organizationId),
        eq(schema.trainingCourses.id, courseId),
        eq(schema.trainingCourses.isActive, true)
      )
    )
    .limit(1);

  if (courses.length === 0) {
    return null;
  }

  const course = courses[0];

  // Get organization settings for currency
  const orgSettings = await db
    .select({ currency: schema.organizationSettings.currency })
    .from(schema.organizationSettings)
    .where(eq(schema.organizationSettings.organizationId, organizationId))
    .limit(1);

  const currency = orgSettings[0]?.currency || "USD";

  // Get upcoming sessions for this course
  const today = new Date().toISOString().split("T")[0];
  const sessions = await db
    .select({
      id: schema.courseSessions.id,
      sessionType: schema.courseSessions.sessionType,
      sessionNumber: schema.courseSessions.sessionNumber,
      scheduledDate: schema.courseSessions.scheduledDate,
      startTime: schema.courseSessions.startTime,
      endTime: schema.courseSessions.endTime,
      location: schema.courseSessions.location,
      maxStudents: schema.courseSessions.maxStudents,
    })
    .from(schema.courseSessions)
    .where(
      and(
        eq(schema.courseSessions.organizationId, organizationId),
        eq(schema.courseSessions.courseId, courseId),
        eq(schema.courseSessions.status, "scheduled"),
        gte(schema.courseSessions.scheduledDate, today)
      )
    )
    .orderBy(asc(schema.courseSessions.scheduledDate), asc(schema.courseSessions.startTime))
    .limit(10);

  // Get enrollment count for each session to calculate available spots
  const sessionsWithAvailability = await Promise.all(
    sessions.map(async (session) => {
      const [enrollmentCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.trainingEnrollments)
        .where(
          and(
            eq(schema.trainingEnrollments.organizationId, organizationId),
            eq(schema.trainingEnrollments.courseId, courseId),
            sql`${schema.trainingEnrollments.status} NOT IN ('withdrawn', 'certified')`
          )
        );

      const maxStudents = session.maxStudents || course.maxStudents;
      const enrolled = Number(enrollmentCount?.count || 0);

      return {
        id: session.id,
        sessionType: session.sessionType,
        sessionNumber: session.sessionNumber,
        scheduledDate: session.scheduledDate,
        startTime: session.startTime,
        endTime: session.endTime,
        location: session.location,
        availableSpots: Math.max(0, maxStudents - enrolled),
      };
    })
  );

  return {
    id: course.id,
    name: course.name,
    description: course.description,
    agencyName: course.agencyName,
    agencyCode: course.agencyCode,
    agencyLogo: course.agencyLogo,
    levelName: course.levelName,
    levelCode: course.levelCode,
    price: course.price,
    depositAmount: course.depositAmount,
    currency,
    maxStudents: course.maxStudents,
    totalSessions: course.totalSessions,
    hasExam: course.hasExam,
    minOpenWaterDives: course.minOpenWaterDives ?? 0,
    scheduleType: course.scheduleType,
    upcomingSessions: sessionsWithAvailability,
  };
}

// ============================================================================
// Public Trip Detail (for booking)
// ============================================================================

export async function getPublicTripById(
  organizationId: string,
  tripId: string
): Promise<PublicTripDetail | null> {
  // Get trip with tour info
  const trips = await db
    .select({
      id: schema.trips.id,
      tourId: schema.trips.tourId,
      tourName: schema.tours.name,
      tourDescription: schema.tours.description,
      date: schema.trips.date,
      startTime: schema.trips.startTime,
      endTime: schema.trips.endTime,
      tripMaxParticipants: schema.trips.maxParticipants,
      tourMaxParticipants: schema.tours.maxParticipants,
      tripPrice: schema.trips.price,
      tourPrice: schema.tours.price,
      currency: schema.tours.currency,
      status: schema.trips.status,
      includesEquipment: schema.tours.includesEquipment,
      includesMeals: schema.tours.includesMeals,
      includesTransport: schema.tours.includesTransport,
      minCertLevel: schema.tours.minCertLevel,
      minAge: schema.tours.minAge,
    })
    .from(schema.trips)
    .innerJoin(schema.tours, eq(schema.trips.tourId, schema.tours.id))
    .where(
      and(
        eq(schema.trips.organizationId, organizationId),
        eq(schema.trips.id, tripId),
        eq(schema.trips.status, "scheduled"),
        eq(schema.tours.isActive, true)
      )
    )
    .limit(1);

  if (trips.length === 0) {
    return null;
  }

  const trip = trips[0];

  // Check if trip is in the past
  const tripDate = new Date(trip.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (tripDate < today) {
    return null; // Trip is in the past
  }

  // Get booking count
  const bookingCount = await db
    .select({ total: sql<number>`COALESCE(SUM(participants), 0)` })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.tripId, tripId),
        sql`${schema.bookings.status} NOT IN ('canceled', 'no_show')`
      )
    );

  const maxParticipants = Number(trip.tripMaxParticipants || trip.tourMaxParticipants);
  const bookedParticipants = Number(bookingCount[0]?.total || 0);

  // Get primary image
  const images = await db
    .select({
      url: schema.images.url,
    })
    .from(schema.images)
    .where(
      and(
        eq(schema.images.organizationId, organizationId),
        eq(schema.images.entityType, "tour"),
        eq(schema.images.entityId, trip.tourId),
        eq(schema.images.isPrimary, true)
      )
    )
    .limit(1);

  return {
    id: trip.id,
    tourId: trip.tourId,
    tourName: trip.tourName,
    tourDescription: trip.tourDescription,
    date: trip.date,
    startTime: trip.startTime,
    endTime: trip.endTime,
    maxParticipants,
    availableSpots: Math.max(0, maxParticipants - bookedParticipants),
    price: trip.tripPrice || trip.tourPrice,
    currency: trip.currency,
    includesEquipment: trip.includesEquipment || false,
    includesMeals: trip.includesMeals || false,
    includesTransport: trip.includesTransport || false,
    minCertLevel: trip.minCertLevel,
    minAge: trip.minAge ? Number(trip.minAge) : null,
    primaryImage: images[0]?.url || null,
  };
}

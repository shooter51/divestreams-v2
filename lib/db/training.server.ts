/**
 * Training Module Database Query Helpers
 *
 * These functions provide typed queries for training-related data.
 * All functions accept an organizationId and filter data accordingly.
 */

import { desc, eq, asc, count, and, sql, gte, lte, ilike, or } from "drizzle-orm";
import { db } from "./index";
import * as schema from "./schema";

// ============================================================================
// Agency Queries
// ============================================================================

export async function getAgencies(organizationId: string) {
  return db
    .select()
    .from(schema.certificationAgencies)
    .where(eq(schema.certificationAgencies.organizationId, organizationId))
    .orderBy(asc(schema.certificationAgencies.name));
}

export async function getAgencyById(organizationId: string, agencyId: string) {
  const [agency] = await db
    .select()
    .from(schema.certificationAgencies)
    .where(
      and(
        eq(schema.certificationAgencies.organizationId, organizationId),
        eq(schema.certificationAgencies.id, agencyId)
      )
    );
  return agency;
}

export async function createAgency(data: {
  organizationId: string;
  name: string;
  code: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  isActive?: boolean;
}) {
  const [agency] = await db
    .insert(schema.certificationAgencies)
    .values(data)
    .returning();
  return agency;
}

export async function updateAgency(
  organizationId: string,
  agencyId: string,
  data: Partial<{
    name: string;
    code: string;
    description: string | null;
    website: string | null;
    logoUrl: string | null;
    isActive: boolean;
  }>
) {
  const [agency] = await db
    .update(schema.certificationAgencies)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(schema.certificationAgencies.organizationId, organizationId),
        eq(schema.certificationAgencies.id, agencyId)
      )
    )
    .returning();
  return agency;
}

export async function deleteAgency(organizationId: string, agencyId: string) {
  await db
    .delete(schema.certificationAgencies)
    .where(
      and(
        eq(schema.certificationAgencies.organizationId, organizationId),
        eq(schema.certificationAgencies.id, agencyId)
      )
    );
}

// ============================================================================
// Level Queries
// ============================================================================

export async function getLevels(organizationId: string) {
  return db
    .select({
      id: schema.certificationLevels.id,
      name: schema.certificationLevels.name,
      code: schema.certificationLevels.code,
      levelNumber: schema.certificationLevels.levelNumber,
      description: schema.certificationLevels.description,
      prerequisites: schema.certificationLevels.prerequisites,
      minAge: schema.certificationLevels.minAge,
      minDives: schema.certificationLevels.minDives,
      isActive: schema.certificationLevels.isActive,
      agencyId: schema.certificationLevels.agencyId,
      agencyName: schema.certificationAgencies.name,
      createdAt: schema.certificationLevels.createdAt,
    })
    .from(schema.certificationLevels)
    .leftJoin(
      schema.certificationAgencies,
      eq(schema.certificationLevels.agencyId, schema.certificationAgencies.id)
    )
    .where(eq(schema.certificationLevels.organizationId, organizationId))
    .orderBy(asc(schema.certificationLevels.levelNumber));
}

export async function getLevelById(organizationId: string, levelId: string) {
  const [level] = await db
    .select()
    .from(schema.certificationLevels)
    .where(
      and(
        eq(schema.certificationLevels.organizationId, organizationId),
        eq(schema.certificationLevels.id, levelId)
      )
    );
  return level;
}

export async function createLevel(data: {
  organizationId: string;
  name: string;
  code: string;
  levelNumber: number;
  agencyId?: string;
  description?: string;
  prerequisites?: string;
  minAge?: number;
  minDives?: number;
  isActive?: boolean;
}) {
  const [level] = await db
    .insert(schema.certificationLevels)
    .values(data)
    .returning();
  return level;
}

export async function updateLevel(
  organizationId: string,
  levelId: string,
  data: Partial<{
    name: string;
    code: string;
    levelNumber: number;
    agencyId: string | null;
    description: string | null;
    prerequisites: string | null;
    minAge: number | null;
    minDives: number | null;
    isActive: boolean;
  }>
) {
  const [level] = await db
    .update(schema.certificationLevels)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(schema.certificationLevels.organizationId, organizationId),
        eq(schema.certificationLevels.id, levelId)
      )
    )
    .returning();
  return level;
}

export async function deleteLevel(organizationId: string, levelId: string) {
  await db
    .delete(schema.certificationLevels)
    .where(
      and(
        eq(schema.certificationLevels.organizationId, organizationId),
        eq(schema.certificationLevels.id, levelId)
      )
    );
}

// ============================================================================
// Course Queries
// ============================================================================

export async function getCourses(
  organizationId: string,
  options?: {
    search?: string;
    agencyId?: string;
    levelId?: string;
    isActive?: boolean;
    isPublic?: boolean;
  }
) {
  const query = db
    .select({
      id: schema.trainingCourses.id,
      name: schema.trainingCourses.name,
      code: schema.trainingCourses.code,
      description: schema.trainingCourses.description,
      images: schema.trainingCourses.images,
      durationDays: schema.trainingCourses.durationDays,
      price: schema.trainingCourses.price,
      currency: schema.trainingCourses.currency,
      maxStudents: schema.trainingCourses.maxStudents,
      isActive: schema.trainingCourses.isActive,
      isPublic: schema.trainingCourses.isPublic,
      agencyId: schema.trainingCourses.agencyId,
      agencyName: schema.certificationAgencies.name,
      levelId: schema.trainingCourses.levelId,
      levelName: schema.certificationLevels.name,
      createdAt: schema.trainingCourses.createdAt,
    })
    .from(schema.trainingCourses)
    .leftJoin(
      schema.certificationAgencies,
      eq(schema.trainingCourses.agencyId, schema.certificationAgencies.id)
    )
    .leftJoin(
      schema.certificationLevels,
      eq(schema.trainingCourses.levelId, schema.certificationLevels.id)
    )
    .where(eq(schema.trainingCourses.organizationId, organizationId))
    .orderBy(asc(schema.trainingCourses.sortOrder), asc(schema.trainingCourses.name));

  return query;
}

export async function getCourseById(organizationId: string, courseId: string) {
  const [course] = await db
    .select({
      id: schema.trainingCourses.id,
      name: schema.trainingCourses.name,
      code: schema.trainingCourses.code,
      description: schema.trainingCourses.description,
      durationDays: schema.trainingCourses.durationDays,
      classroomHours: schema.trainingCourses.classroomHours,
      poolHours: schema.trainingCourses.poolHours,
      openWaterDives: schema.trainingCourses.openWaterDives,
      price: schema.trainingCourses.price,
      currency: schema.trainingCourses.currency,
      depositRequired: schema.trainingCourses.depositRequired,
      depositAmount: schema.trainingCourses.depositAmount,
      minStudents: schema.trainingCourses.minStudents,
      maxStudents: schema.trainingCourses.maxStudents,
      materialsIncluded: schema.trainingCourses.materialsIncluded,
      equipmentIncluded: schema.trainingCourses.equipmentIncluded,
      includedItems: schema.trainingCourses.includedItems,
      requiredItems: schema.trainingCourses.requiredItems,
      minAge: schema.trainingCourses.minAge,
      prerequisites: schema.trainingCourses.prerequisites,
      medicalRequirements: schema.trainingCourses.medicalRequirements,
      images: schema.trainingCourses.images,
      isPublic: schema.trainingCourses.isPublic,
      isActive: schema.trainingCourses.isActive,
      sortOrder: schema.trainingCourses.sortOrder,
      agencyId: schema.trainingCourses.agencyId,
      agencyName: schema.certificationAgencies.name,
      levelId: schema.trainingCourses.levelId,
      levelName: schema.certificationLevels.name,
      requiredCertLevel: schema.trainingCourses.requiredCertLevel,
      createdAt: schema.trainingCourses.createdAt,
      updatedAt: schema.trainingCourses.updatedAt,
    })
    .from(schema.trainingCourses)
    .leftJoin(
      schema.certificationAgencies,
      eq(schema.trainingCourses.agencyId, schema.certificationAgencies.id)
    )
    .leftJoin(
      schema.certificationLevels,
      eq(schema.trainingCourses.levelId, schema.certificationLevels.id)
    )
    .where(
      and(
        eq(schema.trainingCourses.organizationId, organizationId),
        eq(schema.trainingCourses.id, courseId)
      )
    );
  return course;
}

export async function createCourse(data: {
  organizationId: string;
  name: string;
  code?: string;
  description?: string;
  agencyId?: string;
  levelId?: string;
  durationDays?: number;
  classroomHours?: number;
  poolHours?: number;
  openWaterDives?: number;
  price: string;
  currency?: string;
  depositRequired?: boolean;
  depositAmount?: string;
  minStudents?: number;
  maxStudents?: number;
  materialsIncluded?: boolean;
  equipmentIncluded?: boolean;
  includedItems?: string[];
  requiredItems?: string[];
  minAge?: number;
  prerequisites?: string;
  requiredCertLevel?: string;
  medicalRequirements?: string;
  images?: string[];
  isPublic?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}) {
  const [course] = await db
    .insert(schema.trainingCourses)
    .values(data)
    .returning();
  return course;
}

export async function updateCourse(
  organizationId: string,
  courseId: string,
  data: Partial<{
    name: string;
    code: string | null;
    description: string | null;
    agencyId: string | null;
    levelId: string | null;
    durationDays: number;
    classroomHours: number | null;
    poolHours: number | null;
    openWaterDives: number | null;
    price: string;
    currency: string;
    depositRequired: boolean | null;
    depositAmount: string | null;
    minStudents: number | null;
    maxStudents: number;
    materialsIncluded: boolean | null;
    equipmentIncluded: boolean | null;
    includedItems: string[] | null;
    requiredItems: string[] | null;
    minAge: number | null;
    prerequisites: string | null;
    requiredCertLevel: string | null;
    medicalRequirements: string | null;
    images: string[] | null;
    isPublic: boolean;
    isActive: boolean;
    sortOrder: number | null;
  }>
) {
  const [course] = await db
    .update(schema.trainingCourses)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(schema.trainingCourses.organizationId, organizationId),
        eq(schema.trainingCourses.id, courseId)
      )
    )
    .returning();
  return course;
}

export async function deleteCourse(organizationId: string, courseId: string) {
  await db
    .delete(schema.trainingCourses)
    .where(
      and(
        eq(schema.trainingCourses.organizationId, organizationId),
        eq(schema.trainingCourses.id, courseId)
      )
    );
}

// ============================================================================
// Session Queries
// ============================================================================

export async function getSessions(
  organizationId: string,
  options?: {
    courseId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  const conditions = [eq(schema.trainingSessions.organizationId, organizationId)];

  if (options?.courseId) {
    conditions.push(eq(schema.trainingSessions.courseId, options.courseId));
  }
  if (options?.status) {
    conditions.push(eq(schema.trainingSessions.status, options.status));
  }
  if (options?.startDate) {
    conditions.push(gte(schema.trainingSessions.startDate, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(schema.trainingSessions.startDate, options.endDate));
  }

  return db
    .select({
      id: schema.trainingSessions.id,
      startDate: schema.trainingSessions.startDate,
      endDate: schema.trainingSessions.endDate,
      startTime: schema.trainingSessions.startTime,
      location: schema.trainingSessions.location,
      instructorName: schema.trainingSessions.instructorName,
      maxStudents: schema.trainingSessions.maxStudents,
      status: schema.trainingSessions.status,
      enrolledCount: schema.trainingSessions.enrolledCount,
      completedCount: schema.trainingSessions.completedCount,
      priceOverride: schema.trainingSessions.priceOverride,
      courseId: schema.trainingSessions.courseId,
      courseName: schema.trainingCourses.name,
      coursePrice: schema.trainingCourses.price,
      agencyName: schema.certificationAgencies.name,
      levelName: schema.certificationLevels.name,
      createdAt: schema.trainingSessions.createdAt,
    })
    .from(schema.trainingSessions)
    .innerJoin(
      schema.trainingCourses,
      eq(schema.trainingSessions.courseId, schema.trainingCourses.id)
    )
    .leftJoin(
      schema.certificationAgencies,
      eq(schema.trainingCourses.agencyId, schema.certificationAgencies.id)
    )
    .leftJoin(
      schema.certificationLevels,
      eq(schema.trainingCourses.levelId, schema.certificationLevels.id)
    )
    .where(and(...conditions))
    .orderBy(asc(schema.trainingSessions.startDate));
}

export async function getSessionById(organizationId: string, sessionId: string) {
  const [session] = await db
    .select({
      id: schema.trainingSessions.id,
      startDate: schema.trainingSessions.startDate,
      endDate: schema.trainingSessions.endDate,
      startTime: schema.trainingSessions.startTime,
      location: schema.trainingSessions.location,
      meetingPoint: schema.trainingSessions.meetingPoint,
      instructorId: schema.trainingSessions.instructorId,
      instructorName: schema.trainingSessions.instructorName,
      maxStudents: schema.trainingSessions.maxStudents,
      priceOverride: schema.trainingSessions.priceOverride,
      status: schema.trainingSessions.status,
      notes: schema.trainingSessions.notes,
      enrolledCount: schema.trainingSessions.enrolledCount,
      completedCount: schema.trainingSessions.completedCount,
      courseId: schema.trainingSessions.courseId,
      courseName: schema.trainingCourses.name,
      coursePrice: schema.trainingCourses.price,
      courseDurationDays: schema.trainingCourses.durationDays,
      agencyName: schema.certificationAgencies.name,
      levelName: schema.certificationLevels.name,
      createdAt: schema.trainingSessions.createdAt,
      updatedAt: schema.trainingSessions.updatedAt,
    })
    .from(schema.trainingSessions)
    .innerJoin(
      schema.trainingCourses,
      eq(schema.trainingSessions.courseId, schema.trainingCourses.id)
    )
    .leftJoin(
      schema.certificationAgencies,
      eq(schema.trainingCourses.agencyId, schema.certificationAgencies.id)
    )
    .leftJoin(
      schema.certificationLevels,
      eq(schema.trainingCourses.levelId, schema.certificationLevels.id)
    )
    .where(
      and(
        eq(schema.trainingSessions.organizationId, organizationId),
        eq(schema.trainingSessions.id, sessionId)
      )
    );
  return session;
}

export async function createSession(data: {
  organizationId: string;
  courseId: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  location?: string;
  meetingPoint?: string;
  instructorId?: string;
  instructorName?: string;
  maxStudents?: number;
  priceOverride?: string;
  status?: string;
  notes?: string;
}) {
  const [session] = await db
    .insert(schema.trainingSessions)
    .values(data)
    .returning();
  return session;
}

export async function updateSession(
  organizationId: string,
  sessionId: string,
  data: Partial<{
    courseId: string;
    startDate: string;
    endDate: string | null;
    startTime: string | null;
    location: string | null;
    meetingPoint: string | null;
    instructorId: string | null;
    instructorName: string | null;
    maxStudents: number | null;
    priceOverride: string | null;
    status: string;
    notes: string | null;
  }>
) {
  const [session] = await db
    .update(schema.trainingSessions)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(schema.trainingSessions.organizationId, organizationId),
        eq(schema.trainingSessions.id, sessionId)
      )
    )
    .returning();
  return session;
}

export async function deleteSession(organizationId: string, sessionId: string) {
  await db
    .delete(schema.trainingSessions)
    .where(
      and(
        eq(schema.trainingSessions.organizationId, organizationId),
        eq(schema.trainingSessions.id, sessionId)
      )
    );
}

// ============================================================================
// Enrollment Queries
// ============================================================================

export async function getEnrollments(
  organizationId: string,
  options?: {
    sessionId?: string;
    customerId?: string;
    status?: string;
  }
) {
  const conditions = [eq(schema.trainingEnrollments.organizationId, organizationId)];

  if (options?.sessionId) {
    conditions.push(eq(schema.trainingEnrollments.sessionId, options.sessionId));
  }
  if (options?.customerId) {
    conditions.push(eq(schema.trainingEnrollments.customerId, options.customerId));
  }
  if (options?.status) {
    conditions.push(eq(schema.trainingEnrollments.status, options.status));
  }

  return db
    .select({
      id: schema.trainingEnrollments.id,
      status: schema.trainingEnrollments.status,
      enrolledAt: schema.trainingEnrollments.enrolledAt,
      completedAt: schema.trainingEnrollments.completedAt,
      amountPaid: schema.trainingEnrollments.amountPaid,
      paymentStatus: schema.trainingEnrollments.paymentStatus,
      certificationNumber: schema.trainingEnrollments.certificationNumber,
      certificationDate: schema.trainingEnrollments.certificationDate,
      sessionId: schema.trainingEnrollments.sessionId,
      customerId: schema.trainingEnrollments.customerId,
      customerFirstName: schema.customers.firstName,
      customerLastName: schema.customers.lastName,
      customerEmail: schema.customers.email,
      sessionStartDate: schema.trainingSessions.startDate,
      courseName: schema.trainingCourses.name,
      agencyName: schema.certificationAgencies.name,
      levelName: schema.certificationLevels.name,
      createdAt: schema.trainingEnrollments.createdAt,
    })
    .from(schema.trainingEnrollments)
    .innerJoin(
      schema.customers,
      eq(schema.trainingEnrollments.customerId, schema.customers.id)
    )
    .innerJoin(
      schema.trainingSessions,
      eq(schema.trainingEnrollments.sessionId, schema.trainingSessions.id)
    )
    .innerJoin(
      schema.trainingCourses,
      eq(schema.trainingSessions.courseId, schema.trainingCourses.id)
    )
    .leftJoin(
      schema.certificationAgencies,
      eq(schema.trainingCourses.agencyId, schema.certificationAgencies.id)
    )
    .leftJoin(
      schema.certificationLevels,
      eq(schema.trainingCourses.levelId, schema.certificationLevels.id)
    )
    .where(and(...conditions))
    .orderBy(desc(schema.trainingEnrollments.enrolledAt));
}

export async function getEnrollmentById(organizationId: string, enrollmentId: string) {
  const [enrollment] = await db
    .select({
      id: schema.trainingEnrollments.id,
      status: schema.trainingEnrollments.status,
      enrolledAt: schema.trainingEnrollments.enrolledAt,
      completedAt: schema.trainingEnrollments.completedAt,
      amountPaid: schema.trainingEnrollments.amountPaid,
      paymentStatus: schema.trainingEnrollments.paymentStatus,
      progress: schema.trainingEnrollments.progress,
      skillCheckoffs: schema.trainingEnrollments.skillCheckoffs,
      certificationNumber: schema.trainingEnrollments.certificationNumber,
      certificationDate: schema.trainingEnrollments.certificationDate,
      notes: schema.trainingEnrollments.notes,
      sessionId: schema.trainingEnrollments.sessionId,
      customerId: schema.trainingEnrollments.customerId,
      customerFirstName: schema.customers.firstName,
      customerLastName: schema.customers.lastName,
      customerEmail: schema.customers.email,
      customerPhone: schema.customers.phone,
      sessionStartDate: schema.trainingSessions.startDate,
      sessionEndDate: schema.trainingSessions.endDate,
      sessionLocation: schema.trainingSessions.location,
      sessionInstructor: schema.trainingSessions.instructorName,
      courseId: schema.trainingCourses.id,
      courseName: schema.trainingCourses.name,
      coursePrice: schema.trainingCourses.price,
      agencyName: schema.certificationAgencies.name,
      levelName: schema.certificationLevels.name,
      createdAt: schema.trainingEnrollments.createdAt,
      updatedAt: schema.trainingEnrollments.updatedAt,
    })
    .from(schema.trainingEnrollments)
    .innerJoin(
      schema.customers,
      eq(schema.trainingEnrollments.customerId, schema.customers.id)
    )
    .innerJoin(
      schema.trainingSessions,
      eq(schema.trainingEnrollments.sessionId, schema.trainingSessions.id)
    )
    .innerJoin(
      schema.trainingCourses,
      eq(schema.trainingSessions.courseId, schema.trainingCourses.id)
    )
    .leftJoin(
      schema.certificationAgencies,
      eq(schema.trainingCourses.agencyId, schema.certificationAgencies.id)
    )
    .leftJoin(
      schema.certificationLevels,
      eq(schema.trainingCourses.levelId, schema.certificationLevels.id)
    )
    .where(
      and(
        eq(schema.trainingEnrollments.organizationId, organizationId),
        eq(schema.trainingEnrollments.id, enrollmentId)
      )
    );
  return enrollment;
}

export async function createEnrollment(data: {
  organizationId: string;
  sessionId: string;
  customerId: string;
  status?: string;
  amountPaid?: string;
  paymentStatus?: string;
  notes?: string;
}) {
  // Validate session exists and get details
  const [session] = await db
    .select({
      id: schema.trainingSessions.id,
      status: schema.trainingSessions.status,
      maxStudents: schema.trainingSessions.maxStudents,
      enrolledCount: schema.trainingSessions.enrolledCount,
    })
    .from(schema.trainingSessions)
    .where(
      and(
        eq(schema.trainingSessions.organizationId, data.organizationId),
        eq(schema.trainingSessions.id, data.sessionId)
      )
    );

  if (!session) {
    throw new Error("Session not found");
  }

  // Check if session is cancelled
  if (session.status === "cancelled") {
    throw new Error("Cannot enroll in a cancelled session");
  }

  // Check if session is full (allow enrollments for scheduled, in_progress, and completed sessions)
  if (session.maxStudents && session.enrolledCount >= session.maxStudents) {
    throw new Error(`Session is full (${session.enrolledCount}/${session.maxStudents} students enrolled)`);
  }

  // Validate customer exists
  const [customer] = await db
    .select({ id: schema.customers.id })
    .from(schema.customers)
    .where(
      and(
        eq(schema.customers.organizationId, data.organizationId),
        eq(schema.customers.id, data.customerId)
      )
    );

  if (!customer) {
    throw new Error("Customer not found");
  }

  // Check if customer is already enrolled in this session
  const [existingEnrollment] = await db
    .select({ id: schema.trainingEnrollments.id })
    .from(schema.trainingEnrollments)
    .where(
      and(
        eq(schema.trainingEnrollments.sessionId, data.sessionId),
        eq(schema.trainingEnrollments.customerId, data.customerId)
      )
    );

  if (existingEnrollment) {
    throw new Error("Customer is already enrolled in this session");
  }

  // Create enrollment
  const [enrollment] = await db
    .insert(schema.trainingEnrollments)
    .values(data)
    .returning();

  // Update session enrolled count
  await db
    .update(schema.trainingSessions)
    .set({
      enrolledCount: sql`${schema.trainingSessions.enrolledCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(schema.trainingSessions.id, data.sessionId));

  return enrollment;
}

export async function updateEnrollment(
  organizationId: string,
  enrollmentId: string,
  data: Partial<{
    status: string;
    completedAt: Date | null;
    amountPaid: string;
    paymentStatus: string;
    progress: {
      classroomComplete?: boolean;
      poolComplete?: boolean;
      openWaterDivesCompleted?: number;
      quizScore?: number;
      finalExamScore?: number;
    } | null;
    skillCheckoffs: {
      skill: string;
      completedAt: string;
      signedOffBy: string;
    }[] | null;
    certificationNumber: string | null;
    certificationDate: string | null;
    notes: string | null;
  }>
) {
  const [enrollment] = await db
    .update(schema.trainingEnrollments)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(schema.trainingEnrollments.organizationId, organizationId),
        eq(schema.trainingEnrollments.id, enrollmentId)
      )
    )
    .returning();
  return enrollment;
}

export async function deleteEnrollment(organizationId: string, enrollmentId: string) {
  // Get the enrollment to get session ID
  const [enrollment] = await db
    .select({ sessionId: schema.trainingEnrollments.sessionId })
    .from(schema.trainingEnrollments)
    .where(
      and(
        eq(schema.trainingEnrollments.organizationId, organizationId),
        eq(schema.trainingEnrollments.id, enrollmentId)
      )
    );

  if (enrollment) {
    await db
      .delete(schema.trainingEnrollments)
      .where(
        and(
          eq(schema.trainingEnrollments.organizationId, organizationId),
          eq(schema.trainingEnrollments.id, enrollmentId)
        )
      );

    // Update session enrolled count
    await db
      .update(schema.trainingSessions)
      .set({
        enrolledCount: sql`GREATEST(${schema.trainingSessions.enrolledCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(schema.trainingSessions.id, enrollment.sessionId));
  }
}

// ============================================================================
// Dashboard Stats
// ============================================================================

export async function getTrainingDashboardStats(organizationId: string) {
  const today = new Date().toISOString().split("T")[0];

  // Total active courses
  const [{ coursesCount }] = await db
    .select({ coursesCount: count() })
    .from(schema.trainingCourses)
    .where(
      and(
        eq(schema.trainingCourses.organizationId, organizationId),
        eq(schema.trainingCourses.isActive, true)
      )
    );

  // Upcoming sessions (scheduled, starting today or later)
  const [{ upcomingSessionsCount }] = await db
    .select({ upcomingSessionsCount: count() })
    .from(schema.trainingSessions)
    .where(
      and(
        eq(schema.trainingSessions.organizationId, organizationId),
        eq(schema.trainingSessions.status, "scheduled"),
        gte(schema.trainingSessions.startDate, today)
      )
    );

  // Active enrollments (enrolled or in_progress)
  const [{ activeEnrollmentsCount }] = await db
    .select({ activeEnrollmentsCount: count() })
    .from(schema.trainingEnrollments)
    .where(
      and(
        eq(schema.trainingEnrollments.organizationId, organizationId),
        sql`${schema.trainingEnrollments.status} IN ('enrolled', 'in_progress')`
      )
    );

  // Certifications issued this month
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const [{ certificationsThisMonth }] = await db
    .select({ certificationsThisMonth: count() })
    .from(schema.trainingEnrollments)
    .where(
      and(
        eq(schema.trainingEnrollments.organizationId, organizationId),
        eq(schema.trainingEnrollments.status, "completed"),
        gte(schema.trainingEnrollments.completedAt, firstOfMonth)
      )
    );

  return {
    activeCourses: coursesCount,
    upcomingSessions: upcomingSessionsCount,
    activeEnrollments: activeEnrollmentsCount,
    certificationsThisMonth: certificationsThisMonth,
  };
}

export async function getUpcomingTrainingSessions(organizationId: string, limit = 5) {
  const today = new Date().toISOString().split("T")[0];

  return db
    .select({
      id: schema.trainingSessions.id,
      startDate: schema.trainingSessions.startDate,
      startTime: schema.trainingSessions.startTime,
      location: schema.trainingSessions.location,
      enrolledCount: schema.trainingSessions.enrolledCount,
      maxStudents: schema.trainingSessions.maxStudents,
      courseName: schema.trainingCourses.name,
      agencyName: schema.certificationAgencies.name,
    })
    .from(schema.trainingSessions)
    .innerJoin(
      schema.trainingCourses,
      eq(schema.trainingSessions.courseId, schema.trainingCourses.id)
    )
    .leftJoin(
      schema.certificationAgencies,
      eq(schema.trainingCourses.agencyId, schema.certificationAgencies.id)
    )
    .where(
      and(
        eq(schema.trainingSessions.organizationId, organizationId),
        eq(schema.trainingSessions.status, "scheduled"),
        gte(schema.trainingSessions.startDate, today)
      )
    )
    .orderBy(asc(schema.trainingSessions.startDate))
    .limit(limit);
}

export async function getRecentEnrollments(organizationId: string, limit = 5) {
  return db
    .select({
      id: schema.trainingEnrollments.id,
      status: schema.trainingEnrollments.status,
      enrolledAt: schema.trainingEnrollments.enrolledAt,
      customerFirstName: schema.customers.firstName,
      customerLastName: schema.customers.lastName,
      courseName: schema.trainingCourses.name,
    })
    .from(schema.trainingEnrollments)
    .innerJoin(
      schema.customers,
      eq(schema.trainingEnrollments.customerId, schema.customers.id)
    )
    .innerJoin(
      schema.trainingSessions,
      eq(schema.trainingEnrollments.sessionId, schema.trainingSessions.id)
    )
    .innerJoin(
      schema.trainingCourses,
      eq(schema.trainingSessions.courseId, schema.trainingCourses.id)
    )
    .where(eq(schema.trainingEnrollments.organizationId, organizationId))
    .orderBy(desc(schema.trainingEnrollments.enrolledAt))
    .limit(limit);
}

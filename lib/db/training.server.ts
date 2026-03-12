/**
 * Training Module Database Query Helpers
 *
 * These functions provide typed queries for training-related data.
 * All functions accept an organizationId and filter data accordingly.
 */

import { desc, eq, asc, count, and, sql, gte, lte } from "drizzle-orm";
import { db } from "./index";
import * as schema from "./schema";
import { AGENCY_METADATA } from "./training-templates.server";

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options?: {
    search?: string;
    agencyId?: string;
    levelId?: string;
    isActive?: boolean;
    isPublic?: boolean;
  }
) {
  const rows = await db
    .select({
      id: schema.trainingCourses.id,
      // Course fields (used for custom courses or fallback)
      courseName: schema.trainingCourses.name,
      courseCode: schema.trainingCourses.code,
      courseDescription: schema.trainingCourses.description,
      courseImages: schema.trainingCourses.images,
      courseDurationDays: schema.trainingCourses.durationDays,
      // Template fields (used when templateId is set)
      templateId: schema.trainingCourses.templateId,
      templateName: schema.agencyCourseTemplates.name,
      templateCode: schema.agencyCourseTemplates.code,
      templateDescription: schema.agencyCourseTemplates.description,
      templateImages: schema.agencyCourseTemplates.images,
      templateDurationDays: schema.agencyCourseTemplates.durationDays,
      templateAgencyCode: schema.agencyCourseTemplates.agencyCode,
      templateLevelCode: schema.agencyCourseTemplates.levelCode,
      // Tenant-owned fields (always from training_courses)
      imageOverride: schema.trainingCourses.imageOverride,
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
      schema.agencyCourseTemplates,
      eq(schema.trainingCourses.templateId, schema.agencyCourseTemplates.id)
    )
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

  // Merge template + course data (template wins for content fields when present)
  return rows.map((row) => ({
    id: row.id,
    name: row.templateName ?? row.courseName,
    code: row.templateCode ?? row.courseCode,
    description: row.templateDescription ?? row.courseDescription,
    images: row.imageOverride ?? row.templateImages ?? row.courseImages,
    durationDays: row.templateDurationDays ?? row.courseDurationDays,
    price: row.price,
    currency: row.currency,
    maxStudents: row.maxStudents,
    isActive: row.isActive,
    isPublic: row.isPublic,
    agencyId: row.agencyId,
    agencyName: row.agencyName ?? (row.templateAgencyCode ? AGENCY_METADATA[row.templateAgencyCode]?.name : null),
    levelId: row.levelId,
    levelName: row.levelName ?? row.templateLevelCode,
    templateId: row.templateId,
    createdAt: row.createdAt,
  }));
}

export async function getCourseById(organizationId: string, courseId: string) {
  const [row] = await db
    .select({
      id: schema.trainingCourses.id,
      // Course fields (custom courses or legacy)
      courseName: schema.trainingCourses.name,
      courseCode: schema.trainingCourses.code,
      courseDescription: schema.trainingCourses.description,
      courseImages: schema.trainingCourses.images,
      courseDurationDays: schema.trainingCourses.durationDays,
      courseClassroomHours: schema.trainingCourses.classroomHours,
      coursePoolHours: schema.trainingCourses.poolHours,
      courseOpenWaterDives: schema.trainingCourses.openWaterDives,
      coursePrerequisites: schema.trainingCourses.prerequisites,
      courseMinAge: schema.trainingCourses.minAge,
      courseMedicalRequirements: schema.trainingCourses.medicalRequirements,
      courseRequiredItems: schema.trainingCourses.requiredItems,
      courseMaterialsIncluded: schema.trainingCourses.materialsIncluded,
      // Template fields
      templateId: schema.trainingCourses.templateId,
      templateName: schema.agencyCourseTemplates.name,
      templateCode: schema.agencyCourseTemplates.code,
      templateDescription: schema.agencyCourseTemplates.description,
      templateImages: schema.agencyCourseTemplates.images,
      templateDurationDays: schema.agencyCourseTemplates.durationDays,
      templateClassroomHours: schema.agencyCourseTemplates.classroomHours,
      templatePoolHours: schema.agencyCourseTemplates.poolHours,
      templateOpenWaterDives: schema.agencyCourseTemplates.openWaterDives,
      templatePrerequisites: schema.agencyCourseTemplates.prerequisites,
      templateMinAge: schema.agencyCourseTemplates.minAge,
      templateMedicalRequirements: schema.agencyCourseTemplates.medicalRequirements,
      templateRequiredItems: schema.agencyCourseTemplates.requiredItems,
      templateMaterialsIncluded: schema.agencyCourseTemplates.materialsIncluded,
      templateAgencyCode: schema.agencyCourseTemplates.agencyCode,
      templateLevelCode: schema.agencyCourseTemplates.levelCode,
      // Tenant-owned fields
      imageOverride: schema.trainingCourses.imageOverride,
      price: schema.trainingCourses.price,
      currency: schema.trainingCourses.currency,
      depositRequired: schema.trainingCourses.depositRequired,
      depositAmount: schema.trainingCourses.depositAmount,
      minStudents: schema.trainingCourses.minStudents,
      maxStudents: schema.trainingCourses.maxStudents,
      equipmentIncluded: schema.trainingCourses.equipmentIncluded,
      includedItems: schema.trainingCourses.includedItems,
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
      schema.agencyCourseTemplates,
      eq(schema.trainingCourses.templateId, schema.agencyCourseTemplates.id)
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
        eq(schema.trainingCourses.organizationId, organizationId),
        eq(schema.trainingCourses.id, courseId)
      )
    );

  if (!row) return undefined;

  // Merge: template wins for content fields, tenant wins for business fields
  return {
    id: row.id,
    name: row.templateName ?? row.courseName,
    code: row.templateCode ?? row.courseCode,
    description: row.templateDescription ?? row.courseDescription,
    images: row.imageOverride ?? row.templateImages ?? row.courseImages,
    durationDays: row.templateDurationDays ?? row.courseDurationDays,
    classroomHours: row.templateClassroomHours ?? row.courseClassroomHours,
    poolHours: row.templatePoolHours ?? row.coursePoolHours,
    openWaterDives: row.templateOpenWaterDives ?? row.courseOpenWaterDives,
    prerequisites: row.templatePrerequisites ?? row.coursePrerequisites,
    minAge: row.templateMinAge ?? row.courseMinAge,
    medicalRequirements: row.templateMedicalRequirements ?? row.courseMedicalRequirements,
    requiredItems: row.templateRequiredItems ?? row.courseRequiredItems,
    materialsIncluded: row.templateMaterialsIncluded ?? row.courseMaterialsIncluded,
    price: row.price,
    currency: row.currency,
    depositRequired: row.depositRequired,
    depositAmount: row.depositAmount,
    minStudents: row.minStudents,
    maxStudents: row.maxStudents,
    equipmentIncluded: row.equipmentIncluded,
    includedItems: row.includedItems,
    isPublic: row.isPublic,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    agencyId: row.agencyId,
    agencyName: row.agencyName ?? (row.templateAgencyCode ? AGENCY_METADATA[row.templateAgencyCode]?.name : null),
    levelId: row.levelId,
    levelName: row.levelName ?? row.templateLevelCode,
    requiredCertLevel: row.requiredCertLevel,
    templateId: row.templateId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createCourse(data: {
  organizationId: string;
  // Template reference (for catalog courses)
  templateId?: string;
  // Content fields (for custom courses when templateId is null)
  name: string;
  code?: string;
  description?: string;
  agencyId?: string;
  levelId?: string;
  durationDays?: number;
  classroomHours?: number;
  poolHours?: number;
  openWaterDives?: number;
  prerequisites?: string;
  minAge?: number;
  medicalRequirements?: string;
  requiredItems?: string[];
  materialsIncluded?: boolean;
  images?: string[];
  // Tenant-owned fields
  price: string;
  currency?: string;
  depositRequired?: boolean;
  depositAmount?: string;
  minStudents?: number;
  maxStudents?: number;
  equipmentIncluded?: boolean;
  includedItems?: string[];
  imageOverride?: string[];
  requiredCertLevel?: string;
  isPublic?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}) {
  // Validate: if depositRequired, depositAmount must be > 0
  if (data.depositRequired && (!data.depositAmount || parseFloat(data.depositAmount) <= 0)) {
    throw new Error("Deposit amount must be greater than 0 when deposit is required");
  }

  const [course] = await db
    .insert(schema.trainingCourses)
    .values(data)
    .returning();
  return course;
}

/**
 * Enable a course from the global catalog for a tenant.
 * Creates a thin training_courses row with templateId FK.
 */
export async function enableCatalogCourse(data: {
  organizationId: string;
  templateId: string;
  price: string;
  currency?: string;
  isPublic?: boolean;
  isActive?: boolean;
  maxStudents?: number;
  depositRequired?: boolean;
  depositAmount?: string;
  equipmentIncluded?: boolean;
}) {
  // Check if this template is already enabled for this tenant
  const existing = await db
    .select({ id: schema.trainingCourses.id })
    .from(schema.trainingCourses)
    .where(
      and(
        eq(schema.trainingCourses.organizationId, data.organizationId),
        eq(schema.trainingCourses.templateId, data.templateId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0]; // Already enabled, skip
  }

  // Use a placeholder name (will be resolved via template JOIN at read time)
  const [course] = await db
    .insert(schema.trainingCourses)
    .values({
      ...data,
      name: "(from catalog)", // Placeholder; display reads from template
    })
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
  // Validate: if depositRequired, depositAmount must be > 0
  if (data.depositRequired && (!data.depositAmount || parseFloat(data.depositAmount) <= 0)) {
    throw new Error("Deposit amount must be greater than 0 when deposit is required");
  }

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
// Series Queries (DS-phdj: Multi-week course series)
// ============================================================================

export async function getSeries(
  organizationId: string,
  options?: { courseId?: string; status?: string }
) {
  const conditions = [eq(schema.trainingSessionSeries.organizationId, organizationId)];

  if (options?.courseId) {
    conditions.push(eq(schema.trainingSessionSeries.courseId, options.courseId));
  }
  if (options?.status) {
    conditions.push(eq(schema.trainingSessionSeries.status, options.status));
  }

  return db
    .select({
      id: schema.trainingSessionSeries.id,
      name: schema.trainingSessionSeries.name,
      courseId: schema.trainingSessionSeries.courseId,
      courseName: schema.trainingCourses.name,
      maxStudents: schema.trainingSessionSeries.maxStudents,
      priceOverride: schema.trainingSessionSeries.priceOverride,
      status: schema.trainingSessionSeries.status,
      instructorId: schema.trainingSessionSeries.instructorId,
      agencyName: schema.certificationAgencies.name,
      createdAt: schema.trainingSessionSeries.createdAt,
      updatedAt: schema.trainingSessionSeries.updatedAt,
    })
    .from(schema.trainingSessionSeries)
    .innerJoin(
      schema.trainingCourses,
      eq(schema.trainingSessionSeries.courseId, schema.trainingCourses.id)
    )
    .leftJoin(
      schema.certificationAgencies,
      eq(schema.trainingCourses.agencyId, schema.certificationAgencies.id)
    )
    .where(and(...conditions))
    .orderBy(desc(schema.trainingSessionSeries.createdAt));
}

export async function getSeriesByCourse(organizationId: string, courseId: string) {
  return getSeries(organizationId, { courseId });
}

export async function getSessionsBySeries(organizationId: string, seriesId: string) {
  return db
    .select({
      id: schema.trainingSessions.id,
      seriesIndex: schema.trainingSessions.seriesIndex,
      sessionType: schema.trainingSessions.sessionType,
      startDate: schema.trainingSessions.startDate,
      endDate: schema.trainingSessions.endDate,
      startTime: schema.trainingSessions.startTime,
      location: schema.trainingSessions.location,
      instructorName: schema.trainingSessions.instructorName,
      maxStudents: schema.trainingSessions.maxStudents,
      status: schema.trainingSessions.status,
      enrolledCount: schema.trainingSessions.enrolledCount,
      notes: schema.trainingSessions.notes,
      createdAt: schema.trainingSessions.createdAt,
    })
    .from(schema.trainingSessions)
    .where(
      and(
        eq(schema.trainingSessions.organizationId, organizationId),
        eq(schema.trainingSessions.seriesId, seriesId)
      )
    )
    .orderBy(asc(schema.trainingSessions.seriesIndex), asc(schema.trainingSessions.startDate));
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
    conditions.push(lte(schema.trainingSessions.endDate, options.endDate));
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
      seriesId: schema.trainingSessions.seriesId,
      seriesIndex: schema.trainingSessions.seriesIndex,
      sessionType: schema.trainingSessions.sessionType,
      seriesName: schema.trainingSessionSeries.name,
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
    .leftJoin(
      schema.trainingSessionSeries,
      eq(schema.trainingSessions.seriesId, schema.trainingSessionSeries.id)
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
      seriesId: schema.trainingSessions.seriesId,
      seriesIndex: schema.trainingSessions.seriesIndex,
      sessionType: schema.trainingSessions.sessionType,
      seriesName: schema.trainingSessionSeries.name,
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
    .leftJoin(
      schema.trainingSessionSeries,
      eq(schema.trainingSessions.seriesId, schema.trainingSessionSeries.id)
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
  seriesId?: string;
  seriesIndex?: number;
  sessionType?: string;
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
// Series Queries
// ============================================================================

export async function getSeriesList(
  organizationId: string,
  options?: { courseId?: string; status?: string }
) {
  const conditions = [eq(schema.trainingSessionSeries.organizationId, organizationId)];

  if (options?.courseId) {
    conditions.push(eq(schema.trainingSessionSeries.courseId, options.courseId));
  }
  if (options?.status) {
    conditions.push(eq(schema.trainingSessionSeries.status, options.status));
  }

  return db
    .select({
      id: schema.trainingSessionSeries.id,
      name: schema.trainingSessionSeries.name,
      maxStudents: schema.trainingSessionSeries.maxStudents,
      priceOverride: schema.trainingSessionSeries.priceOverride,
      status: schema.trainingSessionSeries.status,
      notes: schema.trainingSessionSeries.notes,
      instructorName: schema.trainingSessionSeries.instructorName,
      enrolledCount: schema.trainingSessionSeries.enrolledCount,
      completedCount: schema.trainingSessionSeries.completedCount,
      courseId: schema.trainingSessionSeries.courseId,
      courseName: schema.trainingCourses.name,
      agencyName: schema.certificationAgencies.name,
      levelName: schema.certificationLevels.name,
      sessionCount: sql<number>`(SELECT COUNT(*)::integer FROM training_sessions WHERE series_id = ${schema.trainingSessionSeries.id})`,
      createdAt: schema.trainingSessionSeries.createdAt,
    })
    .from(schema.trainingSessionSeries)
    .innerJoin(
      schema.trainingCourses,
      eq(schema.trainingSessionSeries.courseId, schema.trainingCourses.id)
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
    .orderBy(desc(schema.trainingSessionSeries.createdAt));
}

export async function getSeriesById(organizationId: string, seriesId: string) {
  const [series] = await db
    .select({
      id: schema.trainingSessionSeries.id,
      name: schema.trainingSessionSeries.name,
      maxStudents: schema.trainingSessionSeries.maxStudents,
      priceOverride: schema.trainingSessionSeries.priceOverride,
      status: schema.trainingSessionSeries.status,
      notes: schema.trainingSessionSeries.notes,
      instructorId: schema.trainingSessionSeries.instructorId,
      instructorName: schema.trainingSessionSeries.instructorName,
      enrolledCount: schema.trainingSessionSeries.enrolledCount,
      completedCount: schema.trainingSessionSeries.completedCount,
      courseId: schema.trainingSessionSeries.courseId,
      courseName: schema.trainingCourses.name,
      coursePrice: schema.trainingCourses.price,
      agencyName: schema.certificationAgencies.name,
      levelName: schema.certificationLevels.name,
      createdAt: schema.trainingSessionSeries.createdAt,
      updatedAt: schema.trainingSessionSeries.updatedAt,
    })
    .from(schema.trainingSessionSeries)
    .innerJoin(
      schema.trainingCourses,
      eq(schema.trainingSessionSeries.courseId, schema.trainingCourses.id)
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
        eq(schema.trainingSessionSeries.organizationId, organizationId),
        eq(schema.trainingSessionSeries.id, seriesId)
      )
    );

  if (!series) return undefined;

  const sessions = await db
    .select()
    .from(schema.trainingSessions)
    .where(eq(schema.trainingSessions.seriesId, seriesId))
    .orderBy(asc(schema.trainingSessions.seriesIndex));

  return { ...series, sessions };
}

export async function createSeries(data: {
  organizationId: string;
  courseId: string;
  name: string;
  maxStudents?: number;
  priceOverride?: string;
  status?: string;
  notes?: string;
  instructorId?: string;
  instructorName?: string;
  sessions?: Array<{
    startDate: string;
    endDate?: string;
    startTime?: string;
    location?: string;
    meetingPoint?: string;
    sessionType?: string;
  }>;
}) {
  return await db.transaction(async (tx) => {
    const { sessions: sessionData, ...seriesData } = data;

    const [series] = await tx
      .insert(schema.trainingSessionSeries)
      .values(seriesData)
      .returning();

    if (sessionData && sessionData.length > 0) {
      for (let i = 0; i < sessionData.length; i++) {
        await tx
          .insert(schema.trainingSessions)
          .values({
            organizationId: data.organizationId,
            courseId: data.courseId,
            seriesId: series.id,
            seriesIndex: i + 1,
            ...sessionData[i],
          });
      }
    }

    return series;
  });
}

export async function updateSeries(
  organizationId: string,
  seriesId: string,
  data: Partial<{
    name: string;
    maxStudents: number | null;
    priceOverride: string | null;
    status: string;
    notes: string | null;
    instructorId: string | null;
    instructorName: string | null;
  }>
) {
  const [series] = await db
    .update(schema.trainingSessionSeries)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(schema.trainingSessionSeries.organizationId, organizationId),
        eq(schema.trainingSessionSeries.id, seriesId)
      )
    )
    .returning();
  return series;
}

export async function deleteSeries(organizationId: string, seriesId: string) {
  const [{ enrollmentCount }] = await db
    .select({ enrollmentCount: count() })
    .from(schema.trainingEnrollments)
    .where(eq(schema.trainingEnrollments.seriesId, seriesId));

  if (enrollmentCount > 0) {
    throw new Error("Cannot delete series with existing enrollments");
  }

  await db
    .delete(schema.trainingSessionSeries)
    .where(
      and(
        eq(schema.trainingSessionSeries.organizationId, organizationId),
        eq(schema.trainingSessionSeries.id, seriesId)
      )
    );
}

export async function addSessionToSeries(
  organizationId: string,
  seriesId: string,
  data: {
    startDate: string;
    endDate?: string;
    startTime?: string;
    location?: string;
    meetingPoint?: string;
    sessionType?: string;
  }
) {
  const [series] = await db
    .select({ courseId: schema.trainingSessionSeries.courseId })
    .from(schema.trainingSessionSeries)
    .where(
      and(
        eq(schema.trainingSessionSeries.organizationId, organizationId),
        eq(schema.trainingSessionSeries.id, seriesId)
      )
    );

  if (!series) {
    throw new Error("Series not found");
  }

  const [result] = await db
    .select({ maxIndex: sql<number>`MAX(${schema.trainingSessions.seriesIndex})` })
    .from(schema.trainingSessions)
    .where(eq(schema.trainingSessions.seriesId, seriesId));

  const nextIndex = (result?.maxIndex ?? 0) + 1;

  const [session] = await db
    .insert(schema.trainingSessions)
    .values({
      organizationId,
      courseId: series.courseId,
      seriesId,
      seriesIndex: nextIndex,
      ...data,
    })
    .returning();

  return session;
}

export async function removeSessionFromSeries(organizationId: string, sessionId: string) {
  const [session] = await db
    .select({
      seriesId: schema.trainingSessions.seriesId,
      seriesIndex: schema.trainingSessions.seriesIndex,
    })
    .from(schema.trainingSessions)
    .where(
      and(
        eq(schema.trainingSessions.organizationId, organizationId),
        eq(schema.trainingSessions.id, sessionId)
      )
    );

  if (!session || !session.seriesId) {
    throw new Error("Session not found or not part of a series");
  }

  await db
    .delete(schema.trainingSessions)
    .where(
      and(
        eq(schema.trainingSessions.organizationId, organizationId),
        eq(schema.trainingSessions.id, sessionId)
      )
    );

  if (session.seriesIndex !== null) {
    await db
      .update(schema.trainingSessions)
      .set({
        seriesIndex: sql`${schema.trainingSessions.seriesIndex} - 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.trainingSessions.seriesId, session.seriesId),
          sql`${schema.trainingSessions.seriesIndex} > ${session.seriesIndex}`
        )
      );
  }
}

export async function createSeriesEnrollment(data: {
  organizationId: string;
  seriesId: string;
  sessionId: string;
  customerId: string;
  status?: string;
  amountPaid?: string;
  paymentStatus?: string;
  notes?: string;
}) {
  return await db.transaction(async (tx) => {
    const [series] = await tx
      .select({
        id: schema.trainingSessionSeries.id,
        status: schema.trainingSessionSeries.status,
        maxStudents: schema.trainingSessionSeries.maxStudents,
        enrolledCount: schema.trainingSessionSeries.enrolledCount,
      })
      .from(schema.trainingSessionSeries)
      .where(
        and(
          eq(schema.trainingSessionSeries.organizationId, data.organizationId),
          eq(schema.trainingSessionSeries.id, data.seriesId)
        )
      )
      .for("update");

    if (!series) {
      throw new Error("Series not found");
    }

    if (series.status === "cancelled") {
      throw new Error("Cannot enroll in a cancelled series");
    }

    if (series.maxStudents && series.enrolledCount >= series.maxStudents) {
      throw new Error(`Series is full (${series.enrolledCount}/${series.maxStudents} students enrolled)`);
    }

    const [existingEnrollment] = await tx
      .select({ id: schema.trainingEnrollments.id })
      .from(schema.trainingEnrollments)
      .where(
        and(
          eq(schema.trainingEnrollments.organizationId, data.organizationId),
          eq(schema.trainingEnrollments.seriesId, data.seriesId),
          eq(schema.trainingEnrollments.customerId, data.customerId)
        )
      );

    if (existingEnrollment) {
      throw new Error("Customer is already enrolled in this series");
    }

    const [enrollment] = await tx
      .insert(schema.trainingEnrollments)
      .values(data)
      .returning();

    await tx
      .update(schema.trainingSessionSeries)
      .set({
        enrolledCount: sql`${schema.trainingSessionSeries.enrolledCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.trainingSessionSeries.id, data.seriesId),
          eq(schema.trainingSessionSeries.organizationId, data.organizationId)
        )
      );

    return enrollment;
  });
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
    seriesId?: string;
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
  if (options?.seriesId) {
    conditions.push(eq(schema.trainingEnrollments.seriesId, options.seriesId));
  }

  return db
    .select({
      id: schema.trainingEnrollments.id,
      status: schema.trainingEnrollments.status,
      seriesId: schema.trainingEnrollments.seriesId,
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
  // Wrap in transaction with FOR UPDATE to prevent TOCTOU race conditions
  return await db.transaction(async (tx) => {
    // Get session details with FOR UPDATE lock to serialize concurrent enrollments
    const [session] = await tx
      .select({
        id: schema.trainingSessions.id,
        status: schema.trainingSessions.status,
        maxStudents: schema.trainingSessions.maxStudents,
        enrolledCount: schema.trainingSessions.enrolledCount,
        priceOverride: schema.trainingSessions.priceOverride,
        coursePrice: schema.trainingCourses.price,
      })
      .from(schema.trainingSessions)
      .leftJoin(
        schema.trainingCourses,
        eq(schema.trainingSessions.courseId, schema.trainingCourses.id)
      )
      .where(
        and(
          eq(schema.trainingSessions.organizationId, data.organizationId),
          eq(schema.trainingSessions.id, data.sessionId)
        )
      )
      .for("update");

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

    // SECURITY: Validate payment amount doesn't exceed session price
    if (data.amountPaid) {
      const amountPaid = Number(data.amountPaid);
      const sessionPrice = Number(session.priceOverride || session.coursePrice || 0);

      if (amountPaid < 0) {
        throw new Error("Payment amount cannot be negative");
      }

      // Allow overpayment by max 1 cent (for rounding)
      if (amountPaid > sessionPrice + 0.01) {
        throw new Error(
          `Payment amount (${amountPaid.toFixed(2)}) exceeds session price (${sessionPrice.toFixed(2)})`
        );
      }
    }

    // Validate customer exists
    const [customer] = await tx
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
    const [existingEnrollment] = await tx
      .select({ id: schema.trainingEnrollments.id })
      .from(schema.trainingEnrollments)
      .where(
        and(
          eq(schema.trainingEnrollments.organizationId, data.organizationId),
          eq(schema.trainingEnrollments.sessionId, data.sessionId),
          eq(schema.trainingEnrollments.customerId, data.customerId)
        )
      );

    if (existingEnrollment) {
      throw new Error("Customer is already enrolled in this session");
    }

    // Create enrollment
    const [enrollment] = await tx
      .insert(schema.trainingEnrollments)
      .values(data)
      .returning();

    // Update session enrolled count
    await tx
      .update(schema.trainingSessions)
      .set({
        enrolledCount: sql`${schema.trainingSessions.enrolledCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.trainingSessions.id, data.sessionId),
          eq(schema.trainingSessions.organizationId, data.organizationId)
        )
      );

    return enrollment;
  });
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
      .where(
        and(
          eq(schema.trainingSessions.id, enrollment.sessionId),
          eq(schema.trainingSessions.organizationId, organizationId)
        )
      );
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

  const [{ activeSeriesCount }] = await db
    .select({ activeSeriesCount: count() })
    .from(schema.trainingSessionSeries)
    .where(
      and(
        eq(schema.trainingSessionSeries.organizationId, organizationId),
        sql`${schema.trainingSessionSeries.status} IN ('scheduled', 'in_progress')`
      )
    );

  return {
    activeCourses: coursesCount,
    upcomingSessions: upcomingSessionsCount,
    activeEnrollments: activeEnrollmentsCount,
    certificationsThisMonth: certificationsThisMonth,
    activeSeries: activeSeriesCount,
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

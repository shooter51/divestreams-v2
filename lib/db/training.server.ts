/**
 * Training Server Functions
 *
 * Database query functions for the dive training/certification module.
 * All functions require organizationId for multi-tenant isolation.
 */

import { db } from "./index";
import {
  certificationAgencies,
  certificationLevels,
  trainingCourses,
  courseSessions,
  trainingEnrollments,
  skillCheckoffs,
  customers,
} from "./schema";
import { eq, and, desc, asc, count, inArray } from "drizzle-orm";

// ============================================================================
// CERTIFICATION AGENCIES
// ============================================================================

export async function getCertificationAgencies(organizationId: string) {
  return db
    .select()
    .from(certificationAgencies)
    .where(
      and(
        eq(certificationAgencies.organizationId, organizationId),
        eq(certificationAgencies.isActive, true)
      )
    )
    .orderBy(asc(certificationAgencies.name));
}

export async function getAllCertificationAgencies(organizationId: string) {
  return db
    .select()
    .from(certificationAgencies)
    .where(eq(certificationAgencies.organizationId, organizationId))
    .orderBy(asc(certificationAgencies.name));
}

export async function getCertificationAgencyById(
  organizationId: string,
  agencyId: string
) {
  const results = await db
    .select()
    .from(certificationAgencies)
    .where(
      and(
        eq(certificationAgencies.organizationId, organizationId),
        eq(certificationAgencies.id, agencyId)
      )
    );
  return results[0] || null;
}

export async function createCertificationAgency(
  organizationId: string,
  data: { name: string; code: string; website?: string; logoUrl?: string }
) {
  const results = await db
    .insert(certificationAgencies)
    .values({
      organizationId,
      ...data,
    })
    .returning();
  return results[0];
}

export async function updateCertificationAgency(
  organizationId: string,
  agencyId: string,
  data: Partial<{ name: string; code: string; website: string; logoUrl: string; isActive: boolean }>
) {
  const results = await db
    .update(certificationAgencies)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(certificationAgencies.organizationId, organizationId),
        eq(certificationAgencies.id, agencyId)
      )
    )
    .returning();
  return results[0];
}

export async function deleteCertificationAgency(
  organizationId: string,
  agencyId: string
) {
  await db
    .delete(certificationAgencies)
    .where(
      and(
        eq(certificationAgencies.organizationId, organizationId),
        eq(certificationAgencies.id, agencyId)
      )
    );
}

// ============================================================================
// CERTIFICATION LEVELS
// ============================================================================

export async function getCertificationLevels(
  organizationId: string,
  agencyId?: string
) {
  const conditions = [
    eq(certificationLevels.organizationId, organizationId),
    eq(certificationLevels.isActive, true),
  ];

  if (agencyId) {
    conditions.push(eq(certificationLevels.agencyId, agencyId));
  }

  return db
    .select({
      level: certificationLevels,
      agency: certificationAgencies,
    })
    .from(certificationLevels)
    .leftJoin(
      certificationAgencies,
      eq(certificationLevels.agencyId, certificationAgencies.id)
    )
    .where(and(...conditions))
    .orderBy(asc(certificationLevels.level));
}

export async function getCertificationLevelById(
  organizationId: string,
  levelId: string
) {
  const results = await db
    .select({
      level: certificationLevels,
      agency: certificationAgencies,
    })
    .from(certificationLevels)
    .leftJoin(
      certificationAgencies,
      eq(certificationLevels.agencyId, certificationAgencies.id)
    )
    .where(
      and(
        eq(certificationLevels.organizationId, organizationId),
        eq(certificationLevels.id, levelId)
      )
    );
  return results[0] || null;
}

export async function createCertificationLevel(
  organizationId: string,
  data: {
    agencyId: string;
    name: string;
    code: string;
    level: number;
    description?: string;
    prerequisites?: string[];
  }
) {
  const results = await db
    .insert(certificationLevels)
    .values({
      organizationId,
      ...data,
    })
    .returning();
  return results[0];
}

export async function updateCertificationLevel(
  organizationId: string,
  levelId: string,
  data: Partial<{
    name: string;
    code: string;
    level: number;
    description: string;
    prerequisites: string[];
    isActive: boolean;
  }>
) {
  const results = await db
    .update(certificationLevels)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(certificationLevels.organizationId, organizationId),
        eq(certificationLevels.id, levelId)
      )
    )
    .returning();
  return results[0];
}

export async function deleteCertificationLevel(
  organizationId: string,
  levelId: string
) {
  await db
    .delete(certificationLevels)
    .where(
      and(
        eq(certificationLevels.organizationId, organizationId),
        eq(certificationLevels.id, levelId)
      )
    );
}

// ============================================================================
// TRAINING COURSES
// ============================================================================

export async function getTrainingCourses(
  organizationId: string,
  options?: { page?: number; limit?: number; agencyId?: string }
) {
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(trainingCourses.organizationId, organizationId),
    eq(trainingCourses.isActive, true),
  ];

  if (options?.agencyId) {
    conditions.push(eq(trainingCourses.agencyId, options.agencyId));
  }

  const courseList = await db
    .select({
      course: trainingCourses,
      agency: certificationAgencies,
      level: certificationLevels,
    })
    .from(trainingCourses)
    .leftJoin(
      certificationAgencies,
      eq(trainingCourses.agencyId, certificationAgencies.id)
    )
    .leftJoin(
      certificationLevels,
      eq(trainingCourses.levelId, certificationLevels.id)
    )
    .where(and(...conditions))
    .orderBy(asc(trainingCourses.name))
    .limit(limit)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(trainingCourses)
    .where(and(...conditions));

  return {
    courses: courseList,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getTrainingCourseById(
  organizationId: string,
  courseId: string
) {
  const results = await db
    .select({
      course: trainingCourses,
      agency: certificationAgencies,
      level: certificationLevels,
    })
    .from(trainingCourses)
    .leftJoin(
      certificationAgencies,
      eq(trainingCourses.agencyId, certificationAgencies.id)
    )
    .leftJoin(
      certificationLevels,
      eq(trainingCourses.levelId, certificationLevels.id)
    )
    .where(
      and(
        eq(trainingCourses.organizationId, organizationId),
        eq(trainingCourses.id, courseId)
      )
    );
  return results[0] || null;
}

export async function createTrainingCourse(
  organizationId: string,
  data: {
    name: string;
    description?: string;
    agencyId: string;
    levelId: string;
    scheduleType?: string;
    price: string;
    depositAmount?: string;
    maxStudents?: number;
    minInstructors?: number;
    totalSessions?: number;
    hasExam?: boolean;
    examPassScore?: number;
    minOpenWaterDives?: number;
  }
) {
  const results = await db
    .insert(trainingCourses)
    .values({
      organizationId,
      ...data,
    })
    .returning();
  return results[0];
}

export async function updateTrainingCourse(
  organizationId: string,
  courseId: string,
  data: Partial<{
    name: string;
    description: string;
    agencyId: string;
    levelId: string;
    scheduleType: string;
    price: string;
    depositAmount: string;
    maxStudents: number;
    minInstructors: number;
    totalSessions: number;
    hasExam: boolean;
    examPassScore: number;
    minOpenWaterDives: number;
    isActive: boolean;
  }>
) {
  const results = await db
    .update(trainingCourses)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(trainingCourses.organizationId, organizationId),
        eq(trainingCourses.id, courseId)
      )
    )
    .returning();
  return results[0];
}

export async function deleteTrainingCourse(
  organizationId: string,
  courseId: string
) {
  // Soft delete - set isActive to false
  await db
    .update(trainingCourses)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(trainingCourses.organizationId, organizationId),
        eq(trainingCourses.id, courseId)
      )
    );
}

// ============================================================================
// COURSE SESSIONS
// ============================================================================

export async function getCourseSessions(
  organizationId: string,
  options?: {
    courseId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }
) {
  const conditions = [eq(courseSessions.organizationId, organizationId)];

  if (options?.courseId) {
    conditions.push(eq(courseSessions.courseId, options.courseId));
  }
  if (options?.status) {
    conditions.push(eq(courseSessions.status, options.status));
  }

  return db
    .select({
      session: courseSessions,
      course: trainingCourses,
    })
    .from(courseSessions)
    .leftJoin(
      trainingCourses,
      eq(courseSessions.courseId, trainingCourses.id)
    )
    .where(and(...conditions))
    .orderBy(asc(courseSessions.scheduledDate), asc(courseSessions.startTime));
}

export async function getCourseSessionById(
  organizationId: string,
  sessionId: string
) {
  const results = await db
    .select({
      session: courseSessions,
      course: trainingCourses,
    })
    .from(courseSessions)
    .leftJoin(
      trainingCourses,
      eq(courseSessions.courseId, trainingCourses.id)
    )
    .where(
      and(
        eq(courseSessions.organizationId, organizationId),
        eq(courseSessions.id, sessionId)
      )
    );
  return results[0] || null;
}

export async function createCourseSession(
  organizationId: string,
  data: {
    courseId: string;
    enrollmentId?: string;
    sessionType: string;
    sessionNumber?: number;
    scheduledDate: string;
    startTime: string;
    endTime?: string;
    location?: string;
    diveSiteId?: string;
    instructorIds?: string[];
    maxStudents?: number;
    notes?: string;
  }
) {
  const results = await db
    .insert(courseSessions)
    .values({
      organizationId,
      ...data,
    })
    .returning();
  return results[0];
}

export async function updateCourseSession(
  organizationId: string,
  sessionId: string,
  data: Partial<{
    sessionType: string;
    sessionNumber: number;
    scheduledDate: string;
    startTime: string;
    endTime: string;
    location: string;
    diveSiteId: string;
    instructorIds: string[];
    status: string;
    maxStudents: number;
    notes: string;
  }>
) {
  const results = await db
    .update(courseSessions)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(courseSessions.organizationId, organizationId),
        eq(courseSessions.id, sessionId)
      )
    )
    .returning();
  return results[0];
}

export async function deleteCourseSession(
  organizationId: string,
  sessionId: string
) {
  await db
    .delete(courseSessions)
    .where(
      and(
        eq(courseSessions.organizationId, organizationId),
        eq(courseSessions.id, sessionId)
      )
    );
}

// ============================================================================
// ENROLLMENTS
// ============================================================================

export async function getEnrollments(
  organizationId: string,
  options?: {
    page?: number;
    limit?: number;
    courseId?: string;
    customerId?: string;
    status?: string;
  }
) {
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = [eq(trainingEnrollments.organizationId, organizationId)];

  if (options?.courseId) {
    conditions.push(eq(trainingEnrollments.courseId, options.courseId));
  }
  if (options?.customerId) {
    conditions.push(eq(trainingEnrollments.customerId, options.customerId));
  }
  if (options?.status) {
    conditions.push(eq(trainingEnrollments.status, options.status));
  }

  const enrollmentList = await db
    .select({
      enrollment: trainingEnrollments,
      course: trainingCourses,
      customer: customers,
    })
    .from(trainingEnrollments)
    .leftJoin(
      trainingCourses,
      eq(trainingEnrollments.courseId, trainingCourses.id)
    )
    .leftJoin(customers, eq(trainingEnrollments.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(trainingEnrollments.enrolledAt))
    .limit(limit)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(trainingEnrollments)
    .where(and(...conditions));

  return {
    enrollments: enrollmentList,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getEnrollmentById(
  organizationId: string,
  enrollmentId: string
) {
  const results = await db
    .select({
      enrollment: trainingEnrollments,
      course: trainingCourses,
      customer: customers,
      agency: certificationAgencies,
      level: certificationLevels,
    })
    .from(trainingEnrollments)
    .leftJoin(
      trainingCourses,
      eq(trainingEnrollments.courseId, trainingCourses.id)
    )
    .leftJoin(customers, eq(trainingEnrollments.customerId, customers.id))
    .leftJoin(
      certificationAgencies,
      eq(trainingCourses.agencyId, certificationAgencies.id)
    )
    .leftJoin(
      certificationLevels,
      eq(trainingCourses.levelId, certificationLevels.id)
    )
    .where(
      and(
        eq(trainingEnrollments.organizationId, organizationId),
        eq(trainingEnrollments.id, enrollmentId)
      )
    );
  return results[0] || null;
}

export async function createEnrollment(
  organizationId: string,
  data: {
    courseId: string;
    customerId: string;
    totalPrice: string;
    depositAmount?: string;
    status?: string;
    prerequisiteOverride?: boolean;
    prerequisiteOverrideBy?: string;
    prerequisiteOverrideNote?: string;
  }
) {
  const results = await db
    .insert(trainingEnrollments)
    .values({
      organizationId,
      balanceDue: data.totalPrice,
      ...data,
    })
    .returning();
  return results[0];
}

export async function updateEnrollmentStatus(
  organizationId: string,
  enrollmentId: string,
  status: string,
  additionalData?: Partial<{
    startedAt: Date;
    completedAt: Date;
    examScore: number;
    examPassedAt: Date;
    certificationNumber: string;
    certifiedAt: Date;
    instructorNotes: string;
  }>
) {
  const results = await db
    .update(trainingEnrollments)
    .set({
      status,
      ...additionalData,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(trainingEnrollments.organizationId, organizationId),
        eq(trainingEnrollments.id, enrollmentId)
      )
    )
    .returning();
  return results[0];
}

export async function updateEnrollmentPayment(
  organizationId: string,
  enrollmentId: string,
  data: {
    paymentStatus: string;
    depositPaidAt?: Date;
    balanceDue?: string;
    posTransactionIds?: string[];
  }
) {
  const results = await db
    .update(trainingEnrollments)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(trainingEnrollments.organizationId, organizationId),
        eq(trainingEnrollments.id, enrollmentId)
      )
    )
    .returning();
  return results[0];
}

// ============================================================================
// SKILL CHECKOFFS
// ============================================================================

export async function getSkillCheckoffs(
  organizationId: string,
  enrollmentId: string
) {
  return db
    .select()
    .from(skillCheckoffs)
    .where(
      and(
        eq(skillCheckoffs.organizationId, organizationId),
        eq(skillCheckoffs.enrollmentId, enrollmentId)
      )
    )
    .orderBy(asc(skillCheckoffs.skillCategory), asc(skillCheckoffs.skillName));
}

export async function getSkillCheckoffsForSession(
  organizationId: string,
  sessionId: string
) {
  return db
    .select({
      checkoff: skillCheckoffs,
      enrollment: trainingEnrollments,
      customer: customers,
    })
    .from(skillCheckoffs)
    .leftJoin(
      trainingEnrollments,
      eq(skillCheckoffs.enrollmentId, trainingEnrollments.id)
    )
    .leftJoin(customers, eq(trainingEnrollments.customerId, customers.id))
    .where(
      and(
        eq(skillCheckoffs.organizationId, organizationId),
        eq(skillCheckoffs.sessionId, sessionId)
      )
    )
    .orderBy(asc(skillCheckoffs.skillCategory), asc(skillCheckoffs.skillName));
}

export async function getEnrollmentsForSession(
  organizationId: string,
  sessionId: string
) {
  // First get the session to find its courseId
  const session = await getCourseSessionById(organizationId, sessionId);
  if (!session) return [];

  // Get enrollments for the same course that are actively in progress
  const enrollments = await db
    .select({
      enrollment: trainingEnrollments,
      course: trainingCourses,
      customer: customers,
    })
    .from(trainingEnrollments)
    .leftJoin(
      trainingCourses,
      eq(trainingEnrollments.courseId, trainingCourses.id)
    )
    .leftJoin(customers, eq(trainingEnrollments.customerId, customers.id))
    .where(
      and(
        eq(trainingEnrollments.organizationId, organizationId),
        eq(trainingEnrollments.courseId, session.session.courseId),
        inArray(trainingEnrollments.status, [
          "enrolled",
          "in_progress",
          "scheduled",
        ])
      )
    )
    .orderBy(asc(customers.lastName), asc(customers.firstName));

  return enrollments;
}

export async function recordSkillCheckoff(
  organizationId: string,
  data: {
    enrollmentId: string;
    sessionId: string;
    skillName: string;
    skillCategory: string;
    status: string;
    instructorId: string;
    notes?: string;
  }
) {
  const results = await db
    .insert(skillCheckoffs)
    .values({
      organizationId,
      ...data,
    })
    .returning();
  return results[0];
}

export async function updateSkillCheckoff(
  organizationId: string,
  checkoffId: string,
  data: {
    status: string;
    instructorId: string;
    notes?: string;
  }
) {
  const results = await db
    .update(skillCheckoffs)
    .set({
      ...data,
      checkedOffAt: new Date(),
    })
    .where(
      and(
        eq(skillCheckoffs.organizationId, organizationId),
        eq(skillCheckoffs.id, checkoffId)
      )
    )
    .returning();
  return results[0];
}

// ============================================================================
// PROGRESS & PREREQUISITES
// ============================================================================

export async function getStudentProgress(
  organizationId: string,
  enrollmentId: string
) {
  // Get enrollment with course details
  const enrollment = await getEnrollmentById(organizationId, enrollmentId);
  if (!enrollment) return null;

  // Get sessions for this course
  const sessions = await getCourseSessions(organizationId, {
    courseId: enrollment.course?.id,
  });

  // Get skill checkoffs
  const checkoffs = await getSkillCheckoffs(organizationId, enrollmentId);

  // Calculate progress
  const totalSessions = enrollment.course?.totalSessions || 1;
  const completedSessions = sessions.filter(
    (s) => s.session.status === "completed"
  ).length;

  const totalSkills = checkoffs.length || 1;
  const demonstratedSkills = checkoffs.filter(
    (c) => c.status === "demonstrated"
  ).length;

  const examPassed = !!enrollment.enrollment.examPassedAt;
  const examRequired = enrollment.course?.hasExam || false;

  // Weighted progress calculation
  const sessionProgress = (completedSessions / totalSessions) * 30;
  const skillProgress = (demonstratedSkills / totalSkills) * 40;
  const examProgress = examRequired ? (examPassed ? 15 : 0) : 15;
  const diveProgress = 15; // TODO: implement dive logging

  const totalProgress = Math.round(
    sessionProgress + skillProgress + examProgress + diveProgress
  );

  return {
    enrollment: enrollment.enrollment,
    course: enrollment.course,
    customer: enrollment.customer,
    progress: {
      total: totalProgress,
      sessions: { completed: completedSessions, total: totalSessions },
      skills: { demonstrated: demonstratedSkills, total: totalSkills },
      examPassed,
      examRequired,
    },
    sessions,
    checkoffs,
  };
}

export async function checkPrerequisites(
  organizationId: string,
  customerId: string,
  courseId: string
): Promise<{ met: boolean; missing: string[]; customerCerts: unknown[] }> {
  // Get course with level
  const course = await getTrainingCourseById(organizationId, courseId);
  if (!course) {
    return { met: false, missing: ["Course not found"], customerCerts: [] };
  }

  // Get level prerequisites
  const prerequisites = course.level?.prerequisites || [];
  if (prerequisites.length === 0) {
    return { met: true, missing: [], customerCerts: [] };
  }

  // Get customer certifications
  const customerData = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.organizationId, organizationId),
        eq(customers.id, customerId)
      )
    );

  const customer = customerData[0];
  if (!customer) {
    return { met: false, missing: ["Customer not found"], customerCerts: [] };
  }

  const customerCerts = (customer.certifications as unknown[]) || [];

  // Get prerequisite level details
  const prereqLevels = await db
    .select()
    .from(certificationLevels)
    .where(inArray(certificationLevels.id, prerequisites));

  // Check which prerequisites are met
  const missing: string[] = [];
  for (const prereq of prereqLevels) {
    const hasCert = (customerCerts as Array<{ agency?: string; level?: string }>).some(
      (cert) =>
        cert.agency?.toLowerCase() === prereq.code?.toLowerCase() ||
        cert.level?.toLowerCase().includes(prereq.name?.toLowerCase())
    );
    if (!hasCert) {
      missing.push(`${prereq.name}`);
    }
  }

  return {
    met: missing.length === 0,
    missing,
    customerCerts,
  };
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export async function getTrainingDashboardStats(organizationId: string) {
  // Active enrollments
  const [{ value: activeEnrollments }] = await db
    .select({ value: count() })
    .from(trainingEnrollments)
    .where(
      and(
        eq(trainingEnrollments.organizationId, organizationId),
        inArray(trainingEnrollments.status, [
          "pending_scheduling",
          "scheduled",
          "enrolled",
          "in_progress",
        ])
      )
    );

  // Completed this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Get completed enrollments (certified)
  const [{ value: completedThisMonth }] = await db
    .select({ value: count() })
    .from(trainingEnrollments)
    .where(
      and(
        eq(trainingEnrollments.organizationId, organizationId),
        eq(trainingEnrollments.status, "certified")
      )
    );

  // Available courses
  const [{ value: availableCourses }] = await db
    .select({ value: count() })
    .from(trainingCourses)
    .where(
      and(
        eq(trainingCourses.organizationId, organizationId),
        eq(trainingCourses.isActive, true)
      )
    );

  // Upcoming sessions (next 7 days)
  const [{ value: upcomingSessions }] = await db
    .select({ value: count() })
    .from(courseSessions)
    .where(
      and(
        eq(courseSessions.organizationId, organizationId),
        eq(courseSessions.status, "scheduled")
      )
    );

  return {
    activeEnrollments,
    completedThisMonth,
    availableCourses,
    upcomingSessions,
  };
}

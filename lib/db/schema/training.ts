/**
 * Training Schema
 *
 * Database tables for the dive training/certification module.
 * Supports certification agencies (PADI, SSI, NAUI, etc.), course management,
 * student enrollments, and skill checkoffs.
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  uuid,
  jsonb,
  date,
  time,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization, user } from "./auth";

// ============================================================================
// CERTIFICATION AGENCIES
// ============================================================================

/**
 * Certification Agencies - PADI, SSI, NAUI, etc.
 */
export const certificationAgencies = pgTable(
  "certification_agencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g., "Professional Association of Diving Instructors"
    code: text("code").notNull(), // e.g., "PADI", "SSI", "NAUI"
    website: text("website"),
    logoUrl: text("logo_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("certification_agencies_org_idx").on(table.organizationId),
    index("certification_agencies_code_idx").on(table.organizationId, table.code),
  ]
);

// ============================================================================
// CERTIFICATION LEVELS
// ============================================================================

/**
 * Certification Levels - Open Water, Advanced, Rescue, Divemaster, etc.
 */
export const certificationLevels = pgTable(
  "certification_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => certificationAgencies.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g., "Open Water Diver"
    code: text("code").notNull(), // e.g., "OWD", "AOWD", "RD"
    level: integer("level").notNull(), // Ordering: 1=OWD, 2=AOWD, etc.
    description: text("description"),
    prerequisites: jsonb("prerequisites").$type<string[]>(), // Array of prerequisite level IDs
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("certification_levels_org_idx").on(table.organizationId),
    index("certification_levels_agency_idx").on(table.agencyId),
    index("certification_levels_level_idx").on(table.organizationId, table.level),
  ]
);

// ============================================================================
// TRAINING COURSES
// ============================================================================

/**
 * Training Courses - Course templates for dive training
 */
export const trainingCourses = pgTable(
  "training_courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => certificationAgencies.id, { onDelete: "restrict" }),
    levelId: uuid("level_id")
      .notNull()
      .references(() => certificationLevels.id, { onDelete: "restrict" }),

    // Scheduling
    scheduleType: text("schedule_type").notNull().default("fixed"), // "fixed" or "on_demand"

    // Pricing
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),

    // Capacity and requirements
    maxStudents: integer("max_students").notNull().default(6),
    minInstructors: integer("min_instructors").notNull().default(1),
    totalSessions: integer("total_sessions").notNull().default(1),

    // Assessment
    hasExam: boolean("has_exam").notNull().default(false),
    examPassScore: integer("exam_pass_score"), // e.g., 75 for 75%
    minOpenWaterDives: integer("min_open_water_dives").default(0),

    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("training_courses_org_idx").on(table.organizationId),
    index("training_courses_agency_idx").on(table.agencyId),
    index("training_courses_level_idx").on(table.levelId),
    index("training_courses_active_idx").on(table.organizationId, table.isActive),
  ]
);

// ============================================================================
// COURSE SESSIONS
// ============================================================================

/**
 * Course Sessions - Scheduled session instances (classroom, pool, open water)
 */
export const courseSessions = pgTable(
  "course_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => trainingCourses.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id"), // Nullable - for on-demand courses linked to specific enrollment

    // Session details
    sessionType: text("session_type").notNull(), // "classroom", "pool", "open_water"
    sessionNumber: integer("session_number").notNull().default(1),

    // Scheduling
    scheduledDate: date("scheduled_date").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time"),

    // Location
    location: text("location"), // Free-text for classroom/pool
    diveSiteId: uuid("dive_site_id"), // FK to diveSites.id - relation defined in main schema

    // Staff
    instructorIds: jsonb("instructor_ids").$type<string[]>(), // Array of user IDs

    // Status
    status: text("status").notNull().default("scheduled"), // "scheduled", "in_progress", "completed", "cancelled"
    maxStudents: integer("max_students"),
    notes: text("notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("course_sessions_org_idx").on(table.organizationId),
    index("course_sessions_course_idx").on(table.courseId),
    index("course_sessions_enrollment_idx").on(table.enrollmentId),
    index("course_sessions_date_idx").on(table.organizationId, table.scheduledDate),
    index("course_sessions_status_idx").on(table.organizationId, table.status),
    index("course_sessions_dive_site_idx").on(table.diveSiteId),
  ]
);

// ============================================================================
// TRAINING ENROLLMENTS
// ============================================================================

/**
 * Training Enrollments - Student enrollments in courses
 */
export const trainingEnrollments = pgTable(
  "training_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => trainingCourses.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").notNull(), // FK to customers.id - relation defined in main schema

    // Enrollment status
    status: text("status").notNull().default("pending_scheduling"),
    // Statuses: "pending_scheduling", "scheduled", "enrolled", "in_progress",
    //           "completed", "certified", "withdrawn"

    // Timeline
    enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),

    // Payment tracking
    depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
    depositPaidAt: timestamp("deposit_paid_at"),
    totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
    balanceDue: decimal("balance_due", { precision: 10, scale: 2 }).notNull(),
    paymentStatus: text("payment_status").notNull().default("pending"),
    // Payment statuses: "pending", "deposit_paid", "partial", "paid", "refunded"
    posTransactionIds: jsonb("pos_transaction_ids").$type<string[]>(), // Array of transaction IDs

    // Assessment
    examScore: integer("exam_score"),
    examPassedAt: timestamp("exam_passed_at"),

    // Certification
    certificationNumber: text("certification_number"),
    certifiedAt: timestamp("certified_at"),

    // Prerequisites override
    prerequisiteOverride: boolean("prerequisite_override").notNull().default(false),
    prerequisiteOverrideBy: text("prerequisite_override_by"), // User ID who approved
    prerequisiteOverrideNote: text("prerequisite_override_note"),

    // Notes
    instructorNotes: text("instructor_notes"),
    studentNotes: text("student_notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("training_enrollments_org_idx").on(table.organizationId),
    index("training_enrollments_course_idx").on(table.courseId),
    index("training_enrollments_customer_idx").on(table.customerId),
    index("training_enrollments_status_idx").on(table.organizationId, table.status),
    index("training_enrollments_payment_idx").on(table.organizationId, table.paymentStatus),
  ]
);

// ============================================================================
// SKILL CHECKOFFS
// ============================================================================

/**
 * Skill Checkoffs - Track individual skill demonstrations
 */
export const skillCheckoffs = pgTable(
  "skill_checkoffs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => trainingEnrollments.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => courseSessions.id, { onDelete: "set null" }),

    // Skill details
    skillName: text("skill_name").notNull(),
    skillCategory: text("skill_category").notNull().default("basic"), // "basic", "intermediate", "advanced"

    // Status
    status: text("status").notNull().default("not_attempted"),
    // Statuses: "not_attempted", "attempted", "demonstrated"

    // Instructor sign-off
    instructorId: text("instructor_id").references(() => user.id, { onDelete: "set null" }),
    checkedOffAt: timestamp("checked_off_at"),
    notes: text("notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("skill_checkoffs_org_idx").on(table.organizationId),
    index("skill_checkoffs_enrollment_idx").on(table.enrollmentId),
    index("skill_checkoffs_session_idx").on(table.sessionId),
    index("skill_checkoffs_status_idx").on(table.organizationId, table.status),
    index("skill_checkoffs_instructor_idx").on(table.instructorId),
  ]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const certificationAgenciesRelations = relations(certificationAgencies, ({ one, many }) => ({
  organization: one(organization, {
    fields: [certificationAgencies.organizationId],
    references: [organization.id],
  }),
  levels: many(certificationLevels),
  courses: many(trainingCourses),
}));

export const certificationLevelsRelations = relations(certificationLevels, ({ one, many }) => ({
  organization: one(organization, {
    fields: [certificationLevels.organizationId],
    references: [organization.id],
  }),
  agency: one(certificationAgencies, {
    fields: [certificationLevels.agencyId],
    references: [certificationAgencies.id],
  }),
  courses: many(trainingCourses),
}));

export const trainingCoursesRelations = relations(trainingCourses, ({ one, many }) => ({
  organization: one(organization, {
    fields: [trainingCourses.organizationId],
    references: [organization.id],
  }),
  agency: one(certificationAgencies, {
    fields: [trainingCourses.agencyId],
    references: [certificationAgencies.id],
  }),
  level: one(certificationLevels, {
    fields: [trainingCourses.levelId],
    references: [certificationLevels.id],
  }),
  sessions: many(courseSessions),
  enrollments: many(trainingEnrollments),
}));

export const courseSessionsRelations = relations(courseSessions, ({ one, many }) => ({
  organization: one(organization, {
    fields: [courseSessions.organizationId],
    references: [organization.id],
  }),
  course: one(trainingCourses, {
    fields: [courseSessions.courseId],
    references: [trainingCourses.id],
  }),
  enrollment: one(trainingEnrollments, {
    fields: [courseSessions.enrollmentId],
    references: [trainingEnrollments.id],
  }),
  // diveSite relation is defined in main schema.ts to avoid circular imports
  skillCheckoffs: many(skillCheckoffs),
}));

export const trainingEnrollmentsRelations = relations(trainingEnrollments, ({ one, many }) => ({
  organization: one(organization, {
    fields: [trainingEnrollments.organizationId],
    references: [organization.id],
  }),
  course: one(trainingCourses, {
    fields: [trainingEnrollments.courseId],
    references: [trainingCourses.id],
  }),
  // customer relation is defined in main schema.ts to avoid circular imports
  sessions: many(courseSessions),
  skillCheckoffs: many(skillCheckoffs),
}));

export const skillCheckoffsRelations = relations(skillCheckoffs, ({ one }) => ({
  organization: one(organization, {
    fields: [skillCheckoffs.organizationId],
    references: [organization.id],
  }),
  enrollment: one(trainingEnrollments, {
    fields: [skillCheckoffs.enrollmentId],
    references: [trainingEnrollments.id],
  }),
  session: one(courseSessions, {
    fields: [skillCheckoffs.sessionId],
    references: [courseSessions.id],
  }),
  instructor: one(user, {
    fields: [skillCheckoffs.instructorId],
    references: [user.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CertificationAgency = typeof certificationAgencies.$inferSelect;
export type NewCertificationAgency = typeof certificationAgencies.$inferInsert;

export type CertificationLevel = typeof certificationLevels.$inferSelect;
export type NewCertificationLevel = typeof certificationLevels.$inferInsert;

export type TrainingCourse = typeof trainingCourses.$inferSelect;
export type NewTrainingCourse = typeof trainingCourses.$inferInsert;

export type CourseSession = typeof courseSessions.$inferSelect;
export type NewCourseSession = typeof courseSessions.$inferInsert;

export type TrainingEnrollment = typeof trainingEnrollments.$inferSelect;
export type NewTrainingEnrollment = typeof trainingEnrollments.$inferInsert;

export type SkillCheckoff = typeof skillCheckoffs.$inferSelect;
export type NewSkillCheckoff = typeof skillCheckoffs.$inferInsert;

// Enum-like types for status fields
export type EnrollmentStatus =
  | "pending_scheduling"
  | "scheduled"
  | "enrolled"
  | "in_progress"
  | "completed"
  | "certified"
  | "withdrawn";

export type PaymentStatus =
  | "pending"
  | "deposit_paid"
  | "partial"
  | "paid"
  | "refunded";

export type SessionType = "classroom" | "pool" | "open_water";

export type SessionStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export type SkillCategory = "basic" | "intermediate" | "advanced";

export type SkillStatus = "not_attempted" | "attempted" | "demonstrated";

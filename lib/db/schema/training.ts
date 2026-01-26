import {
  pgTable,
  text,
  uuid,
  boolean,
  integer,
  decimal,
  timestamp,
  date,
  time,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./auth";
import { customers } from "../schema";

// ============================================================================
// CERTIFICATION AGENCIES (PADI, SSI, NAUI, etc.)
// ============================================================================

export const certificationAgencies = pgTable(
  "certification_agencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // PADI, SSI, NAUI, SDI/TDI, RAID
    code: text("code").notNull(), // padi, ssi, naui, sdi, raid
    description: text("description"),
    website: text("website"),
    logoUrl: text("logo_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("cert_agencies_org_idx").on(table.organizationId),
    uniqueIndex("cert_agencies_org_code_idx").on(table.organizationId, table.code),
  ]
);

// ============================================================================
// CERTIFICATION LEVELS (Open Water, Advanced, Rescue, etc.)
// ============================================================================

export const certificationLevels = pgTable(
  "certification_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    agencyId: uuid("agency_id").references(() => certificationAgencies.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(), // Open Water Diver, Advanced Open Water, etc.
    code: text("code").notNull(), // owd, aowd, rescue, dm, instructor
    levelNumber: integer("level_number").notNull().default(1), // For ordering (1=beginner, 10=instructor)
    description: text("description"),
    prerequisites: text("prerequisites"),
    minAge: integer("min_age"),
    minDives: integer("min_dives"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("cert_levels_org_idx").on(table.organizationId),
    index("cert_levels_agency_idx").on(table.agencyId),
    uniqueIndex("cert_levels_org_code_idx").on(table.organizationId, table.code),
  ]
);

// ============================================================================
// AGENCY COURSE TEMPLATES (Import from certification agencies)
// ============================================================================

export const agencyCourseTemplates = pgTable(
  "agency_course_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Optional FK to tenant-specific agency (for imported courses)
    agencyId: uuid("agency_id").references(() => certificationAgencies.id, { onDelete: "cascade" }),
    levelId: uuid("level_id").references(() => certificationLevels.id, { onDelete: "set null" }),
    // Agency/level codes for global templates (no FK needed)
    agencyCode: text("agency_code"), // e.g., "padi", "ssi" - for global template lookup
    levelCode: text("level_code"), // e.g., "beginner", "advanced" - for display/filtering

    // Agency-controlled fields
    name: text("name").notNull(),
    code: text("code"),
    description: text("description"),
    images: jsonb("images").$type<string[]>(),

    durationDays: integer("duration_days").notNull().default(1),
    classroomHours: integer("classroom_hours").default(0),
    poolHours: integer("pool_hours").default(0),
    openWaterDives: integer("open_water_dives").default(0),

    prerequisites: text("prerequisites"),
    minAge: integer("min_age"),
    medicalRequirements: text("medical_requirements"),
    requiredItems: jsonb("required_items").$type<string[]>(),
    materialsIncluded: boolean("materials_included").default(true),

    // Tracking
    contentHash: text("content_hash").notNull(),
    sourceType: text("source_type").notNull(), // 'api', 'static_json', 'manual'
    sourceUrl: text("source_url"),
    lastSyncedAt: timestamp("last_synced_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    agencyIdx: index("idx_agency_templates_agency").on(table.agencyId),
    agencyCodeIdx: index("idx_agency_templates_agency_code").on(table.agencyCode),
    hashIdx: index("idx_agency_templates_hash").on(table.contentHash),
    uniqueCode: uniqueIndex("idx_agency_templates_unique_code").on(table.agencyCode, table.code),
  })
);

// ============================================================================
// TRAINING COURSES
// ============================================================================

export const trainingCourses = pgTable(
  "training_courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    agencyId: uuid("agency_id").references(() => certificationAgencies.id, {
      onDelete: "set null",
    }),
    levelId: uuid("level_id").references(() => certificationLevels.id, {
      onDelete: "set null",
    }),
    templateId: uuid("template_id").references(() => agencyCourseTemplates.id, { onDelete: "set null" }),
    templateHash: text("template_hash"),
    name: text("name").notNull(),
    code: text("code"), // Course code for reference
    description: text("description"),

    // Course details
    durationDays: integer("duration_days").notNull().default(1),
    classroomHours: integer("classroom_hours").default(0),
    poolHours: integer("pool_hours").default(0),
    openWaterDives: integer("open_water_dives").default(0),

    // Pricing
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    depositRequired: boolean("deposit_required").default(false),
    depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),

    // Capacity
    minStudents: integer("min_students").default(1),
    maxStudents: integer("max_students").notNull().default(6),

    // Materials & equipment
    materialsIncluded: boolean("materials_included").default(true),
    equipmentIncluded: boolean("equipment_included").default(true),
    includedItems: jsonb("included_items").$type<string[]>(),
    requiredItems: jsonb("required_items").$type<string[]>(),

    // Requirements
    minAge: integer("min_age"),
    prerequisites: text("prerequisites"),
    requiredCertLevel: uuid("required_cert_level").references(() => certificationLevels.id),
    medicalRequirements: text("medical_requirements"),

    // Display
    images: jsonb("images").$type<string[]>(),
    isPublic: boolean("is_public").notNull().default(false), // Show on public site
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").default(0),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("training_courses_org_idx").on(table.organizationId),
    index("training_courses_agency_idx").on(table.agencyId),
    index("training_courses_level_idx").on(table.levelId),
    index("training_courses_template_idx").on(table.templateId),
    index("training_courses_public_idx").on(table.organizationId, table.isPublic),
  ]
);

// ============================================================================
// TRAINING SESSIONS (Scheduled instances of courses)
// ============================================================================

export const trainingSessions = pgTable(
  "training_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => trainingCourses.id, { onDelete: "cascade" }),

    // Scheduling
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    startTime: time("start_time"),

    // Location
    location: text("location"),
    meetingPoint: text("meeting_point"),

    // Instructor
    instructorId: text("instructor_id"), // Reference to staff/user
    instructorName: text("instructor_name"),

    // Capacity
    maxStudents: integer("max_students"),

    // Pricing override (if different from course)
    priceOverride: decimal("price_override", { precision: 10, scale: 2 }),

    // Status
    status: text("status").notNull().default("scheduled"), // scheduled, in_progress, completed, cancelled
    notes: text("notes"),

    // Denormalized counts
    enrolledCount: integer("enrolled_count").notNull().default(0),
    completedCount: integer("completed_count").notNull().default(0),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("training_sessions_org_idx").on(table.organizationId),
    index("training_sessions_course_idx").on(table.courseId),
    index("training_sessions_date_idx").on(table.organizationId, table.startDate),
    index("training_sessions_status_idx").on(table.organizationId, table.status),
  ]
);

// ============================================================================
// ENROLLMENTS (Students enrolled in sessions)
// ============================================================================

export const trainingEnrollments = pgTable(
  "training_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),

    // Status
    status: text("status").notNull().default("enrolled"), // enrolled, in_progress, completed, dropped, failed
    enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),

    // Payment
    amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).default("0"),
    paymentStatus: text("payment_status").notNull().default("pending"), // pending, partial, paid, refunded

    // Progress tracking
    progress: jsonb("progress").$type<{
      classroomComplete?: boolean;
      poolComplete?: boolean;
      openWaterDivesCompleted?: number;
      quizScore?: number;
      finalExamScore?: number;
    }>(),

    // Skill checkoffs
    skillCheckoffs: jsonb("skill_checkoffs").$type<{
      skill: string;
      completedAt: string;
      signedOffBy: string;
    }[]>(),

    // Certification issued
    certificationNumber: text("certification_number"),
    certificationDate: date("certification_date"),

    notes: text("notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("training_enrollments_org_idx").on(table.organizationId),
    index("training_enrollments_session_idx").on(table.sessionId),
    index("training_enrollments_customer_idx").on(table.customerId),
    uniqueIndex("training_enrollments_unique_idx").on(table.sessionId, table.customerId),
  ]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const certificationAgenciesRelations = relations(
  certificationAgencies,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [certificationAgencies.organizationId],
      references: [organization.id],
    }),
    levels: many(certificationLevels),
    courses: many(trainingCourses),
  })
);

export const certificationLevelsRelations = relations(
  certificationLevels,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [certificationLevels.organizationId],
      references: [organization.id],
    }),
    agency: one(certificationAgencies, {
      fields: [certificationLevels.agencyId],
      references: [certificationAgencies.id],
    }),
    courses: many(trainingCourses),
  })
);

export const agencyCourseTemplatesRelations = relations(
  agencyCourseTemplates,
  ({ one, many }) => ({
    agency: one(certificationAgencies, {
      fields: [agencyCourseTemplates.agencyId],
      references: [certificationAgencies.id],
    }),
    level: one(certificationLevels, {
      fields: [agencyCourseTemplates.levelId],
      references: [certificationLevels.id],
    }),
    tenantCourses: many(trainingCourses),
  })
);

export const trainingCoursesRelations = relations(
  trainingCourses,
  ({ one, many }) => ({
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
    template: one(agencyCourseTemplates, {
      fields: [trainingCourses.templateId],
      references: [agencyCourseTemplates.id],
    }),
    requiredLevel: one(certificationLevels, {
      fields: [trainingCourses.requiredCertLevel],
      references: [certificationLevels.id],
    }),
    sessions: many(trainingSessions),
  })
);

export const trainingSessionsRelations = relations(
  trainingSessions,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [trainingSessions.organizationId],
      references: [organization.id],
    }),
    course: one(trainingCourses, {
      fields: [trainingSessions.courseId],
      references: [trainingCourses.id],
    }),
    enrollments: many(trainingEnrollments),
  })
);

export const trainingEnrollmentsRelations = relations(
  trainingEnrollments,
  ({ one }) => ({
    organization: one(organization, {
      fields: [trainingEnrollments.organizationId],
      references: [organization.id],
    }),
    session: one(trainingSessions, {
      fields: [trainingEnrollments.sessionId],
      references: [trainingSessions.id],
    }),
    customer: one(customers, {
      fields: [trainingEnrollments.customerId],
      references: [customers.id],
    }),
  })
);

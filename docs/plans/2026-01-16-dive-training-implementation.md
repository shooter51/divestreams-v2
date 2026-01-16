# Dive Training Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated training module for dive shops to manage certification courses, student enrollments, skill tracking, and certification issuance.

**Architecture:** Separate training module at `/app/training` with its own database tables, server functions, and routes. Integrates with existing customers (students), POS (payments), and embed widget (online enrollment). Freemium-gated as premium feature.

**Tech Stack:** React Router v7, Drizzle ORM, PostgreSQL, TypeScript, Tailwind CSS, Vitest

**Design Doc:** `docs/plans/2026-01-16-dive-training-module-design.md`

---

## Task 1: Database Schema - Training Tables

**Files:**
- Create: `lib/db/schema/training.ts`
- Modify: `lib/db/schema.ts` (add export)

**Step 1: Create training schema file**

Create `lib/db/schema/training.ts`:

```typescript
import {
  pgTable,
  text,
  uuid,
  boolean,
  timestamp,
  date,
  time,
  integer,
  decimal,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./auth";
import { customers, diveSites } from "../schema";

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
    name: text("name").notNull(),
    code: text("code").notNull(),
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
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => certificationAgencies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    level: integer("level").notNull(),
    description: text("description"),
    prerequisites: jsonb("prerequisites").$type<string[]>(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("cert_levels_org_idx").on(table.organizationId),
    index("cert_levels_agency_idx").on(table.agencyId),
    uniqueIndex("cert_levels_org_agency_code_idx").on(
      table.organizationId,
      table.agencyId,
      table.code
    ),
  ]
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
    name: text("name").notNull(),
    description: text("description"),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => certificationAgencies.id),
    levelId: uuid("level_id")
      .notNull()
      .references(() => certificationLevels.id),
    scheduleType: text("schedule_type").notNull().default("fixed"), // fixed, on_demand
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
    maxStudents: integer("max_students").default(6),
    minInstructors: integer("min_instructors").default(1),
    totalSessions: integer("total_sessions").default(1),
    hasExam: boolean("has_exam").default(true),
    examPassScore: integer("exam_pass_score").default(75),
    minOpenWaterDives: integer("min_open_water_dives").default(4),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("training_courses_org_idx").on(table.organizationId),
    index("training_courses_agency_idx").on(table.agencyId),
    index("training_courses_level_idx").on(table.levelId),
  ]
);

// ============================================================================
// COURSE SESSIONS (scheduled instances)
// ============================================================================

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
    enrollmentId: uuid("enrollment_id"), // nullable - for on-demand, links to specific enrollment
    sessionType: text("session_type").notNull(), // classroom, pool, open_water
    sessionNumber: integer("session_number").default(1),
    scheduledDate: date("scheduled_date").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time"),
    location: text("location"),
    diveSiteId: uuid("dive_site_id").references(() => diveSites.id),
    instructorIds: jsonb("instructor_ids").$type<string[]>(),
    status: text("status").notNull().default("scheduled"), // scheduled, in_progress, completed, cancelled
    maxStudents: integer("max_students"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("course_sessions_org_idx").on(table.organizationId),
    index("course_sessions_course_idx").on(table.courseId),
    index("course_sessions_date_idx").on(table.scheduledDate),
    index("course_sessions_status_idx").on(table.organizationId, table.status),
  ]
);

// ============================================================================
// ENROLLMENTS
// ============================================================================

export const trainingEnrollments = pgTable(
  "training_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => trainingCourses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    status: text("status").notNull().default("pending_scheduling"),
    // pending_scheduling, scheduled, enrolled, in_progress, completed, certified, withdrawn
    enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    // Payment
    depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
    depositPaidAt: timestamp("deposit_paid_at"),
    totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
    balanceDue: decimal("balance_due", { precision: 10, scale: 2 }),
    paymentStatus: text("payment_status").default("pending"), // pending, deposit_paid, paid_in_full
    posTransactionIds: jsonb("pos_transaction_ids").$type<string[]>(),
    // Assessment
    examScore: integer("exam_score"),
    examPassedAt: timestamp("exam_passed_at"),
    // Certification
    certificationNumber: text("certification_number"),
    certifiedAt: timestamp("certified_at"),
    // Prerequisites
    prerequisiteOverride: boolean("prerequisite_override").default(false),
    prerequisiteOverrideBy: text("prerequisite_override_by"),
    prerequisiteOverrideNote: text("prerequisite_override_note"),
    // Notes
    instructorNotes: text("instructor_notes"),
    studentNotes: text("student_notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("enrollments_org_idx").on(table.organizationId),
    index("enrollments_course_idx").on(table.courseId),
    index("enrollments_customer_idx").on(table.customerId),
    index("enrollments_status_idx").on(table.organizationId, table.status),
  ]
);

// ============================================================================
// SKILL CHECKOFFS
// ============================================================================

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
    sessionId: uuid("session_id")
      .notNull()
      .references(() => courseSessions.id, { onDelete: "cascade" }),
    skillName: text("skill_name").notNull(),
    skillCategory: text("skill_category").notNull(), // basic, intermediate, advanced
    status: text("status").notNull().default("not_attempted"), // not_attempted, attempted, demonstrated
    instructorId: text("instructor_id").notNull(),
    checkedOffAt: timestamp("checked_off_at").notNull().defaultNow(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("skill_checkoffs_org_idx").on(table.organizationId),
    index("skill_checkoffs_enrollment_idx").on(table.enrollmentId),
    index("skill_checkoffs_session_idx").on(table.sessionId),
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
    sessions: many(courseSessions),
    enrollments: many(trainingEnrollments),
  })
);

export const courseSessionsRelations = relations(
  courseSessions,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [courseSessions.organizationId],
      references: [organization.id],
    }),
    course: one(trainingCourses, {
      fields: [courseSessions.courseId],
      references: [trainingCourses.id],
    }),
    diveSite: one(diveSites, {
      fields: [courseSessions.diveSiteId],
      references: [diveSites.id],
    }),
    skillCheckoffs: many(skillCheckoffs),
  })
);

export const trainingEnrollmentsRelations = relations(
  trainingEnrollments,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [trainingEnrollments.organizationId],
      references: [organization.id],
    }),
    course: one(trainingCourses, {
      fields: [trainingEnrollments.courseId],
      references: [trainingCourses.id],
    }),
    customer: one(customers, {
      fields: [trainingEnrollments.customerId],
      references: [customers.id],
    }),
    skillCheckoffs: many(skillCheckoffs),
  })
);

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
}));
```

**Step 2: Export from schema.ts**

Add to `lib/db/schema.ts` after other schema exports (around line 11):

```typescript
export * from "./schema/training";
```

**Step 3: Run typecheck to verify**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/db/schema/training.ts lib/db/schema.ts
git commit -m "feat(training): add database schema for training module

Tables: certification_agencies, certification_levels, training_courses,
course_sessions, training_enrollments, skill_checkoffs"
```

---

## Task 2: Database Migration

**Files:**
- Create: `drizzle/0009_dive_training_module.sql`

**Step 1: Generate migration**

Run: `npm run db:generate`

This will generate the SQL migration file based on schema changes.

**Step 2: Verify migration file exists**

Check that `drizzle/0009_*.sql` was created with the training tables.

**Step 3: Commit**

```bash
git add drizzle/
git commit -m "feat(training): add migration for training tables"
```

---

## Task 3: Server Functions - Training Queries

**Files:**
- Create: `lib/db/training.server.ts`
- Create: `tests/unit/lib/db/training.server.test.ts`

**Step 1: Write failing tests**

Create `tests/unit/lib/db/training.server.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    then: vi.fn(),
  },
}));

describe("Training Server Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCertificationAgencies", () => {
    it("exports getCertificationAgencies function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.getCertificationAgencies).toBe("function");
    });
  });

  describe("getCertificationLevels", () => {
    it("exports getCertificationLevels function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.getCertificationLevels).toBe("function");
    });
  });

  describe("getTrainingCourses", () => {
    it("exports getTrainingCourses function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.getTrainingCourses).toBe("function");
    });
  });

  describe("getTrainingCourseById", () => {
    it("exports getTrainingCourseById function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.getTrainingCourseById).toBe("function");
    });
  });

  describe("getCourseSessions", () => {
    it("exports getCourseSessions function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.getCourseSessions).toBe("function");
    });
  });

  describe("getEnrollments", () => {
    it("exports getEnrollments function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.getEnrollments).toBe("function");
    });
  });

  describe("getEnrollmentById", () => {
    it("exports getEnrollmentById function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.getEnrollmentById).toBe("function");
    });
  });

  describe("createCertificationAgency", () => {
    it("exports createCertificationAgency function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.createCertificationAgency).toBe("function");
    });
  });

  describe("createCertificationLevel", () => {
    it("exports createCertificationLevel function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.createCertificationLevel).toBe("function");
    });
  });

  describe("createTrainingCourse", () => {
    it("exports createTrainingCourse function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.createTrainingCourse).toBe("function");
    });
  });

  describe("createCourseSession", () => {
    it("exports createCourseSession function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.createCourseSession).toBe("function");
    });
  });

  describe("createEnrollment", () => {
    it("exports createEnrollment function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.createEnrollment).toBe("function");
    });
  });

  describe("updateEnrollmentStatus", () => {
    it("exports updateEnrollmentStatus function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.updateEnrollmentStatus).toBe("function");
    });
  });

  describe("recordSkillCheckoff", () => {
    it("exports recordSkillCheckoff function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.recordSkillCheckoff).toBe("function");
    });
  });

  describe("getStudentProgress", () => {
    it("exports getStudentProgress function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.getStudentProgress).toBe("function");
    });
  });

  describe("checkPrerequisites", () => {
    it("exports checkPrerequisites function", async () => {
      const module = await import("../../../lib/db/training.server");
      expect(typeof module.checkPrerequisites).toBe("function");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test tests/unit/lib/db/training.server.test.ts`
Expected: FAIL - module not found

**Step 3: Create training.server.ts**

Create `lib/db/training.server.ts`:

```typescript
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
import { eq, and, desc, asc, count, sql, inArray } from "drizzle-orm";

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
): Promise<{ met: boolean; missing: string[]; customerCerts: any[] }> {
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

  const customerCerts = (customer.certifications as any[]) || [];

  // Get prerequisite level details
  const prereqLevels = await db
    .select()
    .from(certificationLevels)
    .where(inArray(certificationLevels.id, prerequisites));

  // Check which prerequisites are met
  const missing: string[] = [];
  for (const prereq of prereqLevels) {
    const hasCert = customerCerts.some(
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

  const [{ value: completedThisMonth }] = await db
    .select({ value: count() })
    .from(trainingEnrollments)
    .where(
      and(
        eq(trainingEnrollments.organizationId, organizationId),
        eq(trainingEnrollments.status, "certified"),
        sql`${trainingEnrollments.certifiedAt} >= ${startOfMonth}`
      )
    );

  // Upcoming sessions (next 7 days)
  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [{ value: upcomingSessions }] = await db
    .select({ value: count() })
    .from(courseSessions)
    .where(
      and(
        eq(courseSessions.organizationId, organizationId),
        eq(courseSessions.status, "scheduled"),
        sql`${courseSessions.scheduledDate} >= ${today}`,
        sql`${courseSessions.scheduledDate} <= ${nextWeek}`
      )
    );

  // Active courses
  const [{ value: activeCourses }] = await db
    .select({ value: count() })
    .from(trainingCourses)
    .where(
      and(
        eq(trainingCourses.organizationId, organizationId),
        eq(trainingCourses.isActive, true)
      )
    );

  return {
    activeEnrollments,
    completedThisMonth,
    upcomingSessions,
    activeCourses,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test tests/unit/lib/db/training.server.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/db/training.server.ts tests/unit/lib/db/training.server.test.ts
git commit -m "feat(training): add server functions for training module

Includes queries and mutations for agencies, levels, courses,
sessions, enrollments, skill checkoffs, and progress tracking"
```

---

## Task 4: Add Training to Sidebar

**Files:**
- Modify: `app/routes/tenant/layout.tsx`
- Create: `tests/unit/routes/tenant/training-layout.test.ts`

**Step 1: Write failing test**

Create `tests/unit/routes/tenant/training-layout.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("Tenant Layout - Training Navigation", () => {
  it("includes Training in navigation items", () => {
    const layoutContent = readFileSync(
      "app/routes/tenant/layout.tsx",
      "utf-8"
    );
    expect(layoutContent).toContain('"/app/training"');
    expect(layoutContent).toContain('"Training"');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/routes/tenant/training-layout.test.ts`
Expected: FAIL - Training not in navigation

**Step 3: Add Training to navigation**

In `app/routes/tenant/layout.tsx`, add to `navItems` array (after Tours, around line 46):

```typescript
    { href: "/app/training", label: "Training", icon: "🎓" },
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/routes/tenant/training-layout.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/routes/tenant/layout.tsx tests/unit/routes/tenant/training-layout.test.ts
git commit -m "feat(training): add Training to sidebar navigation"
```

---

## Task 5: Training Dashboard Route

**Files:**
- Create: `app/routes/tenant/training/index.tsx`
- Create: `tests/integration/routes/tenant/training/index.test.ts`

**Step 1: Write failing test**

Create `tests/integration/routes/tenant/training/index.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireOrgContext = vi.fn();
const mockGetTrainingDashboardStats = vi.fn();
const mockGetEnrollments = vi.fn();
const mockGetCourseSessions = vi.fn();

vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: mockRequireOrgContext,
}));

vi.mock("../../../../lib/db/training.server", () => ({
  getTrainingDashboardStats: mockGetTrainingDashboardStats,
  getEnrollments: mockGetEnrollments,
  getCourseSessions: mockGetCourseSessions,
}));

describe("Training Dashboard Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrgContext.mockResolvedValue({
      org: { id: "org-1", name: "Test Dive Shop" },
      isPremium: true,
      limits: { hasTraining: true },
    });
    mockGetTrainingDashboardStats.mockResolvedValue({
      activeEnrollments: 5,
      completedThisMonth: 3,
      upcomingSessions: 8,
      activeCourses: 4,
    });
    mockGetEnrollments.mockResolvedValue({
      enrollments: [],
      total: 0,
      page: 1,
      totalPages: 0,
    });
    mockGetCourseSessions.mockResolvedValue([]);
  });

  describe("loader", () => {
    it("returns dashboard stats", async () => {
      const { loader } = await import(
        "../../../../app/routes/tenant/training/index"
      );
      const request = new Request("https://demo.divestreams.com/app/training");
      const result = await loader({
        request,
        params: {},
        context: {},
      } as any);

      expect(result.stats).toEqual({
        activeEnrollments: 5,
        completedThisMonth: 3,
        upcomingSessions: 8,
        activeCourses: 4,
      });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/integration/routes/tenant/training/index.test.ts`
Expected: FAIL - module not found

**Step 3: Create dashboard route**

Create `app/routes/tenant/training/index.tsx`:

```typescript
import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import {
  getTrainingDashboardStats,
  getEnrollments,
  getCourseSessions,
} from "../../../../lib/db/training.server";

export const meta: MetaFunction = () => [
  { title: "Training - DiveStreams" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Check freemium access
  if (!ctx.isPremium) {
    return {
      hasAccess: false,
      stats: null,
      recentEnrollments: null,
      upcomingSessions: null,
    };
  }

  const [stats, enrollmentsData, sessions] = await Promise.all([
    getTrainingDashboardStats(ctx.org.id),
    getEnrollments(ctx.org.id, { limit: 5 }),
    getCourseSessions(ctx.org.id, { status: "scheduled" }),
  ]);

  // Filter to next 7 days
  const today = new Date();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const upcomingSessions = sessions
    .filter((s) => {
      const sessionDate = new Date(s.session.scheduledDate);
      return sessionDate >= today && sessionDate <= nextWeek;
    })
    .slice(0, 5);

  return {
    hasAccess: true,
    stats,
    recentEnrollments: enrollmentsData.enrollments,
    upcomingSessions,
  };
}

export default function TrainingDashboard() {
  const { hasAccess, stats, recentEnrollments, upcomingSessions } =
    useLoaderData<typeof loader>();

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">🎓</div>
        <h1 className="text-2xl font-bold mb-4">Training Module</h1>
        <p className="text-gray-600 mb-6">
          Manage dive certifications, courses, and student progress with the
          Training Module. Available on Premium plans.
        </p>
        <Link
          to="/app/settings/billing"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Upgrade to Premium
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Training Dashboard</h1>
        <Link
          to="/app/training/courses/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + New Course
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg border">
          <div className="text-3xl font-bold text-blue-600">
            {stats?.activeEnrollments || 0}
          </div>
          <div className="text-gray-600">Active Enrollments</div>
        </div>
        <div className="bg-white p-6 rounded-lg border">
          <div className="text-3xl font-bold text-green-600">
            {stats?.completedThisMonth || 0}
          </div>
          <div className="text-gray-600">Certified This Month</div>
        </div>
        <div className="bg-white p-6 rounded-lg border">
          <div className="text-3xl font-bold text-purple-600">
            {stats?.upcomingSessions || 0}
          </div>
          <div className="text-gray-600">Upcoming Sessions</div>
        </div>
        <div className="bg-white p-6 rounded-lg border">
          <div className="text-3xl font-bold text-gray-600">
            {stats?.activeCourses || 0}
          </div>
          <div className="text-gray-600">Active Courses</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Enrollments */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-semibold">Recent Enrollments</h2>
            <Link
              to="/app/training/enrollments"
              className="text-blue-600 text-sm hover:underline"
            >
              View All
            </Link>
          </div>
          <div className="divide-y">
            {recentEnrollments && recentEnrollments.length > 0 ? (
              recentEnrollments.map((item: any) => (
                <Link
                  key={item.enrollment.id}
                  to={`/app/training/enrollments/${item.enrollment.id}`}
                  className="p-4 flex justify-between items-center hover:bg-gray-50"
                >
                  <div>
                    <div className="font-medium">
                      {item.customer?.firstName} {item.customer?.lastName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.course?.name}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      item.enrollment.status === "certified"
                        ? "bg-green-100 text-green-800"
                        : item.enrollment.status === "in_progress"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {item.enrollment.status.replace("_", " ")}
                  </span>
                </Link>
              ))
            ) : (
              <div className="p-4 text-gray-500 text-center">
                No enrollments yet
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-semibold">Upcoming Sessions</h2>
            <Link
              to="/app/training/sessions"
              className="text-blue-600 text-sm hover:underline"
            >
              View Calendar
            </Link>
          </div>
          <div className="divide-y">
            {upcomingSessions && upcomingSessions.length > 0 ? (
              upcomingSessions.map((item: any) => (
                <Link
                  key={item.session.id}
                  to={`/app/training/sessions/${item.session.id}`}
                  className="p-4 flex justify-between items-center hover:bg-gray-50"
                >
                  <div>
                    <div className="font-medium">{item.course?.name}</div>
                    <div className="text-sm text-gray-500">
                      {item.session.sessionType} - {item.session.location}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {new Date(item.session.scheduledDate).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.session.startTime}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-4 text-gray-500 text-center">
                No upcoming sessions
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/app/training/courses"
          className="p-4 bg-white rounded-lg border text-center hover:bg-gray-50"
        >
          <div className="text-2xl mb-2">📚</div>
          <div className="font-medium">Courses</div>
        </Link>
        <Link
          to="/app/training/sessions"
          className="p-4 bg-white rounded-lg border text-center hover:bg-gray-50"
        >
          <div className="text-2xl mb-2">📅</div>
          <div className="font-medium">Sessions</div>
        </Link>
        <Link
          to="/app/training/enrollments"
          className="p-4 bg-white rounded-lg border text-center hover:bg-gray-50"
        >
          <div className="text-2xl mb-2">👥</div>
          <div className="font-medium">Enrollments</div>
        </Link>
        <Link
          to="/app/training/settings/agencies"
          className="p-4 bg-white rounded-lg border text-center hover:bg-gray-50"
        >
          <div className="text-2xl mb-2">⚙️</div>
          <div className="font-medium">Settings</div>
        </Link>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/integration/routes/tenant/training/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/routes/tenant/training/index.tsx tests/integration/routes/tenant/training/index.test.ts
git commit -m "feat(training): add training dashboard route"
```

---

## Task 6-15: Remaining Routes

The remaining tasks follow the same TDD pattern. For brevity, here's the summary:

### Task 6: Courses List Route
- File: `app/routes/tenant/training/courses/index.tsx`
- List courses with filters and pagination

### Task 7: New Course Route
- File: `app/routes/tenant/training/courses/new.tsx`
- Form to create a course with agency/level selection

### Task 8: Course Detail Route
- File: `app/routes/tenant/training/courses/$id.tsx`
- Show course details, sessions, enrollments

### Task 9: Edit Course Route
- File: `app/routes/tenant/training/courses/$id/edit.tsx`
- Form to edit course

### Task 10: Sessions List Route
- File: `app/routes/tenant/training/sessions/index.tsx`
- Calendar view of sessions

### Task 11: Session Detail Route
- File: `app/routes/tenant/training/sessions/$id.tsx`
- Run session: attendance, skill checkoffs

### Task 12: Enrollments List Route
- File: `app/routes/tenant/training/enrollments/index.tsx`
- List enrollments with status filters

### Task 13: Enrollment Detail Route
- File: `app/routes/tenant/training/enrollments/$id.tsx`
- Student progress view with skills, exam, certification

### Task 14: Agencies Settings Route
- File: `app/routes/tenant/training/settings/agencies.tsx`
- CRUD for certification agencies

### Task 15: Levels Settings Route
- File: `app/routes/tenant/training/settings/levels.tsx`
- CRUD for certification levels per agency

---

## Task 16: Freemium Integration

**Files:**
- Modify: `lib/auth/org-context.server.ts`

**Step 1: Add training to free tier limits**

In `lib/auth/org-context.server.ts`, add to `FREE_TIER_LIMITS`:

```typescript
hasTraining: false,
```

And to premium/paid tier logic, ensure `hasTraining: true`.

**Step 2: Commit**

```bash
git add lib/auth/org-context.server.ts
git commit -m "feat(training): add freemium gating for training module"
```

---

## Task 17: Embed Widget Extension

**Files:**
- Modify: `app/routes/embed/$tenant/book.tsx`

**Step 1: Add Courses tab to embed widget**

Extend the existing booking widget to show courses alongside tours.

**Step 2: Commit**

```bash
git add app/routes/embed/\$tenant/book.tsx
git commit -m "feat(training): add courses to public booking widget"
```

---

## Task 18: Final Integration Test

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(training): complete dive training module v1

Includes:
- Certification agencies and levels management
- Course creation (fixed + on-demand scheduling)
- Session scheduling with instructor assignment
- Student enrollments via POS and embed widget
- Prerequisite checking with soft-block override
- Skill checkoff during sessions
- Exam score recording
- Progress tracking dashboard
- Certification recording synced to customer profile
- Freemium gating (premium feature)"
```

---

## Execution Notes

- Each task should pass tests before moving to the next
- Commit frequently after each task
- If tests fail, fix before proceeding
- Reference design doc for detailed specifications
- Use existing route patterns (customers, tours) as templates

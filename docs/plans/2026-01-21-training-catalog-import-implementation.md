# Training Catalog Import System - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a three-tier catalog import system allowing dive shops to prepopulate training courses from certification agencies with smart merge for updates.

**Architecture:** Agency course templates cached in database, three-tier fallback (API → JSON → Manual), background sync job at 2 AM, smart merge preserving tenant pricing/settings while updating agency content.

**Tech Stack:** React Router v7, Drizzle ORM, PostgreSQL JSONB, BullMQ (job queue), SHA-256 hashing, Zod validation

---

## Task 1: Database Schema - agency_course_templates Table

**Files:**
- Create: `drizzle/0014_add_agency_course_templates.sql`
- Modify: `lib/db/schema/training.ts:1-50`
- Test: `tests/unit/lib/db/schema/training-templates.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/db/schema/training-templates.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { agencyCourseTemplates } from "../../../lib/db/schema/training";

describe("agencyCourseTemplates schema", () => {
  it("should have required columns", () => {
    const columns = Object.keys(agencyCourseTemplates);

    expect(columns).toContain("id");
    expect(columns).toContain("agencyId");
    expect(columns).toContain("levelId");
    expect(columns).toContain("name");
    expect(columns).toContain("code");
    expect(columns).toContain("description");
    expect(columns).toContain("images");
    expect(columns).toContain("durationDays");
    expect(columns).toContain("classroomHours");
    expect(columns).toContain("poolHours");
    expect(columns).toContain("openWaterDives");
    expect(columns).toContain("prerequisites");
    expect(columns).toContain("minAge");
    expect(columns).toContain("medicalRequirements");
    expect(columns).toContain("requiredItems");
    expect(columns).toContain("materialsIncluded");
    expect(columns).toContain("contentHash");
    expect(columns).toContain("sourceType");
    expect(columns).toContain("sourceUrl");
    expect(columns).toContain("lastSyncedAt");
    expect(columns).toContain("createdAt");
    expect(columns).toContain("updatedAt");
  });

  it("should define sourceType with correct enum values", () => {
    // This tests the schema definition structure
    expect(agencyCourseTemplates.sourceType).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/lib/db/schema/training-templates.test.ts`
Expected: FAIL with "Cannot find module '../../../lib/db/schema/training'"

**Step 3: Add schema definition to training.ts**

Modify `lib/db/schema/training.ts` - add after `certificationLevels` table:

```typescript
export const agencyCourseTemplates = pgTable(
  "agency_course_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id").references(() => certificationAgencies.id, { onDelete: "cascade" }),
    levelId: uuid("level_id").references(() => certificationLevels.id, { onDelete: "set null" }),

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
    hashIdx: index("idx_agency_templates_hash").on(table.contentHash),
    uniqueCode: uniqueIndex("idx_agency_templates_code").on(table.agencyId, table.code),
  })
);
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/lib/db/schema/training-templates.test.ts`
Expected: PASS (all assertions pass)

**Step 5: Create migration SQL**

Create `drizzle/0014_add_agency_course_templates.sql`:

```sql
CREATE TABLE agency_course_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES certification_agencies(id) ON DELETE CASCADE,
  level_id UUID REFERENCES certification_levels(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  images JSONB,

  duration_days INTEGER NOT NULL DEFAULT 1,
  classroom_hours INTEGER DEFAULT 0,
  pool_hours INTEGER DEFAULT 0,
  open_water_dives INTEGER DEFAULT 0,

  prerequisites TEXT,
  min_age INTEGER,
  medical_requirements TEXT,
  required_items JSONB,
  materials_included BOOLEAN DEFAULT true,

  content_hash TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT,
  last_synced_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agency_templates_agency ON agency_course_templates(agency_id);
CREATE INDEX idx_agency_templates_hash ON agency_course_templates(content_hash);
CREATE UNIQUE INDEX idx_agency_templates_code ON agency_course_templates(agency_id, code);
```

**Step 6: Commit**

```bash
git add lib/db/schema/training.ts drizzle/0014_add_agency_course_templates.sql tests/unit/lib/db/schema/training-templates.test.ts
git commit -m "feat(training): add agency_course_templates table schema"
```

---

## Task 2: Database Schema - Add Template Fields to training_courses

**Files:**
- Create: `drizzle/0015_add_template_fields_to_courses.sql`
- Modify: `lib/db/schema/training.ts:200-210`
- Test: `tests/unit/lib/db/schema/training-templates.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/lib/db/schema/training-templates.test.ts`:

```typescript
describe("trainingCourses template linking", () => {
  it("should have templateId and templateHash fields", () => {
    const columns = Object.keys(trainingCourses);

    expect(columns).toContain("templateId");
    expect(columns).toContain("templateHash");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/lib/db/schema/training-templates.test.ts`
Expected: FAIL with "expected [ columns ] to contain 'templateId'"

**Step 3: Add template fields to trainingCourses schema**

Modify `lib/db/schema/training.ts` in the `trainingCourses` table definition, add after `levelId`:

```typescript
templateId: uuid("template_id").references(() => agencyCourseTemplates.id, { onDelete: "set null" }),
templateHash: text("template_hash"),
```

Also add to the table's index definition:

```typescript
templateIdx: index("idx_training_courses_template").on(table.templateId),
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/lib/db/schema/training-templates.test.ts`
Expected: PASS

**Step 5: Create migration SQL**

Create `drizzle/0015_add_template_fields_to_courses.sql`:

```sql
ALTER TABLE training_courses
  ADD COLUMN template_id UUID REFERENCES agency_course_templates(id) ON DELETE SET NULL,
  ADD COLUMN template_hash TEXT;

CREATE INDEX idx_training_courses_template ON training_courses(template_id);
```

**Step 6: Commit**

```bash
git add lib/db/schema/training.ts drizzle/0015_add_template_fields_to_courses.sql tests/unit/lib/db/schema/training-templates.test.ts
git commit -m "feat(training): add template linking fields to training_courses"
```

---

## Task 3: Content Hash Utility

**Files:**
- Create: `lib/utils/content-hash.server.ts`
- Test: `tests/unit/lib/utils/content-hash.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/utils/content-hash.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateContentHash } from "../../../lib/utils/content-hash.server";

describe("generateContentHash", () => {
  it("should generate consistent hash for same content", () => {
    const template = {
      name: "Open Water Diver",
      code: "OWD",
      description: "Learn to dive",
      images: ["img1.jpg"],
      durationDays: 4,
      classroomHours: 8,
      poolHours: 8,
      openWaterDives: 4,
      prerequisites: "None",
      minAge: 10,
      medicalRequirements: "Medical form required",
      requiredItems: ["mask", "fins"],
      materialsIncluded: true,
    };

    const hash1 = generateContentHash(template);
    const hash2 = generateContentHash(template);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex string
  });

  it("should generate different hash when content changes", () => {
    const template1 = {
      name: "Open Water Diver",
      code: "OWD",
      description: "Learn to dive",
      images: [],
      durationDays: 4,
      classroomHours: 8,
      poolHours: 8,
      openWaterDives: 4,
      prerequisites: null,
      minAge: 10,
      medicalRequirements: null,
      requiredItems: [],
      materialsIncluded: true,
    };

    const template2 = {
      ...template1,
      description: "Learn to scuba dive", // Changed
    };

    const hash1 = generateContentHash(template1);
    const hash2 = generateContentHash(template2);

    expect(hash1).not.toBe(hash2);
  });

  it("should ignore field order (sorted keys)", () => {
    const fields = {
      name: "Test",
      code: "TST",
      description: "Desc",
      durationDays: 1,
    };

    // Reverse order
    const reversed = {
      durationDays: 1,
      description: "Desc",
      code: "TST",
      name: "Test",
    };

    const hash1 = generateContentHash(fields as any);
    const hash2 = generateContentHash(reversed as any);

    expect(hash1).toBe(hash2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/lib/utils/content-hash.test.ts`
Expected: FAIL with "Cannot find module '../../../lib/utils/content-hash.server'"

**Step 3: Implement content hash utility**

Create `lib/utils/content-hash.server.ts`:

```typescript
import crypto from "crypto";

export interface AgencyFieldsForHash {
  name: string;
  code: string | null;
  description: string | null;
  images: string[] | null;
  durationDays: number;
  classroomHours: number | null;
  poolHours: number | null;
  openWaterDives: number | null;
  prerequisites: string | null;
  minAge: number | null;
  medicalRequirements: string | null;
  requiredItems: string[] | null;
  materialsIncluded: boolean | null;
}

export function generateContentHash(template: AgencyFieldsForHash): string {
  const agencyFields = {
    name: template.name,
    code: template.code,
    description: template.description,
    images: template.images,
    durationDays: template.durationDays,
    classroomHours: template.classroomHours,
    poolHours: template.poolHours,
    openWaterDives: template.openWaterDives,
    prerequisites: template.prerequisites,
    minAge: template.minAge,
    medicalRequirements: template.medicalRequirements,
    requiredItems: template.requiredItems,
    materialsIncluded: template.materialsIncluded,
  };

  // Sort keys for consistent hashing
  const sorted = Object.keys(agencyFields)
    .sort()
    .reduce((acc, key) => ({ ...acc, [key]: agencyFields[key as keyof typeof agencyFields] }), {});

  const jsonString = JSON.stringify(sorted);
  return crypto.createHash("sha256").update(jsonString).digest("hex");
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/lib/utils/content-hash.test.ts`
Expected: PASS (all 3 tests pass)

**Step 5: Commit**

```bash
git add lib/utils/content-hash.server.ts tests/unit/lib/utils/content-hash.test.ts
git commit -m "feat(utils): add content hash generator for agency templates"
```

---

## Task 4: Static JSON Catalogs - PADI Sample Data

**Files:**
- Create: `lib/data/catalogs/padi-courses.json`
- Test: `tests/unit/lib/data/catalogs.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/data/catalogs.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

describe("Agency Course Catalogs", () => {
  const catalogDir = join(process.cwd(), "lib", "data", "catalogs");

  it("should have PADI catalog", () => {
    const path = join(catalogDir, "padi-courses.json");
    expect(existsSync(path)).toBe(true);
  });

  it("should have valid JSON structure for PADI", () => {
    const path = join(catalogDir, "padi-courses.json");
    const content = readFileSync(path, "utf-8");
    const catalog = JSON.parse(content);

    expect(Array.isArray(catalog.courses)).toBe(true);
    expect(catalog.agency).toBe("padi");
    expect(catalog.version).toBeDefined();
  });

  it("should have valid course structure", () => {
    const path = join(catalogDir, "padi-courses.json");
    const content = readFileSync(path, "utf-8");
    const catalog = JSON.parse(content);

    const firstCourse = catalog.courses[0];
    expect(firstCourse).toHaveProperty("name");
    expect(firstCourse).toHaveProperty("code");
    expect(firstCourse).toHaveProperty("levelCode");
    expect(firstCourse).toHaveProperty("durationDays");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/lib/data/catalogs.test.ts`
Expected: FAIL with "expected false to be true" (file doesn't exist)

**Step 3: Create PADI catalog JSON**

Create `lib/data/catalogs/padi-courses.json`:

```json
{
  "agency": "padi",
  "version": "2026.1",
  "lastUpdated": "2026-01-21",
  "courses": [
    {
      "name": "Open Water Diver",
      "code": "OWD",
      "levelCode": "beginner",
      "description": "The PADI Open Water Diver course is the world's most popular scuba course. Learn to dive in a relaxed, supportive environment with comprehensive training.",
      "images": [
        "https://www.padi.com/sites/default/files/courses/images/open-water-diver.jpg"
      ],
      "durationDays": 3,
      "classroomHours": 8,
      "poolHours": 8,
      "openWaterDives": 4,
      "prerequisites": null,
      "minAge": 10,
      "medicalRequirements": "PADI Medical Statement required",
      "requiredItems": [
        "Mask, fins, and snorkel",
        "Wetsuit or exposure protection",
        "Weight system",
        "BCD (Buoyancy Control Device)",
        "Regulator with alternate air source",
        "Dive computer or tables"
      ],
      "materialsIncluded": true
    },
    {
      "name": "Advanced Open Water Diver",
      "code": "AOWD",
      "levelCode": "advanced",
      "description": "Take your diving to the next level with adventure dives including deep diving and underwater navigation, plus three specialty dives of your choice.",
      "images": [
        "https://www.padi.com/sites/default/files/courses/images/advanced-open-water.jpg"
      ],
      "durationDays": 2,
      "classroomHours": 4,
      "poolHours": 0,
      "openWaterDives": 5,
      "prerequisites": "PADI Open Water Diver or equivalent",
      "minAge": 12,
      "medicalRequirements": "Current medical clearance if over 45 or with medical conditions",
      "requiredItems": [
        "Personal dive equipment",
        "Dive computer",
        "Underwater slate"
      ],
      "materialsIncluded": true
    },
    {
      "name": "Rescue Diver",
      "code": "RD",
      "levelCode": "advanced",
      "description": "Learn to prevent and manage dive emergencies. Develop skills to help other divers and respond to diving accidents.",
      "images": [
        "https://www.padi.com/sites/default/files/courses/images/rescue-diver.jpg"
      ],
      "durationDays": 4,
      "classroomHours": 8,
      "poolHours": 8,
      "openWaterDives": 4,
      "prerequisites": "PADI Advanced Open Water Diver and Emergency First Response (EFR) certification within 24 months",
      "minAge": 12,
      "medicalRequirements": "PADI Medical Statement required",
      "requiredItems": [
        "Personal dive equipment",
        "Dive computer",
        "Pocket mask",
        "Rescue mannequin (provided by center)"
      ],
      "materialsIncluded": true
    },
    {
      "name": "Divemaster",
      "code": "DM",
      "levelCode": "professional",
      "description": "The first professional level in the PADI system. Learn to supervise dive activities and assist instructors with student divers.",
      "images": [
        "https://www.padi.com/sites/default/files/courses/images/divemaster.jpg"
      ],
      "durationDays": 7,
      "classroomHours": 24,
      "poolHours": 16,
      "openWaterDives": 10,
      "prerequisites": "PADI Rescue Diver, 40+ logged dives, EFR certification within 24 months, 18 years old",
      "minAge": 18,
      "medicalRequirements": "Physician-signed PADI Medical Statement required",
      "requiredItems": [
        "Full personal dive equipment",
        "Dive computer",
        "Compass",
        "Dive tables and slate",
        "Pocket mask and oxygen unit (for training)"
      ],
      "materialsIncluded": true
    },
    {
      "name": "Enriched Air (Nitrox) Diver",
      "code": "EAN",
      "levelCode": "specialty",
      "description": "Learn to dive with enriched air nitrox, extending your no-decompression limits and shortening surface intervals.",
      "images": [
        "https://www.padi.com/sites/default/files/courses/images/enriched-air.jpg"
      ],
      "durationDays": 1,
      "classroomHours": 4,
      "poolHours": 0,
      "openWaterDives": 2,
      "prerequisites": "PADI Open Water Diver or equivalent",
      "minAge": 12,
      "medicalRequirements": "Standard medical requirements",
      "requiredItems": [
        "Personal dive equipment",
        "Oxygen analyzer (provided by center)",
        "Nitrox-compatible dive computer"
      ],
      "materialsIncluded": true
    }
  ]
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/lib/data/catalogs.test.ts`
Expected: PASS (all tests pass)

**Step 5: Commit**

```bash
git add lib/data/catalogs/padi-courses.json tests/unit/lib/data/catalogs.test.ts
git commit -m "feat(data): add PADI course catalog JSON"
```

---

## Task 5: Template CRUD Functions - Insert Templates

**Files:**
- Create: `lib/db/training-templates.server.ts`
- Test: `tests/unit/lib/db/training-templates.server.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/db/training-templates.server.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { upsertAgencyCourseTemplate } from "../../../lib/db/training-templates.server";
import { db } from "../../../lib/db";
import { agencyCourseTemplates } from "../../../lib/db/schema/training";

vi.mock("../../../lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
    })),
  },
}));

describe("upsertAgencyCourseTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should insert template with generated hash", async () => {
    const template = {
      agencyId: "agency-123",
      levelId: "level-456",
      name: "Open Water Diver",
      code: "OWD",
      description: "Learn to dive",
      images: ["img1.jpg"],
      durationDays: 4,
      classroomHours: 8,
      poolHours: 8,
      openWaterDives: 4,
      prerequisites: null,
      minAge: 10,
      medicalRequirements: null,
      requiredItems: ["mask"],
      materialsIncluded: true,
      sourceType: "static_json" as const,
      sourceUrl: null,
    };

    const mockReturning = vi.fn().mockResolvedValue([{ id: "template-789" }]);
    const mockOnConflict = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict });

    (db.insert as any).mockReturnValue({ values: mockValues });

    await upsertAgencyCourseTemplate(template);

    expect(db.insert).toHaveBeenCalledWith(agencyCourseTemplates);
    expect(mockValues).toHaveBeenCalled();

    const insertedData = mockValues.mock.calls[0][0];
    expect(insertedData).toHaveProperty("contentHash");
    expect(insertedData.contentHash).toHaveLength(64); // SHA-256 hex
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/lib/db/training-templates.server.test.ts`
Expected: FAIL with "Cannot find module '../../../lib/db/training-templates.server'"

**Step 3: Implement upsertAgencyCourseTemplate**

Create `lib/db/training-templates.server.ts`:

```typescript
import { db } from "./index";
import { agencyCourseTemplates } from "./schema/training";
import { generateContentHash } from "../utils/content-hash.server";
import { eq, and } from "drizzle-orm";

export interface UpsertAgencyCourseTemplateInput {
  agencyId: string;
  levelId: string | null;
  name: string;
  code: string | null;
  description: string | null;
  images: string[] | null;
  durationDays: number;
  classroomHours: number | null;
  poolHours: number | null;
  openWaterDives: number | null;
  prerequisites: string | null;
  minAge: number | null;
  medicalRequirements: string | null;
  requiredItems: string[] | null;
  materialsIncluded: boolean | null;
  sourceType: "api" | "static_json" | "manual";
  sourceUrl: string | null;
}

export async function upsertAgencyCourseTemplate(
  input: UpsertAgencyCourseTemplateInput
) {
  const contentHash = generateContentHash(input);

  const template = {
    ...input,
    contentHash,
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  };

  const [result] = await db
    .insert(agencyCourseTemplates)
    .values(template)
    .onConflictDoUpdate({
      target: [agencyCourseTemplates.agencyId, agencyCourseTemplates.code],
      set: template,
    })
    .returning();

  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/lib/db/training-templates.server.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/db/training-templates.server.ts tests/unit/lib/db/training-templates.server.test.ts
git commit -m "feat(db): add upsertAgencyCourseTemplate function"
```

---

## Task 6: Template CRUD Functions - Get Templates by Agency

**Files:**
- Modify: `lib/db/training-templates.server.ts`
- Test: `tests/unit/lib/db/training-templates.server.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/lib/db/training-templates.server.test.ts`:

```typescript
import { getAgencyCourseTemplates } from "../../../lib/db/training-templates.server";

describe("getAgencyCourseTemplates", () => {
  it("should query templates by agency ID", async () => {
    const mockSelect = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn().mockResolvedValue([
            { id: "1", name: "Course A", agencyId: "agency-123" },
            { id: "2", name: "Course B", agencyId: "agency-123" },
          ]),
        })),
      })),
    }));

    (db as any).select = mockSelect;

    const result = await getAgencyCourseTemplates("agency-123");

    expect(result).toHaveLength(2);
    expect(mockSelect).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/lib/db/training-templates.server.test.ts`
Expected: FAIL with "getAgencyCourseTemplates is not a function"

**Step 3: Implement getAgencyCourseTemplates**

Add to `lib/db/training-templates.server.ts`:

```typescript
import { asc } from "drizzle-orm";

export async function getAgencyCourseTemplates(agencyId: string) {
  return await db
    .select()
    .from(agencyCourseTemplates)
    .where(eq(agencyCourseTemplates.agencyId, agencyId))
    .orderBy(asc(agencyCourseTemplates.name));
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/lib/db/training-templates.server.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/db/training-templates.server.ts tests/unit/lib/db/training-templates.server.test.ts
git commit -m "feat(db): add getAgencyCourseTemplates query function"
```

---

## Task 7: Smart Merge Function

**Files:**
- Create: `lib/training/merge-templates.server.ts`
- Test: `tests/unit/lib/training/merge-templates.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/training/merge-templates.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mergeTemplateUpdates } from "../../../lib/training/merge-templates.server";

describe("mergeTemplateUpdates", () => {
  it("should update agency fields while preserving tenant fields", () => {
    const tenantCourse = {
      id: "course-123",
      organizationId: "org-456",
      templateId: "template-789",
      templateHash: "old-hash",

      // Agency fields (will be updated)
      name: "Old Name",
      code: "OLD",
      description: "Old description",
      images: ["old-img.jpg"],
      durationDays: 3,
      classroomHours: 6,
      poolHours: 6,
      openWaterDives: 3,
      prerequisites: "Old prereqs",
      minAge: 8,
      medicalRequirements: "Old requirements",
      requiredItems: ["old item"],
      materialsIncluded: false,
      agencyId: "agency-123",
      levelId: "level-456",

      // Tenant fields (should be preserved)
      price: "499.99",
      currency: "USD",
      depositRequired: true,
      depositAmount: "100.00",
      isActive: true,
      isPublic: true,
      sortOrder: 5,
      minStudents: 2,
      maxStudents: 6,
      equipmentIncluded: true,
      includedItems: ["tanks", "weights"],

      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    };

    const template = {
      id: "template-789",
      agencyId: "agency-123",
      levelId: "level-456",

      // Updated agency fields
      name: "New Name",
      code: "NEW",
      description: "New description",
      images: ["new-img.jpg"],
      durationDays: 4,
      classroomHours: 8,
      poolHours: 8,
      openWaterDives: 4,
      prerequisites: "New prereqs",
      minAge: 10,
      medicalRequirements: "New requirements",
      requiredItems: ["new item"],
      materialsIncluded: true,

      contentHash: "new-hash",
      sourceType: "api",
      sourceUrl: "https://api.example.com",
      lastSyncedAt: new Date("2026-01-21"),
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2026-01-21"),
    };

    const merged = mergeTemplateUpdates(tenantCourse, template);

    // Agency fields should be updated
    expect(merged.name).toBe("New Name");
    expect(merged.code).toBe("NEW");
    expect(merged.description).toBe("New description");
    expect(merged.durationDays).toBe(4);
    expect(merged.classroomHours).toBe(8);
    expect(merged.minAge).toBe(10);

    // Tenant fields should be preserved
    expect(merged.price).toBe("499.99");
    expect(merged.depositRequired).toBe(true);
    expect(merged.depositAmount).toBe("100.00");
    expect(merged.isActive).toBe(true);
    expect(merged.isPublic).toBe(true);
    expect(merged.sortOrder).toBe(5);
    expect(merged.maxStudents).toBe(6);
    expect(merged.equipmentIncluded).toBe(true);

    // Hash should be updated
    expect(merged.templateHash).toBe("new-hash");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/lib/training/merge-templates.test.ts`
Expected: FAIL with "Cannot find module '../../../lib/training/merge-templates.server'"

**Step 3: Implement mergeTemplateUpdates**

Create `lib/training/merge-templates.server.ts`:

```typescript
export interface TenantCourse {
  id: string;
  organizationId: string;
  templateId: string | null;
  templateHash: string | null;

  // Agency fields
  name: string;
  code: string | null;
  description: string | null;
  images: string[] | null;
  durationDays: number;
  classroomHours: number | null;
  poolHours: number | null;
  openWaterDives: number | null;
  prerequisites: string | null;
  minAge: number | null;
  medicalRequirements: string | null;
  requiredItems: string[] | null;
  materialsIncluded: boolean | null;
  agencyId: string | null;
  levelId: string | null;

  // Tenant fields
  price: string;
  currency: string;
  depositRequired: boolean | null;
  depositAmount: string | null;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number | null;
  minStudents: number | null;
  maxStudents: number | null;
  equipmentIncluded: boolean | null;
  includedItems: string[] | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface AgencyTemplate {
  id: string;
  agencyId: string | null;
  levelId: string | null;
  name: string;
  code: string | null;
  description: string | null;
  images: string[] | null;
  durationDays: number;
  classroomHours: number | null;
  poolHours: number | null;
  openWaterDives: number | null;
  prerequisites: string | null;
  minAge: number | null;
  medicalRequirements: string | null;
  requiredItems: string[] | null;
  materialsIncluded: boolean | null;
  contentHash: string;
}

export function mergeTemplateUpdates(
  tenantCourse: TenantCourse,
  template: AgencyTemplate
): Partial<TenantCourse> {
  return {
    // Agency-controlled fields (from template)
    name: template.name,
    code: template.code,
    description: template.description,
    images: template.images,
    durationDays: template.durationDays,
    classroomHours: template.classroomHours,
    poolHours: template.poolHours,
    openWaterDives: template.openWaterDives,
    prerequisites: template.prerequisites,
    minAge: template.minAge,
    medicalRequirements: template.medicalRequirements,
    requiredItems: template.requiredItems,
    materialsIncluded: template.materialsIncluded,
    agencyId: template.agencyId,
    levelId: template.levelId,

    // Tenant-controlled fields (preserved)
    price: tenantCourse.price,
    currency: tenantCourse.currency,
    depositRequired: tenantCourse.depositRequired,
    depositAmount: tenantCourse.depositAmount,
    isActive: tenantCourse.isActive,
    isPublic: tenantCourse.isPublic,
    sortOrder: tenantCourse.sortOrder,
    minStudents: tenantCourse.minStudents,
    maxStudents: tenantCourse.maxStudents,
    equipmentIncluded: tenantCourse.equipmentIncluded,
    includedItems: tenantCourse.includedItems,

    // Update tracking
    templateHash: template.contentHash,
    updatedAt: new Date(),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/unit/lib/training/merge-templates.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/training/merge-templates.server.ts tests/unit/lib/training/merge-templates.test.ts
git commit -m "feat(training): add smart merge function for template updates"
```

---

## Task 8: Import Route - UI Structure

**Files:**
- Create: `app/routes/tenant/training/import.tsx`
- Test: `tests/integration/routes/tenant/training-import.test.ts`

**Step 1: Write the failing test**

Create `tests/integration/routes/tenant/training-import.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("tenant/training/import route", () => {
  it("should render import wizard header", async () => {
    const { default: ImportPage } = await import(
      "../../../app/routes/tenant/training/import"
    );

    // Basic smoke test - component should exist
    expect(ImportPage).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/integration/routes/tenant/training-import.test.ts`
Expected: FAIL with "Cannot find module '../../../app/routes/tenant/training/import'"

**Step 3: Create import route with basic UI**

Create `app/routes/tenant/training/import.tsx`:

```typescript
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import { requireOrgContext } from "../../../lib/auth/org-context.server";
import { db } from "../../../lib/db";
import { certificationAgencies } from "../../../lib/db/schema/training";
import { asc } from "drizzle-orm";

export const meta: MetaFunction = () => {
  return [{ title: "Import Training Courses - DiveStreams" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireOrgContext(request);

  const agencies = await db
    .select()
    .from(certificationAgencies)
    .orderBy(asc(certificationAgencies.name));

  return { agencies };
}

export default function TrainingImportPage() {
  const { agencies } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Import Training Courses
        </h1>
        <p className="text-gray-600 mt-2">
          Import courses from certification agencies to quickly populate your catalog.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Step 1: Select Agency</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {agencies.map((agency) => (
              <button
                key={agency.id}
                type="button"
                className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
              >
                <div className="font-semibold">{agency.name}</div>
                <div className="text-xs text-gray-500 mt-1">{agency.code}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Step 2: Select Courses</h2>
          <p className="text-gray-500 text-sm">
            Choose an agency to view available courses
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test tests/integration/routes/tenant/training-import.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/routes/tenant/training/import.tsx tests/integration/routes/tenant/training-import.test.ts
git commit -m "feat(ui): add training course import page skeleton"
```

---

## Task 9: Seed Script - Load PADI Templates

**Files:**
- Create: `scripts/seed-agency-templates.ts`
- Test: Manual verification with `npm run seed:templates`

**Step 1: Create seed script**

Create `scripts/seed-agency-templates.ts`:

```typescript
import { db } from "../lib/db";
import { certificationAgencies, certificationLevels } from "../lib/db/schema/training";
import { upsertAgencyCourseTemplate } from "../lib/db/training-templates.server";
import { readFileSync } from "fs";
import { join } from "path";
import { eq } from "drizzle-orm";

interface CatalogCourse {
  name: string;
  code: string;
  levelCode: string;
  description: string | null;
  images: string[];
  durationDays: number;
  classroomHours: number;
  poolHours: number;
  openWaterDives: number;
  prerequisites: string | null;
  minAge: number;
  medicalRequirements: string | null;
  requiredItems: string[];
  materialsIncluded: boolean;
}

interface Catalog {
  agency: string;
  version: string;
  lastUpdated: string;
  courses: CatalogCourse[];
}

async function seedPADI() {
  console.log("Loading PADI catalog...");

  // Get PADI agency
  const [padiAgency] = await db
    .select()
    .from(certificationAgencies)
    .where(eq(certificationAgencies.code, "padi"))
    .limit(1);

  if (!padiAgency) {
    console.error("PADI agency not found in database");
    return;
  }

  // Load catalog
  const catalogPath = join(process.cwd(), "lib", "data", "catalogs", "padi-courses.json");
  const catalogContent = readFileSync(catalogPath, "utf-8");
  const catalog: Catalog = JSON.parse(catalogContent);

  console.log(`Found ${catalog.courses.length} PADI courses`);

  // Get all levels
  const levels = await db.select().from(certificationLevels);
  const levelMap = new Map(levels.map((l) => [l.code, l.id]));

  let imported = 0;
  for (const course of catalog.courses) {
    const levelId = levelMap.get(course.levelCode) || null;

    await upsertAgencyCourseTemplate({
      agencyId: padiAgency.id,
      levelId,
      name: course.name,
      code: course.code,
      description: course.description,
      images: course.images,
      durationDays: course.durationDays,
      classroomHours: course.classroomHours,
      poolHours: course.poolHours,
      openWaterDives: course.openWaterDives,
      prerequisites: course.prerequisites,
      minAge: course.minAge,
      medicalRequirements: course.medicalRequirements,
      requiredItems: course.requiredItems,
      materialsIncluded: course.materialsIncluded,
      sourceType: "static_json",
      sourceUrl: null,
    });

    imported++;
  }

  console.log(`✓ Imported ${imported} PADI course templates`);
}

async function main() {
  console.log("Seeding agency course templates...\n");

  await seedPADI();

  console.log("\n✓ Seed complete");
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
```

**Step 2: Add npm script**

Modify `package.json` to add:

```json
"scripts": {
  "seed:templates": "tsx scripts/seed-agency-templates.ts"
}
```

**Step 3: Run seed script to verify**

Run: `npm run seed:templates`
Expected: Console output showing "✓ Imported 5 PADI course templates"

**Step 4: Commit**

```bash
git add scripts/seed-agency-templates.ts package.json
git commit -m "feat(scripts): add agency course templates seed script"
```

---

## Summary

**Completed:**
1. ✅ Database schema (agency_course_templates table)
2. ✅ Template linking fields in training_courses
3. ✅ Content hash utility (SHA-256)
4. ✅ PADI static JSON catalog (5 courses)
5. ✅ Template CRUD functions (upsert, query)
6. ✅ Smart merge function (preserves tenant fields)
7. ✅ Import route UI skeleton
8. ✅ Seed script for loading templates

**Next Steps (Not in this plan):**
- Complete import wizard with course selection
- Add "Check for Updates" button to courses list
- Build side-by-side comparison UI
- Implement background sync job
- Add remaining agency catalogs (SSI, NAUI, GUE, etc.)

This plan covers **Phase 1 (Schema & Infrastructure)** and partial **Phase 2 (Import UI)** from the design document.

---

## Plan Complete

Plan saved to `docs/plans/2026-01-21-training-catalog-import-implementation.md`

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with @superpowers:executing-plans, batch execution with checkpoints

Which approach would you prefer?

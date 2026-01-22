# Training Catalog Import System - Design Document

**Created:** 2026-01-21
**Status:** Design Complete - Ready for Implementation

## Overview

A three-tier catalog import system that allows dive shops to prepopulate their training courses from certification agency catalogs (PADI, SSI, NAUI, GUE, SDI/TDI, etc.) with smart merge capabilities for updates.

## Goals

1. **Easy Onboarding** - New tenants can import full course catalogs in minutes
2. **Stay Current** - Tenants get updates to course descriptions, requirements, images
3. **Tenant Control** - Tenants control pricing, availability, capacity (preserved during updates)
4. **Data Quality** - Three-tier fallback ensures reliable data (API → JSON → Manual)
5. **Unlimited Agencies** - Support all major agencies plus custom/regional ones

## Architecture

### Three-Tier Data Sources (Priority Order)

```
┌─────────────────────────────────────────────────────────┐
│ 1. Agency APIs (Primary)                                │
│    • Live data from PADI/SSI/etc. when available       │
│    • 10-second timeout, fallback on failure            │
└─────────────────────────────────────────────────────────┘
                         ↓ (fallback)
┌─────────────────────────────────────────────────────────┐
│ 2. Static JSON Catalogs (Backup)                       │
│    • Curated files: lib/data/catalogs/{agency}.json   │
│    • Version-controlled in git                         │
└─────────────────────────────────────────────────────────┘
                         ↓ (fallback)
┌─────────────────────────────────────────────────────────┐
│ 3. Manual Entry (Last Resort)                          │
│    • Tenant creates courses from scratch               │
│    • Standard course creation form                     │
└─────────────────────────────────────────────────────────┘
```

### Background Sync Architecture

**Nightly Scheduled Job:**
- Runs at 2:00 AM server time
- Fetches from agency APIs (timeout: 10s per agency)
- Falls back to JSON files if API fails
- Updates `agency_course_templates` table
- Generates content hashes for change detection
- Logs sync results and errors

**Tenants always read from cache** - Never wait for API calls

### Database Schema

**New Table: `agency_course_templates`**

```sql
CREATE TABLE agency_course_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES certification_agencies(id),
  level_id UUID REFERENCES certification_levels(id),

  -- Agency-controlled fields (used for hash)
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  images JSONB, -- string[]

  duration_days INTEGER DEFAULT 1,
  classroom_hours INTEGER DEFAULT 0,
  pool_hours INTEGER DEFAULT 0,
  open_water_dives INTEGER DEFAULT 0,

  prerequisites TEXT,
  min_age INTEGER,
  medical_requirements TEXT,
  required_cert_level UUID REFERENCES certification_levels(id),
  required_items JSONB, -- string[]
  materials_included BOOLEAN DEFAULT true,

  -- Tracking
  content_hash TEXT NOT NULL, -- SHA-256 of agency fields
  source_type TEXT NOT NULL, -- 'api', 'static_json', 'manual'
  source_url TEXT,
  last_synced_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agency_templates_agency ON agency_course_templates(agency_id);
CREATE INDEX idx_agency_templates_hash ON agency_course_templates(content_hash);
CREATE UNIQUE INDEX idx_agency_templates_code ON agency_course_templates(agency_id, code);
```

**Update: `training_courses` table**

Add two fields to link tenant courses to templates:

```sql
ALTER TABLE training_courses
  ADD COLUMN template_id UUID REFERENCES agency_course_templates(id) ON DELETE SET NULL,
  ADD COLUMN template_hash TEXT;

CREATE INDEX idx_training_courses_template ON training_courses(template_id);
```

### Field Ownership Strategy

**Agency-Controlled (Auto-Update on Refresh):**
- name, code, description
- images
- durationDays, classroomHours, poolHours, openWaterDives
- prerequisites, minAge, medicalRequirements
- requiredItems, materialsIncluded
- agencyId, levelId

**Tenant-Controlled (Preserved During Refresh):**
- price, currency, depositRequired, depositAmount
- isActive, isPublic (tenant decides if they offer it)
- sortOrder (custom ordering)
- minStudents, maxStudents (capacity limits)
- equipmentIncluded, includedItems (what's bundled)

**Key Principle:** Agency defines WHAT the course is, tenant defines HOW they offer it.

## User Flows

### 1. Initial Catalog Import (New Tenant)

```
User Journey:
1. Navigate to /app/training/import
2. Select agency (PADI, SSI, etc.)
3. Preview available courses (from agency_course_templates)
4. Select courses to import (checkbox list, "Select All" option)
5. Click "Import Courses"
6. System creates trainingCourses with:
   - Agency fields copied from template
   - Tenant fields set to defaults (price=0, isActive=false)
   - templateId and templateHash stored
7. Redirect to course configuration page
8. Tenant sets pricing, enables courses, adjusts capacity
```

### 2. Manual "Check for Updates" Flow

```
User Journey:
1. Click "Check for Updates" button on courses page
2. System compares templateHash for each course
3. Display: "3 courses have updates available"
4. User clicks "View Changes" on specific course
5. Side-by-side comparison shown:
   - Current values (left)
   - Updated values (right)
   - Tenant settings (marked "unchanged")
6. User clicks "Accept Updates" or "Skip"
7. System merges agency fields, preserves tenant fields
8. Updates templateHash to match current template
```

### 3. Background Sync Job (Nightly)

```
Process Flow:
FOR EACH agency IN certification_agencies:
  TRY:
    IF agency has API config:
      courses = fetchFromAPI(agency, timeout: 10s)
      upsertTemplates(courses, sourceType: 'api')
      LOG success
      CONTINUE
  CATCH (timeout | network | API error):
    LOG warning, fall back to JSON

  TRY:
    courses = readJSON(`catalogs/${agency.code}-courses.json`)
    upsertTemplates(courses, sourceType: 'static_json')
    LOG success
  CATCH (file not found | parse error):
    LOG error, notify admin
```

## UI Design

### Import Wizard (`/app/training/import`)

```
┌─────────────────────────────────────────────┐
│ Import Training Courses                     │
├─────────────────────────────────────────────┤
│ Step 1: Select Agency                      │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐   │
│ │ PADI  │ │  SSI  │ │ NAUI  │ │  GUE  │   │
│ │ [✓]   │ │  [ ]  │ │  [ ]  │ │  [ ]  │   │
│ └───────┘ └───────┘ └───────┘ └───────┘   │
│                                             │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐   │
│ │SDI/TDI│ │ BSAC  │ │ CMAS  │ │ RAID  │   │
│ │  [ ]  │ │  [ ]  │ │  [ ]  │ │  [ ]  │   │
│ └───────┘ └───────┘ └───────┘ └───────┘   │
│                                             │
│ Step 2: Select Courses (23 available)      │
│ [✓] Select All  [ ] Beginner Only          │
│                                             │
│ ┌──────────────────────────────────────────┐│
│ │ ☑ Open Water Diver               $449   ││
│ │   4 days • 8 pool • 4 open water        ││
│ │   Prerequisites: None • Min age: 10     ││
│ │                                          ││
│ │ ☑ Advanced Open Water            $399   ││
│ │   2 days • 0 pool • 5 open water        ││
│ │   Prerequisites: OWD • Min age: 12      ││
│ │                                          ││
│ │ ☐ Rescue Diver                   $499   ││
│ │   3 days • 6 pool • 4 scenarios         ││
│ │   Prerequisites: AOWD+EFR • Min age: 12 ││
│ └──────────────────────────────────────────┘│
│                                             │
│ 15 courses selected                         │
│ [Cancel]              [Import Courses →]    │
└─────────────────────────────────────────────┘
```

### Check for Updates Dialog

```
┌─────────────────────────────────────────────┐
│ Course Updates Available                    │
├─────────────────────────────────────────────┤
│ 3 courses have updates from PADI            │
│                                             │
│ Open Water Diver              [View Changes]│
│ • Description updated                       │
│ • New image added                           │
│                                             │
│ Rescue Diver                  [View Changes]│
│ • Prerequisites clarified                   │
│                                             │
│ Divemaster                    [View Changes]│
│ • Duration changed: 5→7 days                │
│                                             │
│ [Dismiss]    [Update All]    [Review Each] │
└─────────────────────────────────────────────┘
```

### Side-by-Side Comparison

```
┌──────────────────────────────────────────────┐
│ Updates for: Rescue Diver                    │
├──────────────────────────────────────────────┤
│ Prerequisites                                │
│ Current: "Advanced OWD + First Aid"          │
│ Updated: "Advanced OWD + Emergency First     │
│           Response (within 24 months)"       │
│                                              │
│ Description                                  │
│ Current: "Learn to prevent and manage..."    │
│ Updated: "Learn to prevent, recognize and... │
│           [Show full text]"                  │
│                                              │
│ Duration                                     │
│ Current: 3 days                              │
│ Updated: 4 days                              │
│                                              │
│ Your Pricing (unchanged): $450               │
│ Your Status (unchanged): Active              │
│                                              │
│ [Skip]              [Accept Updates]         │
└──────────────────────────────────────────────┘
```

## Supported Agencies

### Current List (Extensible)

1. **PADI** - Professional Association of Diving Instructors
2. **SSI** - Scuba Schools International
3. **NAUI** - National Association of Underwater Instructors
4. **SDI/TDI** - Scuba Diving International / Technical Diving International
5. **GUE** - Global Underwater Explorers
6. **BSAC** - British Sub-Aqua Club
7. **CMAS** - World Underwater Federation
8. **RAID** - Rebreather Association of International Divers
9. **IANTD** - International Association of Nitrox and Technical Divers
10. **ANDI** - American Nitrox Divers International
11. **ACUC** - American Canadian Underwater Certifications
12. **IDEA** - International Diving Educators Association

**Plus:** Admin can add custom/regional agencies via UI

## Technical Implementation

### Content Hash Generation

```typescript
function generateContentHash(template: AgencyCourseTemplate): string {
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
    .reduce((acc, key) => ({ ...acc, [key]: agencyFields[key] }), {});

  return sha256(JSON.stringify(sorted));
}
```

### Smart Merge Function

```typescript
function mergeUpdates(
  tenantCourse: TrainingCourse,
  template: AgencyCourseTemplate
): Partial<TrainingCourse> {
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

### Data Validation Rules

```typescript
const validationRules = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 200,
  },
  code: {
    required: false,
    maxLength: 50,
  },
  durationDays: {
    min: 1,
    max: 365,
  },
  classroomHours: {
    min: 0,
    max: 1000,
  },
  minAge: {
    min: 0,
    max: 99,
  },
  images: {
    type: 'array',
    maxItems: 10,
    itemValidator: isValidUrl,
  },
  prerequisites: {
    maxLength: 2000,
  },
  description: {
    maxLength: 5000,
  },
};
```

## Error Handling

### API Failures

```typescript
try {
  const response = await fetch(apiEndpoint, {
    timeout: 10000,
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const courses = await response.json();
  await updateTemplates(courses, 'api');

} catch (error) {
  logger.warn(`API failed for ${agency.name}: ${error.message}`);
  logger.info(`Falling back to static JSON for ${agency.name}`);

  // Fallback to JSON
  const courses = await readJsonCatalog(agency.code);
  await updateTemplates(courses, 'static_json');
}
```

### Missing Data Sources

```typescript
if (!apiConfig && !jsonFileExists) {
  logger.error(`No data source available for ${agency.name}`);
  await notifyAdmin({
    subject: 'Missing Course Catalog Data',
    message: `Agency ${agency.name} has no API config or JSON file`,
    severity: 'warning',
  });
}
```

### Import Conflicts

```typescript
// Duplicate course codes within same agency
try {
  await db.insert(agencyCourseTemplates).values(template);
} catch (UniqueConstraintError) {
  // Update existing template instead
  await db.update(agencyCourseTemplates)
    .set(template)
    .where(and(
      eq(agencyCourseTemplates.agencyId, template.agencyId),
      eq(agencyCourseTemplates.code, template.code)
    ));
}
```

## Performance Optimizations

1. **Batch Imports** - Insert 50+ courses in single transaction
2. **Indexed Hash Lookups** - Fast comparison via `content_hash` index
3. **Lazy Image Loading** - Store URLs only, don't download during sync
4. **Pagination** - Import wizard shows 20 courses per page
5. **Background Processing** - Sync job runs off-peak (2 AM)

## File Structure

```
lib/
├── data/
│   └── catalogs/
│       ├── padi-courses.json
│       ├── ssi-courses.json
│       ├── naui-courses.json
│       ├── gue-courses.json
│       ├── sdi-tdi-courses.json
│       ├── bsac-courses.json
│       ├── cmas-courses.json
│       ├── raid-courses.json
│       ├── iantd-courses.json
│       └── ... (more agencies)
├── db/
│   ├── schema/
│   │   └── training.ts (updated with new fields)
│   └── training.server.ts (updated with template functions)
├── jobs/
│   └── sync-agency-catalogs.server.ts (new)
└── utils/
    └── content-hash.server.ts (new)

app/
└── routes/
    └── tenant/
        └── training/
            ├── import.tsx (new)
            ├── refresh.tsx (new)
            └── index.tsx (updated with refresh button)
```

## Migration Plan

### Phase 1: Schema & Infrastructure
1. Add `agency_course_templates` table
2. Add `templateId` and `templateHash` to `training_courses`
3. Create static JSON catalogs for top 5 agencies (PADI, SSI, NAUI, GUE, SDI/TDI)
4. Seed `agency_course_templates` from JSON files

### Phase 2: Import UI
1. Build import wizard (`/app/training/import`)
2. Add "Import from Agency" option to course creation dropdown
3. Implement bulk import with checkboxes
4. Add course configuration flow after import

### Phase 3: Refresh Mechanism
1. Add "Check for Updates" button to courses page
2. Build hash comparison logic
3. Create side-by-side comparison UI
4. Implement smart merge function

### Phase 4: Background Sync
1. Create sync job (`lib/jobs/sync-agency-catalogs.server.ts`)
2. Add job to cron schedule (nightly at 2 AM)
3. Implement API configs for agencies with APIs
4. Add admin notifications for sync errors

### Phase 5: Additional Agencies
1. Add remaining agencies to seed script
2. Create JSON catalogs for all 12+ agencies
3. Document API integration process
4. Build "Add Custom Agency" UI for admins

## Success Metrics

1. **Adoption** - % of new tenants who import vs manually enter courses
2. **Time Saved** - Average time to populate course catalog (target: <5 minutes)
3. **Data Quality** - % of courses with complete descriptions and images
4. **Currency** - % of tenants who refresh within 90 days of updates
5. **Coverage** - Number of agencies with active data sources

## Security Considerations

1. **API Keys** - Store in environment variables, never commit to git
2. **Rate Limiting** - Respect agency API rate limits (max 1 req/second)
3. **Data Validation** - Sanitize all imported content before storage
4. **Access Control** - Only org admins can import/refresh courses
5. **Audit Trail** - Log all imports and updates with timestamps

## Future Enhancements

1. **Auto-notify on updates** - Email tenants when course updates available
2. **Bulk pricing** - "Set all PADI courses to 10% discount"
3. **Course recommendations** - Suggest courses based on location/season
4. **Multi-agency search** - "Show me all wreck diving courses across agencies"
5. **API webhooks** - Real-time updates when agencies push changes
6. **Image optimization** - Auto-resize and compress imported images
7. **Translation support** - Multi-language course descriptions

---

**Status:** Design validated and ready for implementation.

**Next Steps:** Create implementation plan with detailed task breakdown.

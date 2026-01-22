# Agency Course Catalogs - Static JSON Source Data

## Purpose

These JSON files are **source data** for the training catalog import system. They provide a reliable fallback when agency APIs are unavailable and serve as the initial data source during system setup.

## Structure

Each `{agency-code}-courses.json` file contains:

```json
{
  "$schema": "../../schemas/agency-catalog.schema.json",
  "_comment": "Human-readable note about the file",
  "_note": "Detailed transformation notes",
  "agency": "padi",
  "agencyName": "Professional Association of Diving Instructors",
  "version": "2026.1",
  "lastUpdated": "2026-01-21",
  "courses": [ /* array of courses */ ]
}
```

## Course Object Structure

Each course object represents **agency-controlled** information only:

```json
{
  "name": "Open Water Diver",
  "code": "OWD",
  "levelCode": "beginner",
  "description": "Course description...",
  "images": ["https://..."],
  "durationDays": 3,
  "classroomHours": 8,
  "poolHours": 8,
  "openWaterDives": 4,
  "prerequisites": "Prior certification or null",
  "minAge": 10,
  "medicalRequirements": "Medical clearance details",
  "requiredItems": ["List of required equipment"],
  "materialsIncluded": true
}
```

## Data Transformation

The sync script (`lib/jobs/sync-agency-catalogs.server.ts`) transforms this source data into `agency_course_templates` database records:

### 1. Agency Lookup
```typescript
// Input: "padi" (from JSON)
// Output: UUID of agency from certification_agencies table
const agency = await db.query.certificationAgencies.findFirst({
  where: eq(certificationAgencies.code, 'padi')
});
const agencyId = agency.id;
```

### 2. Level Mapping
```typescript
// Input: "beginner" (levelCode from JSON)
// Output: UUID from certification_levels table
const levelMapping = {
  "beginner": "owd",        // Open Water Diver
  "advanced": "aowd",       // Advanced Open Water
  "professional": "dm",     // Divemaster
  "specialty": "specialty"  // Specialty Courses
};

const level = await db.query.certificationLevels.findFirst({
  where: and(
    eq(certificationLevels.agencyId, agencyId),
    eq(certificationLevels.code, levelMapping[course.levelCode])
  )
});
const levelId = level?.id || null;
```

### 3. Content Hash Generation
```typescript
// Generate SHA-256 hash of agency-controlled fields for change detection
const contentHash = generateContentHash({
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
  materialsIncluded: course.materialsIncluded
});
```

### 4. Database Record Creation
```typescript
await db.insert(agencyCourseTemplates).values({
  id: uuid(),
  agencyId: agencyId,
  levelId: levelId,

  // Agency-controlled fields (from JSON)
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

  // Tracking fields (added by sync script)
  contentHash: contentHash,
  sourceType: 'static_json',
  sourceUrl: null,
  lastSyncedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date()
});
```

## Level Code Mapping

Each agency uses standard level codes that map to certification levels:

| Level Code | Typical Level | Example Courses |
|------------|---------------|-----------------|
| `beginner` | Open Water Diver (OWD) | OWD, Scuba Diver |
| `advanced` | Advanced Open Water (AOWD) | AOWD, Rescue Diver |
| `professional` | Divemaster (DM) | DM, Assistant Instructor |
| `specialty` | Specialty Courses | Nitrox, Wreck, Deep |
| `instructor` | Instructor | OWSI, IDC, MSDT |

The sync script performs the lookup based on the agency and level code.

## Fields NOT in Source Data

The following fields are **tenant-specific** and NOT included in these JSON files:

- `organizationId` - Set when tenant imports
- `price`, `currency` - Tenant pricing
- `depositRequired`, `depositAmount` - Tenant payment terms
- `isActive`, `isPublic` - Tenant availability settings
- `sortOrder` - Tenant display order
- `minStudents`, `maxStudents` - Tenant capacity
- `equipmentIncluded`, `includedItems` - Tenant bundling

These fields are set to defaults when tenants import courses and can be customized per tenant.

## Maintenance

### Adding a New Course
1. Add course object to the `courses` array
2. Use standard `levelCode` values
3. Update `lastUpdated` timestamp
4. Validate JSON structure

### Updating Existing Course
1. Modify course fields
2. Update `lastUpdated` timestamp
3. Next sync will detect changes via content hash
4. Tenants will see "Update Available" notification

### Version Numbering
- Format: `YYYY.N` (e.g., `2026.1`, `2026.2`)
- Increment when courses are added/updated
- Track in version control (git) for audit trail

## Related Files

- **Schema**: `lib/db/schema/training.ts` - `agencyCourseTemplates` table definition
- **Sync Script**: `lib/jobs/sync-agency-catalogs.server.ts` - Transforms JSON → DB
- **Seed Script**: `lib/db/seeds/training-catalog.seed.ts` - Initial population
- **Import UI**: `app/routes/tenant/training/import.tsx` - Tenant import wizard
- **Validation**: `lib/utils/validate-catalog.server.ts` - JSON validation rules

## Validation

Before committing changes, validate the JSON:

```bash
npm run validate:catalogs
```

This checks:
- Valid JSON syntax
- Required fields present
- Field types correct
- levelCode values valid
- URLs accessible (images)
- Reasonable value ranges (hours, days, age)

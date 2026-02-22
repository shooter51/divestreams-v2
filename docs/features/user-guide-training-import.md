# Training Catalog Import System - User Guide

## Overview

The Training Catalog Import System allows dive shops to quickly populate their course catalog with pre-configured templates from certification agencies (PADI, SSI, etc.), saving time and ensuring accuracy.

## Current Status

**Phase 1 Complete (Currently Deployed to Staging):**
- ✅ Database schema for agency templates
- ✅ PADI course catalog (5 courses)
- ✅ Template management functions
- ✅ Import UI interface
- ✅ Template merge system (updates tenant courses when agency templates change)

**Phase 2 (Planned):**
- ⏳ Full import workflow (select and import courses)
- ⏳ Additional agencies (SSI, NAUI, etc.)
- ⏳ Bulk import functionality

## How to Use (Current Implementation)

### Step 1: Set Up Agency and Certification Levels

Before importing templates, you need:

1. **Create Certification Agency** (PADI, SSI, etc.)
   - Navigate to: `/app/training/agencies`
   - Click "Add Agency"
   - Enter: Name = "PADI", Code = "padi"
   - Save

2. **Create Certification Levels**
   - Navigate to: `/app/training/levels`
   - Create these levels with codes:
     - `beginner` - Beginner
     - `advanced` - Advanced
     - `professional` - Professional
     - `specialty` - Specialty

### Step 2: Seed PADI Templates

Run the seed script to load PADI course templates:

```bash
npx tsx scripts/seed-agency-templates.ts
```

**What this does:**
- Loads 5 PADI courses from `lib/data/catalogs/padi-courses.json`:
  - OWD - Open Water Diver (Beginner)
  - AOWD - Advanced Open Water Diver (Advanced)
  - RD - Rescue Diver (Professional)
  - DM - Divemaster (Professional)
  - EAN - Enriched Air Nitrox (Specialty)
- Stores them in `agency_course_templates` table
- Generates content hashes for version tracking

**Expected Output:**
```
Loading PADI catalog...
Found 5 courses in catalog
PADI agency found: PADI (abc123...)
Loaded 4 certification levels
Importing: Open Water Diver (OWD)
Importing: Advanced Open Water Diver (AOWD)
Importing: Rescue Diver (RD)
Importing: Divemaster (DM)
Importing: Enriched Air (Nitrox) Diver (EAN)
✅ Successfully imported 5 PADI course templates
```

### Step 3: Access Import UI

1. Login as a tenant administrator
2. Navigate to: **`/app/training/import`**
3. You'll see:
   - Page heading: "Import Training Courses"
   - Agency dropdown (will show "PADI" if created)
   - "Next: Select Courses" button

**Note:** The import workflow is currently a UI skeleton. The "Next" button doesn't yet import courses automatically.

### Step 4: Manually Create Course from Template (Current Workaround)

Until the full import workflow is implemented, manually create courses based on templates:

1. Navigate to: `/app/training/courses/new`
2. Fill in form with template data:
   - **From template:** Name, Description, Duration, Hours, Prerequisites, etc.
   - **Tenant-specific:** Price, Max Students, Active status, Custom images
3. Link to template (optional):
   - Set `templateId` field to the agency template ID
   - Set `templateHash` to track version
4. Save course

### Step 5: Update Courses When Templates Change

When PADI updates course requirements:

1. Update the template in database or re-run seed script
2. Run merge function to update all tenant courses:

```bash
npx tsx scripts/merge-template-updates.ts
```

**What this does:**
- Finds all courses linked to templates
- Updates agency-controlled fields (description, hours, prerequisites, etc.)
- Preserves tenant-controlled fields (price, max students, active status)
- Updates `templateHash` to track sync status

## Template Data Structure

Each PADI course template includes:

### Agency-Controlled Fields (Updated by Templates)
- `name` - Course name
- `code` - Course code (e.g., "OWD")
- `description` - Course description
- `durationDays` - Standard course duration
- `classroomHours` - Classroom/eLearning hours
- `poolHours` - Confined water hours
- `openWaterDives` - Number of open water dives
- `prerequisites` - Required certifications
- `minAge` - Minimum student age
- `medicalRequirements` - Medical clearance requirements
- `requiredItems` - Student equipment requirements
- `materialsIncluded` - Whether materials are included

### Tenant-Controlled Fields (Never Overwritten)
- `price` - Course pricing
- `maxStudents` - Class size limit
- `isActive` - Whether course is offered
- `images` - Custom course photos
- `instructorNotes` - Shop-specific notes

## Example: PADI Open Water Diver Template

```json
{
  "name": "Open Water Diver",
  "code": "OWD",
  "levelCode": "beginner",
  "description": "The PADI Open Water Diver course is the world's most popular scuba course...",
  "images": [
    "https://www.padi.com/sites/default/files/courses-owd.jpg"
  ],
  "durationDays": 3,
  "classroomHours": 6,
  "poolHours": 8,
  "openWaterDives": 4,
  "prerequisites": null,
  "minAge": 10,
  "medicalRequirements": "PADI Medical Statement required",
  "requiredItems": [
    "Mask, snorkel, fins",
    "Dive computer or tables",
    "Log book"
  ],
  "materialsIncluded": true
}
```

## Database Schema

### `agency_course_templates`
Stores official course templates from certification agencies.

**Key Fields:**
- `id` - Template UUID
- `agencyId` - Links to certification agency
- `levelId` - Links to certification level
- `code` - Agency course code (e.g., "OWD")
- `contentHash` - SHA-256 hash for change detection
- `sourceType` - "static_json", "api", or "manual"
- `sourceUrl` - Source for updates (if applicable)

### `training_courses`
Your tenant's actual course offerings.

**Template Linking Fields:**
- `templateId` - Links to agency template (optional)
- `templateHash` - Hash at last sync
- When `templateHash` differs from template's `contentHash`, course needs update

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ 1. Admin Creates Agency + Levels                         │
│    (One-time setup)                                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Seed Templates from Agency Catalog                    │
│    $ npx tsx scripts/seed-agency-templates.ts           │
│    Loads: PADI OWD, AOWD, RD, DM, EAN                   │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Import Templates to Tenant Courses                    │
│    Navigate to: /app/training/import                     │
│    (Currently: Manual creation with template data)       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Customize for Your Shop                               │
│    Set: Pricing, Max Students, Schedule, Images         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Templates Update? Auto-Merge Changes                  │
│    $ npx tsx scripts/merge-template-updates.ts          │
│    Preserves: Price, Max Students, Active Status        │
│    Updates: Description, Hours, Prerequisites           │
└─────────────────────────────────────────────────────────┘
```

## Common Use Cases

### Use Case 1: New Dive Shop Setup
1. Create PADI agency and certification levels
2. Seed PADI templates
3. Manually create courses based on templates
4. Customize pricing and schedules
5. Activate courses for booking

### Use Case 2: Agency Updates Course Requirements
1. PADI releases new standards (e.g., OWD now requires 5 dives)
2. Update template in database or re-seed
3. Run merge script
4. All tenant OWD courses get 5 dives requirement
5. Pricing and schedules remain unchanged

### Use Case 3: Multi-Agency Shop
1. Create PADI agency, seed PADI templates
2. Create SSI agency, seed SSI templates
3. Courses show both PADI OWD and SSI OWD
4. Students can choose certification path

## Advanced Features

### Content Hash Tracking

Every template has a `contentHash` (SHA-256) that changes when ANY field updates:

```typescript
const contentHash = generateContentHash({
  name: "Open Water Diver",
  description: "...",
  durationDays: 3,
  // ... all agency-controlled fields
});
```

**Why it matters:**
- Detects template changes automatically
- Prevents unnecessary updates
- Tracks sync status per course

### Template Merge Logic

When merging template updates:

```typescript
// Updates ONLY agency-controlled fields
UPDATE training_courses SET
  description = template.description,
  durationDays = template.durationDays,
  classroomHours = template.classroomHours,
  openWaterDives = template.openWaterDives,
  prerequisites = template.prerequisites,
  // ... other agency fields
  templateHash = template.contentHash
WHERE
  templateId = template.id
  AND (templateHash IS NULL OR templateHash != template.contentHash)

// NEVER touches tenant fields:
// - price
// - maxStudents
// - isActive
// - images
// - instructorNotes
```

## API Endpoints

### Get Available Agencies
```typescript
GET /app/training/import

Returns: { agencies: Agency[] }
```

### Import from Template (Planned)
```typescript
POST /app/training/import
Body: {
  agencyId: string,
  templateIds: string[]
}

Returns: {
  imported: number,
  courses: Course[]
}
```

## Troubleshooting

### "PADI agency not found" Error
**Problem:** Running seed script before creating PADI agency.

**Solution:**
1. Create agency first: Name="PADI", Code="padi"
2. Then run seed script

### Import UI Shows "No Agencies"
**Problem:** Agency dropdown is empty.

**Solution:**
- Verify agency exists: `SELECT * FROM certification_agencies WHERE code = 'padi'`
- Check organization ID matches tenant

### Templates Not Updating
**Problem:** Re-seeding doesn't update existing templates.

**Solution:**
- Seed script uses `upsertAgencyCourseTemplate` (INSERT or UPDATE based on agencyId + code)
- Check template code matches exactly (case-sensitive)

## Coming Soon

### Phase 2 Features
- ✨ Full import workflow (select courses from template list)
- ✨ Bulk import (import all agency courses at once)
- ✨ Import preview (see what will be imported before confirming)
- ✨ SSI, NAUI, SDI course catalogs
- ✨ Custom template creation (for shop-specific courses)
- ✨ Template versioning and rollback

## Support

For questions or issues:
- Check E2E tests: `tests/e2e/workflow/training-import.spec.ts`
- Check integration tests: `tests/integration/lib/db/training-templates.test.ts`
- Review implementation: `lib/db/training-templates.server.ts`

## Related Documentation
- [Training Catalog Import Design](./plans/2026-01-21-training-catalog-import-design.md)
- [Implementation Plan](./plans/2026-01-21-training-catalog-import-implementation.md)
- [PADI Course Catalog](../lib/data/catalogs/padi-courses.json)

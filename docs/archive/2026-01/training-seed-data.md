# Training Data Seed Script (DIVE-8bl)

## Overview

Comprehensive seed script that populates training certification data for dive shops. This creates the foundation for managing dive training courses, certifications, and student progression.

## What Gets Seeded

### 1. Certification Agencies (7 total)
- **PADI** - Professional Association of Diving Instructors
- **SSI** - Scuba Schools International
- **NAUI** - National Association of Underwater Instructors
- **SDI/TDI** - Scuba Diving International / Technical Diving International
- **CMAS** - World Underwater Federation
- **BSAC** - British Sub-Aqua Club
- **GUE** - Global Underwater Explorers

### 2. Certification Levels (23 total)

#### Beginner (3 levels)
- Discover Scuba Diving (Level 1)
- Scuba Diver (Level 2)
- Open Water Diver (Level 3)

#### Intermediate (2 levels)
- Advanced Open Water (Level 4)
- Rescue Diver (Level 5)

#### Professional (3 levels)
- Divemaster (Level 6)
- Assistant Instructor (Level 7)
- Open Water Scuba Instructor (Level 8)

#### Specialties (7 specialties)
- Deep Diver
- Wreck Diver
- Night Diver
- Enriched Air (Nitrox)
- Underwater Navigator
- Peak Performance Buoyancy
- Search and Recovery

#### Technical (4 levels)
- Tec 40 (Level 7)
- Tec 45 (Level 8)
- Tec 50 (Level 9)
- Trimix Diver (Level 10)

### 3. Training Courses (23 total)

Each course includes:
- **Pricing**: Realistic USD pricing from $99 to $1,799
- **Duration**: 1-14 days depending on complexity
- **Training Components**:
  - Classroom hours (theory)
  - Pool hours (confined water)
  - Open water dives (certification dives)
- **Prerequisites**: Proper prerequisite chains
- **Requirements**:
  - Minimum age requirements
  - Required equipment lists
  - Included items (materials, equipment rental)
  - Medical clearance requirements
- **Capacity**: Min/max student ratios
- **Deposits**: Required deposits for advanced courses

## Prerequisite Chains

The seed data includes proper prerequisite validation:

```
Discover Scuba (no prereqs)
    ↓
Open Water Diver
    ↓
Advanced Open Water ←─────┐
    ↓                     │
Rescue Diver              │ (Specialties branch)
    ↓                     │
Divemaster                │
    ↓                     │
Instructor                │
                          │
    Nitrox ←──────────────┘
    Deep Diver
    Wreck Diver
    Night Diver
    Navigation
    etc.
```

### Technical Path

```
Open Water + Advanced + Nitrox + 30 dives
    ↓
Tec 40
    ↓
Tec 45 (50 dives)
    ↓
Tec 50 (100 dives)
    ↓
Trimix (150 dives)
```

## Usage

### Seed a Specific Organization

Using subdomain:
```bash
npm run seed:training -- --subdomain=demo
```

Using organization ID:
```bash
npm run seed:training -- --org-id=550e8400-e29b-41d4-a716-446655440000
```

### In Production

After deploying to VPS:
```bash
# SSH into VPS
ssh root@72.62.166.128  # Production
# or
ssh root@76.13.28.28    # Staging

# Navigate to project
cd /docker/divestreams-v2  # Production
# or
cd /docker/divestreams-staging  # Staging

# Run seed inside container
docker compose exec app npm run seed:training -- --subdomain=your-tenant
```

## Duplicate Protection

The script checks if training data already exists for an organization:
- If agencies exist, the script exits gracefully
- Prevents duplicate data on re-runs
- Safe to run multiple times

## What Happens After Seeding

Once seeded, organizations can:

1. **View Courses**: Navigate to `/training` to see all available courses
2. **Schedule Sessions**: Create training sessions for specific dates
3. **Enroll Students**: Sign up customers for upcoming sessions
4. **Track Progress**: Monitor student completion and certifications
5. **Customize**: Modify pricing, add new courses, or adjust prerequisites
6. **Issue Certifications**: Generate certification cards upon completion

## Database Schema

### Tables Populated

1. **certification_agencies**
   - Agency details (name, code, website, logo)
   - Organization-specific agency list

2. **certification_levels**
   - Level hierarchy (beginner → professional → technical)
   - Prerequisites and requirements
   - Age and dive count minimums

3. **training_courses**
   - Full course details
   - Pricing and deposits
   - Equipment and materials lists
   - Training time breakdown
   - Public visibility settings

## Course Pricing Reference

| Course Level | Example | Price Range |
|--------------|---------|-------------|
| Discovery | Discover Scuba | $99 |
| Entry Level | Open Water | $299-$449 |
| Intermediate | Advanced/Rescue | $399-$499 |
| Specialty | Deep/Wreck/Night | $249-$369 |
| Professional | Divemaster | $1,299 |
| Technical | Tec 40-50 | $899-$1,499 |
| Advanced Tech | Trimix | $1,799 |

## Customization

After seeding, dive shops can:

- Adjust pricing for local market
- Add agency-specific branding
- Create custom specialty courses
- Set location-specific requirements
- Add seasonal pricing
- Configure instructor assignments

## Validation Features

- **Age Requirements**: Each course has minimum age (10-18)
- **Dive Count**: Tracks minimum logged dives needed
- **Medical Clearance**: Notes when physician approval required
- **Equipment Checks**: Lists required personal equipment
- **Prerequisite Validation**: Enforced certification chains

## Example Data

### Sample Course: Open Water Diver

```json
{
  "name": "Open Water Diver Certification",
  "code": "OWD",
  "price": "$449.00",
  "duration": "3 days",
  "classroomHours": 8,
  "poolHours": 8,
  "openWaterDives": 4,
  "includedItems": [
    "PADI eLearning or manual",
    "Confined water training (pool)",
    "4 open water training dives",
    "Full equipment rental",
    "Digital certification card",
    "Logbook"
  ],
  "prerequisites": "Adequate swimming skills",
  "minAge": 10,
  "depositRequired": true,
  "depositAmount": "$150.00"
}
```

### Sample Course: Tec 50

```json
{
  "name": "Tec 50 - Full Technical Diver",
  "code": "TEC50",
  "price": "$1,499.00",
  "duration": "6 days",
  "classroomHours": 24,
  "poolHours": 12,
  "openWaterDives": 10,
  "prerequisites": "Tec 45, 100+ dives including 25 decompression dives",
  "minAge": 18,
  "minDives": 100,
  "medicalRequirements": "Physician examination - advanced technical diving fitness"
}
```

## Testing

To verify the seed worked correctly:

```bash
# Check agencies
psql $DATABASE_URL -c "SELECT code, name FROM certification_agencies WHERE organization_id = 'YOUR_ORG_ID';"

# Check levels
psql $DATABASE_URL -c "SELECT code, name, level_number FROM certification_levels WHERE organization_id = 'YOUR_ORG_ID' ORDER BY level_number;"

# Check courses
psql $DATABASE_URL -c "SELECT name, price, duration_days FROM training_courses WHERE organization_id = 'YOUR_ORG_ID' ORDER BY sort_order;"

# Count totals
psql $DATABASE_URL -c "
SELECT
  (SELECT COUNT(*) FROM certification_agencies WHERE organization_id = 'YOUR_ORG_ID') as agencies,
  (SELECT COUNT(*) FROM certification_levels WHERE organization_id = 'YOUR_ORG_ID') as levels,
  (SELECT COUNT(*) FROM training_courses WHERE organization_id = 'YOUR_ORG_ID') as courses;
"
```

Expected counts:
- 7 agencies
- 23 certification levels
- 23 training courses

## Troubleshooting

### "Organization not found"
- Verify the organization exists: `SELECT id, slug FROM organization;`
- Check spelling of subdomain
- Ensure organization was created successfully

### "Training data already exists"
- This is normal if seed was run before
- Data is not duplicated
- To re-seed, manually delete existing data first

### Database connection errors
- Verify `DATABASE_URL` environment variable
- Check PostgreSQL is running
- Ensure organization exists in public schema

## Future Enhancements

Potential additions to seed data:
- Multi-agency certification equivalencies
- Course bundles and packages
- Seasonal pricing variations
- Instructor qualifications required
- Certification card templates
- Insurance requirements
- Equipment rental pricing

## Related Documentation

- [Training Module Overview](./training-module.md)
- [Database Schema](./database-schema.md)
- [Tenant Setup Guide](./tenant-setup.md)

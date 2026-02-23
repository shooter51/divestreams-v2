# Migration 0028: Fix Rentable Equipment Without Rental Prices

**Date:** 2026-01-29
**Issue:** KAN-648 Follow-Up
**Type:** Data Cleanup Migration

## Purpose

This migration fixes existing equipment records that are marked as rentable (`is_rentable = true`) but have no rental price or a price of $0. This data inconsistency was allowed before validation was added in KAN-648.

## Problem

Before the KAN-648 fix:
- Database allowed equipment to be marked as rentable without a rental price
- Frontend compensated with `.filter()` calls to hide invalid items
- Backend validation was added in KAN-648 to prevent new invalid records
- **Existing invalid records need cleanup**

## Impact of NOT Running This Migration

- Equipment marked as rentable but with no price won't appear in POS
- Users may be confused why some rentable equipment is hidden
- Data inconsistency between database state and UI behavior

## What This Migration Does

```sql
UPDATE equipment
SET is_rentable = false,
    updated_at = NOW()
WHERE is_rentable = true
  AND (rental_price IS NULL OR rental_price <= 0);
```

**Effect:** Equipment without valid rental prices will be marked as not rentable.

## When to Run

This migration should be run:
1. **Automatically** - Already included in `drizzle/0028_fix_rentable_equipment_without_price.sql`
2. **Manually** - If you have existing production data that needs cleanup

## How to Run Manually

### Via Docker (Production/Staging)

```bash
# SSH into VPS
ssh root@76.13.28.28  # staging
# or
ssh root@72.62.166.128  # production

# Run migration via docker exec
docker exec -i divestreams-db psql -U divestreams -d divestreams < /path/to/migration.sql
```

### Via Local Database

```bash
# If you have local PostgreSQL
psql -U divestreams -d divestreams -f drizzle/0028_fix_rentable_equipment_without_price.sql
```

### Via Node Script

```bash
# Create a one-off script
node -e "
const { db } = require('./lib/db');
const { equipment } = require('./lib/db/schema');
const { sql } = require('drizzle-orm');

(async () => {
  const result = await db.execute(sql\`
    UPDATE equipment
    SET is_rentable = false, updated_at = NOW()
    WHERE is_rentable = true
      AND (rental_price IS NULL OR rental_price <= 0)
    RETURNING id, name
  \`);
  console.log('Fixed', result.rows.length, 'equipment records');
})();
"
```

## Verification

After running the migration, verify:

```sql
-- Check for any remaining invalid records
SELECT id, name, is_rentable, rental_price
FROM equipment
WHERE is_rentable = true
  AND (rental_price IS NULL OR rental_price <= 0);
-- Should return 0 rows

-- Check total rentable equipment (should all have valid prices)
SELECT COUNT(*) as total_rentable,
       MIN(rental_price) as min_price,
       MAX(rental_price) as max_price
FROM equipment
WHERE is_rentable = true;
```

## Rollback

If you need to rollback (restore rentable status):

```sql
-- This is NOT recommended unless you have a specific backup
-- You would need to identify which equipment SHOULD be rentable

-- Example: Mark all equipment with "rental" in notes as rentable
UPDATE equipment
SET is_rentable = true
WHERE notes ILIKE '%rental%'
  AND rental_price > 0;
```

**Note:** There is no perfect rollback. If you accidentally run this migration, you'll need to manually review and restore the rentable status for affected equipment.

## Prevention

Going forward, invalid records are prevented by:
1. **Backend validation** (KAN-648) - `equipmentSchema.refine()` requires rental_price when is_rentable=true
2. **UI validation** - Both create and edit forms show clear requirements
3. **This migration** - Cleans up existing inconsistent data

## Testing

1. Check equipment marked as not rentable after migration
2. Verify these items no longer appear in POS rental section
3. Confirm items with valid rental prices still appear correctly

## Related Issues

- **KAN-648** - Retail and rentals not showing up in POS (original bug)
- **KAN-633** - POS rentals/trips not adding to cart (related validation fix)
- **Peer Review 2026-01-29** - Recommended this data migration

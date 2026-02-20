-- Migration: Fix rentable equipment without rental prices (KAN-648)
-- This addresses data consistency issue discovered in peer review
--
-- Problem: Equipment marked as is_rentable=true but rental_price is NULL or <= 0
-- causes items to not appear in POS rental section, confusing users.
--
-- Root Cause: Database allowed is_rentable=true without requiring rental_price.
-- Frontend was compensating with .filter() calls (fixed in KAN-633).
-- Backend validation added (KAN-648) but existing data needs cleanup.
--
-- Solution: Set is_rentable=false for equipment with invalid rental prices.
-- This makes the data consistent with new validation rules.

-- Update equipment records that are marked rentable but have no valid price
UPDATE equipment
SET is_rentable = false,
    updated_at = NOW()
WHERE is_rentable = true
  AND (rental_price IS NULL OR rental_price <= 0);

-- Log the results
DO $$
DECLARE
  updated_count INTEGER;
  total_rentable INTEGER;
BEGIN
  -- Count how many were fixed
  SELECT COUNT(*) INTO updated_count
  FROM equipment
  WHERE is_rentable = false
    AND updated_at >= NOW() - INTERVAL '5 seconds';

  -- Count total rentable equipment (should all have valid prices now)
  SELECT COUNT(*) INTO total_rentable
  FROM equipment
  WHERE is_rentable = true;

  RAISE NOTICE 'Fixed % equipment records (set is_rentable=false due to missing/invalid rental price)', updated_count;
  RAISE NOTICE 'Remaining rentable equipment: % (all with valid prices)', total_rentable;

  -- Verify no invalid records remain
  IF EXISTS (
    SELECT 1 FROM equipment
    WHERE is_rentable = true
      AND (rental_price IS NULL OR rental_price <= 0)
  ) THEN
    RAISE WARNING 'Some rentable equipment still has invalid prices - migration may need to run again';
  ELSE
    RAISE NOTICE 'Data integrity check passed: all rentable equipment has valid prices';
  END IF;
END $$;

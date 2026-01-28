-- Migration: Add unique constraint on organization.name
-- This fixes KAN-600: Duplicate organization names can be created
--
-- Problem: Organization table only has unique constraint on slug, not name.
-- Application-level check exists but can be bypassed by race conditions or direct DB access.
--
-- Solution:
-- 1. Clean up any existing duplicate names (rename with suffix)
-- 2. Add database-level unique constraint on organization name.

-- Step 1: Clean up existing duplicate organization names
DO $$
DECLARE
    org_record RECORD;
    suffix INTEGER;
    new_name TEXT;
BEGIN
    -- Find all duplicate organization names
    FOR org_record IN
        SELECT name, array_agg(id ORDER BY created_at) as org_ids
        FROM organization
        GROUP BY name
        HAVING COUNT(*) > 1
    LOOP
        RAISE NOTICE 'Found % duplicates for organization name: "%"',
            array_length(org_record.org_ids, 1),
            org_record.name;

        -- Keep the first (oldest) organization with original name
        -- Rename the rest by appending a number
        suffix := 2;

        -- Loop through duplicate IDs (skip first one)
        FOR i IN 2..array_length(org_record.org_ids, 1) LOOP
            new_name := org_record.name || ' (' || suffix || ')';

            -- Make sure the new name doesn't already exist
            WHILE EXISTS (SELECT 1 FROM organization WHERE name = new_name) LOOP
                suffix := suffix + 1;
                new_name := org_record.name || ' (' || suffix || ')';
            END LOOP;

            -- Update the organization name
            UPDATE organization
            SET name = new_name
            WHERE id = org_record.org_ids[i];

            RAISE NOTICE 'Renamed duplicate: "%" (ID: %) -> "%"',
                org_record.name,
                org_record.org_ids[i],
                new_name;

            suffix := suffix + 1;
        END LOOP;
    END LOOP;

    IF NOT FOUND THEN
        RAISE NOTICE 'No duplicate organization names found';
    END IF;
END $$;

-- Step 2: Add unique constraint on organization name (safe now that duplicates are cleaned)
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'organization_name_unique'
    ) THEN
        ALTER TABLE organization
        ADD CONSTRAINT organization_name_unique UNIQUE (name);

        RAISE NOTICE 'Added unique constraint: organization_name_unique';
    ELSE
        RAISE NOTICE 'Constraint organization_name_unique already exists, skipping';
    END IF;
END $$;

-- Step 3: Create index for faster name lookups (idempotent)
CREATE INDEX IF NOT EXISTS organization_name_idx ON organization(name);

-- Migration: Add sale pricing fields to products table
-- This fixes KAN-618: Error 500 when adding a new product
--
-- Problem: Products table schema was updated to include sale_price, sale_start_date, sale_end_date
-- but existing tenant databases don't have these columns, causing 500 errors.
--
-- Solution: Add sale pricing columns to all tenant products tables.

-- This migration needs to run on EACH tenant schema
-- The Docker entrypoint script handles this by checking for the existence of these columns

DO $$
DECLARE
    tenant_schema text;
BEGIN
    -- Loop through all tenant schemas (tenant_*)
    FOR tenant_schema IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name LIKE 'tenant_%'
    LOOP
        -- Check if sale_price column exists
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = tenant_schema
            AND table_name = 'products'
            AND column_name = 'sale_price'
        ) THEN
            -- Add sale pricing columns
            EXECUTE format('ALTER TABLE %I.products ADD COLUMN sale_price DECIMAL(10, 2)', tenant_schema);
            EXECUTE format('ALTER TABLE %I.products ADD COLUMN sale_start_date TIMESTAMP', tenant_schema);
            EXECUTE format('ALTER TABLE %I.products ADD COLUMN sale_end_date TIMESTAMP', tenant_schema);

            RAISE NOTICE 'Added sale pricing columns to %.products', tenant_schema;
        END IF;
    END LOOP;
END $$;

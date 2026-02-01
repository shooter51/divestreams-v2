-- Migration: Add rentals table to all tenant schemas
-- This table tracks equipment rentals for the POS system
-- Run this against the production database

DO $$
DECLARE
    tenant_record RECORD;
    schema_name TEXT;
BEGIN
    -- Loop through all tenant schemas
    FOR tenant_record IN
        SELECT subdomain FROM public.tenants WHERE subdomain IS NOT NULL
    LOOP
        schema_name := 'tenant_' || tenant_record.subdomain;

        -- Check if schema exists
        IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = schema_name) THEN
            -- Check if rentals table already exists
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = schema_name AND table_name = 'rentals'
            ) THEN
                RAISE NOTICE 'Creating rentals table in schema: %', schema_name;

                -- Create rentals table
                EXECUTE format('
                    CREATE TABLE %I.rentals (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        transaction_id UUID REFERENCES %I.transactions(id),
                        customer_id UUID NOT NULL REFERENCES %I.customers(id),
                        equipment_id UUID NOT NULL REFERENCES %I.equipment(id),

                        rented_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        due_at TIMESTAMP NOT NULL,
                        returned_at TIMESTAMP,

                        daily_rate DECIMAL(10, 2) NOT NULL,
                        total_charge DECIMAL(10, 2) NOT NULL,

                        status TEXT NOT NULL DEFAULT 'active',

                        agreement_number TEXT NOT NULL,
                        agreement_signed_at TIMESTAMP,
                        agreement_signed_by TEXT,

                        notes TEXT,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )', schema_name, schema_name, schema_name, schema_name);

                -- Create indexes
                EXECUTE format('CREATE INDEX rentals_customer_idx ON %I.rentals(customer_id)', schema_name);
                EXECUTE format('CREATE INDEX rentals_equipment_idx ON %I.rentals(equipment_id)', schema_name);
                EXECUTE format('CREATE INDEX rentals_status_idx ON %I.rentals(status)', schema_name);

                RAISE NOTICE 'Created rentals table in schema: %', schema_name;
            ELSE
                RAISE NOTICE 'Rentals table already exists in schema: %', schema_name;
            END IF;
        ELSE
            RAISE NOTICE 'Schema does not exist: %', schema_name;
        END IF;
    END LOOP;
END $$;

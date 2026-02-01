-- Migration: Add rentals table to tenant schemas
-- This table was incorrectly created in PUBLIC schema in 0001_bright_silverclaw.sql
-- It needs to exist in each tenant schema for multi-tenant isolation

-- Note: This migration will be run by the container entrypoint script
-- which executes all .sql files in lexicographic order

DO $$
DECLARE
  tenant_schema text;
BEGIN
  -- Loop through all tenant schemas
  FOR tenant_schema IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'tenant_%'
  LOOP
    -- Create rentals table in this tenant schema
    EXECUTE format($fmt$
      CREATE TABLE IF NOT EXISTS %I.rentals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        organization_id text NOT NULL,
        transaction_id uuid,
        customer_id uuid NOT NULL,
        equipment_id uuid NOT NULL,
        rented_at timestamp DEFAULT now() NOT NULL,
        due_at timestamp NOT NULL,
        returned_at timestamp,
        daily_rate numeric(10, 2) NOT NULL,
        total_charge numeric(10, 2) NOT NULL,
        status text DEFAULT 'active' NOT NULL,
        agreement_number text NOT NULL,
        agreement_signed_at timestamp,
        agreement_signed_by text,
        notes text,
        created_at timestamp DEFAULT now() NOT NULL,

        -- Foreign keys (reference tables in same tenant schema)
        CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE,
        CONSTRAINT %I FOREIGN KEY (transaction_id) REFERENCES %I.transactions(id) ON DELETE NO ACTION,
        CONSTRAINT %I FOREIGN KEY (customer_id) REFERENCES %I.customers(id) ON DELETE NO ACTION,
        CONSTRAINT %I FOREIGN KEY (equipment_id) REFERENCES %I.equipment(id) ON DELETE NO ACTION
      )$fmt$,
      tenant_schema,
      tenant_schema || '_rentals_org_fk',
      tenant_schema || '_rentals_trans_fk',
      tenant_schema,
      tenant_schema || '_rentals_cust_fk',
      tenant_schema,
      tenant_schema || '_rentals_equip_fk',
      tenant_schema
    );

    -- Create indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.rentals (organization_id)',
      tenant_schema || '_rentals_org_idx', tenant_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.rentals (organization_id, customer_id)',
      tenant_schema || '_rentals_org_customer_idx', tenant_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.rentals (organization_id, equipment_id)',
      tenant_schema || '_rentals_org_equipment_idx', tenant_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.rentals (organization_id, status)',
      tenant_schema || '_rentals_org_status_idx', tenant_schema);

    RAISE NOTICE 'Created rentals table in schema: %', tenant_schema;
  END LOOP;
END $$;

-- Migration: Add password_hash column and password_reset_tokens table
-- Run this for each existing tenant schema

-- Add password_hash column if not exists
DO $$
DECLARE
  schema_record RECORD;
BEGIN
  FOR schema_record IN
    SELECT schema_name FROM public.tenants WHERE is_active = true
  LOOP
    -- Add password_hash column to users table
    EXECUTE format('
      ALTER TABLE %I.users
      ADD COLUMN IF NOT EXISTS password_hash TEXT
    ', schema_record.schema_name);

    -- Create password_reset_tokens table
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    ', schema_record.schema_name, schema_record.schema_name);

    RAISE NOTICE 'Updated schema: %', schema_record.schema_name;
  END LOOP;
END $$;

-- Migration: Add Row-Level Security (RLS) policies for multi-tenant isolation
-- Purpose: Defense-in-depth to prevent cross-tenant data access at the database level
--
-- How it works:
--   1. A PostgreSQL function current_org_id() reads the session variable app.current_org_id
--   2. Each table with organization_id gets an RLS policy that either:
--      a. Allows access when the org context matches the row's organization_id
--      b. Allows access when NO org context is set (NULL) - this is the bypass
--
-- The NULL bypass is critical because:
--   - Database migrations run without org context
--   - Admin/superuser queries run without org context
--   - Background workers and seed scripts run without org context
--
-- IMPORTANT: We do NOT use FORCE ROW LEVEL SECURITY, so the table owner
-- (the database user that owns the tables) is never blocked by RLS.
-- RLS only applies to non-owner users. The bypass (IS NULL) provides
-- additional safety for any connection that hasn't set the context.
--
-- This migration is idempotent - safe to re-run.

-- ============================================================================
-- STEP 1: Create helper function for reading the org context
-- ============================================================================

CREATE OR REPLACE FUNCTION current_org_id() RETURNS TEXT AS $$
  SELECT current_setting('app.current_org_id', true);
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- STEP 2: Enable RLS and create policies on all tables with organization_id
-- ============================================================================

-- Note: ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent (safe to re-run).
-- CREATE POLICY uses DO blocks with existence checks for idempotency.

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON customers
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- boats
-- ---------------------------------------------------------------------------
ALTER TABLE boats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'boats' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON boats
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- dive_sites
-- ---------------------------------------------------------------------------
ALTER TABLE dive_sites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dive_sites' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON dive_sites
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- tours
-- ---------------------------------------------------------------------------
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tours' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON tours
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- tour_dive_sites
-- ---------------------------------------------------------------------------
ALTER TABLE tour_dive_sites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tour_dive_sites' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON tour_dive_sites
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trips' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON trips
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON bookings
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- equipment
-- ---------------------------------------------------------------------------
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'equipment' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON equipment
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON transactions
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- rentals
-- ---------------------------------------------------------------------------
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rentals' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON rentals
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON products
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- discount_codes
-- ---------------------------------------------------------------------------
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'discount_codes' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON discount_codes
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- customer_communications
-- ---------------------------------------------------------------------------
ALTER TABLE customer_communications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customer_communications' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON customer_communications
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- images
-- ---------------------------------------------------------------------------
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'images' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON images
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- organization_settings
-- ---------------------------------------------------------------------------
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'organization_settings' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON organization_settings
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- maintenance_logs
-- ---------------------------------------------------------------------------
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_logs' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON maintenance_logs
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- service_records
-- ---------------------------------------------------------------------------
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_records' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON service_records
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- gallery_albums
-- ---------------------------------------------------------------------------
ALTER TABLE gallery_albums ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gallery_albums' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON gallery_albums
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- gallery_images
-- ---------------------------------------------------------------------------
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gallery_images' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON gallery_images
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- page_content
-- ---------------------------------------------------------------------------
ALTER TABLE page_content ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'page_content' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON page_content
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- page_content_history
-- ---------------------------------------------------------------------------
ALTER TABLE page_content_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'page_content_history' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON page_content_history
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- customer_credentials
-- ---------------------------------------------------------------------------
ALTER TABLE customer_credentials ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customer_credentials' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON customer_credentials
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- customer_sessions
-- ---------------------------------------------------------------------------
ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customer_sessions' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON customer_sessions
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- contact_messages
-- ---------------------------------------------------------------------------
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contact_messages' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON contact_messages
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- quickbooks_sync_records
-- ---------------------------------------------------------------------------
ALTER TABLE quickbooks_sync_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'quickbooks_sync_records' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON quickbooks_sync_records
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- quickbooks_item_mappings
-- ---------------------------------------------------------------------------
ALTER TABLE quickbooks_item_mappings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'quickbooks_item_mappings' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON quickbooks_item_mappings
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- stripe_customers
-- ---------------------------------------------------------------------------
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stripe_customers' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON stripe_customers
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- stripe_subscriptions
-- ---------------------------------------------------------------------------
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stripe_subscriptions' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON stripe_subscriptions
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- stripe_payments
-- ---------------------------------------------------------------------------
ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stripe_payments' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON stripe_payments
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- stripe_invoices
-- ---------------------------------------------------------------------------
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stripe_invoices' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON stripe_invoices
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- team_members
-- ---------------------------------------------------------------------------
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON team_members
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- certification_agencies
-- ---------------------------------------------------------------------------
ALTER TABLE certification_agencies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'certification_agencies' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON certification_agencies
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- certification_levels
-- ---------------------------------------------------------------------------
ALTER TABLE certification_levels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'certification_levels' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON certification_levels
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- training_courses
-- ---------------------------------------------------------------------------
ALTER TABLE training_courses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'training_courses' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON training_courses
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- training_sessions
-- ---------------------------------------------------------------------------
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'training_sessions' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON training_sessions
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- training_enrollments
-- ---------------------------------------------------------------------------
ALTER TABLE training_enrollments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'training_enrollments' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON training_enrollments
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- zapier_webhook_subscriptions
-- ---------------------------------------------------------------------------
ALTER TABLE zapier_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'zapier_webhook_subscriptions' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON zapier_webhook_subscriptions
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- zapier_api_keys
-- ---------------------------------------------------------------------------
ALTER TABLE zapier_api_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'zapier_api_keys' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON zapier_api_keys
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- integrations
-- ---------------------------------------------------------------------------
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'integrations' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON integrations
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- subscription
-- ---------------------------------------------------------------------------
ALTER TABLE subscription ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscription' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON subscription
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- usage_tracking
-- ---------------------------------------------------------------------------
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'usage_tracking' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON usage_tracking
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- password_change_audit
-- ---------------------------------------------------------------------------
ALTER TABLE password_change_audit ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'password_change_audit' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON password_change_audit
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- member (auth table with organization_id)
-- ---------------------------------------------------------------------------
ALTER TABLE member ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'member' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON member
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- invitation (auth table with organization_id)
-- ---------------------------------------------------------------------------
ALTER TABLE invitation ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invitation' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON invitation
      USING (
        current_setting('app.current_org_id', true) IS NULL
        OR organization_id = current_setting('app.current_org_id', true)
      );
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION: Log the count of RLS-protected tables
-- ============================================================================

DO $$
DECLARE
  rls_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT tablename) INTO rls_count
  FROM pg_policies
  WHERE policyname = 'tenant_isolation';

  RAISE NOTICE 'RLS tenant_isolation policies active on % tables', rls_count;
END $$;

/**
 * @deprecated LEGACY TENANT SYSTEM
 * 
 * This file contains the legacy schema-per-tenant system which is no longer used.
 * The application now uses a shared-schema approach with organization_id filtering.
 * 
 * MIGRATION PLAN (2026-02-13 DCC Review):
 * 1. Stop creating new tenant schemas (createTenant still creates them - needs fix)
 * 2. Migrate all queries to use organization-based filtering (DONE)
 * 3. Drop unused tenant_* schemas from database
 * 4. Remove the `tenants` table and this file
 * 
 * For new code, use:
 * - Organization from lib/db/schema/auth.ts
 * - OrgContext from lib/auth/org-context.server.ts
 * 
 * DO NOT add new functionality here - this code is scheduled for removal.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";
import { db, migrationDb } from "./index";
import { tenants, subscriptionPlans, type Tenant } from "./schema";
import { organization } from "./schema/auth";
import { subscription } from "./schema/subscription";
import * as schema from "./schema";

// Re-export Tenant type
export type { Tenant } from "./schema";

// Get tenant by subdomain
export async function getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
  const result = await db.select().from(tenants).where(eq(tenants.subdomain, subdomain)).limit(1);
  return result[0] ?? null;
}

// Get tenant by ID
export async function getTenantById(id: string): Promise<Tenant | null> {
  const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return result[0] ?? null;
}

// Get drizzle instance and schema for a specific tenant
// Note: With the new organization-based architecture, all tenants share the same schema
// The schemaName parameter is kept for backwards compatibility but queries should
// filter by organizationId instead of using separate schemas
export function getTenantDb(_schemaName: string) {
  // Return the shared schema - organization filtering is done at query level
  return {
    db: db,
    schema: schema,
  };
}

// Generate a schema name from subdomain
export function generateSchemaName(subdomain: string): string {
  // Sanitize subdomain to be a valid PostgreSQL schema name
  const sanitized = subdomain.toLowerCase().replace(/[^a-z0-9]/g, "_");
  return `tenant_${sanitized}`;
}

// Create a new tenant with their own schema
export async function createTenant(data: {
  subdomain: string;
  name: string;
  email: string;
  phone?: string;
  timezone?: string;
  currency?: string;
  planId?: string;
}): Promise<Tenant> {
  const schemaName = generateSchemaName(data.subdomain);

  // Start a transaction to ensure both tenant record and schema are created
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = postgres(connectionString);

  try {
    // Generate organization ID for Better Auth
    const orgId = crypto.randomUUID();

    // Create the tenant record first (legacy)
    const [tenant] = await db
      .insert(tenants)
      .values({
        subdomain: data.subdomain.toLowerCase(),
        name: data.name,
        email: data.email,
        phone: data.phone,
        timezone: data.timezone ?? "UTC",
        currency: data.currency ?? "USD",
        schemaName,
        planId: data.planId,
        subscriptionStatus: "trialing",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      })
      .returning();

    // Create the Better Auth organization record (required for login)
    await db.insert(organization).values({
      id: orgId,
      slug: data.subdomain.toLowerCase(),
      name: data.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Look up the free plan to get its ID
    const [freePlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, "free"))
      .limit(1);

    // Create subscription record for the organization
    await db.insert(subscription).values({
      organizationId: orgId,
      plan: "free",
      planId: freePlan?.id || null, // Set both plan and planId
      status: "trialing",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create the tenant schema (legacy schema-per-tenant)
    await client.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // Create all tables in the tenant schema
    await createTenantTables(client, schemaName);

    return tenant;
  } catch (error) {
    // If anything fails, try to clean up
    try {
      await client.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await db.delete(tenants).where(eq(tenants.subdomain, data.subdomain.toLowerCase()));
      // Also clean up organization record
      await db.delete(organization).where(eq(organization.slug, data.subdomain.toLowerCase()));
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  } finally {
    await client.end();
  }
}

// Create all tables in a tenant schema
async function createTenantTables(client: postgres.Sql, schemaName: string) {
  // Users table
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      email_verified BOOLEAN NOT NULL DEFAULT false,
      name TEXT NOT NULL,
      phone TEXT,
      avatar_url TEXT,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'staff',
      permissions JSONB,
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Password reset tokens table
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES "${schemaName}".users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Sessions table
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".sessions (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES "${schemaName}".users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Accounts table (for OAuth)
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES "${schemaName}".users(id) ON DELETE CASCADE,
      provider_id TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Customers table
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      date_of_birth DATE,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      emergency_contact_relation TEXT,
      medical_conditions TEXT,
      medications TEXT,
      certifications JSONB,
      address TEXT,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      country TEXT,
      preferred_language TEXT DEFAULT 'en',
      marketing_opt_in BOOLEAN DEFAULT false,
      notes TEXT,
      tags JSONB,
      total_dives INTEGER DEFAULT 0,
      total_spent DECIMAL(10, 2) DEFAULT 0,
      last_dive_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Boats table
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".boats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      capacity INTEGER NOT NULL,
      type TEXT,
      registration_number TEXT,
      images JSONB,
      amenities JSONB,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Dive sites table
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".dive_sites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      latitude DECIMAL(10, 7),
      longitude DECIMAL(10, 7),
      max_depth INTEGER,
      min_depth INTEGER,
      difficulty TEXT,
      current_strength TEXT,
      visibility TEXT,
      highlights JSONB,
      images JSONB,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Tours table
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".tours (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      duration INTEGER,
      max_participants INTEGER NOT NULL,
      min_participants INTEGER DEFAULT 1,
      price DECIMAL(10, 2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      includes_equipment BOOLEAN DEFAULT false,
      includes_meals BOOLEAN DEFAULT false,
      includes_transport BOOLEAN DEFAULT false,
      inclusions JSONB,
      exclusions JSONB,
      min_cert_level TEXT,
      min_age INTEGER,
      requirements JSONB,
      images JSONB,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Tour dive sites junction table
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".tour_dive_sites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tour_id UUID NOT NULL REFERENCES "${schemaName}".tours(id) ON DELETE CASCADE,
      dive_site_id UUID NOT NULL REFERENCES "${schemaName}".dive_sites(id) ON DELETE CASCADE,
      "order" INTEGER DEFAULT 0
    )
  `);

  // Trips table (scheduled instances of tours)
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".trips (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tour_id UUID NOT NULL REFERENCES "${schemaName}".tours(id),
      boat_id UUID REFERENCES "${schemaName}".boats(id),
      date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME,
      status TEXT NOT NULL DEFAULT 'scheduled',
      max_participants INTEGER,
      price DECIMAL(10, 2),
      weather_notes TEXT,
      conditions JSONB,
      notes TEXT,
      staff_ids JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Bookings table
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_number TEXT NOT NULL UNIQUE,
      trip_id UUID NOT NULL REFERENCES "${schemaName}".trips(id),
      customer_id UUID NOT NULL REFERENCES "${schemaName}".customers(id),
      participants INTEGER NOT NULL DEFAULT 1,
      participant_details JSONB,
      status TEXT NOT NULL DEFAULT 'pending',
      subtotal DECIMAL(10, 2) NOT NULL,
      discount DECIMAL(10, 2) DEFAULT 0,
      tax DECIMAL(10, 2) DEFAULT 0,
      total DECIMAL(10, 2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      deposit_amount DECIMAL(10, 2),
      deposit_paid_at TIMESTAMPTZ,
      paid_amount DECIMAL(10, 2) DEFAULT 0,
      stripe_payment_intent_id TEXT,
      equipment_rental JSONB,
      waiver_signed_at TIMESTAMPTZ,
      medical_form_signed_at TIMESTAMPTZ,
      special_requests TEXT,
      internal_notes TEXT,
      source TEXT DEFAULT 'direct',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Equipment table
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".equipment (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      serial_number TEXT,
      barcode TEXT,
      size TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      condition TEXT DEFAULT 'good',
      rental_price DECIMAL(10, 2),
      is_rentable BOOLEAN DEFAULT true,
      last_service_date DATE,
      next_service_date DATE,
      service_notes TEXT,
      purchase_date DATE,
      purchase_price DECIMAL(10, 2),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Transactions table
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL,
      booking_id UUID REFERENCES "${schemaName}".bookings(id),
      customer_id UUID REFERENCES "${schemaName}".customers(id),
      user_id UUID REFERENCES "${schemaName}".users(id),
      amount DECIMAL(10, 2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      payment_method TEXT NOT NULL,
      stripe_payment_id TEXT,
      items JSONB,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Rentals table (for equipment rentals)
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".rentals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id UUID REFERENCES "${schemaName}".transactions(id),
      customer_id UUID NOT NULL REFERENCES "${schemaName}".customers(id),
      equipment_id UUID NOT NULL REFERENCES "${schemaName}".equipment(id),
      rented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      due_at TIMESTAMPTZ NOT NULL,
      returned_at TIMESTAMPTZ,
      daily_rate DECIMAL(10, 2) NOT NULL,
      total_charge DECIMAL(10, 2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      agreement_number TEXT NOT NULL,
      agreement_signed_at TIMESTAMPTZ,
      agreement_signed_by TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Products table (for POS retail items)
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      sku TEXT,
      barcode TEXT,
      category TEXT NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      cost_price DECIMAL(10, 2),
      currency TEXT NOT NULL DEFAULT 'USD',
      tax_rate DECIMAL(5, 2) DEFAULT 0,
      sale_price DECIMAL(10, 2),
      sale_start_date TIMESTAMPTZ,
      sale_end_date TIMESTAMPTZ,
      track_inventory BOOLEAN NOT NULL DEFAULT true,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER DEFAULT 5,
      image_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Discount codes table
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".discount_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      discount_type TEXT NOT NULL,
      discount_value DECIMAL(10, 2) NOT NULL,
      min_booking_amount DECIMAL(10, 2),
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      valid_from TIMESTAMPTZ,
      valid_to TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT true,
      applicable_to TEXT NOT NULL DEFAULT 'all',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Images table (polymorphic for tours, dive sites, boats, equipment, staff)
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS "${schemaName}".images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      url TEXT NOT NULL,
      thumbnail_url TEXT,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      alt TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Create indexes
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_customers_email_idx" ON "${schemaName}".customers(email)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_customers_name_idx" ON "${schemaName}".customers(last_name, first_name)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_trips_date_idx" ON "${schemaName}".trips(date)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_trips_status_idx" ON "${schemaName}".trips(status)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_bookings_trip_idx" ON "${schemaName}".bookings(trip_id)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_bookings_customer_idx" ON "${schemaName}".bookings(customer_id)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_bookings_status_idx" ON "${schemaName}".bookings(status)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_equipment_category_idx" ON "${schemaName}".equipment(category)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_equipment_status_idx" ON "${schemaName}".equipment(status)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_transactions_booking_idx" ON "${schemaName}".transactions(booking_id)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_transactions_customer_idx" ON "${schemaName}".transactions(customer_id)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_products_category_idx" ON "${schemaName}".products(category)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_products_sku_idx" ON "${schemaName}".products(sku)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_products_barcode_idx" ON "${schemaName}".products(barcode)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_equipment_barcode_idx" ON "${schemaName}".equipment(barcode)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_discount_codes_code_idx" ON "${schemaName}".discount_codes(code)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_discount_codes_active_idx" ON "${schemaName}".discount_codes(is_active)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_rentals_customer_idx" ON "${schemaName}".rentals(customer_id)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_rentals_equipment_idx" ON "${schemaName}".rentals(equipment_id)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_rentals_status_idx" ON "${schemaName}".rentals(status)`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS "${schemaName}_images_entity_idx" ON "${schemaName}".images(entity_type, entity_id)`);
}

// Delete a tenant and their schema
export async function deleteTenant(tenantId: string): Promise<void> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = postgres(connectionString);

  try {
    // Drop the schema (legacy - for old schema-per-tenant setups)
    await client.unsafe(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);

    // Delete the tenant record
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  } finally {
    await client.end();
  }
}

// List all tenants
export async function listTenants(options?: {
  isActive?: boolean;
  subscriptionStatus?: string;
}) {
  const query = db.select().from(tenants);

  // Note: filtering would be added here with proper query building
  // For now, return all and filter in memory
  const results = await query;

  if (options?.isActive !== undefined) {
    return results.filter((t) => t.isActive === options.isActive);
  }

  if (options?.subscriptionStatus) {
    return results.filter((t) => t.subscriptionStatus === options.subscriptionStatus);
  }

  return results;
}

// Update tenant
export async function updateTenant(
  tenantId: string,
  data: Partial<{
    name: string;
    email: string;
    phone: string;
    timezone: string;
    currency: string;
    settings: Tenant["settings"];
    isActive: boolean;
  }>
): Promise<Tenant> {
  const [updated] = await db
    .update(tenants)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId))
    .returning();

  if (!updated) {
    throw new Error("Tenant not found");
  }

  return updated;
}

// Check if subdomain is available
export async function isSubdomainAvailable(subdomain: string): Promise<boolean> {
  const normalizedSubdomain = subdomain.toLowerCase();

  // Check legacy tenants table
  const existingTenant = await getTenantBySubdomain(normalizedSubdomain);
  if (existingTenant) {
    return false;
  }

  // Also check Better Auth organization table
  const [existingOrg] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, normalizedSubdomain))
    .limit(1);

  return existingOrg === undefined;
}

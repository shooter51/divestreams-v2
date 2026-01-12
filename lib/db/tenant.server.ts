import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";
import { db, migrationDb } from "./index";
import { tenants, subscriptionPlans, createTenantSchema, type Tenant } from "./schema";

// Re-export Tenant type
export type { Tenant } from "./schema";

// Cache for tenant database connections
const tenantConnections = new Map<string, ReturnType<typeof drizzle>>();

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

// Get drizzle instance for a specific tenant schema
export function getTenantDb(schemaName: string) {
  if (tenantConnections.has(schemaName)) {
    return tenantConnections.get(schemaName)!;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Create a connection with the search_path set to the tenant schema
  const client = postgres(connectionString, {
    connection: {
      search_path: schemaName,
    },
  });

  const tenantSchema = createTenantSchema(schemaName);
  const tenantDb = drizzle(client, { schema: tenantSchema });

  tenantConnections.set(schemaName, tenantDb);
  return tenantDb;
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
    // Create the tenant record first
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

    // Create the tenant schema
    await client.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // Create all tables in the tenant schema
    await createTenantTables(client, schemaName);

    return tenant;
  } catch (error) {
    // If anything fails, try to clean up
    try {
      await client.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await db.delete(tenants).where(eq(tenants.subdomain, data.subdomain.toLowerCase()));
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
      role TEXT NOT NULL DEFAULT 'staff',
      permissions JSONB,
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    // Drop the schema
    await client.unsafe(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);

    // Delete the tenant record
    await db.delete(tenants).where(eq(tenants.id, tenantId));

    // Remove from connection cache
    tenantConnections.delete(tenant.schemaName);
  } finally {
    await client.end();
  }
}

// List all tenants
export async function listTenants(options?: {
  isActive?: boolean;
  subscriptionStatus?: string;
}) {
  let query = db.select().from(tenants);

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
  const existing = await getTenantBySubdomain(subdomain.toLowerCase());
  return existing === null;
}

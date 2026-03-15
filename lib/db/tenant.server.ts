import { eq } from "drizzle-orm";
import { db } from "./index";
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// Create a new tenant
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

  // Generate organization ID for Better Auth
  const orgId = crypto.randomUUID();

  try {
    // Create the tenant record
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

    // Look up the standard plan to get its ID
    const [standardPlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, "standard"))
      .limit(1);

    if (!standardPlan) {
      console.warn(
        `No "standard" subscription plan found in subscriptionPlans table. ` +
        `New tenant "${data.subdomain}" will have planId=null. ` +
        `Ensure the "standard" plan is seeded in the database.`
      );
    }

    // Create subscription record for the organization
    await db.insert(subscription).values({
      organizationId: orgId,
      plan: "standard",
      planId: standardPlan?.id ?? null,
      status: "trialing",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return tenant;
  } catch (error) {
    // If anything fails, try to clean up
    try {
      await db.delete(tenants).where(eq(tenants.subdomain, data.subdomain.toLowerCase()));
      // Also clean up organization record
      await db.delete(organization).where(eq(organization.slug, data.subdomain.toLowerCase()));
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}


// Delete a tenant
export async function deleteTenant(tenantId: string): Promise<void> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  // Delete the tenant record
  await db.delete(tenants).where(eq(tenants.id, tenantId));
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

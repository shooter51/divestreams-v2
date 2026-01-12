import { redirect } from "react-router";
import { getTenantBySubdomain, getTenantDb, type Tenant } from "../db/tenant.server";

// Extract subdomain from request
export function getSubdomainFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const host = url.hostname;

  // Handle localhost development
  if (host.includes("localhost")) {
    // Format: subdomain.localhost:5173
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "localhost") {
      return parts[0];
    }
    return null;
  }

  // Production: subdomain.divestreams.com
  const parts = host.split(".");
  if (parts.length >= 3) {
    // Don't treat www as a subdomain
    if (parts[0] === "www") {
      return null;
    }
    return parts[0];
  }

  return null;
}

// Get tenant context for a request
export async function getTenantFromRequest(
  request: Request
): Promise<{ tenant: Tenant; db: ReturnType<typeof getTenantDb> } | null> {
  const subdomain = getSubdomainFromRequest(request);

  if (!subdomain) {
    return null;
  }

  const tenant = await getTenantBySubdomain(subdomain);

  if (!tenant || !tenant.isActive) {
    return null;
  }

  // Check subscription status
  if (tenant.subscriptionStatus === "canceled") {
    return null;
  }

  // Check trial expiration
  if (tenant.subscriptionStatus === "trialing" && tenant.trialEndsAt) {
    if (new Date() > tenant.trialEndsAt) {
      // Trial expired - they need to subscribe
      return null;
    }
  }

  const tenantDb = getTenantDb(tenant.schemaName);

  return { tenant, db: tenantDb };
}

// Require tenant context - redirects to main site if no tenant
export async function requireTenant(request: Request) {
  const context = await getTenantFromRequest(request);

  if (!context) {
    throw redirect("https://divestreams.com");
  }

  return context;
}

// Auth context type for loaders/actions
export type TenantContext = {
  tenant: Tenant;
  db: ReturnType<typeof getTenantDb>;
};

// Session management for tenant users
export async function getTenantSession(
  request: Request,
  tenantDb: ReturnType<typeof getTenantDb>
) {
  // Get session cookie
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) {
    return null;
  }

  // Parse session ID from cookie
  const sessionId = parseSessionCookie(cookieHeader);
  if (!sessionId) {
    return null;
  }

  // Look up session in tenant's sessions table
  // This would use the tenant's database connection
  // Implementation depends on Better Auth's session storage
  return null; // Placeholder - implement with Better Auth
}

function parseSessionCookie(cookieHeader: string): string | null {
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === "session") {
      return value;
    }
  }
  return null;
}

// Role-based access control
export type UserRole = "owner" | "manager" | "staff";

export const PERMISSIONS = {
  // Booking permissions
  "bookings:read": ["owner", "manager", "staff"],
  "bookings:write": ["owner", "manager", "staff"],
  "bookings:delete": ["owner", "manager"],

  // Customer permissions
  "customers:read": ["owner", "manager", "staff"],
  "customers:write": ["owner", "manager", "staff"],
  "customers:delete": ["owner", "manager"],

  // Tour/Trip permissions
  "tours:read": ["owner", "manager", "staff"],
  "tours:write": ["owner", "manager"],
  "tours:delete": ["owner"],

  // Equipment permissions
  "equipment:read": ["owner", "manager", "staff"],
  "equipment:write": ["owner", "manager"],
  "equipment:delete": ["owner"],

  // Financial permissions
  "transactions:read": ["owner", "manager"],
  "transactions:write": ["owner", "manager"],
  "reports:read": ["owner", "manager"],

  // Settings permissions
  "settings:read": ["owner", "manager"],
  "settings:write": ["owner"],

  // User management
  "users:read": ["owner", "manager"],
  "users:write": ["owner"],
  "users:delete": ["owner"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export function requirePermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Response("Forbidden", { status: 403 });
  }
}

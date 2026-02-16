/**
 * Organization Context Helper
 *
 * Provides organization context and freemium enforcement for all tenant routes.
 * This is the most important helper - it ensures proper multi-tenant isolation
 * and enforces freemium limits on all operations.
 */

import { redirect } from "react-router";
import { eq, and, count, gte } from "drizzle-orm";
import { auth } from "./index";
import { db, withOrgContext, type DbTransaction } from "../db";
import { authLogger } from "../logger";
import {
  organization,
  member,
  account,
} from "../db/schema/auth";
import { subscription } from "../db/schema/subscription";
import { subscriptionPlans, customers, tours, bookings } from "../db/schema";
import type {
  Organization,
  Member,
  User,
  Session,
} from "../db/schema/auth";
import type { Subscription } from "../db/schema/subscription";
import type { PlanFeaturesObject, PlanLimits } from "../plan-features";
import { DEFAULT_PLAN_LIMITS, DEFAULT_PLAN_FEATURES } from "../plan-features";
import { requireCsrf } from "../security/csrf.server";
import {
  getSubdomainFromRequest,
  getSubdomainFromHost,
} from "../utils/url";

/**
 * Plan details from subscription_plans table
 */
export interface PlanDetails {
  id: string;
  name: string;
  displayName: string;
  features: PlanFeaturesObject;
  limits: PlanLimits;
}

// ============================================================================
// TIER LIMITS (derived from DB plan data, with hardcoded fallbacks)
// ============================================================================

/**
 * Type for tier limits used in OrgContext.
 * Combines quantity limits (from PlanLimits) with feature flags.
 * The DB plan is the source of truth; these constants are fallback defaults.
 */
export interface TierLimits {
  customers: number;
  bookingsPerMonth: number;
  tours: number;
  teamMembers: number;
  hasPOS: boolean;
  hasEquipmentRentals: boolean;
  hasAdvancedReports: boolean;
  hasEmailNotifications: boolean;
}

/**
 * Build a TierLimits object from DB-driven PlanLimits and PlanFeaturesObject.
 * This is the single conversion point between the DB schema and the OrgContext shape.
 *
 * @param planLimits - The numeric limits from the plan (users, customers, toursPerMonth, storageGb)
 * @param features - The feature flags from the plan
 * @returns A TierLimits object for use in OrgContext
 */
export function buildTierLimits(
  planLimits: PlanLimits,
  features: PlanFeaturesObject
): TierLimits {
  return {
    customers: planLimits.customers === -1 ? Infinity : planLimits.customers,
    bookingsPerMonth: planLimits.toursPerMonth === -1 ? Infinity : planLimits.toursPerMonth,
    tours: planLimits.toursPerMonth === -1 ? Infinity : planLimits.toursPerMonth,
    teamMembers: planLimits.users === -1 ? Infinity : planLimits.users,
    hasPOS: features.has_pos ?? false,
    hasEquipmentRentals: features.has_equipment_boats ?? false,
    hasAdvancedReports: features.has_advanced_notifications ?? false,
    hasEmailNotifications: features.has_advanced_notifications ?? false,
  };
}

/**
 * Default free tier limits - derived from plan-features.ts defaults.
 * Used as fallback when no plan is found in the database.
 *
 * @deprecated Prefer DB-driven limits from subscription plan. This exists only
 * as a safe fallback when the plan lookup fails or no subscription exists.
 */
export const FREE_TIER_LIMITS: TierLimits = buildTierLimits(
  DEFAULT_PLAN_LIMITS.free,
  DEFAULT_PLAN_FEATURES.free
);

/**
 * Legacy premium limits constant.
 * In the consolidated system, premium limits come from the DB plan.
 * This constant exists only for backward compatibility in tests.
 *
 * @deprecated Use DB-driven plan limits instead.
 */
export const PREMIUM_LIMITS: TierLimits = buildTierLimits(
  DEFAULT_PLAN_LIMITS.enterprise,
  DEFAULT_PLAN_FEATURES.enterprise
);

// ============================================================================
// ORGANIZATION CONTEXT TYPE
// ============================================================================

/**
 * Usage statistics for the current organization
 */
export interface OrgUsage {
  customers: number;
  tours: number;
  bookingsThisMonth: number;
}

/**
 * Full organization context for tenant routes
 */
export interface OrgContext {
  /** Current authenticated user */
  user: User;
  /** Current session */
  session: Session;
  /** Current organization (from subdomain) */
  org: Organization;
  /** User's membership in the organization */
  membership: Member;
  /** Organization's subscription */
  subscription: (Subscription & { planDetails?: PlanDetails }) | null;
  /** Effective limits based on subscription */
  limits: TierLimits;
  /** Current usage statistics */
  usage: OrgUsage;
  /** Whether the user can add a new customer */
  canAddCustomer: boolean;
  /** Whether the user can add a new tour */
  canAddTour: boolean;
  /** Whether the user can add a new booking */
  canAddBooking: boolean;
  /** Whether the organization has a premium subscription */
  isPremium: boolean;
}

// ============================================================================
// SUBDOMAIN HELPERS (re-exported from lib/utils/url.ts)
// ============================================================================

// Re-export subdomain helpers so existing imports from this module continue to work.
export { getSubdomainFromRequest, getSubdomainFromHost };

/**
 * Check if the current request is for the admin subdomain
 * Supports both production (admin.divestreams.com) and staging (admin-staging.divestreams.com)
 */
export function isAdminSubdomain(request: Request): boolean {
  const url = new URL(request.url);
  const host = url.host;
  const parts = host.split(".");

  // Check for admin-staging.divestreams.com (staging admin)
  if (parts.length >= 3 && parts[0] === "admin-staging") {
    return true;
  }

  // Check for admin.staging.divestreams.com (alternative staging admin format)
  if (parts.length >= 4 && parts[0] === "admin" && parts[1] === "staging") {
    return true;
  }

  // Check for admin.divestreams.com (production admin)
  const subdomain = getSubdomainFromRequest(request);
  return subdomain === "admin";
}

// ============================================================================
// ORGANIZATION CONTEXT
// ============================================================================

/**
 * Get the full organization context for the current request
 *
 * This is the main function for tenant routes. It:
 * 1. Extracts the subdomain from the request
 * 2. Gets the authenticated session
 * 3. Finds the organization by slug
 * 4. Verifies user membership
 * 5. Gets subscription status
 * 6. Calculates limits and usage
 *
 * @returns The full organization context or null if not applicable
 */
export async function getOrgContext(
  request: Request
): Promise<OrgContext | null> {
  // Get subdomain from request
  const subdomain = getSubdomainFromRequest(request);

  // No subdomain or admin subdomain - not a tenant route
  if (!subdomain || subdomain === "admin") {
    return null;
  }

  // Get session from Better Auth
  const sessionData = await auth.api.getSession({
    headers: request.headers,
  });

  if (!sessionData || !sessionData.user) {
    return null;
  }

  // Find organization by slug (subdomain)
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, subdomain))
    .limit(1);

  if (!org) {
    return null;
  }

  // Find user's membership in this organization
  const [membership] = await db
    .select()
    .from(member)
    .where(
      and(
        eq(member.userId, sessionData.user.id),
        eq(member.organizationId, org.id)
      )
    )
    .limit(1);

  if (!membership) {
    return null;
  }

  // Get organization subscription
  const [sub] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organizationId, org.id))
    .limit(1);

  // Fetch the plan details from subscriptionPlans table
  // Prefer planId (modern FK) over legacy plan name field
  const planName = sub?.plan || "free";
  let planDetails;
  if (sub?.planId) {
    [planDetails] = await db
      .select()
      .from(subscriptionPlans)
      .where(
        and(
          eq(subscriptionPlans.id, sub.planId),
          eq(subscriptionPlans.isActive, true)
        )
      )
      .limit(1);
  }
  if (!planDetails) {
    // Fall back to legacy plan name lookup
    [planDetails] = await db
      .select()
      .from(subscriptionPlans)
      .where(
        and(
          eq(subscriptionPlans.name, planName),
          eq(subscriptionPlans.isActive, true)
        )
      )
      .limit(1);
  }

  // Determine if premium based on plan details (not legacy string field)
  // Use planDetails.monthlyPrice to ensure we check the authoritative FK relationship
  const isPremium =
    planDetails &&
    planDetails.monthlyPrice > 0 &&
    sub?.status === "active";

  // Build TierLimits from the DB plan data (single source of truth).
  // Falls back to FREE_TIER_LIMITS when no plan is found.
  const limits: TierLimits = planDetails
    ? buildTierLimits(
        planDetails.limits as PlanLimits,
        planDetails.features as PlanFeaturesObject
      )
    : FREE_TIER_LIMITS;

  // Get usage statistics from database (run all 3 queries in parallel)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [customerCount, tourCount, bookingsThisMonthCount] = await Promise.all([
    // Count customers for this organization
    db
      .select({ count: count() })
      .from(customers)
      .where(eq(customers.organizationId, org.id))
      .then(([result]) => result?.count ?? 0)
      .catch((error) => {
        authLogger.error({ err: error, organizationId: org.id }, "Failed to count customers");
        return 0;
      }),
    // Count tours for this organization
    db
      .select({ count: count() })
      .from(tours)
      .where(eq(tours.organizationId, org.id))
      .then(([result]) => result?.count ?? 0)
      .catch((error) => {
        authLogger.error({ err: error, organizationId: org.id }, "Failed to count tours");
        return 0;
      }),
    // Count bookings created this month for this organization
    db
      .select({ count: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, org.id),
          gte(bookings.createdAt, startOfMonth)
        )
      )
      .then(([result]) => result?.count ?? 0)
      .catch((error) => {
        authLogger.error({ err: error, organizationId: org.id }, "Failed to count bookings");
        return 0;
      }),
  ]);

  const usage: OrgUsage = {
    customers: customerCount,
    tours: tourCount,
    bookingsThisMonth: bookingsThisMonthCount,
  };

  // Calculate whether user can add more resources
  const canAddCustomer = isPremium || usage.customers < limits.customers;
  const canAddTour = isPremium || usage.tours < limits.tours;
  const canAddBooking =
    isPremium || usage.bookingsThisMonth < limits.bookingsPerMonth;

  // Build subscription with plan details
  const subscriptionWithPlan = sub
    ? {
        ...sub,
        planDetails: planDetails
          ? {
              id: planDetails.id,
              name: planDetails.name,
              displayName: planDetails.displayName,
              features: planDetails.features as PlanFeaturesObject,
              limits: planDetails.limits as PlanLimits,
            }
          : undefined,
      }
    : null;

  return {
    user: sessionData.user as User,
    session: sessionData.session as Session,
    org,
    membership,
    subscription: subscriptionWithPlan,
    limits,
    usage,
    canAddCustomer,
    canAddTour,
    canAddBooking,
    isPremium,
  };
}

// ============================================================================
// REQUIREMENT HELPERS
// ============================================================================

/**
 * Require organization context or redirect to login
 *
 * Use this in loaders for routes that require authentication
 *
 * @throws Redirect to login page if not authenticated
 */
export async function requireOrgContext(request: Request): Promise<OrgContext> {
  const subdomain = getSubdomainFromRequest(request);

  // Check if tenant is deactivated BEFORE trying to get context
  if (subdomain && subdomain !== "admin") {
    const { tenants } = await import("../db/schema");
    const [tenant] = await db
      .select({ isActive: tenants.isActive })
      .from(tenants)
      .where(eq(tenants.subdomain, subdomain))
      .limit(1);

    if (tenant && !tenant.isActive) {
      // Check if this is a data fetch request (React Router .data requests)
      const url = new URL(request.url);
      const isDataRequest = url.pathname.endsWith(".data") || request.headers.get("Accept")?.includes("application/json");

      if (isDataRequest) {
        // Return JSON response for data fetches
        throw new Response(
          JSON.stringify({
            error: "Account Deactivated",
            message: "This account has been deactivated and is no longer accessible. If you believe this is an error, please contact support@divestreams.com",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      // Return HTML response for page navigations
      throw new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Account Deactivated</title>
            <style>
              body { font-family: system-ui, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; text-align: center; }
              h1 { color: #dc2626; }
              p { color: #666; line-height: 1.6; }
              .box { background: #fee; border: 1px solid #fcc; border-radius: 8px; padding: 20px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <h1>Account Deactivated</h1>
            <div class="box">
              <p><strong>This account has been deactivated and is no longer accessible.</strong></p>
              <p>If you believe this is an error, please contact support at <a href="mailto:support@divestreams.com">support@divestreams.com</a>.</p>
            </div>
          </body>
        </html>
        `,
        {
          status: 403,
          headers: { "Content-Type": "text/html" }
        }
      );
    }
  }

  const context = await getOrgContext(request);

  if (!context) {
    // Get the subdomain for the redirect
    const url = new URL(request.url);

    // If we have a subdomain, redirect to tenant login at /auth/login
    if (subdomain && subdomain !== "admin") {
      throw redirect(`/auth/login?redirect=${encodeURIComponent(url.pathname)}`);
    }

    // Otherwise redirect to main login
    throw redirect("/login");
  }

  // Check if user is forced to change password
  const [userAccount] = await db
    .select()
    .from(account)
    .where(eq(account.userId, context.user.id))
    .limit(1);

  if (userAccount?.forcePasswordChange) {
    const url = new URL(request.url);
    // Allow access to password change page and logout
    if (
      !url.pathname.includes("/settings/password") &&
      !url.pathname.includes("/logout")
    ) {
      throw redirect("/tenant/settings/password?forced=true");
    }
  }

  // Validate CSRF token for mutation requests (POST, PUT, DELETE, PATCH).
  // This is skipped for GET/HEAD/OPTIONS and for exempt API routes.
  // During the rollout phase, missing tokens are logged but not blocked.
  await requireCsrf(request, context.session.id);

  return context;
}

/**
 * Valid organization roles
 */
export type OrgRole = "owner" | "admin" | "staff" | "customer";

/**
 * Require specific role(s) for the current user
 *
 * @throws 403 Response if user doesn't have required role
 */
export function requireRole(
  context: OrgContext,
  allowedRoles: OrgRole[]
): void {
  const userRole = context.membership.role as OrgRole;

  if (!allowedRoles.includes(userRole)) {
    throw new Response("Forbidden: Insufficient permissions", {
      status: 403,
      statusText: "Forbidden",
    });
  }
}

/**
 * Premium feature names for error messages
 */
export type PremiumFeature =
  | "pos"
  | "equipment_rentals"
  | "advanced_reports"
  | "email_notifications"
  | "unlimited_customers"
  | "unlimited_tours"
  | "unlimited_bookings"
  | "unlimited_team";

/**
 * Require premium subscription for a feature
 *
 * @throws 403 Response if organization doesn't have premium
 */
export function requirePremium(
  context: OrgContext,
  feature: PremiumFeature
): void {
  if (!context.isPremium) {
    const featureNames: Record<PremiumFeature, string> = {
      pos: "Point of Sale",
      equipment_rentals: "Equipment Rentals",
      advanced_reports: "Advanced Reports",
      email_notifications: "Email Notifications",
      unlimited_customers: "Unlimited Customers",
      unlimited_tours: "Unlimited Tours",
      unlimited_bookings: "Unlimited Monthly Bookings",
      unlimited_team: "Unlimited Team Members",
    };

    throw new Response(
      `Premium Required: ${featureNames[feature]} is only available on premium plans. Please upgrade to continue.`,
      {
        status: 403,
        statusText: "Premium Required",
      }
    );
  }
}

/**
 * Check if user can perform an action based on limits
 *
 * Returns a user-friendly error message if the limit is reached
 */
export function checkLimit(
  context: OrgContext,
  resource: "customer" | "tour" | "booking"
): { allowed: boolean; message?: string } {
  switch (resource) {
    case "customer":
      if (!context.canAddCustomer) {
        return {
          allowed: false,
          message: `Customer limit reached (${context.limits.customers}). Upgrade to premium for unlimited customers.`,
        };
      }
      break;
    case "tour":
      if (!context.canAddTour) {
        return {
          allowed: false,
          message: `Tour limit reached (${context.limits.tours}). Upgrade to premium for unlimited tours.`,
        };
      }
      break;
    case "booking":
      if (!context.canAddBooking) {
        return {
          allowed: false,
          message: `Monthly booking limit reached (${context.limits.bookingsPerMonth}). Upgrade to premium for unlimited bookings.`,
        };
      }
      break;
  }
  return { allowed: true };
}

// ============================================================================
// BACKWARD COMPATIBILITY HELPERS
// ============================================================================

/**
 * Legacy tenant context for backward compatibility during migration.
 * This provides an interface similar to the old requireTenant() function.
 *
 * @deprecated Use requireOrgContext instead. This is only for migration.
 */
export interface LegacyTenantContext {
  tenant: {
    id: string;
    subdomain: string;
    schemaName: string;
    name: string;
    subscriptionStatus: string;
    trialEndsAt: Date | null;
  };
  organizationId: string;
}

/**
 * Get legacy tenant context for backward compatibility.
 * This wraps the new Better Auth organization context in the old format.
 *
 * @deprecated Use requireOrgContext instead. This is only for migration.
 */
export async function requireTenant(
  request: Request
): Promise<LegacyTenantContext> {
  const context = await requireOrgContext(request);

  // Map new organization-based context to old tenant format
  // Note: schemaName is now derived from org.slug for backward compatibility
  // with raw SQL queries. Once all queries are migrated to use organizationId,
  // this can be removed.
  return {
    tenant: {
      id: context.org.id,
      subdomain: context.org.slug,
      schemaName: `tenant_${context.org.slug}`, // Legacy schema name format
      name: context.org.name,
      subscriptionStatus: context.subscription?.status ?? "free",
      trialEndsAt: context.subscription?.trialEndsAt ?? null,
    },
    organizationId: context.org.id,
  };
}

// ============================================================================
// ROW-LEVEL SECURITY HELPERS
// ============================================================================

/**
 * Execute a database operation with RLS org context set.
 *
 * Combines requireOrgContext with withOrgContext for a one-call pattern
 * in route loaders/actions that need both auth and RLS enforcement.
 *
 * Usage in a route loader:
 * ```ts
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const { context, result } = await withOrgRLS(request, async (tx, ctx) => {
 *     return tx.select().from(customers)
 *       .where(eq(customers.organizationId, ctx.org.id));
 *   });
 *   return { customers: result, org: context.org };
 * }
 * ```
 *
 * @param request - The incoming request (used for auth + subdomain resolution)
 * @param callback - Function receiving the transaction and org context
 * @returns Object with `context` (OrgContext) and `result` (callback return value)
 */
export async function withOrgRLS<T>(
  request: Request,
  callback: (tx: DbTransaction, context: OrgContext) => Promise<T>
): Promise<{ context: OrgContext; result: T }> {
  const context = await requireOrgContext(request);
  const result = await withOrgContext(context.org.id, (tx) =>
    callback(tx, context)
  );
  return { context, result };
}

// Re-export withOrgContext for direct use when orgId is already known
export { withOrgContext, type DbTransaction } from "../db";

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
import { db } from "../db";
import {
  organization,
  member,
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

// ============================================================================
// FREE TIER LIMITS
// ============================================================================

/**
 * Free tier limits for the freemium model
 */
export const FREE_TIER_LIMITS = {
  customers: 50,
  bookingsPerMonth: 20,
  tours: 3,
  teamMembers: 1,
  hasPOS: false,
  hasEquipmentRentals: false,
  hasAdvancedReports: false,
  hasEmailNotifications: false,
} as const;

/**
 * Premium tier has unlimited access
 */
export const PREMIUM_LIMITS = {
  customers: Infinity,
  bookingsPerMonth: Infinity,
  tours: Infinity,
  teamMembers: Infinity,
  hasPOS: true,
  hasEquipmentRentals: true,
  hasAdvancedReports: true,
  hasEmailNotifications: true,
} as const;

/**
 * Type for tier limits - supports both free and premium values
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
  subscription: Subscription | null;
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
// SUBDOMAIN HELPERS
// ============================================================================

/**
 * Extract subdomain from request host
 *
 * Handles:
 * - localhost: subdomain.localhost:5173
 * - production: subdomain.divestreams.com
 *
 * @returns The subdomain or null if none
 */
export function getSubdomainFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const host = url.host;

  // Handle localhost development
  // Format: subdomain.localhost:5173
  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "localhost") {
      return parts[0].toLowerCase();
    }
    return null;
  }

  // Handle production and staging
  const parts = host.split(".");

  // Check if this is the staging environment
  // Format: staging.divestreams.com (base) or {tenant}.staging.divestreams.com (tenant)
  if (parts.length >= 3 && parts[parts.length - 3] === "staging") {
    // This is staging environment
    if (parts.length === 3) {
      // staging.divestreams.com - base staging site, no tenant
      return null;
    }
    if (parts.length >= 4) {
      // {tenant}.staging.divestreams.com
      const subdomain = parts[0].toLowerCase();
      // Ignore www as it's not a tenant subdomain
      if (subdomain === "www") {
        return null;
      }
      return subdomain;
    }
  }

  // Handle production
  // Format: subdomain.divestreams.com
  if (parts.length >= 3) {
    const subdomain = parts[0].toLowerCase();
    // Ignore www and staging as they're not tenant subdomains
    if (subdomain === "www" || subdomain === "staging") {
      return null;
    }
    return subdomain;
  }

  return null;
}

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
  // Match by plan name (e.g., "free", "professional", "enterprise")
  const planName = sub?.plan || "free";
  const [planDetails] = await db
    .select()
    .from(subscriptionPlans)
    .where(
      and(
        eq(subscriptionPlans.name, planName),
        eq(subscriptionPlans.isActive, true)
      )
    )
    .limit(1);

  // Determine if premium (any paid plan with active status)
  const isPremium =
    planName !== "free" && sub?.status === "active";

  // Set limits based on subscription plan from database
  // Fall back to free tier limits if plan not found
  const dbLimits = planDetails?.limits as {
    users?: number;
    customers?: number;
    toursPerMonth?: number;
    storageGb?: number;
  } | undefined;

  const limits: TierLimits = planDetails
    ? {
        customers: dbLimits?.customers ?? FREE_TIER_LIMITS.customers,
        bookingsPerMonth: dbLimits?.toursPerMonth ?? FREE_TIER_LIMITS.bookingsPerMonth,
        tours: dbLimits?.toursPerMonth ?? FREE_TIER_LIMITS.tours,
        teamMembers: dbLimits?.users ?? FREE_TIER_LIMITS.teamMembers,
        hasPOS: isPremium,
        hasEquipmentRentals: isPremium,
        hasAdvancedReports: isPremium,
        hasEmailNotifications: isPremium,
      }
    : FREE_TIER_LIMITS;

  // Get usage statistics from database
  let customerCount = 0;
  let tourCount = 0;
  let bookingsThisMonthCount = 0;

  try {
    // Count customers for this organization
    const [customerResult] = await db
      .select({ count: count() })
      .from(customers)
      .where(eq(customers.organizationId, org.id));
    customerCount = customerResult?.count ?? 0;
  } catch (error) {
    console.error("Failed to count customers:", error);
  }

  try {
    // Count tours for this organization
    const [tourResult] = await db
      .select({ count: count() })
      .from(tours)
      .where(eq(tours.organizationId, org.id));
    tourCount = tourResult?.count ?? 0;
  } catch (error) {
    console.error("Failed to count tours:", error);
  }

  try {
    // Count bookings created this month for this organization
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [bookingsResult] = await db
      .select({ count: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, org.id),
          gte(bookings.createdAt, startOfMonth)
        )
      );
    bookingsThisMonthCount = bookingsResult?.count ?? 0;
  } catch (error) {
    console.error("Failed to count bookings:", error);
  }

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

  return {
    user: sessionData.user as User,
    session: sessionData.session as Session,
    org,
    membership,
    subscription: sub || null,
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
  const context = await getOrgContext(request);

  if (!context) {
    // Get the subdomain for the redirect
    const subdomain = getSubdomainFromRequest(request);
    const url = new URL(request.url);

    // If we have a subdomain, redirect to tenant login at /auth/login
    if (subdomain && subdomain !== "admin") {
      throw redirect(`/auth/login?redirect=${encodeURIComponent(url.pathname)}`);
    }

    // Otherwise redirect to main login
    throw redirect("/login");
  }

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

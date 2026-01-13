/**
 * Platform Admin Context Helper
 *
 * Provides context and authorization for platform admins at admin.divestreams.com.
 * Platform admins are members of a special "platform" organization with elevated
 * privileges for managing the entire DiveStreams platform.
 */

import { redirect } from "react-router";
import { eq, and } from "drizzle-orm";
import { auth } from "./index";
import { db } from "../db";
import { organization, member } from "../db/schema/auth";
import type { User, Session, Member } from "../db/schema/auth";
import { isAdminSubdomain } from "./org-context.server";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * The slug for the platform organization
 * Platform admins are members of this organization
 */
export const PLATFORM_ORG_SLUG = "platform";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Platform admin context for admin.divestreams.com routes
 */
export type PlatformContext = {
  /** Current authenticated user */
  user: User;
  /** Current session */
  session: Session;
  /** User's membership in the platform organization */
  membership: Member;
  /** Whether the user is an owner of the platform organization */
  isOwner: boolean;
  /** Whether the user is an admin (owner or admin role) */
  isAdmin: boolean;
};

// ============================================================================
// CONTEXT HELPERS
// ============================================================================

/**
 * Get the platform admin context for the current request
 *
 * This function:
 * 1. Checks if the request is for the admin subdomain
 * 2. Gets the authenticated session
 * 3. Finds the "platform" organization
 * 4. Verifies user membership in the platform org
 * 5. Returns context with isOwner/isAdmin flags
 *
 * @param request - The incoming request
 * @returns PlatformContext if user is a platform member, null otherwise
 */
export async function getPlatformContext(
  request: Request
): Promise<PlatformContext | null> {
  // Only process admin subdomain requests
  if (!isAdminSubdomain(request)) {
    return null;
  }

  // Get session from Better Auth
  const sessionData = await auth.api.getSession({
    headers: request.headers,
  });

  if (!sessionData || !sessionData.user) {
    return null;
  }

  // Find the platform organization by slug
  const [platformOrg] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, PLATFORM_ORG_SLUG))
    .limit(1);

  if (!platformOrg) {
    // Platform organization doesn't exist - this is a configuration error
    console.error("Platform organization not found. Slug:", PLATFORM_ORG_SLUG);
    return null;
  }

  // Find user's membership in the platform organization
  const [membership] = await db
    .select()
    .from(member)
    .where(
      and(
        eq(member.userId, sessionData.user.id),
        eq(member.organizationId, platformOrg.id)
      )
    )
    .limit(1);

  if (!membership) {
    // User is not a member of the platform organization
    return null;
  }

  // Determine role-based flags
  const isOwner = membership.role === "owner";
  const isAdmin = membership.role === "owner" || membership.role === "admin";

  return {
    user: sessionData.user as User,
    session: sessionData.session as Session,
    membership,
    isOwner,
    isAdmin,
  };
}

// ============================================================================
// REQUIREMENT HELPERS
// ============================================================================

/**
 * Require platform context or redirect to login
 *
 * Use this in loaders for routes that require platform authentication.
 * Redirects to /login if the user is not authenticated or not a platform member.
 *
 * @param request - The incoming request
 * @returns PlatformContext if authenticated
 * @throws Redirect to /login if not authenticated
 */
export async function requirePlatformContext(
  request: Request
): Promise<PlatformContext> {
  const context = await getPlatformContext(request);

  if (!context) {
    const url = new URL(request.url);
    throw redirect(`/login?redirect=${encodeURIComponent(url.pathname)}`);
  }

  return context;
}

/**
 * Require platform admin role
 *
 * Use this to ensure the user has admin privileges (owner or admin role)
 * in the platform organization.
 *
 * @param context - The platform context
 * @throws 403 Response if user is not an admin
 */
export function requirePlatformAdmin(context: PlatformContext): void {
  if (!context.isAdmin) {
    throw new Response("Forbidden: Platform admin access required", {
      status: 403,
      statusText: "Forbidden",
    });
  }
}

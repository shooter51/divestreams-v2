/**
 * Custom Domain Middleware
 *
 * Server-side functions for resolving organizations from custom domains
 * and subdomains. Used in public site routing to determine which
 * tenant's site to display.
 */

import { db } from "../db/index";
import { organization } from "../db/schema/auth";
import { eq, sql } from "drizzle-orm";
import type { PublicSiteSettings } from "../db/schema/auth";
import { getBaseDomain } from "../utils/url";
import { logger } from "../logger";

// ============================================================================
// TYPES
// ============================================================================

export interface ResolvedOrganization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  customDomain: string | null;
  publicSiteSettings: PublicSiteSettings | null;
}

export type DomainResolutionResult =
  | { success: true; organization: ResolvedOrganization; type: "subdomain" | "customDomain" }
  | { success: false; error: string };

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Get the main DiveStreams domain for the current environment
 * Returns environment-aware domain (divestreams.com or staging.divestreams.com)
 */
function getMainDomain(): string {
  return getBaseDomain();
}

/**
 * Reserved subdomains that cannot be used for tenant sites
 */
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "dashboard",
  "staging",
  "dev",
  "mail",
  "smtp",
  "ftp",
  "cdn",
  "assets",
  "static",
  "docs",
  "help",
  "support",
  "status",
  "blog",
]);

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Resolve organization from hostname
 *
 * This function checks if the hostname is:
 * 1. A subdomain of divestreams.com (e.g., demo.divestreams.com)
 * 2. A custom domain registered by an organization
 *
 * @param hostname - The hostname from the request (e.g., "demo.divestreams.com" or "diveshop.com")
 * @returns The resolved organization or null if not found
 */
export async function resolveOrganizationFromHost(
  hostname: string
): Promise<ResolvedOrganization | null> {
  // Normalize hostname (lowercase, remove port if present)
  const normalizedHost = normalizeHostname(hostname);

  // Check if it's a subdomain of divestreams.com
  const subdomain = extractSubdomain(normalizedHost);

  if (subdomain) {
    // It's a subdomain - look up by slug
    return resolveBySubdomain(subdomain);
  }

  // Not a subdomain - check if it's a custom domain
  return resolveByCustomDomain(normalizedHost);
}

/**
 * Resolve organization from subdomain (slug)
 *
 * @param subdomain - The subdomain/slug (e.g., "demo")
 * @returns The organization or null
 */
export async function resolveBySubdomain(
  subdomain: string
): Promise<ResolvedOrganization | null> {
  // Check for reserved subdomains
  if (RESERVED_SUBDOMAINS.has(subdomain.toLowerCase())) {
    return null;
  }

  try {
    const result = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        customDomain: organization.customDomain,
        publicSiteSettings: organization.publicSiteSettings,
      })
      .from(organization)
      .where(eq(organization.slug, subdomain.toLowerCase()))
      .limit(1);

    return result[0] ?? null;
  } catch (error) {
    logger.error({ err: error }, "Error resolving organization by subdomain");
    return null;
  }
}

/**
 * Resolve organization from custom domain
 *
 * @param domain - The custom domain (e.g., "myshop.com")
 * @returns The organization or null
 */
export async function resolveByCustomDomain(
  domain: string
): Promise<ResolvedOrganization | null> {
  try {
    // Use case-insensitive comparison for domain lookup
    const normalizedDomain = domain.toLowerCase();

    const result = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        customDomain: organization.customDomain,
        publicSiteSettings: organization.publicSiteSettings,
      })
      .from(organization)
      .where(sql`LOWER(${organization.customDomain}) = ${normalizedDomain}`)
      .limit(1);

    return result[0] ?? null;
  } catch (error) {
    logger.error({ err: error, domain }, "Error resolving organization by custom domain");
    return null;
  }
}

/**
 * Full domain resolution with detailed result
 *
 * @param hostname - The hostname to resolve
 * @returns Detailed result including resolution type and errors
 */
export async function resolveDomain(
  hostname: string
): Promise<DomainResolutionResult> {
  const normalizedHost = normalizeHostname(hostname);

  // Check if it's a subdomain of divestreams.com
  const subdomain = extractSubdomain(normalizedHost);

  if (subdomain) {
    if (RESERVED_SUBDOMAINS.has(subdomain.toLowerCase())) {
      return {
        success: false,
        error: `Subdomain "${subdomain}" is reserved`,
      };
    }

    const org = await resolveBySubdomain(subdomain);
    if (org) {
      return { success: true, organization: org, type: "subdomain" };
    }
    return {
      success: false,
      error: `No organization found for subdomain "${subdomain}"`,
    };
  }

  // Try custom domain
  const org = await resolveByCustomDomain(normalizedHost);
  if (org) {
    return { success: true, organization: org, type: "customDomain" };
  }

  return {
    success: false,
    error: `No organization found for domain "${normalizedHost}"`,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize hostname by removing port and converting to lowercase
 *
 * @param hostname - Raw hostname (may include port)
 * @returns Normalized hostname
 */
export function normalizeHostname(hostname: string): string {
  // Remove port if present
  const withoutPort = hostname.split(":")[0];
  // Convert to lowercase
  return withoutPort.toLowerCase();
}

/**
 * Extract subdomain from hostname if it's a divestreams.com subdomain
 *
 * @param hostname - Normalized hostname
 * @returns Subdomain or null if not a divestreams subdomain
 */
export function extractSubdomain(hostname: string): string | null {
  // Check if hostname ends with main domain
  const mainDomainSuffix = `.${getMainDomain()}`;

  if (!hostname.endsWith(mainDomainSuffix)) {
    // Also check for exact main domain (no subdomain)
    if (hostname === getMainDomain()) {
      return null;
    }
    // Not a divestreams.com domain
    return null;
  }

  // Extract subdomain (everything before .divestreams.com)
  const subdomain = hostname.slice(0, -mainDomainSuffix.length);

  // Ensure it's a valid single-level subdomain (no additional dots)
  if (subdomain.includes(".")) {
    // Multi-level subdomain (e.g., sub.demo.divestreams.com)
    // For now, we only support single-level subdomains
    return null;
  }

  return subdomain || null;
}

/**
 * Check if a hostname is the main DiveStreams domain (no subdomain)
 *
 * @param hostname - Hostname to check
 * @returns True if it's the main domain
 */
export function isMainDomain(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === getMainDomain() || normalized === `www.${getMainDomain()}`;
}

/**
 * Check if a subdomain is reserved
 *
 * @param subdomain - Subdomain to check
 * @returns True if reserved
 */
export function isReservedSubdomain(subdomain: string): boolean {
  return RESERVED_SUBDOMAINS.has(subdomain.toLowerCase());
}

/**
 * Get the public site URL for an organization
 *
 * @param org - Organization with slug and optionally customDomain
 * @returns The public site URL
 */
export function getPublicSiteUrlForOrg(org: {
  slug: string;
  customDomain: string | null;
}): string {
  // Prefer custom domain if set
  if (org.customDomain) {
    return `https://${org.customDomain}`;
  }

  // Fall back to subdomain
  return `https://${org.slug}.${getMainDomain()}`;
}

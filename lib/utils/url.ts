/**
 * URL utilities for multi-tenant subdomain routing
 *
 * Supports both production and staging environments:
 * - Production: divestreams.com, admin.divestreams.com, {tenant}.divestreams.com
 * - Staging: staging.divestreams.com, admin-staging.divestreams.com, {tenant}.staging.divestreams.com
 */

/**
 * Production URL constant - ALWAYS used unless explicitly overridden by APP_URL
 * This ensures we never accidentally use localhost in production builds
 */
const PRODUCTION_URL = "https://divestreams.com";
const STAGING_URL = "https://staging.divestreams.com";

/**
 * Check if we're in staging environment based on APP_URL
 */
export function isStaging(): boolean {
  const appUrl = process.env.APP_URL;
  return appUrl?.includes("staging.divestreams.com") ?? false;
}

/**
 * Get the appropriate base URL
 *
 * Priority:
 * 1. APP_URL environment variable (if set)
 * 2. Production URL (https://divestreams.com) - default for production
 *
 * Note: localhost values are rejected in production to prevent URL leaks.
 * In CI/test environments, localhost is allowed.
 */
function getBaseUrl(): string {
  const appUrl = process.env.APP_URL;

  // Detect test/CI environment - check multiple indicators
  const isTestEnv =
    process.env.CI === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.GITHUB_ACTIONS === "true" ||
    process.env.VITEST === "true" ||
    process.env.PLAYWRIGHT_TEST_BASE_URL !== undefined;

  // In test/CI environments, allow localhost URLs
  if (appUrl && (isTestEnv || !appUrl.includes("localhost"))) {
    return appUrl;
  }

  // Default to production URL
  return PRODUCTION_URL;
}

/**
 * Get the full URL for a tenant subdomain
 *
 * @param subdomain - The tenant's subdomain (e.g., "demo")
 * @param path - Optional path to append (e.g., "/app")
 * @returns Full URL like "https://demo.divestreams.com/app" or "https://demo.staging.divestreams.com/app"
 */
export function getTenantUrl(subdomain: string, path = ""): string {
  const appUrl = getBaseUrl();

  // Check if this is staging environment
  if (appUrl.includes("staging.divestreams.com")) {
    // Staging: tenant.staging.divestreams.com
    return `https://${subdomain}.staging.divestreams.com${path}`;
  }

  // Production or localhost: tenant.{host}
  const url = new URL(appUrl);
  return `${url.protocol}//${subdomain}.${url.host}${path}`;
}

/**
 * Get the admin URL for the current environment
 * Derives from APP_URL to work across all environments:
 * - Production: https://admin.divestreams.com
 * - Test: https://admin.test.divestreams.com
 * - Dev: https://admin.dev.divestreams.com
 * - Localhost: https://admin.localhost:5173
 */
export function getAdminUrl(path = ""): string {
  const appUrl = getBaseUrl();
  const url = new URL(appUrl);
  return `${url.protocol}//admin.${url.host}${path}`;
}

/**
 * Get the base app URL
 * @returns The APP_URL if set, otherwise production URL
 */
export function getAppUrl(): string {
  return getBaseUrl();
}

/**
 * Get the base domain from APP_URL
 * @returns Just the domain like "divestreams.com" or "staging.divestreams.com"
 */
export function getBaseDomain(): string {
  const appUrl = getBaseUrl();
  const url = new URL(appUrl);
  return url.host;
}

/**
 * Get the root domain (always divestreams.com regardless of staging)
 * @returns "divestreams.com"
 */
export function getRootDomain(): string {
  return "divestreams.com";
}

// ============================================================================
// SUBDOMAIN EXTRACTION
// ============================================================================

/**
 * Extract subdomain from a host string.
 *
 * Handles all deployment environments:
 * - localhost dev: `{tenant}.localhost:5173`
 * - Production:    `{tenant}.divestreams.com`
 * - Staging:       `{tenant}.staging.divestreams.com`
 *
 * Returns null when the host does not contain a subdomain, including:
 * - Plain localhost (no subdomain)
 * - Base domain without subdomain (divestreams.com, staging.divestreams.com)
 * - The `www` subdomain (not a real subdomain)
 * - The `staging` label in production position (staging.divestreams.com)
 *
 * Note: This function returns `"admin"` for admin.divestreams.com and similar.
 * Callers that only want tenant subdomains should additionally filter out
 * `"admin"` and any other non-tenant subdomains.
 *
 * @param host - The host string (e.g. from `url.host`), may include a port
 * @returns The subdomain in lowercase, or null
 */
export function getSubdomainFromHost(host: string): string | null {
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
      // Ignore www as it's not a real subdomain
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
 * Extract subdomain (tenant slug) from a Request object.
 *
 * Convenience wrapper around `getSubdomainFromHost` that extracts the host
 * from the request URL automatically.
 *
 * @param request - The incoming Request
 * @returns The tenant subdomain in lowercase, or null
 */
export function getSubdomainFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  return getSubdomainFromHost(url.host);
}

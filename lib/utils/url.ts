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
 * @returns Admin URL like "https://admin.divestreams.com" or "https://admin.staging.divestreams.com"
 */
export function getAdminUrl(path = ""): string {
  if (isStaging()) {
    return `https://admin.staging.divestreams.com${path}`;
  }
  return `https://admin.divestreams.com${path}`;
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

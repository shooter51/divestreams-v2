/**
 * URL utilities for multi-tenant subdomain routing
 */

/**
 * Production URL constant - ALWAYS used unless explicitly overridden by APP_URL
 * This ensures we never accidentally use localhost in production builds
 */
const PRODUCTION_URL = "https://divestreams.com";

/**
 * Get the appropriate base URL
 *
 * Priority:
 * 1. APP_URL environment variable (if set)
 * 2. Production URL (https://divestreams.com) - default for production
 *
 * Note: localhost values are rejected in production to prevent URL leaks.
 * In CI/test environments (CI=true or NODE_ENV=test), localhost is allowed.
 */
function getBaseUrl(): string {
  const appUrl = process.env.APP_URL;
  const isTestEnv = process.env.CI === "true" || process.env.NODE_ENV === "test";

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
 * @returns Full URL like "https://demo.divestreams.com/app"
 */
export function getTenantUrl(subdomain: string, path = ""): string {
  const appUrl = getBaseUrl();
  const url = new URL(appUrl);
  return `${url.protocol}//${subdomain}.${url.host}${path}`;
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
 * @returns Just the domain like "divestreams.com"
 */
export function getBaseDomain(): string {
  const appUrl = getBaseUrl();
  const url = new URL(appUrl);
  return url.host;
}

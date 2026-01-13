/**
 * URL utilities for multi-tenant subdomain routing
 */

/**
 * Production URL constant - used as fallback when APP_URL is not set in production
 */
const PRODUCTION_URL = "https://divestreams.com";

/**
 * Get the appropriate base URL based on environment
 * In production (NODE_ENV=production), uses APP_URL or falls back to production URL
 * In development, uses APP_URL or falls back to localhost
 */
function getBaseUrl(): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  // In production, always use the production URL as fallback
  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_URL;
  }

  // In development, use localhost
  return "http://localhost:5173";
}

/**
 * Get the full URL for a tenant subdomain
 * Uses APP_URL environment variable in production, falls back to localhost for development
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
 * Get the base app URL from environment
 * @returns The APP_URL or appropriate fallback based on environment
 */
export function getAppUrl(): string {
  return getBaseUrl();
}

/**
 * Get the base domain from APP_URL
 * @returns Just the domain like "divestreams.com" or "localhost:5173"
 */
export function getBaseDomain(): string {
  const appUrl = getBaseUrl();
  const url = new URL(appUrl);
  return url.host;
}

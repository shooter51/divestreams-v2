/**
 * URL utilities for multi-tenant subdomain routing
 */

/**
 * Get the full URL for a tenant subdomain
 * Uses APP_URL environment variable in production, falls back to localhost for development
 *
 * @param subdomain - The tenant's subdomain (e.g., "demo")
 * @param path - Optional path to append (e.g., "/app")
 * @returns Full URL like "https://demo.divestreams.com/app"
 */
export function getTenantUrl(subdomain: string, path = ""): string {
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const url = new URL(appUrl);
  return `${url.protocol}//${subdomain}.${url.host}${path}`;
}

/**
 * Get the base app URL from environment
 * @returns The APP_URL or localhost fallback
 */
export function getAppUrl(): string {
  return process.env.APP_URL || "http://localhost:5173";
}

/**
 * Get the base domain from APP_URL
 * @returns Just the domain like "divestreams.com" or "localhost:5173"
 */
export function getBaseDomain(): string {
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const url = new URL(appUrl);
  return url.host;
}

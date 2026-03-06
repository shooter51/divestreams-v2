/**
 * URL utilities for multi-tenant subdomain routing
 *
 * Supports all deployment environments:
 * - Production: divestreams.com, admin.divestreams.com, {tenant}.divestreams.com
 * - Staging: staging.divestreams.com, admin.staging.divestreams.com, {tenant}.staging.divestreams.com
 * - Test: test.divestreams.com, admin.test.divestreams.com, {tenant}.test.divestreams.com
 * - Dev: dev.divestreams.com, admin.dev.divestreams.com, {tenant}.dev.divestreams.com
 * - Localhost: localhost:5173, admin.localhost:5173, {tenant}.localhost:5173
 */

/**
 * Production URL constant - ALWAYS used unless explicitly overridden by APP_URL
 * This ensures we never accidentally use localhost in production builds
 */
const PRODUCTION_URL = "https://divestreams.com";
/** Known environment subdomains that are NOT tenant names */
const ENV_SUBDOMAINS = ["dev", "test", "staging"];

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
 * Extract the environment base domain from APP_URL.
 * Strips any tenant/instance subdomain, keeping only the environment root.
 *
 * Examples:
 *   divestreams.com                 → { protocol: "https:", baseDomain: "divestreams.com" }
 *   demo.divestreams.com            → { protocol: "https:", baseDomain: "divestreams.com" }
 *   staging.divestreams.com         → { protocol: "https:", baseDomain: "staging.divestreams.com" }
 *   demo.staging.divestreams.com    → { protocol: "https:", baseDomain: "staging.divestreams.com" }
 *   test.divestreams.com            → { protocol: "https:", baseDomain: "test.divestreams.com" }
 *   demo.dev.divestreams.com        → { protocol: "https:", baseDomain: "dev.divestreams.com" }
 *   localhost:5173                  → { protocol: "https:", baseDomain: "localhost:5173" }
 *   demo.localhost:5173             → { protocol: "https:", baseDomain: "localhost:5173" }
 */
function getEnvBase(): { protocol: string; baseDomain: string } {
  const appUrl = getBaseUrl();
  const url = new URL(appUrl);
  const host = url.host;

  // Localhost: strip any subdomain prefix
  if (host.includes("localhost")) {
    const match = host.match(/(localhost(?::\d+)?)/);
    return { protocol: url.protocol, baseDomain: match ? match[1] : "localhost" };
  }

  // For divestreams.com domains
  const parts = host.split(".");
  const rootDomain = parts.slice(-2).join("."); // "divestreams.com"
  const subdomains = parts.slice(0, -2);

  // Find known environment subdomain (dev, test, staging)
  for (const env of ENV_SUBDOMAINS) {
    if (subdomains.includes(env)) {
      return { protocol: url.protocol, baseDomain: `${env}.${rootDomain}` };
    }
  }

  // Production
  return { protocol: url.protocol, baseDomain: rootDomain };
}

/**
 * Get the full URL for a tenant subdomain
 *
 * @param subdomain - The tenant's subdomain (e.g., "demo")
 * @param path - Optional path to append (e.g., "/app")
 * @returns Full URL like "https://demo.divestreams.com/app" or "https://demo.dev.divestreams.com/app"
 */
export function getTenantUrl(subdomain: string, path = ""): string {
  const { protocol, baseDomain } = getEnvBase();
  return `${protocol}//${subdomain}.${baseDomain}${path}`;
}

/**
 * Get the admin URL for the current environment.
 * Strips any tenant/instance subdomain and prepends "admin.":
 * - Production: admin.divestreams.com
 * - Staging:    admin.staging.divestreams.com
 * - Test:       admin.test.divestreams.com
 * - Dev:        admin.dev.divestreams.com
 * - Localhost:  admin.localhost:5173
 */
export function getAdminUrl(path = ""): string {
  const { protocol, baseDomain } = getEnvBase();
  return `${protocol}//admin.${baseDomain}${path}`;
}

/**
 * Get the base app URL
 * @returns The APP_URL if set, otherwise production URL
 */
export function getAppUrl(): string {
  return getBaseUrl();
}

/**
 * Get the environment base domain (stripping any tenant/instance subdomain)
 * @returns Domain like "divestreams.com", "dev.divestreams.com", "staging.divestreams.com"
 */
export function getBaseDomain(): string {
  return getEnvBase().baseDomain;
}

/**
 * Get the root domain (always divestreams.com regardless of environment)
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

  const parts = host.split(".");

  // Handle environment roots and tenant subdomains for dev/test/staging
  // e.g. test.divestreams.com (3 parts) → null (env root, no tenant)
  //      demo.test.divestreams.com (4 parts) → "demo" (tenant on test env)
  if (parts.length >= 3) {
    const envPart = parts[parts.length - 3]; // 3rd from end: "test", "dev", "staging"
    if (ENV_SUBDOMAINS.includes(envPart)) {
      if (parts.length === 3) {
        // e.g. test.divestreams.com — environment root, no tenant
        return null;
      }
      // e.g. demo.test.divestreams.com — tenant subdomain
      const subdomain = parts[0].toLowerCase();
      return subdomain === "www" ? null : subdomain;
    }
  }

  // Handle production: subdomain.divestreams.com
  if (parts.length >= 3) {
    const subdomain = parts[0].toLowerCase();
    if (subdomain === "www" || ENV_SUBDOMAINS.includes(subdomain)) {
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

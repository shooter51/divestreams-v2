/**
 * CSRF Protection Module
 *
 * Provides HMAC-based CSRF token generation and validation for form submissions.
 * Tokens are tied to the user's session and have a configurable time-to-live.
 *
 * Token format: `timestamp.hmac(AUTH_SECRET, sessionId + timestamp)`
 *
 * This protects against cross-site request forgery in our multi-subdomain
 * architecture where SameSite=Lax cookies alone are insufficient.
 */

import crypto from "node:crypto";

/** How long a CSRF token remains valid (default: 4 hours) */
const CSRF_TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

// Import and re-export from shared constants (safe for both server and client)
import { CSRF_FIELD_NAME } from "./csrf-constants";
export { CSRF_FIELD_NAME };

/**
 * Get the HMAC secret from environment.
 * Falls back through AUTH_SECRET and BETTER_AUTH_SECRET.
 */
function getSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("CSRF: AUTH_SECRET environment variable is not set");
  }
  return secret;
}

/**
 * Generate an HMAC-based CSRF token tied to a session.
 *
 * @param sessionId - The current user's session ID
 * @returns A token string in the format `timestamp.hmac`
 */
export function generateCsrfToken(sessionId: string): string {
  const timestamp = Date.now().toString();
  const secret = getSecret();
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(sessionId + timestamp)
    .digest("hex");
  return `${timestamp}.${hmac}`;
}

/**
 * Validate a CSRF token against the session.
 *
 * Checks that:
 * 1. The token has the correct format (timestamp.hmac)
 * 2. The token has not expired (within CSRF_TOKEN_TTL_MS)
 * 3. The HMAC matches when recomputed with the session ID
 *
 * @param sessionId - The current user's session ID
 * @param token - The token value from the form submission
 * @param ttlMs - Optional custom TTL in milliseconds (default: 4 hours)
 * @returns true if the token is valid
 */
export function validateCsrfToken(
  sessionId: string,
  token: string | null,
  ttlMs: number = CSRF_TOKEN_TTL_MS
): boolean {
  if (!token || typeof token !== "string") {
    return false;
  }

  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) {
    return false;
  }

  const timestamp = token.substring(0, dotIndex);
  const receivedHmac = token.substring(dotIndex + 1);

  // Check timestamp is a valid number
  const timestampNum = Number(timestamp);
  if (Number.isNaN(timestampNum)) {
    return false;
  }

  // Check token has not expired
  const age = Date.now() - timestampNum;
  if (age < 0 || age > ttlMs) {
    return false;
  }

  // Recompute the HMAC and compare using timing-safe comparison
  const secret = getSecret();
  const expectedHmac = crypto
    .createHmac("sha256", secret)
    .update(sessionId + timestamp)
    .digest("hex");

  // Timing-safe comparison to prevent timing attacks
  if (receivedHmac.length !== expectedHmac.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(receivedHmac, "utf8"),
    Buffer.from(expectedHmac, "utf8")
  );
}

/**
 * Generate a CSRF token for unauthenticated forms (login, signup).
 *
 * Uses a static prefix ("anon") instead of a session ID. This still provides
 * meaningful CSRF protection because:
 * 1. The token proves the form was rendered by our server (HMAC with AUTH_SECRET)
 * 2. The token has a timestamp that prevents replay after expiry
 * 3. An attacker on another domain cannot forge a valid HMAC
 *
 * @returns A token string in the format `timestamp.hmac`
 */
export function generateAnonCsrfToken(): string {
  return generateCsrfToken("anon");
}

/**
 * Validate a CSRF token from an unauthenticated form.
 *
 * @param token - The token value from the form submission
 * @returns true if the token is valid
 */
export function validateAnonCsrfToken(token: string | null): boolean {
  return validateCsrfToken("anon", token);
}

/** HTTP methods that are safe (read-only) and do not need CSRF validation */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** URL path prefixes that use their own authentication and skip CSRF */
const CSRF_EXEMPT_PATHS = [
  "/api/stripe-webhook",
  "/api/zapier/",
  "/api/auth/",
  "/api/health",
  "/api/integrations/",
];

/**
 * Validate CSRF token from a Request's form data.
 *
 * This is the main helper for use in action functions. It:
 * - Skips validation for safe HTTP methods (GET, HEAD, OPTIONS)
 * - Skips validation for API routes with their own auth (webhooks, Zapier, etc.)
 * - Extracts the `_csrf` field from form data
 * - Validates against the session
 * - Throws a 403 Response if invalid
 *
 * IMPORTANT: Call this BEFORE reading form data in your action, since
 * Request.formData() can only be read once. This function clones the
 * request internally.
 *
 * @param request - The incoming Request object
 * @param sessionId - The current user's session ID
 * @throws Response with status 403 if CSRF validation fails
 */
export async function requireCsrf(
  request: Request,
  sessionId: string
): Promise<void> {
  // Skip for safe methods
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return;
  }

  // Skip for exempt API paths
  const url = new URL(request.url);
  for (const prefix of CSRF_EXEMPT_PATHS) {
    if (url.pathname.startsWith(prefix)) {
      return;
    }
  }

  // Clone the request so the original formData can still be read by the action
  const clonedRequest = request.clone();

  let token: string | null = null;
  try {
    const formData = await clonedRequest.formData();
    token = formData.get(CSRF_FIELD_NAME) as string | null;
  } catch {
    // If the request body is not form data (e.g., JSON API), skip validation.
    // JSON APIs should use their own auth mechanisms.
    return;
  }

  if (!token) {
    throw new Response("Forbidden: Missing CSRF token", {
      status: 403,
      statusText: "Forbidden",
    });
  }

  if (!validateCsrfToken(sessionId, token)) {
    throw new Response("Forbidden: Invalid CSRF token", {
      status: 403,
      statusText: "Forbidden",
    });
  }
}

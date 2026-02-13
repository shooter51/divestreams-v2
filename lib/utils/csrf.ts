/**
 * CSRF Protection
 * 
 * Provides CSRF token generation and validation.
 * Uses the double-submit cookie pattern with signed tokens.
 * 
 * Usage:
 *   // In loader - generate token and set cookie
 *   const { token, cookie } = generateCsrfToken();
 *   return json({ csrfToken: token }, { headers: { "Set-Cookie": cookie } });
 *   
 *   // In form - include hidden field
 *   <input type="hidden" name="_csrf" value={csrfToken} />
 *   
 *   // In action - validate token
 *   const error = await validateCsrfToken(request);
 *   if (error) return { error };
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const CSRF_COOKIE_NAME = "__csrf";
const CSRF_FORM_FIELD = "_csrf";
const TOKEN_VALIDITY_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.CSRF_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET or CSRF_SECRET must be set in production");
  }
  return secret || "dev-csrf-secret-not-for-production";
}

/**
 * Generate a signed CSRF token and cookie
 */
export function generateCsrfToken(): { token: string; cookie: string } {
  const secret = getSecret();
  const timestamp = Date.now().toString(36);
  const random = randomBytes(16).toString("hex");
  const payload = `${timestamp}.${random}`;
  
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
    .slice(0, 16);
  
  const token = `${payload}.${signature}`;
  
  const cookieOptions = [
    `${CSRF_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
  ];
  
  if (process.env.NODE_ENV === "production") {
    cookieOptions.push("Secure");
  }
  
  return {
    token,
    cookie: cookieOptions.join("; "),
  };
}

/**
 * Parse cookie header to get a specific cookie value
 */
function getCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [key, value] = cookie.split("=");
    if (key === name) return value;
  }
  return null;
}

/**
 * Validate CSRF token from request
 * 
 * Checks that:
 * 1. Form token matches cookie token (double-submit)
 * 2. Token signature is valid
 * 3. Token hasn't expired
 * 
 * @returns Error message if invalid, null if valid
 */
export async function validateCsrfToken(request: Request): Promise<string | null> {
  // Skip for GET, HEAD, OPTIONS (read-only methods)
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return null;
  }
  
  const cookieHeader = request.headers.get("cookie");
  const cookieToken = getCookie(cookieHeader, CSRF_COOKIE_NAME);
  
  if (!cookieToken) {
    return "CSRF validation failed: missing cookie";
  }
  
  // Get form token
  let formToken: string | null = null;
  
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.clone().formData();
      formToken = formData.get(CSRF_FORM_FIELD) as string | null;
    } catch {
      // Couldn't parse form data
    }
  } else if (contentType.includes("application/json")) {
    try {
      const body = await request.clone().json();
      formToken = body[CSRF_FORM_FIELD];
    } catch {
      // Couldn't parse JSON
    }
  }
  
  // Also check header for API requests
  if (!formToken) {
    formToken = request.headers.get("x-csrf-token");
  }
  
  if (!formToken) {
    return "CSRF validation failed: missing token";
  }
  
  // Tokens must match (double-submit pattern)
  if (cookieToken !== formToken) {
    return "CSRF validation failed: token mismatch";
  }
  
  // Validate token format and signature
  const parts = cookieToken.split(".");
  if (parts.length !== 3) {
    return "CSRF validation failed: invalid token format";
  }
  
  const [timestamp, random, providedSignature] = parts;
  const secret = getSecret();
  const payload = `${timestamp}.${random}`;
  
  const expectedSignature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
    .slice(0, 16);
  
  // Timing-safe comparison
  try {
    const isValid = timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature)
    );
    if (!isValid) {
      return "CSRF validation failed: invalid signature";
    }
  } catch {
    return "CSRF validation failed: invalid signature";
  }
  
  // Check expiry
  const tokenTime = parseInt(timestamp, 36);
  if (Date.now() - tokenTime > TOKEN_VALIDITY_MS) {
    return "CSRF validation failed: token expired";
  }
  
  return null; // Valid
}

/**
 * React component helper - renders hidden CSRF input
 */
export function CsrfInput({ token }: { token: string }) {
  return `<input type="hidden" name="${CSRF_FORM_FIELD}" value="${token}" />`;
}

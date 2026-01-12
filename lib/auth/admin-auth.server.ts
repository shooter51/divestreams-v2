import { redirect } from "react-router";

const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

// Simple signing using HMAC-like approach with the password itself
function signValue(value: string, secret: string): string {
  // Create a simple hash by combining value with secret
  const encoder = new TextEncoder();
  const data = encoder.encode(value + secret);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data[i]) | 0;
  }
  return `${value}.${hash.toString(36)}`;
}

function verifySignedValue(signed: string, secret: string): string | null {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;

  const value = signed.substring(0, lastDot);
  const expectedSigned = signValue(value, secret);

  if (signed === expectedSigned) {
    return value;
  }
  return null;
}

export function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD environment variable is not set");
  }
  return password;
}

export function validateAdminPassword(input: string): boolean {
  return input === getAdminPassword();
}

export function createAdminSessionCookie(): string {
  const password = getAdminPassword();
  const timestamp = Date.now().toString();
  const signed = signValue(timestamp, password);

  return `${COOKIE_NAME}=${signed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}; Secure`;
}

export function clearAdminSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`;
}

export function isAdminAuthenticated(request: Request): boolean {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return false;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === COOKIE_NAME && value) {
      const password = getAdminPassword();
      const timestamp = verifySignedValue(value, password);

      if (timestamp) {
        // Check if session is still valid (within 24 hours)
        const sessionTime = parseInt(timestamp, 10);
        const now = Date.now();
        const maxAge = COOKIE_MAX_AGE * 1000;

        if (now - sessionTime < maxAge) {
          return true;
        }
      }
    }
  }

  return false;
}

export function requireAdmin(request: Request): void {
  if (!isAdminAuthenticated(request)) {
    throw redirect("/login");
  }
}

// Check if request is on admin subdomain
export function isAdminSubdomain(request: Request): boolean {
  const url = new URL(request.url);
  const host = url.hostname;

  // Handle localhost development: admin.localhost
  if (host.includes("localhost")) {
    const parts = host.split(".");
    return parts[0] === "admin";
  }

  // Production: admin.divestreams.com
  const parts = host.split(".");
  return parts.length >= 3 && parts[0] === "admin";
}

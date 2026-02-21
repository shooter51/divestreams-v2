/**
 * Shared E2E URL helpers — derive all URLs from BASE_URL env var.
 *
 * Local:  BASE_URL=http://localhost:5173
 *   getTenantUrl("demo", "/tenant")  → http://demo.localhost:5173/tenant
 *   getAdminUrl("/login")            → http://admin.localhost:5173/login
 *   getBaseUrl("/signup")            → http://localhost:5173/signup
 *   getEmbedUrl("demo", "/courses")  → http://localhost:5173/embed/demo/courses
 *
 * Remote: BASE_URL=https://test.divestreams.com
 *   getTenantUrl("demo", "/tenant")  → https://demo.test.divestreams.com/tenant
 *   getAdminUrl("/login")            → https://admin.test.divestreams.com/login
 *   getBaseUrl("/signup")            → https://test.divestreams.com/signup
 *   getEmbedUrl("demo", "/courses")  → https://test.divestreams.com/embed/demo/courses
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

function parseBase(): { protocol: string; host: string } {
  const url = new URL(BASE_URL);
  return { protocol: url.protocol, host: url.host };
}

export function getTenantUrl(subdomain: string, path = ""): string {
  const { protocol, host } = parseBase();
  return `${protocol}//${subdomain}.${host}${path}`;
}

export function getAdminUrl(path = ""): string {
  const { protocol, host } = parseBase();
  return `${protocol}//admin.${host}${path}`;
}

export function getBaseUrl(path = ""): string {
  return `${BASE_URL}${path}`;
}

export function getEmbedUrl(subdomain: string, path = ""): string {
  return `${BASE_URL}/embed/${subdomain}${path}`;
}

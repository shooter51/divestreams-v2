/**
 * Validates and returns a safe redirect URL.
 * Prevents open redirect vulnerabilities by ensuring the URL is:
 * 1. A relative path (starts with /)
 * 2. Not a protocol-relative URL (doesn't start with //)
 * 3. Doesn't contain newlines or other injection characters
 */
export function getSafeRedirectUrl(
  redirectTo: string | null,
  defaultPath: string = "/tenant"
): string {
  if (!redirectTo) {
    return defaultPath;
  }

  // Must start with / but not //
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return defaultPath;
  }

  // No newlines, tabs, or other control characters
  if (/[\r\n\t]/.test(redirectTo)) {
    return defaultPath;
  }

  // No URL-encoded control characters
  if (/%0[aAdD]/i.test(redirectTo)) {
    return defaultPath;
  }

  return redirectTo;
}

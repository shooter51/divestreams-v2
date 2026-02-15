/**
 * Test Helper: Redirect Assertions
 *
 * Helpers for asserting on redirect responses that may include query parameters.
 */

/**
 * Extract pathname from a redirect location header
 * Ignores query parameters and hash fragments
 */
export function getRedirectPathname(location: string | null): string {
  if (!location) return "";

  // If it's a full URL, parse it
  try {
    const url = new URL(location, "http://localhost");
    return url.pathname;
  } catch {
    // If it's a relative path, split on ? or #
    const pathname = location.split("?")[0].split("#")[0];
    return pathname;
  }
}

/**
 * Assert that a response redirects to a specific pathname (ignoring query params)
 */
export function expectRedirectTo(response: Response, expectedPath: string): void {
  const location = response.headers.get("location");
  const actualPath = getRedirectPathname(location);

  if (actualPath !== expectedPath) {
    throw new Error(
      `Expected redirect to "${expectedPath}", but got "${actualPath}" (full location: "${location}")`
    );
  }
}

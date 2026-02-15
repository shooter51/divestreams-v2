/**
 * CsrfInput Component
 *
 * Renders a hidden input with the CSRF token for form submissions.
 * The token is sourced from the tenant layout loader data.
 *
 * Usage:
 *   <Form method="post">
 *     <CsrfInput />
 *     ... other fields ...
 *   </Form>
 *
 * The component gracefully renders nothing if no token is available,
 * so it is safe to include in forms that may render before the layout
 * loader has run.
 */

import { useRouteLoaderData } from "react-router";
import { CSRF_FIELD_NAME } from "../../lib/security/csrf-constants";

/**
 * Shape of the tenant layout loader data that includes the CSRF token.
 * This is a minimal subset; the actual loader returns more fields.
 */
interface TenantLayoutData {
  csrfToken?: string;
}

/**
 * Hidden input that includes the CSRF token from the tenant layout.
 *
 * Retrieves the token from the route loader data for the tenant layout
 * route (routes/tenant/layout). Falls back gracefully if the token or
 * loader data is not available.
 */
export function CsrfInput() {
  // Try to get the CSRF token from the tenant layout loader data.
  // The route ID matches the layout path in routes.ts.
  const layoutData = useRouteLoaderData("routes/tenant/layout") as TenantLayoutData | undefined;
  const token = layoutData?.csrfToken;

  if (!token) {
    return null;
  }

  return <input type="hidden" name={CSRF_FIELD_NAME} value={token} />;
}

/**
 * Standalone CSRF input that accepts the token directly as a prop.
 * Useful for forms outside the tenant layout (e.g., login, signup).
 */
export function CsrfTokenInput({ token }: { token?: string }) {
  if (!token) {
    return null;
  }

  return <input type="hidden" name={CSRF_FIELD_NAME} value={token} />;
}

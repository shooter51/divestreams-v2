/**
 * QuickBooks OAuth Callback Handler
 *
 * This route handles the OAuth callback from QuickBooks (Intuit) after the user
 * authorizes the accounting integration. It exchanges the code for tokens,
 * stores the credentials, and redirects back to the integrations page.
 *
 * Route: /api/integrations/quickbooks/callback
 *
 * QuickBooks callback includes:
 * - code: Authorization code to exchange for tokens
 * - state: Our encoded state (orgId + nonce)
 * - realmId: The QuickBooks company ID (required for API calls)
 */

import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import {
  parseOAuthState,
  handleQuickBooksCallback,
} from "../../../../../lib/integrations/quickbooks.server";
import { getSubdomainFromRequest } from "../../../../../lib/auth/org-context.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const realmId = url.searchParams.get("realmId");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  // Get subdomain for proper redirect
  const subdomain = getSubdomainFromRequest(request);

  // Build redirect URL based on subdomain
  const getRedirectUrl = (path: string) => {
    if (subdomain) {
      const baseUrl = new URL(process.env.APP_URL || "http://localhost:5173");
      return `${baseUrl.protocol}//${subdomain}.${baseUrl.host}${path}`;
    }
    return path;
  };

  // Handle OAuth errors
  if (error) {
    console.error("QuickBooks OAuth error:", error, errorDescription);
    const errorMessage = encodeURIComponent(
      error === "access_denied"
        ? "You declined the QuickBooks access request."
        : errorDescription || `QuickBooks authorization failed: ${error}`
    );
    return redirect(
      getRedirectUrl(`/app/settings/integrations?error=${errorMessage}`)
    );
  }

  // Validate required parameters
  if (!code) {
    return redirect(
      getRedirectUrl(
        "/tenant/settings/integrations?error=" +
          encodeURIComponent("Missing authorization code")
      )
    );
  }

  if (!state) {
    return redirect(
      getRedirectUrl(
        "/tenant/settings/integrations?error=" +
          encodeURIComponent("Missing state parameter")
      )
    );
  }

  if (!realmId) {
    return redirect(
      getRedirectUrl(
        "/tenant/settings/integrations?error=" +
          encodeURIComponent("Missing company ID (realmId)")
      )
    );
  }

  try {
    // Parse and validate state
    const { orgId } = parseOAuthState(state);

    if (!orgId) {
      throw new Error("Invalid state: missing organization ID");
    }

    // Exchange code for tokens and store integration
    await handleQuickBooksCallback(code, realmId, orgId, subdomain || undefined);

    // Redirect back to integrations page with success message
    return redirect(
      getRedirectUrl(
        "/tenant/settings/integrations?success=" +
          encodeURIComponent("QuickBooks connected successfully!")
      )
    );
  } catch (err) {
    console.error("QuickBooks OAuth callback error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Failed to connect QuickBooks";
    return redirect(
      getRedirectUrl(
        `/app/settings/integrations?error=${encodeURIComponent(errorMessage)}`
      )
    );
  }
}

// This route only handles redirects, no UI needed
export default function QuickBooksCallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Connecting QuickBooks...</p>
      </div>
    </div>
  );
}

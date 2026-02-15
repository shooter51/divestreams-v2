/**
 * Google Calendar OAuth Callback Handler
 *
 * This route handles the OAuth callback from Google after the user
 * authorizes the calendar integration. It exchanges the code for tokens,
 * stores the credentials, and redirects back to the integrations page.
 *
 * Route: /api/integrations/google/callback
 */

import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import {
  parseOAuthState,
  handleGoogleCallback,
} from "../../../../../lib/integrations/google-calendar.server";
import { getSubdomainFromRequest } from "../../../../../lib/auth/org-context.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

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
    console.error("Google OAuth error:", error);
    const errorMessage = encodeURIComponent(
      error === "access_denied"
        ? "You declined the calendar access request."
        : `Google authorization failed: ${error}`
    );
    return redirect(
      getRedirectUrl(`/tenant/settings/integrations?error=${errorMessage}`)
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

  try {
    // Parse and validate state
    const { orgId } = parseOAuthState(state);

    if (!orgId) {
      throw new Error("Invalid state: missing organization ID");
    }

    // Exchange code for tokens and store integration
    await handleGoogleCallback(code, orgId, subdomain || undefined);

    // Redirect back to integrations page with success message
    return redirect(
      getRedirectUrl(
        "/tenant/settings/integrations?success=" +
          encodeURIComponent("Google Calendar connected successfully!")
      )
    );
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Failed to connect Google Calendar";
    return redirect(
      getRedirectUrl(
        `/tenant/settings/integrations?error=${encodeURIComponent(errorMessage)}`
      )
    );
  }
}

// This route only handles redirects, no UI needed
export default function GoogleCallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
        <p className="text-foreground-muted">Connecting Google Calendar...</p>
      </div>
    </div>
  );
}

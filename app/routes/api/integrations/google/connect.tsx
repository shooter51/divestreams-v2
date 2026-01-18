/**
 * Google Calendar OAuth Connection Initiation
 *
 * This route initiates the OAuth flow by redirecting the user to Google's
 * consent screen. After authorization, Google will redirect back to the
 * callback route.
 *
 * Route: /api/integrations/google/connect
 */

import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import {
  requireOrgContext,
  getSubdomainFromRequest,
} from "../../../../../lib/auth/org-context.server";
import { getGoogleAuthUrl } from "../../../../../lib/integrations/google-calendar.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Require authenticated organization context
  const { organizationId } = await requireOrgContext(request);

  // Get subdomain for callback URL
  const subdomain = getSubdomainFromRequest(request);

  try {
    // Generate Google OAuth authorization URL
    const authUrl = getGoogleAuthUrl(organizationId, subdomain || undefined);

    // Redirect to Google's consent screen
    return redirect(authUrl);
  } catch (error) {
    console.error("Failed to generate Google OAuth URL:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to connect to Google Calendar";

    // Redirect back to integrations page with error
    return redirect(
      `/app/settings/integrations?error=${encodeURIComponent(errorMessage)}`
    );
  }
}

// This route only handles redirects, no UI needed
export default function GoogleConnect() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to Google...</p>
      </div>
    </div>
  );
}

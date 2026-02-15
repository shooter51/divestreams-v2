/**
 * QuickBooks OAuth Connect Route
 *
 * This route initiates the QuickBooks OAuth flow by redirecting the user
 * to the Intuit authorization page.
 *
 * Route: /api/integrations/quickbooks/connect
 */

import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { getQuickBooksAuthUrl } from "../../../../../lib/integrations/quickbooks.server";
import {
  requireOrgContext,
  getSubdomainFromRequest,
} from "../../../../../lib/auth/org-context.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Require authenticated org context
  const { org } = await requireOrgContext(request);
  const subdomain = getSubdomainFromRequest(request);

  try {
    // Generate OAuth URL with org ID and subdomain
    const authUrl = getQuickBooksAuthUrl(org.id, subdomain || undefined);

    // Redirect to QuickBooks authorization page
    return redirect(authUrl);
  } catch (error) {
    console.error("Failed to generate QuickBooks auth URL:", error);

    // Redirect back to integrations page with error
    const errorMessage =
      error instanceof Error ? error.message : "Failed to start QuickBooks authorization";

    const getRedirectUrl = () => {
      if (subdomain) {
        const baseUrl = new URL(process.env.APP_URL || "http://localhost:5173");
        return `${baseUrl.protocol}//${subdomain}.${baseUrl.host}/tenant/settings/integrations`;
      }
      return "/tenant/settings/integrations";
    };

    return redirect(`${getRedirectUrl()}?error=${encodeURIComponent(errorMessage)}`);
  }
}

// This route only handles redirects, no UI needed
export default function QuickBooksConnect() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-success mx-auto mb-4"></div>
        <p className="text-gray-600">Connecting to QuickBooks...</p>
      </div>
    </div>
  );
}

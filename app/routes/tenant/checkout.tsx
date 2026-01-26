import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireOrgContext } from "../../../lib/auth/org-context.server";

/**
 * Checkout Route
 *
 * This route handles Stripe Checkout redirects after successful or canceled payments.
 * It processes the checkout session and redirects to the billing page with appropriate
 * status messages.
 */

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);

  // Check for session_id parameter from Stripe Checkout
  const sessionId = url.searchParams.get("session_id");
  const success = url.searchParams.get("success");
  const canceled = url.searchParams.get("canceled");

  // Build redirect URL with status
  const billingUrl = new URL("/tenant/settings/billing", url.origin);

  if (success === "true" || sessionId) {
    billingUrl.searchParams.set("success", "true");
  } else if (canceled === "true") {
    billingUrl.searchParams.set("canceled", "true");
  }

  return redirect(billingUrl.toString());
}

export default function CheckoutPage() {
  // This component won't be rendered as loader always redirects
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Processing checkout...</h1>
        <p className="text-foreground-muted">Please wait while we redirect you.</p>
      </div>
    </div>
  );
}

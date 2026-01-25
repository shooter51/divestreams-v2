/**
 * Onboarding Tour Complete API
 *
 * POST /tenant/onboarding/tour
 * Marks the product tour as completed.
 */

import type { ActionFunctionArgs } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { markTourCompleted } from "../../../../lib/db/onboarding.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const ctx = await requireOrgContext(request);
    const progress = await markTourCompleted(ctx.user.id);
    return Response.json({ success: true, progress });
  } catch (error) {
    console.error("Onboarding tour complete error:", error);
    return Response.json(
      { error: "Failed to mark tour complete" },
      { status: 500 }
    );
  }
}

export default function OnboardingTour() {
  return null;
}

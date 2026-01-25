/**
 * Onboarding Dismiss API
 *
 * POST /tenant/onboarding/dismiss
 * Dismisses or undismisses the onboarding widget.
 */

import type { ActionFunctionArgs } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import {
  dismissOnboarding,
  undismissOnboarding,
} from "../../../../lib/db/onboarding.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const ctx = await requireOrgContext(request);
    const formData = await request.formData();
    const actionType = formData.get("action") as string;

    if (actionType === "undismiss") {
      const progress = await undismissOnboarding(ctx.user.id);
      return Response.json({ success: true, progress });
    }

    const progress = await dismissOnboarding(ctx.user.id);
    return Response.json({ success: true, progress });
  } catch (error) {
    console.error("Onboarding dismiss error:", error);
    return Response.json(
      { error: "Failed to update dismiss status" },
      { status: 500 }
    );
  }
}

export default function OnboardingDismiss() {
  return null;
}

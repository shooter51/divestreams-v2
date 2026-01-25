/**
 * Onboarding Task Incomplete API
 *
 * POST /tenant/onboarding/incomplete
 * Marks a specific onboarding task as incomplete.
 */

import type { ActionFunctionArgs } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { markTaskIncomplete } from "../../../../lib/db/onboarding.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const ctx = await requireOrgContext(request);
    const formData = await request.formData();
    const taskId = formData.get("taskId") as string;

    if (!taskId) {
      return Response.json({ error: "Task ID required" }, { status: 400 });
    }

    const progress = await markTaskIncomplete(ctx.user.id, taskId);
    return Response.json({ success: true, progress });
  } catch (error) {
    console.error("Onboarding incomplete error:", error);
    return Response.json(
      { error: "Failed to mark task incomplete" },
      { status: 500 }
    );
  }
}

export default function OnboardingIncomplete() {
  return null;
}

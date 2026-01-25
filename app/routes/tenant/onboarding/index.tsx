/**
 * Onboarding Progress API
 *
 * GET /tenant/onboarding
 * Returns the current user's onboarding progress.
 */

import type { LoaderFunctionArgs } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { getOrCreateOnboardingProgress } from "../../../../lib/db/onboarding.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const progress = await getOrCreateOnboardingProgress(ctx.user.id);
  return { progress };
}

export default function OnboardingIndex() {
  return null;
}

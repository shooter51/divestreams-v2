import { redirect } from "react-router";
import type { PlanFeatureKey, PlanFeaturesObject, PlanLimits } from "./plan-features";
import { getUsage } from "./usage.server";

export function requireFeature(
  features: PlanFeaturesObject,
  feature: PlanFeatureKey
): void {
  if (!features[feature]) {
    throw redirect(`/tenant/dashboard?upgrade=${feature}`);
  }
}

export async function requireLimit(
  organizationId: string,
  limitType: keyof PlanLimits,
  limits: PlanLimits
): Promise<{ current: number; limit: number; remaining: number }> {
  const usage = await getUsage(organizationId);
  const current = usage[limitType];
  const limit = limits[limitType];

  if (limit !== -1 && current >= limit) {
    throw redirect(`/tenant/dashboard?limit_exceeded=${limitType}`);
  }

  return {
    current,
    limit,
    remaining: limit === -1 ? -1 : limit - current,
  };
}

import { createContext, useContext } from "react";
import type { PlanFeatureKey, PlanFeaturesObject, PlanLimits } from "./plan-features";
import { DEFAULT_PLAN_FEATURES, DEFAULT_PLAN_LIMITS } from "./plan-features";

export interface FeaturesContextValue {
  features: PlanFeaturesObject;
  limits: PlanLimits;
  planName: string;
}

export const FeaturesContext = createContext<FeaturesContextValue | null>(null);

export function useFeatures(): FeaturesContextValue {
  const ctx = useContext(FeaturesContext);
  if (!ctx) {
    // Return standard tier defaults if no context (shouldn't happen in normal use)
    return {
      features: DEFAULT_PLAN_FEATURES.standard,
      limits: DEFAULT_PLAN_LIMITS.standard,
      planName: "Standard",
    };
  }
  return ctx;
}

export function useHasFeature(feature: PlanFeatureKey): boolean {
  const { features } = useFeatures();
  return features[feature] ?? false;
}

export function usePlanLimits(): PlanLimits {
  const { limits } = useFeatures();
  return limits;
}

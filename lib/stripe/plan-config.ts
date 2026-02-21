/**
 * Centralized Subscription Plan Configuration
 *
 * SINGLE SOURCE OF TRUTH for all pricing information.
 *
 * When changing prices:
 * 1. Update this file
 * 2. Run: npm run stripe:setup (creates new Stripe prices)
 * 3. Run: npm run db:seed (updates database)
 * 4. Run: npm run stripe:verify (validates sync)
 * 5. Deploy via git push (CI/CD will verify)
 *
 * DO NOT edit prices directly in:
 * - Database (subscription_plans table)
 * - Stripe Dashboard
 * - Seed scripts
 */

import { DEFAULT_PLAN_FEATURES, type PlanFeaturesObject } from "../plan-features";

export interface PlanConfig {
  name: string;
  displayName: string;
  monthlyPrice: number; // in cents
  yearlyPrice: number; // in cents
  description: string;
  features: string[]; // Marketing descriptions for pricing page
  planFeatures: PlanFeaturesObject; // Boolean flags for feature gating
  limits: {
    users: number; // -1 = unlimited
    customers: number; // -1 = unlimited
    toursPerMonth: number; // -1 = unlimited
    storageGb: number;
  };
}

/**
 * All subscription plans
 *
 * Prices are in cents (e.g., 4900 = $49.00)
 */
export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  standard: {
    name: "standard",
    displayName: "Standard",
    monthlyPrice: 3000, // $30.00
    yearlyPrice: 28800, // $288.00 (save $72/year or 20%)
    description: "Perfect for dive shops running tours",
    features: [
      "Up to 3 users",
      "500 customers",
      "Tours & booking management",
      "Stripe payments",
      "25 tours per month",
      "Email support",
    ],
    planFeatures: DEFAULT_PLAN_FEATURES.standard,
    limits: {
      users: 3,
      customers: 500,
      toursPerMonth: 25,
      storageGb: 5,
    },
  },

  pro: {
    name: "pro",
    displayName: "Pro",
    monthlyPrice: 10000, // $100.00
    yearlyPrice: 96000, // $960.00 (save $240/year or 20%)
    description: "Everything you need to run your dive business",
    features: [
      "Unlimited users",
      "Unlimited customers",
      "Equipment & rental tracking",
      "Training management",
      "Point of Sale",
      "Public booking site",
      "All integrations",
      "API access",
      "Priority support",
    ],
    planFeatures: DEFAULT_PLAN_FEATURES.pro,
    limits: {
      users: -1, // unlimited
      customers: -1, // unlimited
      toursPerMonth: -1, // unlimited
      storageGb: 100,
    },
  },
} as const;

/**
 * Get plan config by name
 */
export function getPlanConfig(planName: string): PlanConfig | null {
  return PLAN_CONFIGS[planName] || null;
}

/**
 * Get all plan configs as array
 */
export function getAllPlanConfigs(): PlanConfig[] {
  return Object.values(PLAN_CONFIGS);
}

/**
 * Get all paid plans (excluding free)
 */
export function getPaidPlanConfigs(): PlanConfig[] {
  return Object.values(PLAN_CONFIGS).filter(plan => plan.monthlyPrice > 0);
}

/**
 * Validate that a price matches the config
 */
export function validatePrice(
  planName: string,
  billingPeriod: "monthly" | "yearly",
  priceInCents: number
): boolean {
  const config = PLAN_CONFIGS[planName];
  if (!config) return false;

  const expectedPrice = billingPeriod === "monthly"
    ? config.monthlyPrice
    : config.yearlyPrice;

  return priceInCents === expectedPrice;
}

/**
 * Format price for display
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Calculate yearly savings
 */
export function calculateYearlySavings(planName: string): {
  amountCents: number;
  percentOff: number;
} {
  const config = PLAN_CONFIGS[planName];
  if (!config || config.monthlyPrice === 0) {
    return { amountCents: 0, percentOff: 0 };
  }

  const monthlyTotal = config.monthlyPrice * 12;
  const yearlySavings = monthlyTotal - config.yearlyPrice;
  const percentOff = Math.round((yearlySavings / monthlyTotal) * 100);

  return {
    amountCents: yearlySavings,
    percentOff,
  };
}

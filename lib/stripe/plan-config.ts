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

export interface PlanConfig {
  name: string;
  displayName: string;
  monthlyPrice: number; // in cents
  yearlyPrice: number; // in cents
  description: string;
  features: string[];
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
  free: {
    name: "free",
    displayName: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Perfect for getting started",
    features: [
      "1 user",
      "50 customers",
      "Basic booking management",
      "5 tours per month",
      "Community support",
    ],
    limits: {
      users: 1,
      customers: 50,
      toursPerMonth: 5,
      storageGb: 0.5,
    },
  },

  starter: {
    name: "starter",
    displayName: "Starter",
    monthlyPrice: 4900, // $49.00
    yearlyPrice: 47000, // $470.00 (save $118/year or 20%)
    description: "Perfect for small dive shops getting started",
    features: [
      "Up to 3 users",
      "500 customers",
      "Booking management",
      "Public booking site",
      "Basic reporting",
      "Email support",
    ],
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
    monthlyPrice: 9900, // $99.00
    yearlyPrice: 95000, // $950.00 (save $238/year or 20%)
    description: "For growing dive shops that need more power",
    features: [
      "Up to 10 users",
      "5,000 customers",
      "Online booking widget",
      "Equipment & rental tracking",
      "Training management",
      "Point of Sale",
      "Advanced reporting",
      "Priority support",
      "API access",
    ],
    limits: {
      users: 10,
      customers: 5000,
      toursPerMonth: 100,
      storageGb: 25,
    },
  },

  enterprise: {
    name: "enterprise",
    displayName: "Enterprise",
    monthlyPrice: 19900, // $199.00
    yearlyPrice: 191000, // $1,910.00 (save $478/year or 20%)
    description: "For large operations and multiple locations",
    features: [
      "Unlimited users",
      "Unlimited customers",
      "Multi-location support",
      "Custom integrations",
      "Dedicated support",
      "White-label options",
      "SLA guarantee",
    ],
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

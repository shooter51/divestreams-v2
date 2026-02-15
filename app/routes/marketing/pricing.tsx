import type { MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import { useState } from "react";
import { db } from "../../../lib/db";
import { subscriptionPlans, type SubscriptionPlan } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";

export const meta: MetaFunction = () => {
  return [
    { title: "Pricing - DiveStreams" },
    { name: "description", content: "Simple, transparent pricing for dive shops of all sizes." },
  ];
};

// Helper to format cents to dollars
function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

// Helper to get description based on plan name
function getPlanDescription(name: string): string {
  const descriptions: Record<string, string> = {
    starter: "Perfect for small dive shops getting started",
    pro: "For growing shops that need more power",
    enterprise: "For large operations and multiple locations",
  };
  return descriptions[name.toLowerCase()] || "A great plan for your dive shop";
}

// Helper to determine if plan is popular
function isPlanPopular(name: string): boolean {
  return name.toLowerCase() === "pro";
}

// Helper to get CTA text
function getPlanCta(name: string): string {
  return name.toLowerCase() === "enterprise" ? "Contact Sales" : "Start Free Trial";
}

// Default fallback plans if database is unavailable
const DEFAULT_PLANS: Array<{
  id: string;
  name: string;
  displayName: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
}> = [
  {
    id: "default-starter",
    name: "starter",
    displayName: "Starter",
    monthlyPrice: 4900,
    yearlyPrice: 47000,
    features: [
      "Up to 3 users",
      "1,000 customers",
      "Booking management",
      "Basic reporting",
      "Email support",
    ],
  },
  {
    id: "default-pro",
    name: "pro",
    displayName: "Pro",
    monthlyPrice: 9900,
    yearlyPrice: 95000,
    features: [
      "Up to 10 users",
      "Unlimited customers",
      "Online booking widget",
      "Equipment tracking",
      "Advanced reporting",
      "Priority support",
      "API access",
    ],
  },
  {
    id: "default-enterprise",
    name: "enterprise",
    displayName: "Enterprise",
    monthlyPrice: 19900,
    yearlyPrice: 191000,
    features: [
      "Unlimited users",
      "Unlimited customers",
      "Multi-location support",
      "Custom integrations",
      "Dedicated support",
      "White-label options",
      "SLA guarantee",
    ],
  },
];

export const headers = () => ({
  "Cache-Control": "public, max-age=3600, s-maxage=86400",
});

export async function loader() {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true));

    // Sort plans by monthly price (ascending)
    plans.sort((a, b) => a.monthlyPrice - b.monthlyPrice);

    // If no plans in database, use defaults
    if (plans.length === 0) {
      return { plans: DEFAULT_PLANS };
    }

    return { plans };
  } catch (error) {
    // If database query fails, return default plans so page still renders
    console.error("Failed to fetch subscription plans from database:", error);
    return { plans: DEFAULT_PLANS };
  }
}

export default function PricingPage() {
  const { plans } = useLoaderData<typeof loader>();
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <div className="min-h-screen bg-surface-inset">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <a href="/" className="text-2xl font-bold text-brand">
          DiveStreams
        </a>
        <div className="flex gap-6 items-center">
          <a href="/features" className="text-foreground-muted hover:text-brand">
            Features
          </a>
          <a href="/pricing" className="text-brand font-medium">
            Pricing
          </a>
          <a href="/signup" className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover">
            Start Free Trial
          </a>
        </div>
      </nav>

      {/* Header */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-foreground-muted mb-8">
          Start with a 14-day free trial. No credit card required.
        </p>
        <div className="inline-flex items-center gap-2 bg-surface-raised rounded-full p-1 border">
          <button
            onClick={() => setBillingInterval('monthly')}
            className={`px-4 py-2 rounded-full transition-colors ${
              billingInterval === 'monthly'
                ? 'bg-brand text-white'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval('yearly')}
            className={`px-4 py-2 rounded-full transition-colors ${
              billingInterval === 'yearly'
                ? 'bg-brand text-white'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            Yearly (Save 20%)
          </button>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => {
            const popular = isPlanPopular(plan.name);
            const description = getPlanDescription(plan.name);
            const cta = getPlanCta(plan.name);
            const features: string[] = Array.isArray(plan.features) ? plan.features : [];

            const price = billingInterval === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const displayPrice = billingInterval === 'monthly'
              ? formatPrice(price)
              : formatPrice(Math.round(price / 12));
            const savingsPercent = billingInterval === 'yearly'
              ? Math.round((1 - (plan.yearlyPrice / (plan.monthlyPrice * 12))) * 100)
              : 0;

            return (
              <div
                key={plan.id}
                className={`bg-surface-raised rounded-2xl p-8 ${
                  popular
                    ? "ring-2 ring-brand shadow-lg relative"
                    : "border border-default"
                }`}
              >
                {popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand text-white px-4 py-1 rounded-full text-sm">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.displayName}</h3>
                <p className="text-foreground-muted mb-4">{description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{displayPrice}</span>
                  <span className="text-foreground-muted">/month</span>
                  {billingInterval === 'yearly' && savingsPercent > 0 && (
                    <div className="mt-2">
                      <span className="inline-block bg-success-muted text-success px-2 py-1 rounded text-xs font-medium">
                        Save {savingsPercent}%
                      </span>
                      <p className="text-xs text-foreground-muted mt-1">
                        Billed {formatPrice(price)} annually
                      </p>
                    </div>
                  )}
                </div>
                <ul className="space-y-3 mb-8">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-success"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  href="/signup"
                  className={`block text-center py-3 rounded-lg font-semibold ${
                    popular
                      ? "bg-brand text-white hover:bg-brand-hover"
                      : "border-2 border-brand text-brand hover:bg-brand-muted transition-all"
                  }`}
                >
                  {cta}
                </a>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Frequently Asked Questions
        </h2>
        <div className="max-w-2xl mx-auto space-y-6">
          <FaqItem
            question="Can I change plans later?"
            answer="Yes, you can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle."
          />
          <FaqItem
            question="What happens after my trial ends?"
            answer="After 14 days, you'll be asked to select a plan and add payment information. If you don't, your account will be paused until you subscribe."
          />
          <FaqItem
            question="Do you offer discounts for yearly billing?"
            answer="Yes! Save 20% when you choose annual billing. That's like getting 2+ months free."
          />
          <FaqItem
            question="Can I cancel anytime?"
            answer="Absolutely. There are no long-term contracts. Cancel anytime and you won't be charged again."
          />
        </div>
      </section>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-surface-raised p-6 rounded-lg border border-default">
      <h3 className="font-semibold mb-2">{question}</h3>
      <p className="text-foreground-muted">{answer}</p>
    </div>
  );
}

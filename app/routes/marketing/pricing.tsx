import type { MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
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
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <a href="/" className="text-2xl font-bold text-blue-600">
          DiveStreams
        </a>
        <div className="flex gap-6 items-center">
          <a href="/features" className="text-gray-600 hover:text-blue-600">
            Features
          </a>
          <a href="/pricing" className="text-blue-600 font-medium">
            Pricing
          </a>
          <a href="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Start Free Trial
          </a>
        </div>
      </nav>

      {/* Header */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Start with a 14-day free trial. No credit card required.
        </p>
        <div className="inline-flex items-center gap-2 bg-white rounded-full p-1 border">
          <button className="px-4 py-2 rounded-full bg-blue-600 text-white">
            Monthly
          </button>
          <button className="px-4 py-2 rounded-full text-gray-600">
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
            const features = Array.isArray(plan.features) ? plan.features : [];

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl p-8 ${
                  popular
                    ? "ring-2 ring-blue-600 shadow-lg relative"
                    : "border border-gray-200"
                }`}
              >
                {popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.displayName}</h3>
                <p className="text-gray-600 mb-4">{description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{formatPrice(plan.monthlyPrice)}</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-green-500"
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
                  className={`block text-center py-3 rounded-lg ${
                    popular
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "border border-gray-300 hover:bg-gray-50"
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
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="font-semibold mb-2">{question}</h3>
      <p className="text-gray-600">{answer}</p>
    </div>
  );
}

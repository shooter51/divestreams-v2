import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Pricing - DiveStreams" },
    { name: "description", content: "Simple, transparent pricing for dive shops of all sizes." },
  ];
};

const plans = [
  {
    name: "Starter",
    price: "$49",
    yearlyPrice: "$39",
    period: "/month",
    description: "Perfect for small dive shops getting started",
    features: [
      "Up to 3 team members",
      "1,000 customer records",
      "Booking management",
      "Basic reporting",
      "Email support",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Pro",
    price: "$99",
    yearlyPrice: "$79",
    period: "/month",
    description: "For growing shops that need more power",
    features: [
      "Up to 10 team members",
      "Unlimited customers",
      "Online booking widget",
      "Equipment tracking",
      "Advanced reporting",
      "Priority support",
      "API access",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$199",
    yearlyPrice: "$159",
    period: "/month",
    description: "For large operations and multiple locations",
    features: [
      "Unlimited team members",
      "Unlimited customers",
      "Multi-location support",
      "Custom integrations",
      "Dedicated support",
      "White-label options",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export default function PricingPage() {
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
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`bg-white rounded-2xl p-8 ${
                plan.popular
                  ? "ring-2 ring-blue-600 shadow-lg relative"
                  : "border border-gray-200"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm">
                  Most Popular
                </div>
              )}
              <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
              <p className="text-gray-600 mb-4">{plan.description}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-gray-600">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
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
                  plan.popular
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
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

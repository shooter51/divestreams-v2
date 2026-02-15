import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Features - DiveStreams" },
    { name: "description", content: "Explore all the features DiveStreams offers for dive shop management." },
  ];
};

export const headers = () => ({
  "Cache-Control": "public, max-age=3600, s-maxage=86400",
});

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-surface-raised">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <a href="/" className="text-2xl font-bold text-brand">
          DiveStreams
        </a>
        <div className="flex gap-6 items-center">
          <a href="/features" className="text-brand font-medium">
            Features
          </a>
          <a href="/pricing" className="text-foreground-muted hover:text-brand">
            Pricing
          </a>
          <a href="/signup" className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover">
            Start Free Trial
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Powerful Features for Modern Dive Shops
        </h1>
        <p className="text-xl text-foreground-muted max-w-2xl mx-auto">
          Everything you need to manage bookings, customers, equipment, and operations in one platform.
        </p>
      </section>

      {/* Feature Sections */}
      <section className="container mx-auto px-4 py-12 space-y-24">
        <FeatureSection
          title="Booking Management"
          description="Accept bookings online 24/7, manage your calendar, and reduce no-shows with automated reminders."
          features={[
            "Online booking widget for your website",
            "Calendar view with drag-and-drop scheduling",
            "Automated confirmation and reminder emails",
            "Deposit collection and payment processing",
            "Waitlist management for full trips",
          ]}
          align="left"
        />

        <FeatureSection
          title="Customer Management"
          description="Build lasting relationships with your customers by keeping all their information in one place."
          features={[
            "Complete customer profiles with contact info",
            "Certification tracking and verification",
            "Medical information and emergency contacts",
            "Dive history and preferences",
            "Marketing opt-in management",
          ]}
          align="right"
        />

        <FeatureSection
          title="Tour & Trip Planning"
          description="Create tour packages, schedule trips, and manage your fleet all from one dashboard."
          features={[
            "Tour templates with pricing and inclusions",
            "Trip scheduling with boat assignments",
            "Staff scheduling and notifications",
            "Dive site management with conditions",
            "Multi-stop trip support",
          ]}
          align="left"
        />

        <FeatureSection
          title="Equipment Tracking"
          description="Keep track of your rental inventory and never miss a service date."
          features={[
            "Complete equipment inventory",
            "Rental management and availability",
            "Service scheduling and history",
            "Size tracking for customer preferences",
            "Condition and maintenance logs",
          ]}
          align="right"
        />

        <FeatureSection
          title="Reports & Analytics"
          description="Make data-driven decisions with insights into your business performance."
          features={[
            "Revenue reports by period and category",
            "Booking trends and forecasting",
            "Customer acquisition and retention",
            "Staff performance metrics",
            "Equipment utilization reports",
          ]}
          align="left"
        />
      </section>

      {/* CTA */}
      <section className="bg-brand text-white py-20 mt-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 text-white/80">
            Try DiveStreams free for 14 days. No credit card required.
          </p>
          <a
            href="/signup"
            className="bg-surface-raised text-brand px-8 py-3 rounded-lg text-lg hover:bg-brand-muted inline-block"
          >
            Start Your Free Trial
          </a>
        </div>
      </section>
    </div>
  );
}

function FeatureSection({
  title,
  description,
  features,
  align,
}: {
  title: string;
  description: string;
  features: string[];
  align: "left" | "right";
}) {
  return (
    <div className={`flex flex-col md:flex-row gap-12 items-center ${align === "right" ? "md:flex-row-reverse" : ""}`}>
      <div className="flex-1">
        <h2 className="text-3xl font-bold mb-4">{title}</h2>
        <p className="text-foreground-muted mb-6">{description}</p>
        <ul className="space-y-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <svg className="w-5 h-5 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1 bg-surface-inset rounded-xl h-64 flex items-center justify-center text-foreground-subtle">
        Feature Screenshot
      </div>
    </div>
  );
}

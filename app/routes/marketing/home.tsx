import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { isAdminSubdomain } from "../../../lib/auth/org-context.server";
import { getPlatformContext } from "../../../lib/auth/platform-context.server";

export const meta: MetaFunction = () => {
  return [
    { title: "DiveStreams - Dive Shop Management Software" },
    {
      name: "description",
      content: "Modern booking and management software for dive shops worldwide. Streamline operations, manage customers, and grow your business.",
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  // If on admin subdomain, redirect to admin dashboard or login
  if (isAdminSubdomain(request)) {
    const platformContext = await getPlatformContext(request);
    if (platformContext) {
      throw redirect("/dashboard");
    } else {
      throw redirect("/login");
    }
  }
  return null;
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="text-2xl font-bold text-brand">DiveStreams</div>
        <div className="flex gap-6 items-center">
          <a href="/features" className="text-foreground-muted hover:text-brand">
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
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6 drop-shadow-sm">
          Run Your Dive Shop
          <span className="text-brand"> Effortlessly</span>
        </h1>
        <p className="text-xl text-foreground-muted mb-8 max-w-2xl mx-auto">
          The all-in-one platform for dive shops to manage bookings, customers,
          equipment, and operations. Built by divers, for divers.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/signup"
            className="bg-brand text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-brand-hover shadow-lg hover:shadow-xl transition-all"
          >
            Start Free Trial
          </a>
          <a
            href="/features"
            className="border-2 border-brand text-brand px-8 py-3 rounded-lg text-lg font-semibold hover:bg-brand-muted transition-all"
          >
            See Features
          </a>
        </div>
        <div className="mt-4 flex flex-col items-center gap-1">
          <p className="text-sm font-medium text-success">14 days free • No credit card required</p>
          <p className="text-xs text-foreground-muted">Cancel anytime</p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything You Need to Manage Your Dive Shop
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            title="Booking Management"
            description="Take online bookings 24/7, manage schedules, and reduce no-shows with automated reminders."
            icon="📅"
          />
          <FeatureCard
            title="Customer Database"
            description="Track certifications, medical info, and dive history. Build lasting relationships."
            icon="👥"
          />
          <FeatureCard
            title="Tour & Trip Planning"
            description="Create tours, schedule trips, assign boats and staff, all from one dashboard."
            icon="🚤"
          />
          <FeatureCard
            title="Equipment Tracking"
            description="Manage inventory, track rentals, and never miss a service date."
            icon="🤿"
          />
          <FeatureCard
            title="Payment Processing"
            description="Accept deposits, process payments, and manage invoices with Stripe integration."
            icon="💳"
          />
          <FeatureCard
            title="Reports & Insights"
            description="Understand your business with revenue reports, booking trends, and customer analytics."
            icon="📊"
          />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Streamline Your Operations?</h2>
          <p className="text-xl mb-8 text-blue-100">
            Join dive shops worldwide who trust DiveStreams to run their business.
          </p>
          <div className="flex flex-col items-center gap-3">
            <a
              href="/signup"
              className="bg-surface-raised text-brand px-8 py-3 rounded-lg text-lg font-semibold hover:bg-brand-muted inline-block shadow-lg hover:shadow-xl transition-all"
            >
              Start Your 14-Day Free Trial
            </a>
            <p className="text-sm text-blue-100">No credit card required • Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12">
        <div className="flex justify-between items-center text-foreground-muted">
          <div className="text-xl font-bold text-brand">DiveStreams</div>
          <div className="flex gap-6">
            <a href="/pricing">Pricing</a>
            <a href="/features">Features</a>
            <a href="mailto:support@divestreams.com">Support</a>
          </div>
        </div>
        <div className="text-center text-foreground-muted mt-8">
          © {new Date().getFullYear()} DiveStreams. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="bg-surface-raised p-6 rounded-xl shadow-sm border border-default">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-foreground-muted">{description}</p>
    </div>
  );
}

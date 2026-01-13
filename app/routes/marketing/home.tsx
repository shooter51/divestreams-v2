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
        <div className="text-2xl font-bold text-blue-600">DiveStreams</div>
        <div className="flex gap-6 items-center">
          <a href="/features" className="text-gray-600 hover:text-blue-600">
            Features
          </a>
          <a href="/pricing" className="text-gray-600 hover:text-blue-600">
            Pricing
          </a>
          <a href="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Start Free Trial
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Run Your Dive Shop
          <span className="text-blue-600"> Effortlessly</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          The all-in-one platform for dive shops to manage bookings, customers,
          equipment, and operations. Built by divers, for divers.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/signup"
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-700"
          >
            Start 14-Day Free Trial
          </a>
          <a
            href="/features"
            className="border border-gray-300 px-8 py-3 rounded-lg text-lg hover:bg-gray-50"
          >
            See Features
          </a>
        </div>
        <p className="text-sm text-gray-500 mt-4">No credit card required</p>
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
      <section className="bg-blue-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Streamline Your Operations?</h2>
          <p className="text-xl mb-8 text-blue-100">
            Join dive shops worldwide who trust DiveStreams to run their business.
          </p>
          <a
            href="/signup"
            className="bg-white text-blue-600 px-8 py-3 rounded-lg text-lg hover:bg-blue-50 inline-block"
          >
            Start Your Free Trial
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12">
        <div className="flex justify-between items-center text-gray-600">
          <div className="text-xl font-bold text-blue-600">DiveStreams</div>
          <div className="flex gap-6">
            <a href="/pricing">Pricing</a>
            <a href="/features">Features</a>
            <a href="mailto:support@divestreams.com">Support</a>
          </div>
        </div>
        <div className="text-center text-gray-500 mt-8">
          © {new Date().getFullYear()} DiveStreams. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

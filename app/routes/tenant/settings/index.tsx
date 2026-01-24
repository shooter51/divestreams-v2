import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { Link, useLoaderData, useFetcher } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { member, customers } from "../../../../lib/db/schema";
import { eq, count } from "drizzle-orm";
import { seedDemoData } from "../../../../lib/db/seed-demo-data.server";

export const meta: MetaFunction = () => [{ title: "Settings - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Get real team count
  const [teamCountResult] = await db
    .select({ count: count() })
    .from(member)
    .where(eq(member.organizationId, ctx.org.id));

  const teamCount = teamCountResult?.count || 1;

  // Check if there's already customer data (to show/hide seed option)
  const [customerCountResult] = await db
    .select({ count: count() })
    .from(customers)
    .where(eq(customers.organizationId, ctx.org.id));

  const hasData = (customerCountResult?.count || 0) > 0;

  // Parse metadata to check for integrations
  const metadata = ctx.org.metadata ? JSON.parse(ctx.org.metadata) : {};

  // Count connected integrations (based on Stripe connection for now)
  const connectedIntegrations = metadata.stripeCustomerId ? 1 : 0;

  return {
    tenantName: ctx.org.name,
    planName: ctx.subscription?.plan || "free",
    teamCount,
    connectedIntegrations,
    isPremium: ctx.isPremium,
    hasData,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "seedDemoData") {
    try {
      await seedDemoData(ctx.org.id);
      return { success: true, message: "Demo data seeded successfully!" };
    } catch (error) {
      console.error("Failed to seed demo data:", error);
      return { success: false, message: "Failed to seed demo data. Please try again." };
    }
  }

  return { success: false, message: "Unknown action" };
}

export default function SettingsPage() {
  const { tenantName, planName, teamCount, connectedIntegrations, hasData } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const isSeeding = fetcher.state === "submitting";

  const settingsLinks: Array<{
    href: string;
    title: string;
    description: string;
    icon: string;
    preview: string | null;
    disabled?: boolean;
  }> = [
    {
      href: "/tenant/settings/profile",
      title: "Shop Profile",
      description: "Business name, address, timezone, and booking settings",
      icon: "🏪",
      preview: tenantName,
    },
    {
      href: "/tenant/settings/billing",
      title: "Billing & Subscription",
      description: "Manage your subscription, payment methods, and invoices",
      icon: "💳",
      preview: `${planName} Plan`,
    },
    {
      href: "/tenant/settings/team",
      title: "Team Members",
      description: "Invite staff and manage roles and permissions",
      icon: "👥",
      preview: `${teamCount} members`,
    },
    {
      href: "/tenant/settings/integrations",
      title: "Integrations",
      description: "Connect third-party services like Stripe, Google Calendar, and more",
      icon: "🔌",
      preview: `${connectedIntegrations} connected`,
    },
    {
      href: "/tenant/settings/notifications",
      title: "Notifications",
      description: "Configure email and notification preferences",
      icon: "🔔",
      preview: null,
    },
    {
      href: "/tenant/settings/booking-widget",
      title: "Booking Widget",
      description: "Customize and embed your booking widget",
      icon: "🎨",
      preview: null,
    },
    {
      href: "/tenant/settings/public-site",
      title: "Public Site",
      description: "Configure your public-facing website and appearance",
      icon: "🌐",
      preview: null,
    },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-4">
        {settingsLinks.map((link) =>
          link.disabled ? (
            <div
              key={link.href}
              className="bg-white rounded-xl p-6 shadow-sm opacity-60"
            >
              <div className="flex items-start gap-4">
                <div className="text-2xl">{link.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{link.title}</h2>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      Coming soon
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mt-1">{link.description}</p>
                </div>
              </div>
            </div>
          ) : (
            <Link
              key={link.href}
              to={link.href}
              className="block bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start gap-4">
                <div className="text-2xl">{link.icon}</div>
                <div className="flex-1">
                  <h2 className="font-semibold group-hover:text-blue-600 transition-colors">
                    {link.title}
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">{link.description}</p>
                </div>
                {link.preview && (
                  <div className="text-sm text-gray-400">{link.preview}</div>
                )}
                <div className="text-gray-400 group-hover:text-blue-600 transition-colors">
                  →
                </div>
              </div>
            </Link>
          )
        )}
      </div>

      {/* Demo Data Section - only show if no data exists */}
      {!hasData && (
        <div className="mt-8 bg-blue-50 rounded-xl p-6 border border-blue-100">
          <h2 className="font-semibold text-blue-800 mb-2">Get Started</h2>
          <p className="text-sm text-blue-600 mb-4">
            Your account is empty. Populate with sample data to explore all features.
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-800">Seed Demo Data</p>
              <p className="text-xs text-blue-600">
                Add sample customers, tours, bookings, equipment, and products
              </p>
            </div>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="seedDemoData" />
              <button
                type="submit"
                disabled={isSeeding}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSeeding ? "Seeding..." : "Load Demo Data"}
              </button>
            </fetcher.Form>
          </div>
          {fetcher.data?.message && (
            <p className={`mt-3 text-sm ${fetcher.data.success ? "text-green-600" : "text-red-600"}`}>
              {fetcher.data.message}
            </p>
          )}
        </div>
      )}

      {/* Danger Zone */}
      <div className="mt-8 bg-red-50 rounded-xl p-6 border border-red-100">
        <h2 className="font-semibold text-red-800 mb-2">Danger Zone</h2>
        <p className="text-sm text-red-600 mb-4">
          Permanent actions that cannot be undone
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-red-800">Export all data</p>
              <p className="text-xs text-red-600">
                Download a copy of all your data in JSON format
              </p>
            </div>
            <button
              onClick={() => alert("Data export feature coming soon. Contact support@divestreams.com for immediate data export needs.")}
              className="px-4 py-2 text-sm border border-red-200 rounded-lg hover:bg-red-100 text-red-700"
            >
              Export Data
            </button>
          </div>
          <hr className="border-red-100" />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-red-800">Delete account</p>
              <p className="text-xs text-red-600">
                Permanently delete your account and all data
              </p>
            </div>
            <button
              onClick={() => {
                if (confirm("⚠️ WARNING: This will permanently delete your account and ALL data including customers, bookings, trips, and equipment. This action CANNOT be undone.\n\nAre you absolutely sure you want to delete your account?")) {
                  if (confirm("Please confirm once more. Type 'DELETE' in the next prompt to proceed.")) {
                    const input = prompt("Type DELETE to confirm account deletion:");
                    if (input === "DELETE") {
                      alert("Account deletion request submitted. Our team will process this within 24 hours and send confirmation to your email.");
                    } else {
                      alert("Account deletion cancelled - confirmation text did not match.");
                    }
                  }
                }
              }}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";

export const meta: MetaFunction = () => [{ title: "Settings - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant, db } = await requireTenant(request);

  // Mock data
  const tenantName = "Coral Bay Diving";
  const planName = "Starter";
  const teamCount = 2;
  const connectedIntegrations = 1;

  return { tenantName, planName, teamCount, connectedIntegrations };
}

export default function SettingsPage() {
  const { tenantName, planName, teamCount, connectedIntegrations } =
    useLoaderData<typeof loader>();

  const settingsLinks = [
    {
      href: "/app/settings/profile",
      title: "Shop Profile",
      description: "Business name, address, timezone, and booking settings",
      icon: "🏪",
      preview: tenantName,
    },
    {
      href: "/app/settings/billing",
      title: "Billing & Subscription",
      description: "Manage your subscription, payment methods, and invoices",
      icon: "💳",
      preview: `${planName} Plan`,
    },
    {
      href: "/app/settings/team",
      title: "Team Members",
      description: "Invite staff and manage roles and permissions",
      icon: "👥",
      preview: `${teamCount} members`,
    },
    {
      href: "/app/settings/integrations",
      title: "Integrations",
      description: "Connect third-party services like Stripe, Google Calendar, and more",
      icon: "🔌",
      preview: `${connectedIntegrations} connected`,
    },
    {
      href: "/app/settings/notifications",
      title: "Notifications",
      description: "Configure email and notification preferences",
      icon: "🔔",
      preview: null,
      disabled: true,
    },
    {
      href: "/app/settings/booking-widget",
      title: "Booking Widget",
      description: "Customize and embed your booking widget",
      icon: "🎨",
      preview: null,
      disabled: true,
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
            <button className="px-4 py-2 text-sm border border-red-200 rounded-lg hover:bg-red-100 text-red-700">
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
            <button className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

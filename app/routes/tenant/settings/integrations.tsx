import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";

export const meta: MetaFunction = () => [{ title: "Integrations - DiveStreams" }];

const availableIntegrations = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Process payments, deposits, and refunds",
    category: "payments",
    icon: "💳",
    features: ["Online payments", "Card processing", "Automatic refunds", "Invoice generation"],
    requiredPlan: "starter",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Sync trips and bookings with Google Calendar",
    category: "calendar",
    icon: "📅",
    features: ["Two-way sync", "Automatic updates", "Team calendars"],
    requiredPlan: "starter",
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    description: "Email marketing and customer newsletters",
    category: "marketing",
    icon: "📧",
    features: ["Customer sync", "Automated campaigns", "Booking follow-ups"],
    requiredPlan: "professional",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description: "Accounting and financial reporting",
    category: "accounting",
    icon: "📊",
    features: ["Invoice sync", "Expense tracking", "Financial reports"],
    requiredPlan: "professional",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect to 5,000+ apps with automation",
    category: "automation",
    icon: "⚡",
    features: ["Custom workflows", "Triggers", "Multi-step automations"],
    requiredPlan: "professional",
  },
  {
    id: "twilio",
    name: "Twilio SMS",
    description: "Send SMS notifications to customers",
    category: "notifications",
    icon: "📱",
    features: ["Booking confirmations", "Reminders", "Custom messages"],
    requiredPlan: "professional",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Chat with customers on WhatsApp",
    category: "notifications",
    icon: "💬",
    features: ["Booking updates", "Customer support", "Automated responses"],
    requiredPlan: "enterprise",
  },
  {
    id: "xero",
    name: "Xero",
    description: "Cloud accounting software",
    category: "accounting",
    icon: "📈",
    features: ["Invoice sync", "Bank reconciliation", "Multi-currency"],
    requiredPlan: "enterprise",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Parse metadata if it exists
  const metadata = ctx.org.metadata ? JSON.parse(ctx.org.metadata) : {};

  // Get connected integrations based on organization's integration status
  const connectedIntegrations: Array<{
    id: string;
    accountName: string;
    lastSync: string;
  }> = [];

  // Check for Stripe connection
  if (metadata.stripeCustomerId) {
    connectedIntegrations.push({
      id: "stripe",
      accountName: ctx.org.name,
      lastSync: "Recently",
    });
  }

  // Get current plan name from subscription
  const currentPlan = ctx.subscription?.plan || "free";

  return {
    connectedIntegrations,
    availableIntegrations,
    currentPlan,
    isPremium: ctx.isPremium,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "connect") {
    const integrationId = formData.get("integrationId");
    // TODO: Redirect to OAuth flow or open configuration modal
    return { redirectToOAuth: true, integrationId };
  }

  if (intent === "disconnect") {
    const integrationId = formData.get("integrationId");
    // TODO: Disconnect integration and clean up
    return { success: true, message: "Integration disconnected" };
  }

  if (intent === "sync") {
    const integrationId = formData.get("integrationId");
    // TODO: Trigger manual sync
    return { success: true, message: "Sync started" };
  }

  if (intent === "configure") {
    const integrationId = formData.get("integrationId");
    // TODO: Open configuration modal
    return { openConfig: true, integrationId };
  }

  return null;
}

const planHierarchy = ["starter", "professional", "enterprise"];

export default function IntegrationsPage() {
  const { connectedIntegrations, availableIntegrations, currentPlan } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const isIntegrationAvailable = (requiredPlan: string) => {
    return planHierarchy.indexOf(currentPlan) >= planHierarchy.indexOf(requiredPlan);
  };

  const isConnected = (integrationId: string) => {
    return connectedIntegrations.some((i) => i.id === integrationId);
  };

  const getConnection = (integrationId: string) => {
    return connectedIntegrations.find((i) => i.id === integrationId);
  };

  const categories = [
    { id: "payments", name: "Payments" },
    { id: "calendar", name: "Calendar" },
    { id: "marketing", name: "Marketing" },
    { id: "accounting", name: "Accounting" },
    { id: "notifications", name: "Notifications" },
    { id: "automation", name: "Automation" },
  ];

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link to="/app/settings" className="text-blue-600 hover:underline text-sm">
          ← Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Integrations</h1>
        <p className="text-gray-500">Connect third-party services to enhance DiveStreams</p>
      </div>

      {/* Connected Integrations */}
      {connectedIntegrations.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold mb-4">Connected</h2>
          <div className="space-y-4">
            {connectedIntegrations.map((connection) => {
              const integration = availableIntegrations.find((i) => i.id === connection.id);
              if (!integration) return null;

              return (
                <div
                  key={connection.id}
                  className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-green-500"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{integration.icon}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{integration.name}</h3>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            Connected
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{integration.description}</p>
                        <div className="mt-2 text-xs text-gray-400">
                          <span>Account: {connection.accountName}</span>
                          <span className="mx-2">•</span>
                          <span>Last sync: {connection.lastSync}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="sync" />
                        <input type="hidden" name="integrationId" value={connection.id} />
                        <button
                          type="submit"
                          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                        >
                          Sync Now
                        </button>
                      </fetcher.Form>
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="configure" />
                        <input type="hidden" name="integrationId" value={connection.id} />
                        <button
                          type="submit"
                          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                        >
                          Configure
                        </button>
                      </fetcher.Form>
                      <fetcher.Form
                        method="post"
                        onSubmit={(e) => {
                          if (
                            !confirm(
                              `Are you sure you want to disconnect ${integration.name}?`
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="intent" value="disconnect" />
                        <input type="hidden" name="integrationId" value={connection.id} />
                        <button
                          type="submit"
                          className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                        >
                          Disconnect
                        </button>
                      </fetcher.Form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Integrations by Category */}
      {categories.map((category) => {
        const categoryIntegrations = availableIntegrations.filter(
          (i) => i.category === category.id && !isConnected(i.id)
        );

        if (categoryIntegrations.length === 0) return null;

        return (
          <div key={category.id} className="mb-8">
            <h2 className="font-semibold mb-4">{category.name}</h2>
            <div className="grid grid-cols-2 gap-4">
              {categoryIntegrations.map((integration) => {
                const available = isIntegrationAvailable(integration.requiredPlan);

                return (
                  <div
                    key={integration.id}
                    className={`bg-white rounded-xl p-6 shadow-sm ${
                      !available ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{integration.icon}</div>
                        <div>
                          <h3 className="font-semibold">{integration.name}</h3>
                          <p className="text-sm text-gray-500">{integration.description}</p>
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-1 mb-4">
                      {integration.features.map((feature) => (
                        <li key={feature} className="text-xs text-gray-500 flex items-center gap-1">
                          <span className="text-green-500">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {available ? (
                      <fetcher.Form method="post">
                        <input type="hidden" name="intent" value="connect" />
                        <input type="hidden" name="integrationId" value={integration.id} />
                        <button
                          type="submit"
                          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                          Connect
                        </button>
                      </fetcher.Form>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-2">
                          Requires {integration.requiredPlan} plan
                        </p>
                        <Link
                          to="/app/settings/billing"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Upgrade to unlock
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* API Access */}
      <div className="bg-white rounded-xl p-6 shadow-sm mt-8">
        <h2 className="font-semibold mb-2">API Access</h2>
        <p className="text-sm text-gray-500 mb-4">
          Build custom integrations with the DiveStreams API
        </p>

        {currentPlan === "starter" ? (
          <div>
            <p className="text-sm text-gray-600 mb-3">
              API access is available on Professional and Enterprise plans.
            </p>
            <Link
              to="/app/settings/billing"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
            >
              Upgrade for API Access
            </Link>
          </div>
        ) : (
          <div>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">API Key</p>
                  <p className="text-xs text-gray-500 font-mono">
                    dk_live_••••••••••••••••••••••••
                  </p>
                </div>
                <button className="text-sm text-blue-600 hover:underline">
                  Reveal
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">
                Regenerate Key
              </button>
              <a
                href="/docs/api"
                target="_blank"
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
              >
                View Documentation
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Webhooks */}
      <div className="bg-white rounded-xl p-6 shadow-sm mt-4">
        <h2 className="font-semibold mb-2">Webhooks</h2>
        <p className="text-sm text-gray-500 mb-4">
          Receive real-time notifications when events happen in your account
        </p>

        {currentPlan === "starter" ? (
          <p className="text-sm text-gray-600">
            Webhooks are available on Professional and Enterprise plans.
          </p>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-3">
              No webhooks configured yet.
            </p>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
              Add Webhook Endpoint
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

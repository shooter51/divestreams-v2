/**
 * Zapier Integration Settings Page
 *
 * Allows users to:
 * - Generate and manage API keys for Zapier actions
 * - View webhook subscription status
 * - Test webhook connection
 * - View recent webhook deliveries
 */

import { useState } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, useNavigation } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  generateZapierApiKey,
  listZapierApiKeys,
  revokeZapierApiKey,
  getWebhookStats,
  hasZapierConfigured,
} from "../../../../../lib/integrations/zapier-enhanced.server";
import {
  ZAPIER_TRIGGERS,
  ZAPIER_TRIGGER_DESCRIPTIONS,
  type ZapierTriggerType,
} from "../../../../../lib/integrations/zapier.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Get API keys
  const apiKeys = await listZapierApiKeys(ctx.org.id);

  // Get webhook stats
  const webhookStats = await getWebhookStats(ctx.org.id);

  // Check if configured
  const isConfigured = await hasZapierConfigured(ctx.org.id);

  return {
    apiKeys,
    webhookStats,
    isConfigured,
    triggers: ZAPIER_TRIGGERS.map((trigger: ZapierTriggerType) => ({
      key: trigger,
      description: ZAPIER_TRIGGER_DESCRIPTIONS[trigger],
    })),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "generate-key") {
    const label = formData.get("label")?.toString();
    const { key, keyId } = await generateZapierApiKey(ctx.org.id, label);

    return {
      success: true,
      newKey: key,
      keyId,
    };
  }

  if (intent === "revoke-key") {
    const keyId = formData.get("keyId")?.toString();
    if (!keyId) {
      return { success: false, error: "Missing key ID" };
    }

    const success = await revokeZapierApiKey(keyId, ctx.org.id);
    return { success };
  }

  return { success: false, error: "Invalid intent" };
}

export default function ZapierIntegrationSettings() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);

  const isLoading = navigation.state !== "idle";

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Zapier Integration</h1>
        <p className="text-gray-600">
          Connect DiveStreams to 5000+ apps using Zapier workflow automation.
        </p>
      </div>

      {/* Setup Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Setup Instructions</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Generate an API key below (if you haven't already)</li>
          <li>
            Visit{" "}
            <a
              href="https://zapier.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Zapier.com
            </a>{" "}
            and create a new Zap
          </li>
          <li>Search for "DiveStreams" or use "Webhooks by Zapier"</li>
          <li>Use your API key to authenticate the connection</li>
          <li>Choose a trigger or action and configure your workflow</li>
        </ol>
      </div>

      {/* API Keys Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">API Keys</h2>
          <Form method="post">
            <input type="hidden" name="intent" value="generate-key" />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              onClick={() => setShowKeyModal(true)}
            >
              {isLoading ? "Generating..." : "Generate New Key"}
            </button>
          </Form>
        </div>

        {data.apiKeys.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No API keys generated yet. Create one to get started with Zapier.
          </p>
        ) : (
          <div className="space-y-3">
            {data.apiKeys.map((key: any) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-mono text-sm">{key.keyPrefix}...</div>
                  {key.label && (
                    <div className="text-xs text-gray-500 mt-1">{key.label}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    Created: {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt && (
                      <span className="ml-3">
                        Last used: {new Date(key.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <Form method="post">
                  <input type="hidden" name="intent" value="revoke-key" />
                  <input type="hidden" name="keyId" value={key.id} />
                  <button
                    type="submit"
                    disabled={!key.isActive || isLoading}
                    className="text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
                  >
                    {key.isActive ? "Revoke" : "Revoked"}
                  </button>
                </Form>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New API Key Modal */}
      {showKeyModal && newApiKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-3">New API Key Generated</h3>
            <div className="bg-gray-100 p-3 rounded mb-4 break-all font-mono text-sm">
              {newApiKey}
            </div>
            <p className="text-sm text-red-600 mb-4">
              ⚠️ Save this key now. You won't be able to see it again!
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newApiKey);
                setShowKeyModal(false);
                setNewApiKey(null);
              }}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Copy and Close
            </button>
          </div>
        </div>
      )}

      {/* Available Triggers */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Available Triggers</h2>
        <div className="space-y-2">
          {data.triggers.map((trigger: { key: string; description: string }) => (
            <div
              key={trigger.key}
              className="flex items-start p-3 border border-gray-100 rounded"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">{trigger.key}</div>
                <div className="text-xs text-gray-600">{trigger.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook Statistics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Webhook Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {data.webhookStats.activeSubscriptions}
            </div>
            <div className="text-xs text-gray-600">Active Subscriptions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {data.webhookStats.successfulDeliveries}
            </div>
            <div className="text-xs text-gray-600">Successful Deliveries</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {data.webhookStats.failedDeliveries}
            </div>
            <div className="text-xs text-gray-600">Failed Deliveries</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">
              {data.webhookStats.totalDeliveries}
            </div>
            <div className="text-xs text-gray-600">Total Deliveries</div>
          </div>
        </div>

        {/* Recent Deliveries */}
        {data.webhookStats.recentDeliveries.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Recent Deliveries</h3>
            <div className="space-y-2">
              {data.webhookStats.recentDeliveries.map((delivery: any) => (
                <div
                  key={delivery.id}
                  className="flex items-center justify-between p-2 border border-gray-100 rounded text-sm"
                >
                  <div className="flex-1">
                    <span className="font-medium">{delivery.eventType}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        delivery.status === "success"
                          ? "bg-green-100 text-green-700"
                          : delivery.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {delivery.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(delivery.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Documentation Link */}
      <div className="mt-6 text-center text-sm text-gray-500">
        Need help?{" "}
        <a
          href="https://docs.divestreams.com/integrations/zapier"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          View Zapier Integration Documentation
        </a>
      </div>
    </div>
  );
}

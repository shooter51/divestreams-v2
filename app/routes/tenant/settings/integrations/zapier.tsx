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
import { requireOrgContext, requireRole} from "../../../../../lib/auth/org-context.server";
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
import { CsrfInput } from "../../../../components/CsrfInput";
import { useT } from "../../../../i18n/use-t";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);

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
  requireRole(ctx, ["owner", "admin"]);

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
  const t = useT();
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);

  const isLoading = navigation.state !== "idle";

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t("tenant.settings.integrations.zapier.title")}</h1>
        <p className="text-foreground-muted">
          {t("tenant.settings.integrations.zapier.subtitle")}
        </p>
      </div>

      {/* Setup Instructions */}
      <div className="bg-brand-muted border border-brand rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">{t("tenant.settings.integrations.zapier.setupInstructions")}</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>{t("tenant.settings.integrations.zapier.setupStep1")}</li>
          <li>
            {t("tenant.settings.integrations.zapier.setupStep2Visit")}{" "}
            <a
              href="https://zapier.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              Zapier.com
            </a>{" "}
            {t("tenant.settings.integrations.zapier.setupStep2CreateZap")}
          </li>
          <li>{t("tenant.settings.integrations.zapier.setupStep3")}</li>
          <li>{t("tenant.settings.integrations.zapier.setupStep4")}</li>
          <li>{t("tenant.settings.integrations.zapier.setupStep5")}</li>
        </ol>
      </div>

      {/* API Keys Section */}
      <div className="bg-surface-raised rounded-lg shadow-sm border border-border p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{t("tenant.settings.integrations.zapier.apiKeys")}</h2>
          <Form method="post">
            <CsrfInput />
            <input type="hidden" name="intent" value="generate-key" />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover disabled:opacity-50"
              onClick={() => setShowKeyModal(true)}
            >
              {isLoading ? t("tenant.settings.integrations.zapier.generating") : t("tenant.settings.integrations.zapier.generateNewKey")}
            </button>
          </Form>
        </div>

        {data.apiKeys.length === 0 ? (
          <p className="text-foreground-muted text-center py-8">
            {t("tenant.settings.integrations.zapier.noApiKeys")}
          </p>
        ) : (
          <div className="space-y-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {data.apiKeys.map((key: any) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-mono text-sm">{key.keyPrefix}...</div>
                  {key.label && (
                    <div className="text-xs text-foreground-muted mt-1">{key.label}</div>
                  )}
                  <div className="text-xs text-foreground-subtle mt-1">
                    {t("tenant.settings.integrations.zapier.created")}: {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt && (
                      <span className="ml-3">
                        {t("tenant.settings.integrations.zapier.lastUsed")}: {new Date(key.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <Form method="post">
                  <CsrfInput />
                  <input type="hidden" name="intent" value="revoke-key" />
                  <input type="hidden" name="keyId" value={key.id} />
                  <button
                    type="submit"
                    disabled={!key.isActive || isLoading}
                    className="text-danger hover:text-danger text-sm disabled:opacity-50"
                  >
                    {key.isActive ? t("tenant.settings.integrations.zapier.revoke") : t("tenant.settings.integrations.zapier.revoked")}
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
          <div className="bg-surface-raised rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-3">{t("tenant.settings.integrations.zapier.newKeyGenerated")}</h3>
            <div className="bg-surface-inset p-3 rounded mb-4 break-all font-mono text-sm">
              {newApiKey}
            </div>
            <p className="text-sm text-danger mb-4">
              {t("tenant.settings.integrations.zapier.saveKeyWarning")}
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newApiKey);
                setShowKeyModal(false);
                setNewApiKey(null);
              }}
              className="w-full bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
            >
              {t("tenant.settings.integrations.zapier.copyAndClose")}
            </button>
          </div>
        </div>
      )}

      {/* Available Triggers */}
      <div className="bg-surface-raised rounded-lg shadow-sm border border-border p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">{t("tenant.settings.integrations.zapier.availableTriggers")}</h2>
        <div className="space-y-2">
          {data.triggers.map((trigger: { key: string; description: string }) => (
            <div
              key={trigger.key}
              className="flex items-start p-3 border border-border rounded"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">{trigger.key}</div>
                <div className="text-xs text-foreground-muted">{trigger.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook Statistics */}
      <div className="bg-surface-raised rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-xl font-semibold mb-4">{t("tenant.settings.integrations.zapier.webhookStatistics")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-brand">
              {data.webhookStats.activeSubscriptions}
            </div>
            <div className="text-xs text-foreground-muted">{t("tenant.settings.integrations.zapier.activeSubscriptions")}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-success">
              {data.webhookStats.successfulDeliveries}
            </div>
            <div className="text-xs text-foreground-muted">{t("tenant.settings.integrations.zapier.successfulDeliveries")}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-danger">
              {data.webhookStats.failedDeliveries}
            </div>
            <div className="text-xs text-foreground-muted">{t("tenant.settings.integrations.zapier.failedDeliveries")}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground-muted">
              {data.webhookStats.totalDeliveries}
            </div>
            <div className="text-xs text-foreground-muted">{t("tenant.settings.integrations.zapier.totalDeliveries")}</div>
          </div>
        </div>

        {/* Recent Deliveries */}
        {data.webhookStats.recentDeliveries.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">{t("tenant.settings.integrations.zapier.recentDeliveries")}</h3>
            <div className="space-y-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {data.webhookStats.recentDeliveries.map((delivery: any) => (
                <div
                  key={delivery.id}
                  className="flex items-center justify-between p-2 border border-border rounded text-sm"
                >
                  <div className="flex-1">
                    <span className="font-medium">{delivery.eventType}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        delivery.status === "success"
                          ? "bg-success-muted text-success"
                          : delivery.status === "failed"
                            ? "bg-danger-muted text-danger"
                            : "bg-warning-muted text-warning"
                      }`}
                    >
                      {delivery.status}
                    </span>
                    <span className="text-xs text-foreground-muted">
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
      <div className="mt-6 text-center text-sm text-foreground-muted">
        {t("tenant.settings.integrations.zapier.needHelp")}{" "}
        <a
          href="https://docs.divestreams.com/integrations/zapier"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand hover:underline"
        >
          {t("tenant.settings.integrations.zapier.viewDocumentation")}
        </a>
      </div>
    </div>
  );
}

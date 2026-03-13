import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { useT } from "../../i18n/use-t";
import { Icons } from "./Icons";
import type { ZapierSettings } from "./types";

interface ZapierIntegrationProps {
  isConnected: boolean;
  zapierTriggers: string[];
  zapierTriggerDescriptions: Record<string, string>;
  zapierWebhookUrl: string;
  zapierSettings: ZapierSettings | null;
  onNotification: (notification: { type: "success" | "error"; message: string }) => void;
  openModal?: boolean;
}

export function ZapierIntegration({
  isConnected,
  zapierTriggers,
  zapierTriggerDescriptions,
  zapierWebhookUrl,
  zapierSettings,
  onNotification,
  openModal,
}: ZapierIntegrationProps) {
  const t = useT();
  const fetcher = useFetcher();

  // Connect modal state
  const [showConnectModal, setShowConnectModal] = useState(false);

  useEffect(() => {
    if (openModal) setShowConnectModal(true);
  }, [openModal]);
  const [userWebhookUrl, setUserWebhookUrl] = useState(zapierSettings?.webhookUrl || "");
  const [enabledTriggers, setEnabledTriggers] = useState<string[]>(
    zapierSettings?.enabledTriggers || [...zapierTriggers]
  );

  // Config modal state
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Secret modal state
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  };

  // Handle fetcher responses
  const fetcherData = fetcher.data as Record<string, unknown> | undefined;

  useEffect(() => {
    if (!fetcherData) return;

    if ("showZapierModal" in fetcherData && fetcherData.showZapierModal) {
      setShowConnectModal(true);
      return;
    }

    if ("zapierConnected" in fetcherData && fetcherData.zapierConnected) {
      if (fetcherData.zapierSecret) {
        setSecret(fetcherData.zapierSecret as string);
        setShowSecretModal(true);
        setShowConnectModal(false);
      }
      return;
    }

    if ("zapierSecretRegenerated" in fetcherData && fetcherData.zapierSecretRegenerated) {
      if (fetcherData.newZapierSecret) {
        setSecret(fetcherData.newZapierSecret as string);
        setShowSecretModal(true);
      }
      return;
    }

    if ("zapierTestSuccess" in fetcherData && fetcherData.zapierTestSuccess) {
      onNotification({ type: "success", message: t("tenant.integrations.zapier.testWebhookSuccess") });
      return;
    }

    if ("success" in fetcherData && fetcherData.success && "message" in fetcherData) {
      if (!("zapierConnected" in fetcherData) && !("zapierTestSuccess" in fetcherData)) {
        onNotification({ type: "success", message: fetcherData.message as string });
        setShowConfigModal(false);
      }
      return;
    }

    if ("error" in fetcherData && !("success" in fetcherData)) {
      onNotification({ type: "error", message: fetcherData.error as string });
    }
  }, [fetcherData, onNotification]);

  // Trigger checkbox renderer (shared between connect and config modals)
  const renderTriggerCheckboxes = () => (
    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
      {zapierTriggers.map((trigger) => (
        <label
          key={trigger}
          className="flex items-start gap-3 p-2 hover:bg-surface-inset rounded cursor-pointer"
        >
          <input
            type="checkbox"
            name="zapierTriggers"
            value={trigger}
            checked={enabledTriggers.includes(trigger)}
            onChange={(e) => {
              if (e.target.checked) {
                setEnabledTriggers([...enabledTriggers, trigger]);
              } else {
                setEnabledTriggers(enabledTriggers.filter((t) => t !== trigger));
              }
            }}
            className="mt-1"
          />
          <div>
            <span className="text-sm font-medium">{trigger}</span>
            <p className="text-xs text-foreground-muted">
              {zapierTriggerDescriptions[trigger]}
            </p>
          </div>
        </label>
      ))}
    </div>
  );

  return (
    <>
      {/* Connected state: Configure button */}
      {isConnected && (
        <button
          type="button"
          onClick={() => setShowConfigModal(true)}
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-surface-inset"
        >
          {t("tenant.integrations.zapier.configure")}
        </button>
      )}

      {/* Zapier Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">{t("tenant.integrations.zapier.connectZapier")}</h2>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.integrations.zapier.automateWorkflows")}
                </p>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-foreground-subtle hover:text-foreground-muted"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-5">
              <input type="hidden" name="intent" value="connectZapier" />

              {/* Webhook URL from DiveStreams */}
              <div className="bg-surface-inset rounded-lg p-4">
                <h3 className="text-sm font-medium mb-2">{t("tenant.integrations.zapier.yourWebhookUrl")}</h3>
                <p className="text-xs text-foreground-muted mb-3">
                  {t("tenant.integrations.zapier.webhookUrlDescription")}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={zapierWebhookUrl}
                    className="flex-1 bg-surface-raised border rounded-lg p-2 text-sm font-mono text-foreground-muted"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(zapierWebhookUrl)}
                    className="p-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
                    title={t("tenant.integrations.zapier.copyUrl")}
                  >
                    <Icons.Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Optional: Zapier Webhook URL for Catch Hook */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("tenant.integrations.zapier.zapierWebhookUrlOptional")}
                </label>
                <input
                  type="url"
                  name="zapierWebhookUrl"
                  value={userWebhookUrl}
                  onChange={(e) => setUserWebhookUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                />
                <p className="text-xs text-foreground-muted mt-1">
                  {t("tenant.integrations.zapier.catchHookDescription")}
                </p>
              </div>

              {/* Available Triggers */}
              <div>
                <label className="block text-sm font-medium mb-2">{t("tenant.integrations.zapier.availableTriggersLabel")}</label>
                <p className="text-xs text-foreground-muted mb-3">
                  {t("tenant.integrations.zapier.selectEvents")}
                </p>
                {renderTriggerCheckboxes()}
              </div>

              <div className="bg-brand-muted rounded-lg p-4 text-sm">
                <h4 className="font-medium text-brand mb-1">{t("tenant.integrations.zapier.howToUse")}:</h4>
                <ol className="list-decimal list-inside text-brand space-y-1 text-xs">
                  <li>{t("tenant.integrations.zapier.howStep1")}</li>
                  <li>{t("tenant.integrations.zapier.howStep2")}</li>
                  <li>{t("tenant.integrations.zapier.howStep3")}</li>
                  <li>{t("tenant.integrations.zapier.howStep4")}</li>
                  <li>{t("tenant.integrations.zapier.howStep5")}</li>
                </ol>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  {t("tenant.integrations.zapier.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? t("tenant.integrations.zapier.connecting") : t("tenant.integrations.zapier.connectZapier")}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Zapier Config Modal (for connected integrations) */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">{t("tenant.integrations.zapier.zapierSettings")}</h2>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.integrations.zapier.manageSettings")}
                </p>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-foreground-subtle hover:text-foreground-muted"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-5">
              <input type="hidden" name="intent" value="updateZapierSettings" />

              {/* Webhook URL from DiveStreams */}
              <div className="bg-surface-inset rounded-lg p-4">
                <h3 className="text-sm font-medium mb-2">{t("tenant.integrations.zapier.yourWebhookUrl")}</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={zapierWebhookUrl}
                    className="flex-1 bg-surface-raised border rounded-lg p-2 text-sm font-mono text-foreground-muted"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(zapierWebhookUrl)}
                    className="p-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
                    title={t("tenant.integrations.zapier.copyUrl")}
                  >
                    <Icons.Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Zapier Webhook URL */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("tenant.integrations.zapier.zapierWebhookUrl")}
                </label>
                <input
                  type="url"
                  name="zapierWebhookUrl"
                  value={userWebhookUrl}
                  onChange={(e) => setUserWebhookUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                />
              </div>

              {/* Enabled Triggers */}
              <div>
                <label className="block text-sm font-medium mb-2">{t("tenant.integrations.zapier.enabledTriggers")}</label>
                {renderTriggerCheckboxes()}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  {t("tenant.integrations.zapier.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? t("tenant.integrations.zapier.saving") : t("tenant.integrations.zapier.saveSettings")}
                </button>
              </div>
            </fetcher.Form>

            {/* Test Webhook & Regenerate Secret */}
            <div className="mt-4 pt-4 border-t space-y-3">
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="testZapierWebhook" />
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle" || !userWebhookUrl}
                  className="w-full py-2 border rounded-lg hover:bg-surface-inset disabled:opacity-50 text-sm"
                >
                  {fetcher.state !== "idle" ? t("tenant.integrations.zapier.testing") : t("tenant.integrations.zapier.testWebhookConnection")}
                </button>
              </fetcher.Form>

              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="regenerateZapierSecret" />
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="w-full py-2 border border-accent text-accent rounded-lg hover:bg-accent-muted disabled:opacity-50 text-sm"
                >
                  {t("tenant.integrations.zapier.regenerateWebhookSecret")}
                </button>
              </fetcher.Form>
            </div>
          </div>
        </div>
      )}

      {/* Zapier Secret Modal */}
      {showSecretModal && secret && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-success">{t("tenant.integrations.zapier.zapierConnected")}</h2>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.integrations.zapier.saveSecretWarning")}
                </p>
              </div>
            </div>

            <div className="bg-warning-muted border border-warning rounded-lg max-w-4xl break-words p-4 mb-4">
              <div className="flex items-start gap-2">
                <Icons.AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="text-sm text-warning">
                  <strong>{t("tenant.integrations.zapier.important")}:</strong> {t("tenant.integrations.zapier.copySecretNow")}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">{t("tenant.integrations.zapier.webhookSecret")}</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={secret}
                  className="flex-1 bg-surface-inset border rounded-lg p-3 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(secret)}
                  className="p-3 bg-brand text-white rounded-lg hover:bg-brand-hover"
                  title={t("tenant.integrations.zapier.copySecret")}
                >
                  <Icons.Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowSecretModal(false);
                setSecret(null);
              }}
              className="w-full py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
            >
              {t("tenant.integrations.zapier.savedMySecret")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

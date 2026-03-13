import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { useT } from "../../i18n/use-t";
import { Icons } from "./Icons";
import type { StripeSettings, ConnectedIntegration } from "./types";

interface StripeIntegrationProps {
  connection: ConnectedIntegration | null;
  stripeSettings: StripeSettings | null;
  onNotification: (notification: { type: "success" | "error"; message: string }) => void;
  openModal?: boolean;
}

export function StripeIntegration({
  connection,
  stripeSettings,
  onNotification,
  openModal,
}: StripeIntegrationProps) {
  const t = useT();
  const fetcher = useFetcher();
  const [showConnectModal, setShowConnectModal] = useState(false);

  useEffect(() => {
    if (openModal) setShowConnectModal(true);
  }, [openModal]);
  const [secretKey, setSecretKey] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Handle fetcher responses
  const fetcherData = fetcher.data as Record<string, unknown> | undefined;

  useEffect(() => {
    if (!fetcherData) return;

    if ("showStripeModal" in fetcherData && fetcherData.showStripeModal) {
      setShowConnectModal(true);
      return;
    }

    if ("success" in fetcherData && fetcherData.success && "message" in fetcherData) {
      onNotification({ type: "success", message: fetcherData.message as string });
      setShowConnectModal(false);
      setShowSettingsModal(false);
      setSecretKey("");
      setPublishableKey("");
      return;
    }

    if ("error" in fetcherData && !("success" in fetcherData)) {
      onNotification({ type: "error", message: fetcherData.error as string });
    }
  }, [fetcherData, onNotification]);

  return (
    <>
      {/* Connected state buttons */}
      {connection && stripeSettings && (
        <button
          type="button"
          onClick={() => setShowSettingsModal(true)}
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-surface-inset"
        >
          {t("tenant.integrations.stripe.viewSettings")}
        </button>
      )}

      {/* Stripe Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">{t("tenant.integrations.stripe.connectStripe")}</h2>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.integrations.stripe.enterApiKeys")}
                </p>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="text-foreground-subtle hover:text-foreground-muted"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="connectStripe" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("tenant.integrations.stripe.secretKey")} <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  name="secretKey"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="sk_test_... or sk_live_..."
                  className="w-full border rounded-lg p-2 text-sm font-mono"
                  required
                />
                <p className="text-xs text-foreground-muted mt-1">
                  {t("tenant.integrations.stripe.secretKeyHint")}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("tenant.integrations.stripe.publishableKey")} <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="publishableKey"
                  value={publishableKey}
                  onChange={(e) => setPublishableKey(e.target.value)}
                  placeholder="pk_test_... or pk_live_..."
                  className="w-full border rounded-lg p-2 text-sm font-mono"
                  required
                />
                <p className="text-xs text-foreground-muted mt-1">
                  {t("tenant.integrations.stripe.publishableKeyHint")}
                </p>
              </div>

              <div className="bg-brand-muted border border-brand rounded-lg p-3">
                <p className="text-xs text-brand">
                  <strong>{t("tenant.integrations.stripe.whereToFindKeys")}:</strong>
                  <br />
                  {t("tenant.integrations.stripe.visitYour")}{" "}
                  <a
                    href="https://dashboard.stripe.com/apikeys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-brand"
                  >
                    Stripe Dashboard &rarr; API Keys
                  </a>
                  <br />
                  {t("tenant.integrations.stripe.useTestKeys")}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  {t("tenant.integrations.stripe.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? t("tenant.integrations.stripe.connecting") : t("tenant.integrations.stripe.connectStripe")}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Stripe Settings Modal */}
      {showSettingsModal && stripeSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">{t("tenant.integrations.stripe.stripeSettings")}</h2>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.integrations.stripe.viewConfiguration")}
                </p>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-foreground-subtle hover:text-foreground-muted"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-surface-inset rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">{t("tenant.integrations.stripe.accountId")}</p>
                    <p className="text-sm font-mono">{stripeSettings.accountId || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">{t("tenant.integrations.stripe.accountName")}</p>
                    <p className="text-sm">{stripeSettings.accountName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">{t("tenant.integrations.stripe.mode")}</p>
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded-full ${
                        stripeSettings.liveMode
                          ? "bg-success-muted text-success"
                          : "bg-warning-muted text-warning"
                      }`}
                    >
                      {stripeSettings.liveMode ? t("tenant.integrations.stripe.liveMode") : t("tenant.integrations.stripe.testMode")}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">{t("tenant.integrations.stripe.publishableKey")}</p>
                    <p className="text-sm font-mono">{stripeSettings.publishableKeyPrefix || "N/A"}</p>
                  </div>
                </div>
              </div>

              <div className="bg-surface-inset rounded-lg p-4">
                <p className="text-sm font-medium mb-2">{t("tenant.integrations.stripe.capabilities")}</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground-muted">{t("tenant.integrations.stripe.chargesEnabled")}</span>
                    {stripeSettings.chargesEnabled ? (
                      <Icons.Check className="w-5 h-5 text-success" />
                    ) : (
                      <Icons.X className="w-5 h-5 text-danger" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground-muted">{t("tenant.integrations.stripe.payoutsEnabled")}</span>
                    {stripeSettings.payoutsEnabled ? (
                      <Icons.Check className="w-5 h-5 text-success" />
                    ) : (
                      <Icons.X className="w-5 h-5 text-danger" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground-muted">{t("tenant.integrations.stripe.webhookConfigured")}</span>
                    {stripeSettings.webhookConfigured ? (
                      <Icons.Check className="w-5 h-5 text-success" />
                    ) : (
                      <Icons.X className="w-5 h-5 text-danger" />
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-brand-muted border border-brand rounded-lg p-3">
                <p className="text-xs text-brand">
                  <strong>{t("tenant.integrations.stripe.dashboardAccess")}:</strong>
                  <br />
                  {t("tenant.integrations.stripe.manageAccount")}{" "}
                  <a
                    href="https://dashboard.stripe.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-brand"
                  >
                    dashboard.stripe.com
                  </a>
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  {t("tenant.integrations.stripe.close")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

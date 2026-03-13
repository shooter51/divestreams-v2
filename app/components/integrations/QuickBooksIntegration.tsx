import { useState, useEffect } from "react";
import { useFetcher, Link } from "react-router";
import { useT } from "../../i18n/use-t";
import { Icons } from "./Icons";

interface QuickBooksIntegrationProps {
  isConnected: boolean;
  onNotification: (notification: { type: "success" | "error"; message: string }) => void;
  openModal?: boolean;
}

export function QuickBooksIntegration({
  isConnected,
  onNotification,
  openModal,
}: QuickBooksIntegrationProps) {
  const t = useT();
  const fetcher = useFetcher();
  const [showOAuthModal, setShowOAuthModal] = useState(false);

  useEffect(() => {
    if (openModal) setShowOAuthModal(true);
  }, [openModal]);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  // Handle fetcher responses
  const fetcherData = fetcher.data as Record<string, unknown> | undefined;

  useEffect(() => {
    if (!fetcherData) return;

    if ("showQuickBooksOAuthModal" in fetcherData && fetcherData.showQuickBooksOAuthModal) {
      setShowOAuthModal(true);
      return;
    }

    if ("success" in fetcherData && fetcherData.success && "message" in fetcherData) {
      onNotification({ type: "success", message: fetcherData.message as string });
      setShowOAuthModal(false);
      setClientId("");
      setClientSecret("");
      return;
    }

    if ("error" in fetcherData && !("success" in fetcherData)) {
      onNotification({ type: "error", message: fetcherData.error as string });
    }
  }, [fetcherData, onNotification]);

  return (
    <>
      {/* Connected state: Manage Settings link */}
      {isConnected && (
        <Link
          to="/tenant/settings/integrations/quickbooks"
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-surface-inset inline-block"
        >
          {t("tenant.integrations.quickbooks.manageSettings")}
        </Link>
      )}

      {/* QuickBooks OAuth Configuration Modal */}
      {showOAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">{t("tenant.integrations.quickbooks.connectQuickBooks")}</h2>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.integrations.quickbooks.enterOAuthCredentials")}
                </p>
              </div>
              <button
                onClick={() => setShowOAuthModal(false)}
                className="text-foreground-subtle hover:text-foreground-muted"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="connectQuickBooks" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("tenant.integrations.quickbooks.clientId")} <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder={t("tenant.integrations.quickbooks.clientIdPlaceholder")}
                  className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("tenant.integrations.quickbooks.clientSecret")} <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  name="clientSecret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={t("tenant.integrations.quickbooks.clientSecretPlaceholder")}
                  className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                  required
                />
                <p className="text-xs text-foreground-muted mt-1">
                  {t("tenant.integrations.quickbooks.encryptedStorage")}
                </p>
              </div>

              <div className="bg-brand-muted border border-brand rounded-lg p-3">
                <p className="text-sm text-brand">
                  <strong>{t("tenant.integrations.quickbooks.getCredentials")}:</strong>
                  <br />
                  1. {t("tenant.integrations.quickbooks.step1GoTo")}{" "}
                  <a
                    href="https://developer.intuit.com/app/developer/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Intuit Developer Portal
                  </a>
                  <br />
                  2. {t("tenant.integrations.quickbooks.step2CreateApp")}
                  <br />
                  3. {t("tenant.integrations.quickbooks.step3AddRedirect")}: <code className="bg-surface-raised px-1 break-all text-xs">{typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/quickbooks/callback</code>
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOAuthModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  {t("tenant.integrations.quickbooks.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? t("tenant.integrations.quickbooks.connecting") : t("tenant.integrations.quickbooks.continueToQuickBooks")}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
    </>
  );
}

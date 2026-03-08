import { useState, useEffect } from "react";
import { useFetcher, Form } from "react-router";
import { useT } from "../../i18n/use-t";
import { Icons } from "./Icons";

interface GoogleCalendarIntegrationProps {
  isConnected: boolean;
  onNotification: (notification: { type: "success" | "error"; message: string }) => void;
  openModal?: boolean;
}

export function GoogleCalendarIntegration({
  isConnected,
  onNotification,
  openModal,
}: GoogleCalendarIntegrationProps) {
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

    if ("showGoogleOAuthModal" in fetcherData && fetcherData.showGoogleOAuthModal) {
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
      {/* Connected state: Sync button */}
      {isConnected && (
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="sync" />
          <input type="hidden" name="integrationId" value="google-calendar" />
          <button
            type="submit"
            disabled={fetcher.state !== "idle"}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-surface-inset disabled:opacity-50"
          >
            {fetcher.state !== "idle" ? t("tenant.integrations.google.syncing") : t("tenant.integrations.google.syncNow")}
          </button>
        </fetcher.Form>
      )}

      {/* Google Calendar OAuth Configuration Modal */}
      {showOAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">{t("tenant.integrations.google.connectGoogleCalendar")}</h2>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.integrations.google.enterOAuthCredentials")}
                </p>
              </div>
              <button
                onClick={() => setShowOAuthModal(false)}
                className="text-foreground-subtle hover:text-foreground-muted"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="connectGoogle" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("tenant.integrations.google.clientId")} <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="your-client-id.apps.googleusercontent.com"
                  className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("tenant.integrations.google.clientSecret")} <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  name="clientSecret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={t("tenant.integrations.google.clientSecretPlaceholder")}
                  className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                  required
                />
                <p className="text-xs text-foreground-muted mt-1">
                  {t("tenant.integrations.google.encryptedStorage")}
                </p>
              </div>

              <div className="bg-brand-muted border border-brand rounded-lg p-3">
                <p className="text-sm text-brand">
                  <strong>{t("tenant.integrations.google.getCredentials")}:</strong>
                  <br />
                  1. {t("tenant.integrations.google.step1GoTo")}{" "}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Google Cloud Console
                  </a>
                  <br />
                  2. {t("tenant.integrations.google.step2CreateOAuth")}
                  <br />
                  3. {t("tenant.integrations.google.step3AddRedirect")}: <code className="bg-surface-raised px-1 break-all text-xs">{typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/google/callback</code>
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOAuthModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  {t("tenant.integrations.google.cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
                >
                  {t("tenant.integrations.google.continueToGoogle")}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </>
  );
}

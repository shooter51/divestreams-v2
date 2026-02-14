import { useState } from "react";
import { useFetcher } from "react-router";
import { Icons } from "./Icons";

interface GoogleCalendarIntegrationProps {
  isConnected: boolean;
  onNotification: (notification: { type: "success" | "error"; message: string }) => void;
}

export function GoogleCalendarIntegration({
  isConnected,
  onNotification,
}: GoogleCalendarIntegrationProps) {
  const fetcher = useFetcher();
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  // Handle fetcher responses
  const fetcherData = fetcher.data as Record<string, unknown> | undefined;

  if (fetcherData && "showGoogleOAuthModal" in fetcherData && fetcherData.showGoogleOAuthModal) {
    if (!showOAuthModal) setShowOAuthModal(true);
  }

  if (fetcherData && "success" in fetcherData && fetcherData.success && "message" in fetcherData) {
    if (showOAuthModal) {
      onNotification({ type: "success", message: fetcherData.message as string });
      setShowOAuthModal(false);
      setClientId("");
      setClientSecret("");
    }
  }

  if (fetcherData && "error" in fetcherData && !("success" in fetcherData)) {
    onNotification({ type: "error", message: fetcherData.error as string });
  }

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
            {fetcher.state !== "idle" ? "Syncing..." : "Sync Now"}
          </button>
        </fetcher.Form>
      )}

      {/* Google Calendar OAuth Configuration Modal */}
      {showOAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Connect Google Calendar</h2>
                <p className="text-sm text-foreground-muted">
                  Enter your Google OAuth credentials to enable calendar sync
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
              <input type="hidden" name="intent" value="connectGoogle" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Client ID <span className="text-danger">*</span>
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
                  Client Secret <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  name="clientSecret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Your Google Client Secret"
                  className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                  required
                />
                <p className="text-xs text-foreground-muted mt-1">
                  This will be encrypted and stored securely
                </p>
              </div>

              <div className="bg-brand-muted border border-brand rounded-lg p-3">
                <p className="text-sm text-brand">
                  <strong>Get your credentials:</strong>
                  <br />
                  1. Go to{" "}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Google Cloud Console
                  </a>
                  <br />
                  2. Create OAuth 2.0 Client ID
                  <br />
                  3. Add redirect URI: <code className="bg-surface-raised px-1 break-all text-xs">{typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/google/callback</code>
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOAuthModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Connecting..." : "Continue to Google"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
    </>
  );
}

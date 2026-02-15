import { useState } from "react";
import { useFetcher } from "react-router";
import { Icons } from "./Icons";
import type { StripeSettings, ConnectedIntegration } from "./types";

interface StripeIntegrationProps {
  connection: ConnectedIntegration | null;
  stripeSettings: StripeSettings | null;
  onNotification: (notification: { type: "success" | "error"; message: string }) => void;
}

export function StripeIntegration({
  connection,
  stripeSettings,
  onNotification,
}: StripeIntegrationProps) {
  const fetcher = useFetcher();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [secretKey, setSecretKey] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Handle fetcher responses
  const fetcherData = fetcher.data as Record<string, unknown> | undefined;

  if (fetcherData && "showStripeModal" in fetcherData && fetcherData.showStripeModal) {
    if (!showConnectModal) setShowConnectModal(true);
  }

  if (fetcherData && "success" in fetcherData && fetcherData.success && "message" in fetcherData) {
    if (showConnectModal || showSettingsModal) {
      onNotification({ type: "success", message: fetcherData.message as string });
      setShowConnectModal(false);
      setShowSettingsModal(false);
      setSecretKey("");
      setPublishableKey("");
    }
  }

  if (fetcherData && "error" in fetcherData && !("success" in fetcherData)) {
    onNotification({ type: "error", message: fetcherData.error as string });
  }

  return (
    <>
      {/* Connected state buttons */}
      {connection && stripeSettings && (
        <button
          type="button"
          onClick={() => setShowSettingsModal(true)}
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-surface-inset"
        >
          View Settings
        </button>
      )}

      {/* Stripe Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Connect Stripe</h2>
                <p className="text-sm text-foreground-muted">
                  Enter your Stripe API keys to enable payment processing
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
                  Secret Key <span className="text-danger">*</span>
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
                  Your Stripe Secret Key (starts with sk_test_ or sk_live_)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Publishable Key <span className="text-danger">*</span>
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
                  Your Stripe Publishable Key (starts with pk_test_ or pk_live_)
                </p>
              </div>

              <div className="bg-brand-muted border border-brand rounded-lg p-3">
                <p className="text-xs text-brand">
                  <strong>Where to find your API keys:</strong>
                  <br />
                  Visit your{" "}
                  <a
                    href="https://dashboard.stripe.com/apikeys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-brand"
                  >
                    Stripe Dashboard &rarr; API Keys
                  </a>
                  <br />
                  Use test keys for development and live keys for production.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Connecting..." : "Connect Stripe"}
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
                <h2 className="text-lg font-bold">Stripe Settings</h2>
                <p className="text-sm text-foreground-muted">
                  View your Stripe integration configuration
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
                    <p className="text-xs text-foreground-muted mb-1">Account ID</p>
                    <p className="text-sm font-mono">{stripeSettings.accountId || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Account Name</p>
                    <p className="text-sm">{stripeSettings.accountName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Mode</p>
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded-full ${
                        stripeSettings.liveMode
                          ? "bg-success-muted text-success"
                          : "bg-warning-muted text-warning"
                      }`}
                    >
                      {stripeSettings.liveMode ? "Live Mode" : "Test Mode"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-foreground-muted mb-1">Publishable Key</p>
                    <p className="text-sm font-mono">{stripeSettings.publishableKeyPrefix || "N/A"}</p>
                  </div>
                </div>
              </div>

              <div className="bg-surface-inset rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Capabilities</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground-muted">Charges Enabled</span>
                    {stripeSettings.chargesEnabled ? (
                      <Icons.Check className="w-5 h-5 text-success" />
                    ) : (
                      <Icons.X className="w-5 h-5 text-danger" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground-muted">Payouts Enabled</span>
                    {stripeSettings.payoutsEnabled ? (
                      <Icons.Check className="w-5 h-5 text-success" />
                    ) : (
                      <Icons.X className="w-5 h-5 text-danger" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground-muted">Webhook Configured</span>
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
                  <strong>Dashboard Access:</strong>
                  <br />
                  Manage your Stripe account at{" "}
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
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

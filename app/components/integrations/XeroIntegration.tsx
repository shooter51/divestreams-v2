import { useState } from "react";
import { useFetcher } from "react-router";
import { Icons } from "./Icons";
import type { XeroSettings } from "./types";

interface XeroIntegrationProps {
  isConnected: boolean;
  xeroSettings: XeroSettings | null;
  onNotification: (notification: { type: "success" | "error"; message: string }) => void;
}

export function XeroIntegration({
  isConnected,
  xeroSettings,
  onNotification,
}: XeroIntegrationProps) {
  const fetcher = useFetcher();
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  // Config modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [syncInvoices, setSyncInvoices] = useState(xeroSettings?.syncInvoices || false);
  const [syncPayments, setSyncPayments] = useState(xeroSettings?.syncPayments || false);
  const [syncContacts, setSyncContacts] = useState(xeroSettings?.syncContacts || false);
  const [revenueAccountCode, setRevenueAccountCode] = useState(xeroSettings?.defaultRevenueAccountCode || "");
  const [taxType, setTaxType] = useState(xeroSettings?.defaultTaxType || "");
  const [invoicePrefix, setInvoicePrefix] = useState(xeroSettings?.invoicePrefix || "");

  // Handle fetcher responses
  const fetcherData = fetcher.data as Record<string, unknown> | undefined;

  if (fetcherData && "showXeroOAuthModal" in fetcherData && fetcherData.showXeroOAuthModal) {
    if (!showOAuthModal) setShowOAuthModal(true);
  }

  if (fetcherData && "showXeroConfigModal" in fetcherData && fetcherData.showXeroConfigModal) {
    if (!showConfigModal) setShowConfigModal(true);
  }

  if (fetcherData && "success" in fetcherData && fetcherData.success && "message" in fetcherData) {
    if (showOAuthModal || showConfigModal) {
      onNotification({ type: "success", message: fetcherData.message as string });
      setShowOAuthModal(false);
      setShowConfigModal(false);
      setClientId("");
      setClientSecret("");
    }
  }

  if (fetcherData && "error" in fetcherData && !("success" in fetcherData)) {
    onNotification({ type: "error", message: fetcherData.error as string });
  }

  return (
    <>
      {/* Connected state: Configure button */}
      {isConnected && (
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="configureXero" />
          <button
            type="submit"
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-surface-inset"
          >
            Configure
          </button>
        </fetcher.Form>
      )}

      {/* Xero OAuth Configuration Modal */}
      {showOAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Connect Xero</h2>
                <p className="text-sm text-foreground-muted">
                  Enter your Xero OAuth credentials to enable accounting sync
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
              <input type="hidden" name="intent" value="connectXero" />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Client ID <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Your Xero Client ID"
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
                  placeholder="Your Xero Client Secret"
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
                    href="https://developer.xero.com/app/manage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Xero Developer Portal
                  </a>
                  <br />
                  2. Create an OAuth 2.0 app
                  <br />
                  3. Add redirect URI: <code className="bg-surface-raised px-1 break-all text-xs">{typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/xero/callback</code>
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
                  {fetcher.state !== "idle" ? "Connecting..." : "Continue to Xero"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Xero Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Xero Settings</h2>
                <p className="text-sm text-foreground-muted">
                  Configure sync options and account mapping
                </p>
                {xeroSettings?.tenantName && (
                  <p className="text-xs text-foreground-subtle mt-1">
                    Connected to: {xeroSettings.tenantName}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-foreground-subtle hover:text-foreground-muted"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            <fetcher.Form method="post" className="space-y-6">
              <input type="hidden" name="intent" value="updateXeroSettings" />

              {/* Sync Options */}
              <div>
                <h3 className="text-sm font-medium mb-3">Sync Options</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-surface-inset cursor-pointer">
                    <input
                      type="checkbox"
                      name="syncInvoices"
                      value="true"
                      checked={syncInvoices}
                      onChange={(e) => setSyncInvoices(e.target.checked)}
                      className="rounded border-border-strong text-brand focus:ring-brand"
                    />
                    <div>
                      <span className="text-sm font-medium">Sync Invoices</span>
                      <p className="text-xs text-foreground-muted">
                        Automatically create invoices in Xero when bookings are confirmed
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-surface-inset cursor-pointer">
                    <input
                      type="checkbox"
                      name="syncPayments"
                      value="true"
                      checked={syncPayments}
                      onChange={(e) => setSyncPayments(e.target.checked)}
                      className="rounded border-border-strong text-brand focus:ring-brand"
                    />
                    <div>
                      <span className="text-sm font-medium">Sync Payments</span>
                      <p className="text-xs text-foreground-muted">
                        Record payments in Xero when received via Stripe
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-surface-inset cursor-pointer">
                    <input
                      type="checkbox"
                      name="syncContacts"
                      value="true"
                      checked={syncContacts}
                      onChange={(e) => setSyncContacts(e.target.checked)}
                      className="rounded border-border-strong text-brand focus:ring-brand"
                    />
                    <div>
                      <span className="text-sm font-medium">Sync Contacts</span>
                      <p className="text-xs text-foreground-muted">
                        Create and update contacts in Xero from customer data
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Account Mapping */}
              <div>
                <h3 className="text-sm font-medium mb-3">Account Mapping</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Default Revenue Account Code
                    </label>
                    <input
                      type="text"
                      name="defaultRevenueAccountCode"
                      value={revenueAccountCode}
                      onChange={(e) => setRevenueAccountCode(e.target.value)}
                      placeholder="e.g., 200 or 4000"
                      className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                    />
                    <p className="text-xs text-foreground-muted mt-1">
                      The account code for booking revenue in your Xero chart of accounts
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Default Tax Type
                    </label>
                    <select
                      name="defaultTaxType"
                      value={taxType}
                      onChange={(e) => setTaxType(e.target.value)}
                      className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                    >
                      <option value="">Select tax type...</option>
                      <option value="OUTPUT">OUTPUT (Standard Tax)</option>
                      <option value="OUTPUT2">OUTPUT2 (Reduced Rate)</option>
                      <option value="NONE">NONE (No Tax)</option>
                      <option value="ZERORATEDOUTPUT">Zero Rated</option>
                      <option value="EXEMPTOUTPUT">Exempt</option>
                    </select>
                    <p className="text-xs text-foreground-muted mt-1">
                      Tax type to apply to invoices
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Invoice Reference Prefix
                    </label>
                    <input
                      type="text"
                      name="invoicePrefix"
                      value={invoicePrefix}
                      onChange={(e) => setInvoicePrefix(e.target.value)}
                      placeholder="e.g., DS-"
                      className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                    />
                    <p className="text-xs text-foreground-muted mt-1">
                      Prefix added to invoice references (e.g., DS-12345)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-brand-muted border border-brand rounded-lg p-3">
                <p className="text-sm text-brand">
                  <strong>Note:</strong> Changes to sync settings will apply to new bookings and transactions.
                  Existing records will not be automatically synced.
                </p>
              </div>

              {fetcherData && "error" in fetcherData && (
                <p className="text-danger text-sm">{fetcherData.error as string}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
    </>
  );
}

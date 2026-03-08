import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { useT } from "../../i18n/use-t";
import { Icons } from "./Icons";
import type { XeroSettings } from "./types";

interface XeroIntegrationProps {
  isConnected: boolean;
  xeroSettings: XeroSettings | null;
  onNotification: (notification: { type: "success" | "error"; message: string }) => void;
  openModal?: boolean;
}

export function XeroIntegration({
  isConnected,
  xeroSettings,
  onNotification,
  openModal,
}: XeroIntegrationProps) {
  const t = useT();
  const fetcher = useFetcher();
  const [showOAuthModal, setShowOAuthModal] = useState(false);

  useEffect(() => {
    if (openModal) setShowOAuthModal(true);
  }, [openModal]);
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

  useEffect(() => {
    if (!fetcherData) return;

    if ("showXeroOAuthModal" in fetcherData && fetcherData.showXeroOAuthModal) {
      setShowOAuthModal(true);
      return;
    }

    if ("showXeroConfigModal" in fetcherData && fetcherData.showXeroConfigModal) {
      setShowConfigModal(true);
      return;
    }

    if ("success" in fetcherData && fetcherData.success && "message" in fetcherData) {
      onNotification({ type: "success", message: fetcherData.message as string });
      setShowOAuthModal(false);
      setShowConfigModal(false);
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
      {/* Connected state: Configure button */}
      {isConnected && (
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="configureXero" />
          <button
            type="submit"
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-surface-inset"
          >
            {t("tenant.integrations.xero.configure")}
          </button>
        </fetcher.Form>
      )}

      {/* Xero OAuth Configuration Modal */}
      {showOAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">{t("tenant.integrations.xero.connectXero")}</h2>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.integrations.xero.enterOAuthCredentials")}
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
                  {t("tenant.integrations.xero.clientId")} <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder={t("tenant.integrations.xero.clientIdPlaceholder")}
                  className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("tenant.integrations.xero.clientSecret")} <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  name="clientSecret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={t("tenant.integrations.xero.clientSecretPlaceholder")}
                  className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                  required
                />
                <p className="text-xs text-foreground-muted mt-1">
                  {t("tenant.integrations.xero.encryptedStorage")}
                </p>
              </div>

              <div className="bg-brand-muted border border-brand rounded-lg p-3">
                <p className="text-sm text-brand">
                  <strong>{t("tenant.integrations.xero.getCredentials")}:</strong>
                  <br />
                  1. {t("tenant.integrations.xero.step1GoTo")}{" "}
                  <a
                    href="https://developer.xero.com/app/manage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Xero Developer Portal
                  </a>
                  <br />
                  2. {t("tenant.integrations.xero.step2CreateApp")}
                  <br />
                  3. {t("tenant.integrations.xero.step3AddRedirect")}: <code className="bg-surface-raised px-1 break-all text-xs">{typeof window !== "undefined" ? window.location.origin : ""}/api/integrations/xero/callback</code>
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOAuthModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  {t("tenant.integrations.xero.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? t("tenant.integrations.xero.connecting") : t("tenant.integrations.xero.continueToXero")}
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
                <h2 className="text-lg font-bold">{t("tenant.integrations.xero.xeroSettings")}</h2>
                <p className="text-sm text-foreground-muted">
                  {t("tenant.integrations.xero.configureSyncOptions")}
                </p>
                {xeroSettings?.tenantName && (
                  <p className="text-xs text-foreground-subtle mt-1">
                    {t("tenant.integrations.xero.connectedTo")}: {xeroSettings.tenantName}
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
                <h3 className="text-sm font-medium mb-3">{t("tenant.integrations.xero.syncOptions")}</h3>
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
                      <span className="text-sm font-medium">{t("tenant.integrations.xero.syncInvoices")}</span>
                      <p className="text-xs text-foreground-muted">
                        {t("tenant.integrations.xero.syncInvoicesDesc")}
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
                      <span className="text-sm font-medium">{t("tenant.integrations.xero.syncPayments")}</span>
                      <p className="text-xs text-foreground-muted">
                        {t("tenant.integrations.xero.syncPaymentsDesc")}
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
                      <span className="text-sm font-medium">{t("tenant.integrations.xero.syncContacts")}</span>
                      <p className="text-xs text-foreground-muted">
                        {t("tenant.integrations.xero.syncContactsDesc")}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Account Mapping */}
              <div>
                <h3 className="text-sm font-medium mb-3">{t("tenant.integrations.xero.accountMapping")}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t("tenant.integrations.xero.defaultRevenueAccountCode")}
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
                      {t("tenant.integrations.xero.revenueAccountCodeHint")}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t("tenant.integrations.xero.defaultTaxType")}
                    </label>
                    <select
                      name="defaultTaxType"
                      value={taxType}
                      onChange={(e) => setTaxType(e.target.value)}
                      className="w-full border border-border-strong rounded-lg p-2 text-sm bg-surface-raised text-foreground"
                    >
                      <option value="">{t("tenant.integrations.xero.selectTaxType")}</option>
                      <option value="OUTPUT">{t("tenant.integrations.xero.taxOutputStandard")}</option>
                      <option value="OUTPUT2">{t("tenant.integrations.xero.taxOutputReduced")}</option>
                      <option value="NONE">{t("tenant.integrations.xero.taxNone")}</option>
                      <option value="ZERORATEDOUTPUT">{t("tenant.integrations.xero.taxZeroRated")}</option>
                      <option value="EXEMPTOUTPUT">{t("tenant.integrations.xero.taxExempt")}</option>
                    </select>
                    <p className="text-xs text-foreground-muted mt-1">
                      {t("tenant.integrations.xero.taxTypeHint")}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t("tenant.integrations.xero.invoiceReferencePrefix")}
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
                      {t("tenant.integrations.xero.invoicePrefixHint")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-brand-muted border border-brand rounded-lg p-3">
                <p className="text-sm text-brand">
                  <strong>{t("tenant.integrations.xero.note")}:</strong> {t("tenant.integrations.xero.syncSettingsNote")}
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
                  {t("tenant.integrations.xero.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50"
                >
                  {fetcher.state !== "idle" ? t("tenant.integrations.xero.saving") : t("tenant.integrations.xero.saveSettings")}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
    </>
  );
}

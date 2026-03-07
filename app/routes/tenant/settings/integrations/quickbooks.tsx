/**
 * QuickBooks Integration Settings Page
 *
 * Allows users to:
 * - Connect/disconnect QuickBooks account
 * - Configure sync settings
 * - Map DiveStreams products to QuickBooks items
 * - Manual sync for customers, invoices, and payments
 * - View sync history and errors
 */

import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Form, redirect, Link } from "react-router";
import { useState } from "react";
import { requireOrgContext, requireRole} from "../../../../../lib/auth/org-context.server";
import {
  getIntegration,
  disconnectIntegration,
  updateIntegrationSettings,
} from "../../../../../lib/integrations/index.server";
import {
  getQuickBooksStatus,
  listQuickBooksItems,
  listQuickBooksAccounts,
  syncBookingToQuickBooks,
} from "../../../../../lib/integrations/quickbooks.server";
import { db } from "../../../../../lib/db";
import { eq, desc } from "drizzle-orm";
import { integrationSyncLog } from "../../../../../lib/db/schema/integrations";
import { CsrfInput } from "../../../../components/CsrfInput";
import { useT } from "../../../../i18n/use-t";

export const meta: MetaFunction = () => [
  { title: "QuickBooks Integration - DiveStreams" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const { org } = ctx;

  // Get QuickBooks integration
  const integration = await getIntegration(org.id, "quickbooks");

  // Get connection status and company info
  const status = integration
    ? await getQuickBooksStatus(org.id)
    : { connected: false };

  // Get available items and accounts if connected
  const items = status?.connected
    ? await listQuickBooksItems(org.id)
    : null;

  const accounts = status?.connected
    ? await listQuickBooksAccounts(org.id)
    : null;

  // Get recent sync logs
  const syncLogs = integration
    ? await db
        .select()
        .from(integrationSyncLog)
        .where(eq(integrationSyncLog.integrationId, integration.id))
        .orderBy(desc(integrationSyncLog.createdAt))
        .limit(20)
    : [];

  return {
    integration,
    status,
    items: items || [],
    accounts: accounts || [],
    syncLogs,
    settings: integration?.settings as {
      syncInvoices?: boolean;
      syncPayments?: boolean;
      syncCustomers?: boolean;
      autoSyncEnabled?: boolean;
      useSandbox?: boolean;
    } | null,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const { org } = ctx;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "disconnect") {
    await disconnectIntegration(org.id, "quickbooks");
    return redirect("/tenant/settings/integrations?success=QuickBooks disconnected");
  }

  if (intent === "updateSettings") {
    const syncInvoices = formData.get("syncInvoices") === "on";
    const syncPayments = formData.get("syncPayments") === "on";
    const syncCustomers = formData.get("syncCustomers") === "on";
    const autoSyncEnabled = formData.get("autoSyncEnabled") === "on";

    const integration = await getIntegration(org.id, "quickbooks");
    if (!integration) {
      throw new Error("QuickBooks not connected");
    }

    await updateIntegrationSettings(org.id, "quickbooks", {
      syncInvoices,
      syncPayments,
      syncCustomers,
      autoSyncEnabled,
    });

    return { success: true, message: "Settings updated" };
  }

  if (intent === "syncBooking") {
    const bookingId = formData.get("bookingId") as string;
    if (!bookingId) {
      return { success: false, error: "Booking ID required" };
    }

    const result = await syncBookingToQuickBooks(org.id, bookingId);
    return result;
  }

  return { success: false, error: "Invalid action" };
}

export default function QuickBooksSettings() {
  const t = useT();
  const { status, items, syncLogs, settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showSyncHistory, setShowSyncHistory] = useState(false);

  const isConnected = status?.connected ?? false;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/tenant/settings/integrations"
          className="text-sm text-brand hover:text-brand mb-2 inline-block"
        >
          &larr; {t("tenant.settings.integrations.quickbooks.backToIntegrations")}
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{t("tenant.settings.integrations.quickbooks.title")}</h1>
        <p className="text-foreground-muted mt-1">
          {t("tenant.settings.integrations.quickbooks.subtitle")}
        </p>
      </div>

      {/* Connection Status */}
      <div className="bg-surface-raised rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t("tenant.settings.integrations.quickbooks.connectionStatus")}</h2>
            {isConnected ? (
              <div className="mt-2">
                <div className="flex items-center text-success mb-1">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {t("tenant.settings.integrations.connected")}
                </div>
                {status?.companyName && (
                  <p className="text-sm text-foreground-muted">{t("tenant.settings.integrations.quickbooks.company")}: {status.companyName}</p>
                )}
                {status?.useSandbox && (
                  <p className="text-sm text-accent font-medium">{t("tenant.settings.integrations.quickbooks.sandboxMode")}</p>
                )}
              </div>
            ) : (
              <div className="mt-2">
                <div className="flex items-center text-foreground-muted">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {t("tenant.settings.integrations.notConnected")}
                </div>
              </div>
            )}
          </div>

          <div>
            {isConnected ? (
              <Form method="post">
                <CsrfInput />
                <input type="hidden" name="intent" value="disconnect" />
                <button
                  type="submit"
                  className="px-4 py-2 border border-danger text-danger rounded-lg hover:bg-danger-muted"
                >
                  {t("tenant.settings.integrations.disconnect")}
                </button>
              </Form>
            ) : (
              <a
                href="/api/integrations/quickbooks/connect"
                className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success-hover"
              >
                {t("tenant.settings.integrations.quickbooks.connectQuickBooks")}
              </a>
            )}
          </div>
        </div>
      </div>

      {isConnected && (
        <>
          {/* Sync Settings */}
          <div className="bg-surface-raised rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">{t("tenant.settings.integrations.quickbooks.syncSettings")}</h2>

            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="updateSettings" />

              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="syncInvoices"
                    defaultChecked={settings?.syncInvoices ?? true}
                    className="rounded border-border-strong text-success focus:ring-success"
                  />
                  <span className="ml-2 text-foreground">
                    {t("tenant.settings.integrations.quickbooks.syncInvoices")}
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="syncPayments"
                    defaultChecked={settings?.syncPayments ?? true}
                    className="rounded border-border-strong text-success focus:ring-success"
                  />
                  <span className="ml-2 text-foreground">
                    {t("tenant.settings.integrations.quickbooks.syncPayments")}
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="syncCustomers"
                    defaultChecked={settings?.syncCustomers ?? true}
                    className="rounded border-border-strong text-success focus:ring-success"
                  />
                  <span className="ml-2 text-foreground">
                    {t("tenant.settings.integrations.quickbooks.syncCustomers")}
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="autoSyncEnabled"
                    defaultChecked={settings?.autoSyncEnabled ?? false}
                    className="rounded border-border-strong text-success focus:ring-success"
                  />
                  <span className="ml-2 text-foreground">
                    {t("tenant.settings.integrations.quickbooks.autoSync")}
                  </span>
                </label>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
                >
                  {t("tenant.settings.integrations.quickbooks.saveSettings")}
                </button>
              </div>

              {fetcher.data?.success && (
                <div className="mt-4 p-3 bg-success-muted text-success rounded-lg">
                  {fetcher.data.message}
                </div>
              )}
            </fetcher.Form>
          </div>

          {/* Available Items */}
          {items.length > 0 && (
            <div className="bg-surface-raised rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {t("tenant.settings.integrations.quickbooks.items")}
              </h2>
              <p className="text-sm text-foreground-muted mb-4">
                {t("tenant.settings.integrations.quickbooks.itemsDescription")}
              </p>
              <div className="overflow-auto max-h-64">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-surface-inset">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-foreground-muted uppercase">
                        {t("common.name")}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-foreground-muted uppercase">
                        {t("tenant.settings.integrations.quickbooks.type")}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-foreground-muted uppercase">
                        {t("tenant.settings.integrations.quickbooks.unitPrice")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface-raised divide-y divide-border">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 text-sm text-foreground">{item.name}</td>
                        <td className="px-4 py-2 text-sm text-foreground-muted">{item.type}</td>
                        <td className="px-4 py-2 text-sm text-foreground-muted">
                          {item.unitPrice ? `$${item.unitPrice.toFixed(2)}` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sync History */}
          <div className="bg-surface-raised rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">{t("tenant.settings.integrations.quickbooks.syncHistory")}</h2>
              <button
                onClick={() => setShowSyncHistory(!showSyncHistory)}
                className="text-sm text-brand hover:text-brand"
              >
                {showSyncHistory ? t("tenant.settings.integrations.quickbooks.hideDetails") : t("tenant.settings.integrations.quickbooks.showDetails")}
              </button>
            </div>

            {showSyncHistory && syncLogs.length > 0 && (
              <div className="overflow-auto max-h-96">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-surface-inset">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-foreground-muted uppercase">
                        {t("common.date")}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-foreground-muted uppercase">
                        {t("tenant.settings.integrations.quickbooks.action")}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-foreground-muted uppercase">
                        {t("tenant.settings.integrations.quickbooks.entity")}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-foreground-muted uppercase">
                        {t("common.status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface-raised divide-y divide-border">
                    {syncLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-2 text-sm text-foreground-muted">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-foreground">{log.action}</td>
                        <td className="px-4 py-2 text-sm text-foreground-muted">{log.entityType}</td>
                        <td className="px-4 py-2 text-sm">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              log.status === "success"
                                ? "bg-success-muted text-success"
                                : log.status === "failed"
                                ? "bg-danger-muted text-danger"
                                : "bg-warning-muted text-warning"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {showSyncHistory && syncLogs.length === 0 && (
              <p className="text-sm text-foreground-muted">{t("tenant.settings.integrations.quickbooks.noSyncHistory")}</p>
            )}
          </div>
        </>
      )}

      {/* Setup Instructions */}
      {!isConnected && (
        <div className="bg-brand-muted rounded-lg p-6">
          <h3 className="text-lg font-semibold text-brand mb-3">{t("tenant.settings.integrations.quickbooks.setupInstructions")}</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-brand">
            <li>
              {t("tenant.settings.integrations.quickbooks.setupStep1")}{" "}
              <a
                href="https://developer.intuit.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                developer.intuit.com
              </a>
            </li>
            <li>{t("tenant.settings.integrations.quickbooks.setupStep2")}</li>
            <li>{t("tenant.settings.integrations.quickbooks.setupStep3")}
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>QUICKBOOKS_CLIENT_ID</li>
                <li>QUICKBOOKS_CLIENT_SECRET</li>
              </ul>
            </li>
            <li>{t("tenant.settings.integrations.quickbooks.setupStep4")}</li>
          </ol>
        </div>
      )}
    </div>
  );
}

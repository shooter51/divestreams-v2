/**
 * POS Transaction History
 *
 * Displays all transactions with filtering and search.
 */

import { useState, useEffect } from "react";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams, useFetcher } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getPOSSummary } from "../../../../../lib/db/queries.server";
import { db } from "../../../../../lib/db";
import * as schema from "../../../../../lib/db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { sendEmail } from "../../../../../lib/email/email.server";
import { getPOSReceiptEmail } from "../../../../../lib/email/templates";
import { TransactionActions } from "../../../../../app/components/pos/TransactionActions";
import {
  ReceiptModal,
  TransactionDetailsModal,
  EmailConfirmationModal,
} from "../../../../../app/components/pos/TransactionModals";
import {
  RefundConfirmationModal,
} from "../../../../../app/components/pos/RefundModals";

// Define the POSTransaction type locally
interface POSTransaction {
  id: string;
  type: string;
  amount: number;
  paymentMethod: string | null;
  customerName: string | null;
  customerEmail: string | null;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }> | null;
  createdAt: Date;
  stripePaymentId: string | null;
  refundedTransactionId: string | null;
}

// Local query function for POS transactions
async function getPOSTransactions(
  organizationId: string,
  options: { type?: string; dateFrom?: string; dateTo?: string; limit?: number } = {}
): Promise<POSTransaction[]> {
  const { type, dateFrom, dateTo, limit = 100 } = options;

  const conditions = [eq(schema.transactions.organizationId, organizationId)];
  if (type) conditions.push(eq(schema.transactions.type, type));
  if (dateFrom) conditions.push(gte(schema.transactions.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(schema.transactions.createdAt, new Date(dateTo)));

  const transactions = await db
    .select({
      id: schema.transactions.id,
      type: schema.transactions.type,
      amount: schema.transactions.amount,
      paymentMethod: schema.transactions.paymentMethod,
      items: schema.transactions.items,
      createdAt: schema.transactions.createdAt,
      customerFirstName: schema.customers.firstName,
      customerLastName: schema.customers.lastName,
      customerEmail: schema.customers.email,
      stripePaymentId: schema.transactions.stripePaymentId,
      refundedTransactionId: schema.transactions.refundedTransactionId,
    })
    .from(schema.transactions)
    .leftJoin(schema.customers, eq(schema.transactions.customerId, schema.customers.id))
    .where(and(...conditions))
    .orderBy(desc(schema.transactions.createdAt))
    .limit(limit);

  return transactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: Number(tx.amount),
    paymentMethod: tx.paymentMethod,
    customerName: tx.customerFirstName && tx.customerLastName
      ? `${tx.customerFirstName} ${tx.customerLastName}`
      : null,
    customerEmail: tx.customerEmail,
    items: tx.items as POSTransaction["items"],
    createdAt: tx.createdAt,
    stripePaymentId: tx.stripePaymentId,
    refundedTransactionId: tx.refundedTransactionId,
  }));
}

export const meta: MetaFunction = () => [{ title: "Transactions - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || undefined;
  const dateFrom = url.searchParams.get("dateFrom") || undefined;
  const dateTo = url.searchParams.get("dateTo") || undefined;

  const [transactions, summary, orgData] = await Promise.all([
    getPOSTransactions(organizationId, { type, dateFrom, dateTo, limit: 100 }),
    getPOSSummary(organizationId),
    db
      .select({
        name: schema.organization.name,
        taxRate: schema.organizationSettings.taxRate,
        taxName: schema.organizationSettings.taxName,
        currency: schema.organizationSettings.currency,
      })
      .from(schema.organization)
      .leftJoin(schema.organizationSettings, eq(schema.organizationSettings.organizationId, schema.organization.id))
      .where(eq(schema.organization.id, organizationId))
      .limit(1)
      .then(rows => rows[0]),
  ]);

  return {
    transactions,
    summary,
    organization: {
      name: orgData?.name || "DiveStreams",
      taxRate: orgData?.taxRate || "0",
      taxName: orgData?.taxName || "Tax",
      currency: orgData?.currency || "USD"
    }
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "email-receipt") {
    try {
      const transactionId = formData.get("transactionId") as string;

      if (!transactionId) {
        return { error: "Transaction ID is required" };
      }

      // Fetch full transaction with customer data
      const [transactionData] = await db
        .select({
          id: schema.transactions.id,
          type: schema.transactions.type,
          amount: schema.transactions.amount,
          paymentMethod: schema.transactions.paymentMethod,
          items: schema.transactions.items,
          createdAt: schema.transactions.createdAt,
          customerFirstName: schema.customers.firstName,
          customerLastName: schema.customers.lastName,
          customerEmail: schema.customers.email,
        })
        .from(schema.transactions)
        .leftJoin(schema.customers, eq(schema.transactions.customerId, schema.customers.id))
        .where(
          and(
            eq(schema.transactions.organizationId, organizationId),
            eq(schema.transactions.id, transactionId)
          )
        )
        .limit(1);

      if (!transactionData) {
        return { error: "Transaction not found" };
      }

      // Check if customer has email
      if (!transactionData.customerEmail) {
        return { error: "No customer email on file" };
      }

      // Fetch organization settings
      const [orgData] = await db
        .select({
          name: schema.organization.name,
          taxRate: schema.organizationSettings.taxRate,
          taxName: schema.organizationSettings.taxName,
          currency: schema.organizationSettings.currency,
        })
        .from(schema.organization)
        .leftJoin(schema.organizationSettings, eq(schema.organizationSettings.organizationId, schema.organization.id))
        .where(eq(schema.organization.id, organizationId))
        .limit(1);

      const organization = {
        name: orgData?.name || "DiveStreams",
        taxRate: orgData?.taxRate || "0",
        taxName: orgData?.taxName || "Tax",
        currency: orgData?.currency || "USD"
      };

      // Calculate totals
      const amount = Number(transactionData.amount);
      const taxRate = Number(organization.taxRate) / 100;
      const subtotal = amount / (1 + taxRate);
      const tax = amount - subtotal;

      // Prepare items for receipt
      const items = (transactionData.items as Array<{ description: string; quantity: number; unitPrice: number; total: number }> | null) || [];
      const receiptItems = items.map(item => ({
        name: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      }));

      // If no items, create a generic line item
      if (receiptItems.length === 0) {
        receiptItems.push({
          name: "Transaction",
          quantity: 1,
          unitPrice: subtotal,
          total: subtotal,
        });
      }

      const customerName = `${transactionData.customerFirstName} ${transactionData.customerLastName}`;

      // Generate email
      const emailData = getPOSReceiptEmail({
        receiptNumber: transactionData.id,
        customerName,
        customerEmail: transactionData.customerEmail,
        businessName: organization.name,
        transactionDate: new Date(transactionData.createdAt).toLocaleDateString(),
        items: receiptItems,
        subtotal,
        tax,
        taxName: organization.taxName,
        total: amount,
        paymentMethod: transactionData.paymentMethod || "N/A",
        currency: organization.currency,
      });

      // Send email
      await sendEmail({
        to: transactionData.customerEmail,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
      });

      return { success: true, message: "Receipt sent successfully" };
    } catch (error) {
      console.error("Email receipt error:", error);
      return {
        error: error instanceof Error ? error.message : "Failed to send receipt email"
      };
    }
  }

  return { error: "Invalid action" };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

const typeColors: Record<string, string> = {
  sale: "bg-success-muted text-success",
  refund: "bg-danger-muted text-danger",
  deposit: "bg-brand-muted text-brand",
  payment: "bg-info-muted text-info",
};

const paymentMethodIcons: Record<string, string> = {
  cash: "$",
  card: "Card",
  stripe: "Stripe",
};

export default function TransactionsPage() {
  const { transactions, summary, organization } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const fetcher = useFetcher();

  const currentType = searchParams.get("type") || "";

  // Modal state
  const [selectedTransaction, setSelectedTransaction] = useState<POSTransaction | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  // Monitor fetcher for toast notifications
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const data = fetcher.data as { success?: boolean; message?: string; error?: string };

      if (data.success && data.message) {
        setToastMessage(data.message);
        setToastType("success");
        setEmailModalOpen(false);
        setTimeout(() => setToastMessage(null), 3000);
      } else if (data.error) {
        setToastMessage(data.error);
        setToastType("error");
        setTimeout(() => setToastMessage(null), 5000);
      }
    }
  }, [fetcher.state, fetcher.data]);

  // Action handlers
  const handleViewReceipt = (tx: POSTransaction) => {
    setSelectedTransaction(tx);
    setReceiptModalOpen(true);
  };

  const handleViewDetails = (tx: POSTransaction) => {
    setSelectedTransaction(tx);
    setDetailsModalOpen(true);
  };

  const handleEmailReceipt = (tx: POSTransaction) => {
    setSelectedTransaction(tx);
    setEmailModalOpen(true);
  };

  const handleRefund = (tx: POSTransaction) => {
    setSelectedTransaction(tx);
    setRefundModalOpen(true);
  };

  const handleEmailConfirm = () => {
    if (!selectedTransaction) return;

    const formData = new FormData();
    formData.append("intent", "email-receipt");
    formData.append("transactionId", selectedTransaction.id);
    fetcher.submit(formData, { method: "POST" });
  };

  const handleRefundConfirm = (refundReason: string) => {
    if (!selectedTransaction) return;

    // This would need to be implemented in the action
    // For now, close the modal
    setRefundModalOpen(false);
    setToastMessage("Refund functionality needs to be integrated");
    setToastType("error");
    setTimeout(() => setToastMessage(null), 5000);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-sm text-foreground-muted">{transactions.length} transactions</p>
        </div>
        <Link
          to="/tenant/pos"
          className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
        >
          Back to POS
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-sm text-foreground-muted">Today's Sales</p>
          <p className="text-2xl font-bold text-success">{formatCurrency(summary.totalSales)}</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-sm text-foreground-muted">Transactions</p>
          <p className="text-2xl font-bold">{summary.transactionCount}</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-sm text-foreground-muted">Avg Transaction</p>
          <p className="text-2xl font-bold">{formatCurrency(summary.averageTransaction)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-raised rounded-xl p-4 shadow-sm mb-6">
        <div className="flex gap-2">
          <Link
            to="/tenant/pos/transactions"
            className={`px-4 py-2 rounded-lg text-sm ${
              !currentType ? "bg-brand text-white" : "bg-surface-inset hover:bg-surface-overlay"
            }`}
          >
            All
          </Link>
          <Link
            to="/tenant/pos/transactions?type=sale"
            className={`px-4 py-2 rounded-lg text-sm ${
              currentType === "sale" ? "bg-brand text-white" : "bg-surface-inset hover:bg-surface-overlay"
            }`}
          >
            Sales
          </Link>
          <Link
            to="/tenant/pos/transactions?type=refund"
            className={`px-4 py-2 rounded-lg text-sm ${
              currentType === "refund" ? "bg-brand text-white" : "bg-surface-inset hover:bg-surface-overlay"
            }`}
          >
            Refunds
          </Link>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-surface-raised rounded-xl shadow-sm overflow-hidden">
        {transactions.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-surface-inset">
                <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Date/Time</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Type</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Items</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Customer</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Payment</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-foreground-muted">Amount</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-foreground-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: POSTransaction) => (
                <tr key={tx.id} className="border-b last:border-0 hover:bg-surface-inset">
                  <td className="px-6 py-4 text-sm">
                    {formatDateTime(tx.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded capitalize ${
                          typeColors[tx.type] || "bg-surface-inset text-foreground"
                        }`}
                      >
                        {tx.type}
                      </span>
                      {tx.refundedTransactionId && (
                        <span className="text-xs px-2 py-1 rounded bg-warning-muted text-warning">
                          Refunded
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {tx.items && tx.items.length > 0 ? (
                      <div className="text-sm">
                        {tx.items.slice(0, 2).map((item, i) => (
                          <div key={i} className="text-foreground-muted">
                            {item.quantity}x {item.description}
                          </div>
                        ))}
                        {tx.items.length > 2 && (
                          <div className="text-foreground-subtle">+{tx.items.length - 2} more</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-foreground-subtle">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {tx.customerName || <span className="text-foreground-subtle">Walk-in</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm capitalize">{tx.paymentMethod}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`font-medium ${
                        tx.type === "refund" ? "text-danger" : "text-success"
                      }`}
                    >
                      {tx.type === "refund" ? "-" : ""}
                      {formatCurrency(tx.amount)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <TransactionActions
                      transaction={tx}
                      onViewReceipt={() => handleViewReceipt(tx)}
                      onViewDetails={() => handleViewDetails(tx)}
                      onEmailReceipt={() => handleEmailReceipt(tx)}
                      onRefund={() => handleRefund(tx)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <p className="text-foreground-muted">No transactions found</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedTransaction && (
        <>
          <ReceiptModal
            isOpen={receiptModalOpen}
            onClose={() => setReceiptModalOpen(false)}
            transaction={selectedTransaction}
            organization={organization}
          />

          <TransactionDetailsModal
            isOpen={detailsModalOpen}
            onClose={() => setDetailsModalOpen(false)}
            transaction={selectedTransaction}
            organization={organization}
          />

          <EmailConfirmationModal
            isOpen={emailModalOpen}
            onClose={() => setEmailModalOpen(false)}
            onConfirm={handleEmailConfirm}
            transaction={selectedTransaction}
            organization={organization}
            isLoading={fetcher.state === "submitting"}
          />

          <RefundConfirmationModal
            isOpen={refundModalOpen}
            onClose={() => setRefundModalOpen(false)}
            transaction={{
              id: selectedTransaction.id,
              amount: selectedTransaction.amount.toString(),
              paymentMethod: selectedTransaction.paymentMethod || "cash",
              stripePaymentId: selectedTransaction.stripePaymentId,
              items: selectedTransaction.items?.map(item => ({
                type: "product",
                name: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
              })) || [],
              createdAt: selectedTransaction.createdAt.toString(),
              customer: selectedTransaction.customerName && selectedTransaction.customerEmail ? {
                firstName: selectedTransaction.customerName.split(" ")[0],
                lastName: selectedTransaction.customerName.split(" ").slice(1).join(" "),
                email: selectedTransaction.customerEmail,
              } : null,
            }}
            onConfirm={handleRefundConfirm}
          />
        </>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div
            className={`px-6 py-4 rounded-lg shadow-lg ${
              toastType === "success"
                ? "bg-success text-white"
                : "bg-danger text-white"
            }`}
          >
            <div className="flex items-center gap-3">
              {toastType === "success" ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <p className="font-medium">{toastMessage}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

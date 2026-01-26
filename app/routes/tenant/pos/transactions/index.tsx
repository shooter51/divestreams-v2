/**
 * POS Transaction History
 *
 * Displays all transactions with filtering and search.
 */

import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireTenant } from "../../../../../lib/auth/org-context.server";
import { getPOSSummary } from "../../../../../lib/db/queries.server";
import { db } from "../../../../../lib/db";
import * as schema from "../../../../../lib/db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";

// Define the POSTransaction type locally
interface POSTransaction {
  id: string;
  type: string;
  amount: number;
  paymentMethod: string | null;
  customerName: string | null;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }> | null;
  createdAt: Date;
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
    items: tx.items as POSTransaction["items"],
    createdAt: tx.createdAt,
  }));
}

export const meta: MetaFunction = () => [{ title: "Transactions - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || undefined;
  const dateFrom = url.searchParams.get("dateFrom") || undefined;
  const dateTo = url.searchParams.get("dateTo") || undefined;

  const [transactions, summary] = await Promise.all([
    getPOSTransactions(organizationId, { type, dateFrom, dateTo, limit: 100 }),
    getPOSSummary(organizationId),
  ]);

  return { transactions, summary };
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
  const { transactions, summary } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const currentType = searchParams.get("type") || "";

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
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: POSTransaction) => (
                <tr key={tx.id} className="border-b last:border-0 hover:bg-surface-inset">
                  <td className="px-6 py-4 text-sm">
                    {formatDateTime(tx.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded capitalize ${
                        typeColors[tx.type] || "bg-surface-inset text-foreground"
                      }`}
                    >
                      {tx.type}
                    </span>
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
    </div>
  );
}

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
  sale: "bg-green-100 text-green-700",
  refund: "bg-red-100 text-red-700",
  deposit: "bg-blue-100 text-blue-700",
  payment: "bg-purple-100 text-purple-700",
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
          <p className="text-sm text-gray-500">{transactions.length} transactions</p>
        </div>
        <Link
          to="/tenant/pos"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to POS
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Today's Sales</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalSales)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Transactions</p>
          <p className="text-2xl font-bold">{summary.transactionCount}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Avg Transaction</p>
          <p className="text-2xl font-bold">{formatCurrency(summary.averageTransaction)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <div className="flex gap-2">
          <Link
            to="/tenant/pos/transactions"
            className={`px-4 py-2 rounded-lg text-sm ${
              !currentType ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            All
          </Link>
          <Link
            to="/tenant/pos/transactions?type=sale"
            className={`px-4 py-2 rounded-lg text-sm ${
              currentType === "sale" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            Sales
          </Link>
          <Link
            to="/tenant/pos/transactions?type=refund"
            className={`px-4 py-2 rounded-lg text-sm ${
              currentType === "refund" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            Refunds
          </Link>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {transactions.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Date/Time</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Type</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Items</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Customer</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Payment</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: POSTransaction) => (
                <tr key={tx.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">
                    {formatDateTime(tx.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded capitalize ${
                        typeColors[tx.type] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {tx.items && tx.items.length > 0 ? (
                      <div className="text-sm">
                        {tx.items.slice(0, 2).map((item, i) => (
                          <div key={i} className="text-gray-600">
                            {item.quantity}x {item.description}
                          </div>
                        ))}
                        {tx.items.length > 2 && (
                          <div className="text-gray-400">+{tx.items.length - 2} more</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {tx.customerName || <span className="text-gray-400">Walk-in</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm capitalize">{tx.paymentMethod}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`font-medium ${
                        tx.type === "refund" ? "text-red-600" : "text-green-600"
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
            <p className="text-gray-500">No transactions found</p>
          </div>
        )}
      </div>
    </div>
  );
}

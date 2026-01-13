/**
 * POS Transaction History
 *
 * Displays all transactions with filtering and search.
 */

import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireTenant } from "../../../../../lib/auth/tenant-auth.server";
import { getPOSTransactions, getPOSSummary, type POSTransaction } from "../../../../../lib/db/queries.server";

export const meta: MetaFunction = () => [{ title: "Transactions - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || undefined;
  const dateFrom = url.searchParams.get("dateFrom") || undefined;
  const dateTo = url.searchParams.get("dateTo") || undefined;

  const [transactions, summary] = await Promise.all([
    getPOSTransactions(tenant.schemaName, { type, dateFrom, dateTo, limit: 100 }),
    getPOSSummary(tenant.schemaName),
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
          to="/app/pos"
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
          <p className="text-sm text-gray-500">Cash</p>
          <p className="text-2xl font-bold">{formatCurrency(summary.cashSales)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Card</p>
          <p className="text-2xl font-bold">{formatCurrency(summary.cardSales)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <div className="flex gap-2">
          <Link
            to="/app/pos/transactions"
            className={`px-4 py-2 rounded-lg text-sm ${
              !currentType ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            All
          </Link>
          <Link
            to="/app/pos/transactions?type=sale"
            className={`px-4 py-2 rounded-lg text-sm ${
              currentType === "sale" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            Sales
          </Link>
          <Link
            to="/app/pos/transactions?type=refund"
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

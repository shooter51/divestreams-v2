/**
 * Reports Dashboard
 *
 * Displays key business metrics and reports including:
 * - Revenue overview and trends
 * - Booking statistics
 * - Customer insights
 * - Equipment utilization
 */

import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { bookings, customers, tours, equipment } from "../../../../lib/db/schema";
import { eq, gte, and, sql, count, sum } from "drizzle-orm";
import { PremiumGate } from "../../../components/ui/UpgradePrompt";

export const meta: MetaFunction = () => [{ title: "Reports - DiveStreams" }];

// Type definitions for report data
type RevenueDataItem = {
  period: string;
  revenue: number;
  bookings: number;
};

type BookingStatusItem = {
  status: string;
  count: number;
};

type TopTourItem = {
  id: string;
  name: string;
  bookings: number;
  revenue: number;
};

type EquipmentUtilizationItem = {
  category: string;
  total: number;
  available: number;
  rented: number;
  maintenance: number;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Advanced reports require premium subscription
  // For now, provide basic stats for all users
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const lastMonth = new Date(startOfMonth);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  // Default values for all queries
  let currentMonth = 0;
  let lastMonthTotal = 0;
  let changePercent = 0;
  let bookingsThisMonth = 0;
  let avgBookingValue = 0;
  let totalCustomers = 0;
  let newThisMonth = 0;

  try {
    // Get basic revenue overview
    const [currentMonthResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${bookings.total}), 0)` })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, ctx.org.id),
          gte(bookings.createdAt, startOfMonth)
        )
      );

    const [lastMonthResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${bookings.total}), 0)` })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, ctx.org.id),
          gte(bookings.createdAt, lastMonth),
          sql`${bookings.createdAt} < ${startOfMonth}`
        )
      );

    currentMonth = Number(currentMonthResult?.total || 0);
    lastMonthTotal = Number(lastMonthResult?.total || 0);
    changePercent = lastMonthTotal > 0
      ? Math.round(((currentMonth - lastMonthTotal) / lastMonthTotal) * 100)
      : 0;

    // Get booking count this month
    const [bookingCountResult] = await db
      .select({ count: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, ctx.org.id),
          gte(bookings.createdAt, startOfMonth)
        )
      );

    bookingsThisMonth = bookingCountResult?.count || 0;
    avgBookingValue = bookingsThisMonth > 0 ? Math.round(currentMonth / bookingsThisMonth) : 0;

    // Get customer count
    const [customerCountResult] = await db
      .select({ count: count() })
      .from(customers)
      .where(eq(customers.organizationId, ctx.org.id));

    totalCustomers = customerCountResult?.count || 0;

    // Get new customers this month
    const [newCustomerResult] = await db
      .select({ count: count() })
      .from(customers)
      .where(
        and(
          eq(customers.organizationId, ctx.org.id),
          gte(customers.createdAt, startOfMonth)
        )
      );

    newThisMonth = newCustomerResult?.count || 0;
  } catch (error) {
    console.error("Error fetching report data:", error);
    // Return defaults - all zeros already set above
  }

  const revenueOverview = {
    currentMonth,
    lastMonth: lastMonthTotal,
    yearToDate: currentMonth + lastMonthTotal, // Simplified for now
    avgBookingValue,
    changePercent,
  };

  const customerStats = {
    totalCustomers,
    newThisMonth,
    repeatCustomers: 0, // Would need more complex query
    avgBookingsPerCustomer: totalCustomers > 0 ? Math.round(bookingsThisMonth / totalCustomers * 10) / 10 : 0,
  };

  // Only fetch advanced reporting data for premium users
  let advancedData: {
    revenueData: RevenueDataItem[];
    bookingsByStatus: BookingStatusItem[];
    topTours: TopTourItem[];
    equipmentUtilization: EquipmentUtilizationItem[];
  } | null = null;

  if (ctx.isPremium) {
    advancedData = {
      revenueData: [] as RevenueDataItem[], // Placeholder - would need daily aggregation query
      bookingsByStatus: [] as BookingStatusItem[], // Placeholder - would need status grouping query
      topTours: [] as TopTourItem[], // Placeholder - would need tour revenue aggregation
      equipmentUtilization: [] as EquipmentUtilizationItem[], // Placeholder - would need equipment status query
    };
  }

  // Return report data with premium gating
  return {
    revenueOverview,
    // Advanced features - only for premium users
    revenueData: advancedData?.revenueData ?? [],
    bookingsByStatus: advancedData?.bookingsByStatus ?? [],
    topTours: advancedData?.topTours ?? [],
    equipmentUtilization: advancedData?.equipmentUtilization ?? [],
    // Basic stats - available to all users
    customerStats,
    isPremium: ctx.isPremium,
  };
}

// Status color mapping
const statusColors: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: "bg-green-100", text: "text-green-700" },
  pending: { bg: "bg-yellow-100", text: "text-yellow-700" },
  checked_in: { bg: "bg-blue-100", text: "text-blue-700" },
  completed: { bg: "bg-gray-100", text: "text-gray-700" },
  canceled: { bg: "bg-red-100", text: "text-red-700" },
  no_show: { bg: "bg-orange-100", text: "text-orange-700" },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value}%`;
}

export default function ReportsPage() {
  const {
    revenueOverview,
    revenueData,
    bookingsByStatus,
    topTours,
    customerStats,
    equipmentUtilization,
    isPremium,
  } = useLoaderData<typeof loader>();

  // Calculate total bookings
  const totalBookings = bookingsByStatus.reduce((sum, s) => sum + s.count, 0);

  // Get max revenue for scaling the chart bars
  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue), 1);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="text-sm text-gray-500">Last 30 days</div>
      </div>

      {/* Revenue Overview Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-gray-500 text-sm mb-1">This Month</p>
          <p className="text-2xl font-bold">{formatCurrency(revenueOverview.currentMonth)}</p>
          <p
            className={`text-sm mt-1 ${
              revenueOverview.changePercent >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {formatPercent(revenueOverview.changePercent)} vs last month
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-gray-500 text-sm mb-1">Last Month</p>
          <p className="text-2xl font-bold">{formatCurrency(revenueOverview.lastMonth)}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-gray-500 text-sm mb-1">Year to Date</p>
          <p className="text-2xl font-bold">{formatCurrency(revenueOverview.yearToDate)}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-gray-500 text-sm mb-1">Avg Booking Value</p>
          <p className="text-2xl font-bold">{formatCurrency(revenueOverview.avgBookingValue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Revenue Chart - Premium Feature */}
        <PremiumGate feature="Advanced Revenue Charts" isPremium={isPremium}>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Revenue Trend (Last 30 Days)</h2>
            {revenueData.length > 0 ? (
              <div className="h-48">
                <div className="flex items-end justify-between h-full gap-1">
                  {revenueData.map((data, index) => (
                    <div
                      key={data.period}
                      className="flex-1 flex flex-col items-center group relative"
                    >
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                        style={{
                          height: `${Math.max((data.revenue / maxRevenue) * 100, 2)}%`,
                        }}
                      />
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                        <div>{data.period}</div>
                        <div>{formatCurrency(data.revenue)}</div>
                        <div>{data.bookings} bookings</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400">
                No revenue data available
              </div>
            )}
          </div>
        </PremiumGate>

        {/* Booking Status Breakdown - Premium Feature */}
        <PremiumGate feature="Detailed Booking Analytics" isPremium={isPremium}>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Bookings by Status</h2>
            {totalBookings > 0 ? (
              <div className="space-y-3">
                {bookingsByStatus.map((status) => {
                  const colors = statusColors[status.status] || {
                    bg: "bg-gray-100",
                    text: "text-gray-700",
                  };
                  const percentage = Math.round((status.count / totalBookings) * 100);

                  return (
                    <div key={status.status}>
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-medium capitalize ${colors.text}`}>
                          {status.status.replace("_", " ")}
                        </span>
                        <span className="text-sm text-gray-500">
                          {status.count} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${colors.bg.replace("100", "500")}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400">
                No booking data available
              </div>
            )}
          </div>
        </PremiumGate>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Top Tours - Premium Feature */}
        <PremiumGate feature="Detailed Revenue Breakdowns" isPremium={isPremium}>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Top Tours by Revenue</h2>
            {topTours.length > 0 ? (
              <div className="space-y-3">
                {topTours.map((tour, index) => (
                  <div
                    key={tour.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                          index === 0
                            ? "bg-yellow-100 text-yellow-700"
                            : index === 1
                            ? "bg-gray-200 text-gray-700"
                            : index === 2
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{tour.name}</p>
                        <p className="text-sm text-gray-500">{tour.bookings} bookings</p>
                      </div>
                    </div>
                    <p className="font-semibold text-green-600">{formatCurrency(tour.revenue)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400">
                No tour data available
              </div>
            )}
            <Link
              to="/app/tours"
              className="block text-center text-blue-600 mt-4 text-sm hover:underline"
            >
              View all tours
            </Link>
          </div>
        </PremiumGate>

        {/* Customer Stats - Available to all users (basic analytics) */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Customer Insights</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-700">{customerStats.totalCustomers}</p>
              <p className="text-sm text-blue-600">Total Customers</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-700">{customerStats.newThisMonth}</p>
              <p className="text-sm text-green-600">New This Month</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-700">{customerStats.repeatCustomers}</p>
              <p className="text-sm text-purple-600">Repeat Customers</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-700">
                {customerStats.avgBookingsPerCustomer}
              </p>
              <p className="text-sm text-orange-600">Avg Bookings/Customer</p>
            </div>
          </div>
          <Link
            to="/app/customers"
            className="block text-center text-blue-600 mt-4 text-sm hover:underline"
          >
            View all customers
          </Link>
        </div>
      </div>

      {/* Equipment Utilization - Premium Feature */}
      <PremiumGate feature="Equipment Utilization Reports" isPremium={isPremium}>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Equipment Utilization</h2>
          {equipmentUtilization.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-gray-500">
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium text-center">Total</th>
                    <th className="pb-3 font-medium text-center">Available</th>
                    <th className="pb-3 font-medium text-center">Rented</th>
                    <th className="pb-3 font-medium text-center">Maintenance</th>
                    <th className="pb-3 font-medium">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentUtilization.map((category) => {
                    const utilization =
                      category.total > 0
                        ? Math.round(((category.rented) / category.total) * 100)
                        : 0;

                    return (
                      <tr key={category.category} className="border-b last:border-0">
                        <td className="py-3 font-medium capitalize">{category.category}</td>
                        <td className="py-3 text-center">{category.total}</td>
                        <td className="py-3 text-center text-green-600">{category.available}</td>
                        <td className="py-3 text-center text-blue-600">{category.rented}</td>
                        <td className="py-3 text-center text-orange-600">{category.maintenance}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-100 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-blue-500"
                                style={{ width: `${utilization}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{utilization}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-400">
              No equipment data available
            </div>
          )}
          <Link
            to="/app/equipment"
            className="block text-center text-blue-600 mt-4 text-sm hover:underline"
          >
            View all equipment
          </Link>
        </div>
      </PremiumGate>
    </div>
  );
}

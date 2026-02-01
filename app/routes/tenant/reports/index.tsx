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
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { bookings, customers, tours, equipment } from "../../../../lib/db/schema";
import { eq, gte, and, sql, count, sum, lte } from "drizzle-orm";
import { PremiumGate } from "../../../components/ui/UpgradePrompt";
import { useState, useRef, useEffect } from "react";

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

// Date range preset types
type DateRangePreset = "today" | "this_week" | "this_month" | "this_year" | "custom";

// Helper function to calculate date range from preset
function getDateRangeFromPreset(preset: DateRangePreset, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1), // End of today
      };
    case "this_week": {
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek); // Sunday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      return { start: startOfWeek, end: endOfWeek };
    }
    case "this_month": {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start: startOfMonth, end: endOfMonth };
    }
    case "this_year": {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start: startOfYear, end: endOfYear };
    }
    case "custom": {
      const start = customStart ? new Date(customStart) : today;
      const end = customEnd ? new Date(customEnd + "T23:59:59.999") : new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
      return { start, end };
    }
    default: {
      // Default to this month
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start: startOfMonth, end: endOfMonth };
    }
  }
}

// Helper to get previous period for comparison
function getPreviousPeriod(preset: DateRangePreset, start: Date, end: Date): { start: Date; end: Date } {
  const duration = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration - 1),
    end: new Date(start.getTime() - 1),
  };
}

// Helper to format date range label
function getDateRangeLabel(preset: DateRangePreset, customStart?: string, customEnd?: string): string {
  switch (preset) {
    case "today":
      return "Today";
    case "this_week":
      return "This Week";
    case "this_month":
      return "This Month";
    case "this_year":
      return "This Year";
    case "custom":
      if (customStart && customEnd) {
        return `${customStart} to ${customEnd}`;
      }
      return "Custom Range";
    default:
      return "This Month";
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);

  // Parse date range from URL params
  const rangeParam = url.searchParams.get("range") as DateRangePreset | null;
  const customStart = url.searchParams.get("start") || undefined;
  const customEnd = url.searchParams.get("end") || undefined;

  // Default to "this_month" if no range specified
  const selectedRange: DateRangePreset = rangeParam || "this_month";

  // Calculate date range
  const { start: dateStart, end: dateEnd } = getDateRangeFromPreset(selectedRange, customStart, customEnd);
  const { start: prevStart, end: prevEnd } = getPreviousPeriod(selectedRange, dateStart, dateEnd);

  // For YTD calculation
  const startOfYear = new Date(new Date().getFullYear(), 0, 1);

  // Default values for all queries
  let currentPeriodRevenue = 0;
  let previousPeriodRevenue = 0;
  let changePercent = 0;
  let bookingsInPeriod = 0;
  let avgBookingValue = 0;
  let totalCustomers = 0;
  let newCustomersInPeriod = 0;
  let yearToDateRevenue = 0;

  try {
    // Get revenue for selected period
    const [currentPeriodResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${bookings.total}), 0)` })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, ctx.org.id),
          gte(bookings.createdAt, dateStart),
          lte(bookings.createdAt, dateEnd)
        )
      );

    // Get revenue for previous period (for comparison)
    const [previousPeriodResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${bookings.total}), 0)` })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, ctx.org.id),
          gte(bookings.createdAt, prevStart),
          lte(bookings.createdAt, prevEnd)
        )
      );

    // Get Year to Date revenue
    const [ytdResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${bookings.total}), 0)` })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, ctx.org.id),
          gte(bookings.createdAt, startOfYear)
        )
      );

    currentPeriodRevenue = Number(currentPeriodResult?.total || 0);
    previousPeriodRevenue = Number(previousPeriodResult?.total || 0);
    yearToDateRevenue = Number(ytdResult?.total || 0);
    changePercent = previousPeriodRevenue > 0
      ? Math.round(((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100)
      : 0;

    // Get booking count for selected period
    const [bookingCountResult] = await db
      .select({ count: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, ctx.org.id),
          gte(bookings.createdAt, dateStart),
          lte(bookings.createdAt, dateEnd)
        )
      );

    bookingsInPeriod = bookingCountResult?.count || 0;
    avgBookingValue = bookingsInPeriod > 0 ? Math.round(currentPeriodRevenue / bookingsInPeriod) : 0;

    // Get total customer count (not filtered by date range)
    const [customerCountResult] = await db
      .select({ count: count() })
      .from(customers)
      .where(eq(customers.organizationId, ctx.org.id));

    totalCustomers = customerCountResult?.count || 0;

    // Get new customers in selected period
    const [newCustomerResult] = await db
      .select({ count: count() })
      .from(customers)
      .where(
        and(
          eq(customers.organizationId, ctx.org.id),
          gte(customers.createdAt, dateStart),
          lte(customers.createdAt, dateEnd)
        )
      );

    newCustomersInPeriod = newCustomerResult?.count || 0;
  } catch (error) {
    console.error("Error fetching report data:", error);
    // Return defaults - all zeros already set above
  }

  const revenueOverview = {
    currentPeriod: currentPeriodRevenue,
    previousPeriod: previousPeriodRevenue,
    yearToDate: yearToDateRevenue,
    avgBookingValue,
    changePercent,
  };

  const customerStats = {
    totalCustomers,
    newInPeriod: newCustomersInPeriod,
    repeatCustomers: 0, // Would need more complex query
    avgBookingsPerCustomer: totalCustomers > 0 ? Math.round(bookingsInPeriod / totalCustomers * 10) / 10 : 0,
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
    // Date range info
    dateRange: {
      preset: selectedRange,
      start: customStart,
      end: customEnd,
      label: getDateRangeLabel(selectedRange, customStart, customEnd),
    },
  };
}

// Status color mapping
const statusColors: Record<string, { bg: string; text: string; bar: string }> = {
  confirmed: { bg: "bg-success-muted", text: "text-success", bar: "bg-success" },
  pending: { bg: "bg-warning-muted", text: "text-warning", bar: "bg-warning" },
  checked_in: { bg: "bg-brand-muted", text: "text-brand", bar: "bg-brand" },
  completed: { bg: "bg-surface-inset", text: "text-foreground", bar: "bg-surface-overlay" },
  canceled: { bg: "bg-danger-muted", text: "text-danger", bar: "bg-danger" },
  no_show: { bg: "bg-warning-muted", text: "text-warning", bar: "bg-warning" },
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

// Date Range Selector Component
function DateRangeSelector({
  currentPreset,
  currentStart,
  currentEnd,
}: {
  currentPreset: string;
  currentStart?: string;
  currentEnd?: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(currentPreset === "custom");
  const [customStartDate, setCustomStartDate] = useState(currentStart || "");
  const [customEndDate, setCustomEndDate] = useState(currentEnd || "");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const presets = [
    { value: "today", label: "Today" },
    { value: "this_week", label: "This Week" },
    { value: "this_month", label: "This Month" },
    { value: "this_year", label: "This Year" },
  ];

  const handlePresetSelect = (preset: string) => {
    if (preset === "custom") {
      setShowCustom(true);
    } else {
      setSearchParams({ range: preset });
      setIsOpen(false);
      setShowCustom(false);
    }
  };

  const handleCustomApply = () => {
    if (customStartDate && customEndDate) {
      setSearchParams({
        range: "custom",
        start: customStartDate,
        end: customEndDate,
      });
      setIsOpen(false);
    }
  };

  const getCurrentLabel = () => {
    if (currentPreset === "custom" && currentStart && currentEnd) {
      return `${currentStart} to ${currentEnd}`;
    }
    const preset = presets.find((p) => p.value === currentPreset);
    return preset?.label || "This Month";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-surface-raised border border-border-strong rounded-lg hover:bg-surface-inset focus:outline-none focus:ring-2 focus:ring-brand"
        aria-label="Select date range"
      >
        <svg
          className="w-5 h-5 text-foreground-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span className="text-sm font-medium text-foreground">{getCurrentLabel()}</span>
        <svg
          className={`w-4 h-4 text-foreground-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-surface-raised rounded-lg shadow-lg border border-border z-50">
          <div className="p-2">
            <p className="px-3 py-2 text-xs font-semibold text-foreground-muted uppercase tracking-wider">
              Presets
            </p>
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePresetSelect(preset.value)}
                className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-surface-overlay ${
                  currentPreset === preset.value ? "bg-brand-muted text-brand font-medium" : "text-foreground"
                }`}
              >
                {preset.label}
              </button>
            ))}

            <hr className="my-2" />

            <button
              type="button"
              onClick={() => setShowCustom(!showCustom)}
              className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-surface-overlay ${
                currentPreset === "custom" ? "bg-brand-muted text-brand font-medium" : "text-foreground"
              }`}
            >
              Custom Range
            </button>

            {showCustom && (
              <div className="p-3 space-y-3">
                <div>
                  <label htmlFor="start-date" className="block text-xs font-medium text-foreground-muted mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="start-date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
                    aria-label="Start date"
                  />
                </div>
                <div>
                  <label htmlFor="end-date" className="block text-xs font-medium text-foreground-muted mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    id="end-date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
                    aria-label="End date"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCustomApply}
                  disabled={!customStartDate || !customEndDate}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-brand rounded-md hover:bg-brand-hover disabled:bg-surface-overlay disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
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
    dateRange,
  } = useLoaderData<typeof loader>();

  // Calculate total bookings
  const totalBookings = bookingsByStatus.reduce((sum, s) => sum + s.count, 0);

  // Get max revenue for scaling the chart bars
  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue), 1);

  // Get period label for display
  const periodLabel = dateRange.label;
  const comparisonLabel = dateRange.preset === "today" ? "vs yesterday" :
    dateRange.preset === "this_week" ? "vs last week" :
    dateRange.preset === "this_month" ? "vs last month" :
    dateRange.preset === "this_year" ? "vs last year" :
    "vs previous period";

  // Build export URL with current date range params
  const buildExportUrl = (type: "csv" | "pdf") => {
    const params = new URLSearchParams();
    if (dateRange.start) params.set("startDate", dateRange.start);
    if (dateRange.end) params.set("endDate", dateRange.end);
    const queryString = params.toString();
    return `/tenant/reports/export/${type}${queryString ? `?${queryString}` : ""}`;
  };

  const handleExportCSV = () => {
    window.location.href = buildExportUrl("csv");
  };

  const handleExportPDF = () => {
    window.location.href = buildExportUrl("pdf");
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-surface-raised border border-border-strong rounded-lg hover:bg-surface-inset focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand border border-transparent rounded-lg hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF
          </button>
          <DateRangeSelector
            currentPreset={dateRange.preset}
            currentStart={dateRange.start}
            currentEnd={dateRange.end}
          />
        </div>
      </div>

      {/* Revenue Overview Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <p className="text-foreground-muted text-sm mb-1">{periodLabel}</p>
          <p className="text-2xl font-bold">{formatCurrency(revenueOverview.currentPeriod)}</p>
          <p
            className={`text-sm mt-1 ${
              revenueOverview.changePercent >= 0 ? "text-success" : "text-danger"
            }`}
          >
            {formatPercent(revenueOverview.changePercent)} {comparisonLabel}
          </p>
        </div>
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <p className="text-foreground-muted text-sm mb-1">Previous Period</p>
          <p className="text-2xl font-bold">{formatCurrency(revenueOverview.previousPeriod)}</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <p className="text-foreground-muted text-sm mb-1">Year to Date</p>
          <p className="text-2xl font-bold">{formatCurrency(revenueOverview.yearToDate)}</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <p className="text-foreground-muted text-sm mb-1">Avg Booking Value</p>
          <p className="text-2xl font-bold">{formatCurrency(revenueOverview.avgBookingValue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Revenue Chart - Premium Feature */}
        <PremiumGate feature="Advanced Revenue Charts" isPremium={isPremium}>
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
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
                        className="w-full bg-brand rounded-t transition-all hover:bg-brand"
                        style={{
                          height: `${Math.max((data.revenue / maxRevenue) * 100, 2)}%`,
                        }}
                      />
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-surface text-foreground border border-border text-xs rounded px-2 py-1 whitespace-nowrap z-10 shadow-lg">
                        <div>{data.period}</div>
                        <div>{formatCurrency(data.revenue)}</div>
                        <div>{data.bookings} bookings</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-foreground-subtle">
                No revenue data available
              </div>
            )}
          </div>
        </PremiumGate>

        {/* Booking Status Breakdown - Premium Feature */}
        <PremiumGate feature="Detailed Booking Analytics" isPremium={isPremium}>
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Bookings by Status</h2>
            {totalBookings > 0 ? (
              <div className="space-y-3">
                {bookingsByStatus.map((status) => {
                  const colors = statusColors[status.status] || {
                    bg: "bg-surface-inset",
                    text: "text-foreground",
                    bar: "bg-surface-overlay",
                  };
                  const percentage = Math.round((status.count / totalBookings) * 100);

                  return (
                    <div key={status.status}>
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-medium capitalize ${colors.text}`}>
                          {status.status.replace("_", " ")}
                        </span>
                        <span className="text-sm text-foreground-muted">
                          {status.count} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-surface-inset rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${colors.bar}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-foreground-subtle">
                No booking data available
              </div>
            )}
          </div>
        </PremiumGate>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Top Tours - Premium Feature */}
        <PremiumGate feature="Detailed Revenue Breakdowns" isPremium={isPremium}>
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Top Tours by Revenue</h2>
            {topTours.length > 0 ? (
              <div className="space-y-3">
                {topTours.map((tour, index) => (
                  <div
                    key={tour.id}
                    className="flex items-center justify-between p-3 bg-surface-inset rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                          index === 0
                            ? "bg-warning-muted text-warning"
                            : index === 1
                            ? "bg-surface-overlay text-foreground"
                            : index === 2
                            ? "bg-accent-muted text-accent"
                            : "bg-surface-inset text-foreground-muted"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{tour.name}</p>
                        <p className="text-sm text-foreground-muted">{tour.bookings} bookings</p>
                      </div>
                    </div>
                    <p className="font-semibold text-success">{formatCurrency(tour.revenue)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-foreground-subtle">
                No tour data available
              </div>
            )}
            <Link
              to="/tenant/tours"
              className="block text-center text-brand mt-4 text-sm hover:underline"
            >
              View all tours
            </Link>
          </div>
        </PremiumGate>

        {/* Customer Stats - Available to all users (basic analytics) */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Customer Insights</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-brand-muted rounded-lg">
              <p className="text-2xl font-bold text-brand">{customerStats.totalCustomers}</p>
              <p className="text-sm text-brand">Total Customers</p>
            </div>
            <div className="p-4 bg-success-muted rounded-lg">
              <p className="text-2xl font-bold text-success">{customerStats.newInPeriod}</p>
              <p className="text-sm text-success">New {periodLabel}</p>
            </div>
            <div className="p-4 bg-info-muted rounded-lg">
              <p className="text-2xl font-bold text-info">{customerStats.repeatCustomers}</p>
              <p className="text-sm text-info">Repeat Customers</p>
            </div>
            <div className="p-4 bg-accent-muted rounded-lg">
              <p className="text-2xl font-bold text-accent">
                {customerStats.avgBookingsPerCustomer}
              </p>
              <p className="text-sm text-accent">Avg Bookings/Customer</p>
            </div>
          </div>
          <Link
            to="/tenant/customers"
            className="block text-center text-brand mt-4 text-sm hover:underline"
          >
            View all customers
          </Link>
        </div>
      </div>

      {/* Equipment Utilization - Premium Feature */}
      <PremiumGate feature="Equipment Utilization Reports" isPremium={isPremium}>
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Equipment Utilization</h2>
          {equipmentUtilization.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-foreground-muted">
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
                        <td className="py-3 text-center text-success">{category.available}</td>
                        <td className="py-3 text-center text-brand">{category.rented}</td>
                        <td className="py-3 text-center text-accent">{category.maintenance}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-surface-inset rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-brand"
                                style={{ width: `${utilization}%` }}
                              />
                            </div>
                            <span className="text-sm text-foreground-muted">{utilization}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-foreground-subtle">
              No equipment data available
            </div>
          )}
          <Link
            to="/tenant/equipment"
            className="block text-center text-brand mt-4 text-sm hover:underline"
          >
            View all equipment
          </Link>
        </div>
      </PremiumGate>
    </div>
  );
}

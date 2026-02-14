/**
 * CSV Export Route for Reports
 *
 * Generates a CSV file containing:
 * - Revenue metrics
 * - Customer stats
 * - Booking data
 */

import type { LoaderFunctionArgs } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { bookings, customers, trips, tours } from "../../../../lib/db/schema";
import { eq, gte, and, sql, count, desc } from "drizzle-orm";

/**
 * Escape a CSV field to prevent formula injection and handle special characters.
 * Prefixes fields starting with =, +, -, @, tab, or carriage return with a single quote.
 * Wraps fields containing commas, double quotes, or newlines in double quotes.
 */
function escapeCsvField(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return "'" + value;
  }
  return value.includes(",") || value.includes('"') || value.includes("\n")
    ? '"' + value.replace(/"/g, '""') + '"'
    : value;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Parse date range from query params
  const url = new URL(request.url);
  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");

  // Default to current month if no dates provided
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const startDate = startDateParam ? new Date(startDateParam) : startOfMonth;
  const endDate = endDateParam ? new Date(endDateParam) : new Date();

  const lastMonth = new Date(startOfMonth);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  // Fetch revenue data
  let currentMonthRevenue = 0;
  let lastMonthRevenue = 0;
  let bookingsThisMonth = 0;
  let avgBookingValue = 0;
  let totalCustomers = 0;
  let newCustomersThisMonth = 0;

  try {
    // Current month revenue
    const [currentMonthResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(${bookings.total}), 0)` })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, ctx.org.id),
          gte(bookings.createdAt, startDate)
        )
      );
    currentMonthRevenue = Number(currentMonthResult?.total || 0);

    // Last month revenue
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
    lastMonthRevenue = Number(lastMonthResult?.total || 0);

    // Bookings count this month
    const [bookingCountResult] = await db
      .select({ count: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.organizationId, ctx.org.id),
          gte(bookings.createdAt, startDate)
        )
      );
    bookingsThisMonth = bookingCountResult?.count || 0;
    avgBookingValue = bookingsThisMonth > 0 ? Math.round(currentMonthRevenue / bookingsThisMonth) : 0;

    // Total customers
    const [customerCountResult] = await db
      .select({ count: count() })
      .from(customers)
      .where(eq(customers.organizationId, ctx.org.id));
    totalCustomers = customerCountResult?.count || 0;

    // New customers this month
    const [newCustomerResult] = await db
      .select({ count: count() })
      .from(customers)
      .where(
        and(
          eq(customers.organizationId, ctx.org.id),
          gte(customers.createdAt, startDate)
        )
      );
    newCustomersThisMonth = newCustomerResult?.count || 0;
  } catch (error) {
    console.error("Error fetching report data for CSV export:", error);
  }

  // Fetch recent bookings for detailed data with joins
  let recentBookings: Array<{
    id: string;
    customerFirstName: string | null;
    customerLastName: string | null;
    tourName: string | null;
    total: string;
    status: string;
    createdAt: Date | null;
  }> = [];

  try {
    const bookingsData = await db
      .select({
        id: bookings.id,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        tourName: tours.name,
        total: bookings.total,
        status: bookings.status,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .leftJoin(customers, eq(bookings.customerId, customers.id))
      .leftJoin(trips, eq(bookings.tripId, trips.id))
      .leftJoin(tours, eq(trips.tourId, tours.id))
      .where(
        and(
          eq(bookings.organizationId, ctx.org.id),
          gte(bookings.createdAt, startDate)
        )
      )
      .orderBy(desc(bookings.createdAt))
      .limit(100);

    recentBookings = bookingsData;
  } catch (error) {
    console.error("Error fetching recent bookings for CSV:", error);
  }

  // Calculate change percent
  const changePercent = lastMonthRevenue > 0
    ? Math.round(((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : 0;

  // Generate CSV content
  const csvLines: string[] = [];

  // Header section
  csvLines.push("DiveStreams Reports Export");
  csvLines.push(`Organization,${escapeCsvField(ctx.org.name || ctx.org.slug)}`);
  csvLines.push(`Date Range,${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
  csvLines.push(`Generated,${new Date().toLocaleString()}`);
  csvLines.push("");

  // Revenue Overview section
  csvLines.push("REVENUE OVERVIEW");
  csvLines.push("Metric,Value");
  csvLines.push(`This Month Revenue,$${currentMonthRevenue.toLocaleString()}`);
  csvLines.push(`Last Month Revenue,$${lastMonthRevenue.toLocaleString()}`);
  csvLines.push(`Year to Date,$${(currentMonthRevenue + lastMonthRevenue).toLocaleString()}`);
  csvLines.push(`Average Booking Value,$${avgBookingValue.toLocaleString()}`);
  csvLines.push(`Change vs Last Month,${changePercent >= 0 ? "+" : ""}${changePercent}%`);
  csvLines.push("");

  // Customer Stats section
  csvLines.push("CUSTOMER STATISTICS");
  csvLines.push("Metric,Value");
  csvLines.push(`Total Customers,${totalCustomers}`);
  csvLines.push(`New This Month,${newCustomersThisMonth}`);
  csvLines.push(`Bookings This Month,${bookingsThisMonth}`);
  csvLines.push(`Avg Bookings Per Customer,${totalCustomers > 0 ? (bookingsThisMonth / totalCustomers).toFixed(1) : "0"}`);
  csvLines.push("");

  // Booking Details section
  csvLines.push("BOOKING DATA");
  csvLines.push("Booking ID,Customer Name,Tour Name,Total,Status,Date");

  for (const booking of recentBookings) {
    const customerName = escapeCsvField([booking.customerFirstName, booking.customerLastName].filter(Boolean).join(" ") || "N/A");
    const tourName = escapeCsvField(booking.tourName || "N/A");
    const total = booking.total ? `$${Number(booking.total).toLocaleString()}` : "$0";
    const status = escapeCsvField(booking.status || "N/A");
    const date = booking.createdAt ? booking.createdAt.toLocaleDateString() : "N/A";

    csvLines.push(`${booking.id},${customerName},${tourName},${total},${status},${date}`);
  }

  const csvContent = csvLines.join("\n");

  // Generate filename with date
  const filename = `reports-${startDate.toISOString().split("T")[0]}-to-${endDate.toISOString().split("T")[0]}.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

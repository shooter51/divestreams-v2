import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { bookings, customers, trips, tours } from "../../../../lib/db/schema";
import { eq, or, ilike, sql, count, and, gte } from "drizzle-orm";
import { UpgradePrompt } from "../../../components/ui/UpgradePrompt";

export const meta: MetaFunction = () => [{ title: "Bookings - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  // Build query with organization filter
  const baseCondition = eq(bookings.organizationId, ctx.org.id);

  // Add status filter if provided
  const statusCondition = status ? eq(bookings.status, status) : undefined;

  // Combine conditions
  let whereCondition = baseCondition;
  if (statusCondition) {
    whereCondition = sql`${baseCondition} AND ${statusCondition}`;
  }

  // Get bookings with customer and trip info
  const bookingList = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      participants: bookings.participants,
      total: bookings.total,
      paidAmount: bookings.paidAmount,
      createdAt: bookings.createdAt,
      customerId: bookings.customerId,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerEmail: customers.email,
      tripId: bookings.tripId,
      tripDate: trips.date,
      tripTime: trips.startTime,
      tourName: tours.name,
    })
    .from(bookings)
    .leftJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(trips, eq(bookings.tripId, trips.id))
    .leftJoin(tours, eq(trips.tourId, tours.id))
    .where(whereCondition)
    .orderBy(sql`${bookings.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  // Get total count for pagination
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(bookings)
    .where(whereCondition);

  // Transform to UI format
  const bookingData = bookingList.map((b) => ({
    id: b.id,
    bookingNumber: b.bookingNumber,
    customer: {
      id: b.customerId,
      firstName: b.customerFirstName || "",
      lastName: b.customerLastName || "",
      email: b.customerEmail || "",
    },
    trip: {
      id: b.tripId,
      tourName: b.tourName || "Unknown Tour",
      date: b.tripDate ? (typeof b.tripDate === 'object' && 'toLocaleDateString' in b.tripDate ? (b.tripDate as Date).toLocaleDateString() : String(b.tripDate)) : "",
      startTime: b.tripTime || "",
    },
    participants: b.participants,
    total: Number(b.total || 0).toFixed(2),
    status: b.status,
    paidAmount: Number(b.paidAmount || 0).toFixed(2),
    createdAt: b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "",
  }));

  // Calculate stats from the current page data
  const today = new Date().toLocaleDateString();
  const stats = {
    today: bookingData.filter((b) => b.trip.date === today).length,
    upcoming: bookingData.filter((b) => b.status === "confirmed").length,
    pendingPayment: bookingData.filter(
      (b) => b.status !== "cancelled" && b.status !== "canceled" && parseFloat(b.paidAmount) < parseFloat(b.total)
    ).length,
  };

  // Get monthly booking count for limit tracking
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [{ value: monthlyCount }] = await db
    .select({ value: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.organizationId, ctx.org.id),
        gte(bookings.createdAt, startOfMonth)
      )
    );

  return {
    bookings: bookingData,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    search,
    status,
    stats,
    // Freemium data
    canAddBooking: ctx.canAddBooking,
    usage: monthlyCount,
    limit: ctx.limits.bookingsPerMonth,
    isPremium: ctx.isPremium,
  };
}

const statusColors: Record<string, string> = {
  pending: "bg-warning-muted text-warning",
  confirmed: "bg-success-muted text-success",
  completed: "bg-surface-inset text-foreground-muted",
  cancelled: "bg-danger-muted text-danger",
  no_show: "bg-accent-muted text-accent",
};

export default function BookingsPage() {
  const {
    bookings,
    total,
    page,
    totalPages,
    search,
    status,
    stats,
    canAddBooking,
    usage,
    limit,
    isPremium
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleFilter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params: Record<string, string> = {};
    const search = formData.get("search") as string;
    const status = formData.get("status") as string;
    if (search) params.search = search;
    if (status) params.status = status;
    setSearchParams(params);
  };

  // Check if at limit (for free tier)
  const isAtLimit = !isPremium && usage >= limit;

  return (
    <div>
      {/* Show upgrade banner when at limit */}
      {isAtLimit && (
        <div className="mb-6">
          <UpgradePrompt
            feature="bookings this month"
            currentCount={usage}
            limit={limit}
            variant="banner"
          />
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-foreground-muted">
            {total} total bookings
            {!isPremium && (
              <span className="ml-2 text-sm text-foreground-subtle">
                ({usage}/{limit} this month)
              </span>
            )}
          </p>
        </div>
        <Link
          to="/tenant/bookings/new"
          className={`px-4 py-2 rounded-lg ${
            canAddBooking
              ? "bg-brand text-white hover:bg-brand-hover"
              : "bg-border-strong text-foreground-muted cursor-not-allowed"
          }`}
          onClick={(e) => {
            if (!canAddBooking) {
              e.preventDefault();
            }
          }}
          aria-disabled={!canAddBooking}
        >
          New Booking
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold">{stats.today}</p>
          <p className="text-foreground-muted text-sm">Today's Bookings</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold">{stats.upcoming}</p>
          <p className="text-foreground-muted text-sm">Upcoming Confirmed</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-warning">{stats.pendingPayment}</p>
          <p className="text-foreground-muted text-sm">Pending Payment</p>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilter} className="mb-6 flex gap-4">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search by booking #, customer name, or email..."
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
        />
        <select
          name="status"
          defaultValue={status}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-surface-inset rounded-lg hover:bg-surface-overlay"
        >
          Filter
        </button>
      </form>

      {/* Bookings Table */}
      <div className="bg-surface-raised rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-inset border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Booking</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Customer</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Trip</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Pax</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Total</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-foreground-muted">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-foreground-muted">
                  {search || status
                    ? "No bookings found matching your filters."
                    : "No bookings yet. Create your first booking to get started."}
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-surface-inset">
                  <td className="px-6 py-4">
                    <Link
                      to={`/tenant/bookings/${booking.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {booking.bookingNumber}
                    </Link>
                    <p className="text-xs text-foreground-subtle">{booking.createdAt}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/tenant/customers/${booking.customer.id}`}
                      className="hover:text-brand"
                    >
                      {booking.customer.firstName} {booking.customer.lastName}
                    </Link>
                    <p className="text-sm text-foreground-muted">{booking.customer.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium">{booking.trip.tourName}</p>
                    <p className="text-sm text-foreground-muted">
                      {booking.trip.date} at {booking.trip.startTime}
                    </p>
                  </td>
                  <td className="px-6 py-4">{booking.participants}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium">${booking.total}</p>
                    {parseFloat(booking.paidAmount) < parseFloat(booking.total) && (
                      <p className="text-xs text-warning">
                        ${booking.paidAmount} paid
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        statusColors[booking.status] || "bg-surface-inset text-foreground"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/tenant/bookings/${booking.id}`}
                      className="text-brand hover:underline text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t flex justify-between items-center">
            <span className="text-sm text-foreground-muted">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: String(page - 1) })}
                disabled={page <= 1}
                className="px-3 py-1 border border-border-strong rounded bg-surface-raised text-foreground hover:bg-surface-overlay disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: String(page + 1) })}
                disabled={page >= totalPages}
                className="px-3 py-1 border border-border-strong rounded bg-surface-raised text-foreground hover:bg-surface-overlay disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

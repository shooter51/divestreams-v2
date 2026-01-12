import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";
import { getBookings } from "../../../../lib/db/queries.server";

export const meta: MetaFunction = () => [{ title: "Bookings - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  const { bookings: rawBookings, total } = await getBookings(tenant.schemaName, {
    status: status || undefined,
    limit,
    offset,
  });

  // Transform to expected format
  const bookings = rawBookings.map((b) => ({
    id: b.id,
    bookingNumber: b.bookingNumber,
    customer: {
      id: b.customerId,
      firstName: b.customerFirstName,
      lastName: b.customerLastName,
      email: b.customerEmail,
    },
    trip: {
      id: b.tripId,
      tourName: b.tourName,
      date: b.tripDate instanceof Date ? b.tripDate.toLocaleDateString() : String(b.tripDate),
      startTime: b.tripTime,
    },
    participants: b.participants,
    total: b.total.toFixed(2),
    status: b.status,
    paidAmount: b.paidAmount.toFixed(2),
    createdAt: b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "",
  }));

  // Calculate stats
  const today = new Date().toLocaleDateString();
  const stats = {
    today: bookings.filter((b) => b.trip.date === today).length,
    upcoming: bookings.filter((b) => b.status === "confirmed").length,
    pendingPayment: bookings.filter(
      (b) => b.status !== "cancelled" && b.status !== "canceled" && parseFloat(b.paidAmount) < parseFloat(b.total)
    ).length,
  };

  return { bookings, total, page, search, status, stats };
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-orange-100 text-orange-700",
};

export default function BookingsPage() {
  const { bookings, total, page, search, status, stats } = useLoaderData<typeof loader>();
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-gray-500">{total} bookings</p>
        </div>
        <Link
          to="/app/bookings/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          New Booking
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold">{stats.today}</p>
          <p className="text-gray-500 text-sm">Today's Bookings</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold">{stats.upcoming}</p>
          <p className="text-gray-500 text-sm">Upcoming Confirmed</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-yellow-600">{stats.pendingPayment}</p>
          <p className="text-gray-500 text-sm">Pending Payment</p>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilter} className="mb-6 flex gap-4">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search by booking #, customer name, or email..."
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <select
          name="status"
          defaultValue={status}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
          className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Filter
        </button>
      </form>

      {/* Bookings Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Booking</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Customer</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Trip</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Pax</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Total</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  {search || status
                    ? "No bookings found matching your filters."
                    : "No bookings yet. Create your first booking to get started."}
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      to={`/app/bookings/${booking.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {booking.bookingNumber}
                    </Link>
                    <p className="text-xs text-gray-400">{booking.createdAt}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/app/customers/${booking.customer.id}`}
                      className="hover:text-blue-600"
                    >
                      {booking.customer.firstName} {booking.customer.lastName}
                    </Link>
                    <p className="text-sm text-gray-500">{booking.customer.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium">{booking.trip.tourName}</p>
                    <p className="text-sm text-gray-500">
                      {booking.trip.date} at {booking.trip.startTime}
                    </p>
                  </td>
                  <td className="px-6 py-4">{booking.participants}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium">${booking.total}</p>
                    {parseFloat(booking.paidAmount) < parseFloat(booking.total) && (
                      <p className="text-xs text-yellow-600">
                        ${booking.paidAmount} paid
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        statusColors[booking.status] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/app/bookings/${booking.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";

export const meta: MetaFunction = () => [{ title: "Bookings - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant, db } = await requireTenant(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const dateFrom = url.searchParams.get("from") || "";
  const dateTo = url.searchParams.get("to") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 20;

  // Mock data for now
  const bookings = [
    {
      id: "b1",
      bookingNumber: "BK-2026-001",
      customer: { id: "1", firstName: "John", lastName: "Smith", email: "john.smith@example.com" },
      trip: { id: "t1", tourName: "Morning 2-Tank Dive", date: "2026-01-15", startTime: "08:00" },
      participants: 2,
      total: "300.00",
      status: "confirmed",
      paidAmount: "300.00",
      createdAt: "2026-01-10",
    },
    {
      id: "b2",
      bookingNumber: "BK-2026-002",
      customer: { id: "2", firstName: "Sarah", lastName: "Johnson", email: "sarah.j@example.com" },
      trip: { id: "t1", tourName: "Morning 2-Tank Dive", date: "2026-01-15", startTime: "08:00" },
      participants: 1,
      total: "150.00",
      status: "confirmed",
      paidAmount: "75.00",
      createdAt: "2026-01-11",
    },
    {
      id: "b3",
      bookingNumber: "BK-2026-003",
      customer: { id: "3", firstName: "Mike", lastName: "Wilson", email: "mike.wilson@example.com" },
      trip: { id: "t2", tourName: "Night Dive Adventure", date: "2026-01-18", startTime: "18:00" },
      participants: 3,
      total: "360.00",
      status: "pending",
      paidAmount: "0.00",
      createdAt: "2026-01-11",
    },
    {
      id: "b4",
      bookingNumber: "BK-2025-089",
      customer: { id: "1", firstName: "John", lastName: "Smith", email: "john.smith@example.com" },
      trip: { id: "t3", tourName: "Sunset Dive", date: "2025-12-20", startTime: "16:00" },
      participants: 2,
      total: "170.00",
      status: "completed",
      paidAmount: "170.00",
      createdAt: "2025-12-15",
    },
    {
      id: "b5",
      bookingNumber: "BK-2026-004",
      customer: { id: "4", firstName: "Emily", lastName: "Davis", email: "emily.d@example.com" },
      trip: { id: "t4", tourName: "Discover Scuba", date: "2026-01-20", startTime: "09:00" },
      participants: 1,
      total: "199.00",
      status: "cancelled",
      paidAmount: "199.00",
      createdAt: "2026-01-08",
    },
  ].filter((b) => {
    const matchesSearch =
      !search ||
      b.bookingNumber.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.firstName.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.lastName.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !status || b.status === status;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    today: bookings.filter((b) => b.trip.date === "2026-01-11").length,
    upcoming: bookings.filter((b) => b.status === "confirmed").length,
    pendingPayment: bookings.filter(
      (b) => b.status !== "cancelled" && parseFloat(b.paidAmount) < parseFloat(b.total)
    ).length,
  };

  return { bookings, total: bookings.length, page, search, status, stats };
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

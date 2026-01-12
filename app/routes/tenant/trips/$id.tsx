import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher } from "react-router";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";

export const meta: MetaFunction = () => [{ title: "Trip Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { tenant, db } = await requireTenant(request);
  const tripId = params.id;

  // Mock data
  const trip = {
    id: tripId,
    tour: { id: "1", name: "Morning 2-Tank Dive" },
    boat: { id: "b1", name: "Ocean Explorer" },
    date: "2026-01-15",
    startTime: "08:00",
    endTime: "12:00",
    maxParticipants: 12,
    bookedParticipants: 8,
    status: "confirmed",
    price: "150.00",
    weatherNotes: "Clear skies, light wind from NE, visibility 25m+",
    notes: "VIP group from hotel - provide extra attention",
    staff: [
      { id: "s1", name: "Captain Mike", role: "Captain" },
      { id: "s2", name: "DM Sarah", role: "Dive Master" },
    ],
    createdAt: "2026-01-05",
  };

  const bookings = [
    {
      id: "b1",
      bookingNumber: "BK-2026-001",
      customer: { id: "1", firstName: "John", lastName: "Smith" },
      participants: 2,
      status: "confirmed",
      total: "300.00",
      paidInFull: true,
    },
    {
      id: "b2",
      bookingNumber: "BK-2026-002",
      customer: { id: "2", firstName: "Sarah", lastName: "Johnson" },
      participants: 1,
      status: "confirmed",
      total: "150.00",
      paidInFull: true,
    },
    {
      id: "b3",
      bookingNumber: "BK-2026-005",
      customer: { id: "5", firstName: "David", lastName: "Lee" },
      participants: 3,
      status: "confirmed",
      total: "450.00",
      paidInFull: false,
    },
    {
      id: "b4",
      bookingNumber: "BK-2026-006",
      customer: { id: "6", firstName: "Emma", lastName: "Brown" },
      participants: 2,
      status: "pending",
      total: "300.00",
      paidInFull: false,
    },
  ];

  const revenue = {
    bookingsTotal: "1,200.00",
    paidTotal: "750.00",
    pendingTotal: "450.00",
  };

  return { trip, bookings, revenue };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { tenant, db } = await requireTenant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "cancel") {
    // TODO: Cancel trip
    return { cancelled: true };
  }

  if (intent === "complete") {
    // TODO: Mark trip complete
    return { completed: true };
  }

  return null;
}

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  full: "bg-purple-100 text-purple-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

export default function TripDetailPage() {
  const { trip, bookings, revenue } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const spotsAvailable = trip.maxParticipants - trip.bookedParticipants;

  const handleCancel = () => {
    if (confirm("Are you sure you want to cancel this trip? All bookings will be affected.")) {
      fetcher.submit({ intent: "cancel" }, { method: "post" });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link to="/app/trips" className="text-blue-600 hover:underline text-sm">
          ← Back to Trips
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{trip.tour.name}</h1>
            <span
              className={`text-sm px-3 py-1 rounded-full ${
                statusColors[trip.status] || "bg-gray-100 text-gray-700"
              }`}
            >
              {trip.status}
            </span>
          </div>
          <p className="text-gray-500">
            {new Date(trip.date + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            at {trip.startTime}
          </p>
        </div>
        <div className="flex gap-2">
          {trip.status !== "cancelled" && trip.status !== "completed" && spotsAvailable > 0 && (
            <Link
              to={`/app/bookings/new?tripId=${trip.id}`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Add Booking
            </Link>
          )}
          {trip.status === "confirmed" && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="complete" />
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Mark Complete
              </button>
            </fetcher.Form>
          )}
          <Link
            to={`/app/trips/${trip.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Edit
          </Link>
          {trip.status !== "cancelled" && trip.status !== "completed" && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              Cancel Trip
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">
                {trip.bookedParticipants}/{trip.maxParticipants}
              </p>
              <p className="text-gray-500 text-sm">Booked</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-green-600">{spotsAvailable}</p>
              <p className="text-gray-500 text-sm">Spots Left</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">${revenue.bookingsTotal}</p>
              <p className="text-gray-500 text-sm">Total Revenue</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-yellow-600">${revenue.pendingTotal}</p>
              <p className="text-gray-500 text-sm">Pending Payment</p>
            </div>
          </div>

          {/* Trip Details */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Trip Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Time</p>
                <p>
                  {trip.startTime} - {trip.endTime}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Boat</p>
                <Link to={`/app/boats/${trip.boat.id}`} className="text-blue-600 hover:underline">
                  {trip.boat.name}
                </Link>
              </div>
              <div>
                <p className="text-gray-500">Price</p>
                <p>${trip.price} per person</p>
              </div>
              <div>
                <p className="text-gray-500">Tour</p>
                <Link to={`/app/tours/${trip.tour.id}`} className="text-blue-600 hover:underline">
                  {trip.tour.name}
                </Link>
              </div>
            </div>
          </div>

          {/* Weather & Notes */}
          {(trip.weatherNotes || trip.notes) && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Notes</h2>
              <div className="space-y-4 text-sm">
                {trip.weatherNotes && (
                  <div>
                    <p className="text-gray-500 mb-1">Weather:</p>
                    <p>{trip.weatherNotes}</p>
                  </div>
                )}
                {trip.notes && (
                  <div>
                    <p className="text-gray-500 mb-1">Internal Notes:</p>
                    <p>{trip.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bookings */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Bookings ({bookings.length})</h2>
              {spotsAvailable > 0 && (
                <Link
                  to={`/app/bookings/new?tripId=${trip.id}`}
                  className="text-blue-600 text-sm hover:underline"
                >
                  + Add Booking
                </Link>
              )}
            </div>
            {bookings.length === 0 ? (
              <p className="text-gray-500 text-sm">No bookings yet.</p>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <Link
                    key={booking.id}
                    to={`/app/bookings/${booking.id}`}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-medium">
                        {booking.customer.firstName} {booking.customer.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {booking.bookingNumber} • {booking.participants} pax
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${booking.total}</p>
                      {!booking.paidInFull && (
                        <span className="text-xs text-yellow-600">Payment pending</span>
                      )}
                      {booking.paidInFull && (
                        <span className="text-xs text-green-600">Paid</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Staff */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Staff</h2>
            {trip.staff.length === 0 ? (
              <p className="text-gray-500 text-sm">No staff assigned.</p>
            ) : (
              <div className="space-y-2">
                {trip.staff.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm">
                      {member.name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link
              to={`/app/trips/${trip.id}/edit`}
              className="block text-center mt-4 text-blue-600 text-sm hover:underline"
            >
              Manage Staff
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">
                📋 Print Manifest
              </button>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">
                📧 Email Passengers
              </button>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">
                📤 Export to PDF
              </button>
              <Link
                to={`/app/trips/new?tourId=${trip.tour.id}`}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
              >
                📅 Schedule Similar Trip
              </Link>
            </div>
          </div>

          {/* Participant Summary */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Capacity</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Max Capacity</span>
                <span>{trip.maxParticipants}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Booked</span>
                <span>{trip.bookedParticipants}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Available</span>
                <span className={spotsAvailable === 0 ? "text-red-600" : "text-green-600"}>
                  {spotsAvailable}
                </span>
              </div>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 rounded-full h-2"
                  style={{
                    width: `${(trip.bookedParticipants / trip.maxParticipants) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400">
            <p>Created {trip.createdAt}</p>
            <p>Trip ID: {trip.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

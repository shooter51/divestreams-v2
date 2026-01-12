import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher } from "react-router";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";

export const meta: MetaFunction = () => [{ title: "Boat Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { tenant, db } = await requireTenant(request);
  const boatId = params.id;

  // Mock data
  const boat = {
    id: boatId,
    name: "Ocean Explorer",
    type: "Dive Boat",
    capacity: 14,
    registrationNumber: "PW-1234-DV",
    description:
      "Our flagship vessel with full amenities for day trips. Features a spacious dive platform, freshwater showers, and comfortable seating areas.",
    amenities: [
      "Freshwater shower",
      "Sun deck",
      "Camera station",
      "Dive platform",
      "Toilet",
      "First aid kit",
      "Storage lockers",
    ],
    isActive: true,
    createdAt: "2024-06-15",
    updatedAt: "2026-01-10",
    lastMaintenance: "2025-12-15",
    nextMaintenance: "2026-03-15",
    maintenanceNotes: "Regular service completed. New dive compressor installed.",
  };

  const recentTrips = [
    {
      id: "t1",
      date: "2026-01-15",
      tourName: "Morning 2-Tank Dive",
      participants: 10,
      revenue: "$1,500",
    },
    {
      id: "t2",
      date: "2026-01-14",
      tourName: "Morning 2-Tank Dive",
      participants: 12,
      revenue: "$1,800",
    },
    {
      id: "t3",
      date: "2026-01-12",
      tourName: "Night Dive Adventure",
      participants: 6,
      revenue: "$720",
    },
  ];

  const upcomingTrips = [
    {
      id: "t4",
      date: "2026-01-18",
      tourName: "Morning 2-Tank Dive",
      bookedParticipants: 8,
      maxParticipants: 14,
    },
    {
      id: "t5",
      date: "2026-01-20",
      tourName: "Sunset Dive",
      bookedParticipants: 10,
      maxParticipants: 14,
    },
  ];

  const stats = {
    totalTrips: 156,
    totalPassengers: 1842,
    totalRevenue: "$127,450",
    avgOccupancy: 84,
  };

  return { boat, recentTrips, upcomingTrips, stats };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { tenant, db } = await requireTenant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "toggle-active") {
    // TODO: Toggle active status
    return { toggled: true };
  }

  if (intent === "delete") {
    // TODO: Delete boat (soft delete)
    return { deleted: true };
  }

  if (intent === "log-maintenance") {
    // TODO: Log maintenance event
    return { maintenanceLogged: true };
  }

  return null;
}

export default function BoatDetailPage() {
  const { boat, recentTrips, upcomingTrips, stats } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this boat?")) {
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  const maintenanceDue =
    boat.nextMaintenance && new Date(boat.nextMaintenance) <= new Date();

  return (
    <div>
      <div className="mb-6">
        <Link to="/app/boats" className="text-blue-600 hover:underline text-sm">
          ← Back to Boats
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{boat.name}</h1>
            <span
              className={`text-sm px-3 py-1 rounded-full ${
                boat.isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {boat.isActive ? "Active" : "Inactive"}
            </span>
            {maintenanceDue && (
              <span className="text-sm px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">
                Maintenance Due
              </span>
            )}
          </div>
          <p className="text-gray-500">
            {boat.type} • {boat.capacity} passengers
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/app/boats/${boat.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Edit
          </Link>
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="toggle-active" />
            <button
              type="submit"
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              {boat.isActive ? "Deactivate" : "Activate"}
            </button>
          </fetcher.Form>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{stats.totalTrips}</p>
              <p className="text-gray-500 text-sm">Total Trips</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{stats.totalPassengers}</p>
              <p className="text-gray-500 text-sm">Passengers</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-green-600">{stats.totalRevenue}</p>
              <p className="text-gray-500 text-sm">Revenue</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{stats.avgOccupancy}%</p>
              <p className="text-gray-500 text-sm">Avg Occupancy</p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-3">Description</h2>
            <p className="text-gray-700">{boat.description}</p>
          </div>

          {/* Amenities */}
          {boat.amenities.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-3">Amenities</h2>
              <div className="flex flex-wrap gap-2">
                {boat.amenities.map((a) => (
                  <span
                    key={a}
                    className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Trips */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Upcoming Trips</h2>
              <Link
                to={`/app/trips/new?boatId=${boat.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                + Schedule Trip
              </Link>
            </div>
            {upcomingTrips.length === 0 ? (
              <p className="text-gray-500 text-sm">No upcoming trips.</p>
            ) : (
              <div className="space-y-3">
                {upcomingTrips.map((trip) => (
                  <Link
                    key={trip.id}
                    to={`/app/trips/${trip.id}`}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-medium">{trip.tourName}</p>
                      <p className="text-sm text-gray-500">{trip.date}</p>
                    </div>
                    <span className="text-sm">
                      {trip.bookedParticipants}/{trip.maxParticipants} booked
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent Trips */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Recent Trips</h2>
              <Link
                to={`/app/trips?boatId=${boat.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                View All
              </Link>
            </div>
            {recentTrips.length === 0 ? (
              <p className="text-gray-500 text-sm">No trips yet.</p>
            ) : (
              <div className="space-y-3">
                {recentTrips.map((trip) => (
                  <Link
                    key={trip.id}
                    to={`/app/trips/${trip.id}`}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-medium">{trip.tourName}</p>
                      <p className="text-sm text-gray-500">
                        {trip.date} • {trip.participants} passengers
                      </p>
                    </div>
                    <span className="text-sm text-green-600">{trip.revenue}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span>{boat.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Capacity</span>
                <span>{boat.capacity} passengers</span>
              </div>
              {boat.registrationNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Registration</span>
                  <span>{boat.registrationNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Maintenance */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Maintenance</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Last Service</span>
                <span>{boat.lastMaintenance || "Never"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Next Due</span>
                <span className={maintenanceDue ? "text-yellow-600 font-medium" : ""}>
                  {boat.nextMaintenance || "Not scheduled"}
                </span>
              </div>
              {boat.maintenanceNotes && (
                <div className="pt-2 border-t">
                  <p className="text-gray-500 mb-1">Notes:</p>
                  <p className="text-gray-700">{boat.maintenanceNotes}</p>
                </div>
              )}
            </div>
            <fetcher.Form method="post" className="mt-4">
              <input type="hidden" name="intent" value="log-maintenance" />
              <button
                type="submit"
                className="w-full text-center py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                Log Maintenance
              </button>
            </fetcher.Form>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <Link
                to={`/app/trips/new?boatId=${boat.id}`}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
              >
                Schedule Trip
              </Link>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">
                View Calendar
              </button>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">
                Export Report
              </button>
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400 space-y-1">
            <p>Created: {boat.createdAt}</p>
            <p>Updated: {boat.updatedAt}</p>
            <p>ID: {boat.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

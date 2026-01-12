import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";
import { getTrips } from "../../../../lib/db/queries.server";

export const meta: MetaFunction = () => [{ title: "Trips - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const url = new URL(request.url);
  const view = url.searchParams.get("view") || "upcoming";
  const tourId = url.searchParams.get("tourId") || "";

  const today = new Date().toISOString().split("T")[0];

  // Determine date filters based on view
  const options: { fromDate?: string; status?: string } = {};
  if (view === "upcoming") {
    options.fromDate = today;
  } else if (view === "past") {
    options.status = "completed";
  }

  const rawTrips = await getTrips(tenant.schemaName, options);

  // Filter by view and transform
  const trips = rawTrips
    .filter((t) => {
      if (tourId && t.tourId !== tourId) return false;
      if (view === "upcoming" && (t.status === "completed" || t.status === "cancelled")) return false;
      if (view === "past" && t.status !== "completed" && t.status !== "cancelled") return false;
      return true;
    })
    .map((t) => ({
      id: t.id,
      tour: { id: t.tourId, name: t.tourName || "Unknown Tour" },
      boat: { id: t.boatId, name: t.boatName || "TBD" },
      date: t.date,
      startTime: t.startTime,
      endTime: t.endTime || "",
      maxParticipants: t.maxParticipants || 0,
      bookedParticipants: t.bookedParticipants || 0,
      status: t.bookedParticipants >= t.maxParticipants ? "full" : t.status,
      revenue: (t.bookedParticipants * (t.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      staff: [], // Staff would need separate query
    }));

  // Group by date
  const tripsByDate: Record<string, typeof trips> = {};
  trips.forEach((trip) => {
    if (!tripsByDate[trip.date]) tripsByDate[trip.date] = [];
    tripsByDate[trip.date].push(trip);
  });

  return { trips, tripsByDate, total: trips.length, view, tourId };
}

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  confirmed: "bg-green-100 text-green-700",
  full: "bg-purple-100 text-purple-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

export default function TripsPage() {
  const { trips, tripsByDate, total, view, tourId } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const setView = (newView: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("view", newView);
    setSearchParams(params);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Scheduled Trips</h1>
          <p className="text-gray-500">{total} trips</p>
        </div>
        <Link
          to="/app/trips/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Schedule Trip
        </Link>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView("upcoming")}
          className={`px-4 py-2 rounded-lg ${
            view === "upcoming" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setView("past")}
          className={`px-4 py-2 rounded-lg ${
            view === "past" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          Past
        </button>
        <button
          onClick={() => setView("all")}
          className={`px-4 py-2 rounded-lg ${
            view === "all" ? "bg-blue-600 text-white" : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          All
        </button>
      </div>

      {/* Trips List */}
      {trips.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <p className="text-gray-500">
            {view === "upcoming"
              ? "No upcoming trips scheduled."
              : view === "past"
              ? "No past trips."
              : "No trips found."}
          </p>
          <Link
            to="/app/trips/new"
            className="inline-block mt-4 text-blue-600 hover:underline"
          >
            Schedule your first trip
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(tripsByDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, dateTrips]) => (
              <div key={date}>
                <h3 className="font-semibold text-gray-700 mb-3">
                  {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>
                <div className="space-y-3">
                  {dateTrips.map((trip) => (
                    <Link
                      key={trip.id}
                      to={`/app/trips/${trip.id}`}
                      className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-lg font-bold">{trip.startTime}</p>
                          <p className="text-xs text-gray-500">{trip.endTime}</p>
                        </div>
                        <div>
                          <p className="font-semibold">{trip.tour.name}</p>
                          <p className="text-sm text-gray-500">
                            {trip.boat.name}
                            {trip.staff.length > 0 && (
                              <> • {trip.staff.map((s: { name: string }) => s.name).join(", ")}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="font-medium">
                            {trip.bookedParticipants}/{trip.maxParticipants} booked
                          </p>
                          <p className="text-sm text-gray-500">${trip.revenue}</p>
                        </div>
                        <span
                          className={`text-xs px-3 py-1 rounded-full ${
                            statusColors[trip.status] || "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {trip.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

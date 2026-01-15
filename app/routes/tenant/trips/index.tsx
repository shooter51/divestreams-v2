import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useSearchParams } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { trips as tripsTable, tours, boats, bookings } from "../../../../lib/db/schema";
import { eq, and, gte, or, sql, lt } from "drizzle-orm";

export const meta: MetaFunction = () => [{ title: "Trips - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);
  const view = url.searchParams.get("view") || "upcoming";
  const tourId = url.searchParams.get("tourId") || "";

  const today = new Date().toISOString().split("T")[0];

  // Build query conditions
  const conditions = [eq(tripsTable.organizationId, ctx.org.id)];

  if (view === "upcoming") {
    conditions.push(gte(tripsTable.date, today));
  } else if (view === "past") {
    conditions.push(lt(tripsTable.date, today));
  }

  if (tourId) {
    conditions.push(eq(tripsTable.tourId, tourId));
  }

  // Get trips with tour and boat info
  const rawTrips = await db
    .select({
      id: tripsTable.id,
      date: tripsTable.date,
      startTime: tripsTable.startTime,
      endTime: tripsTable.endTime,
      maxParticipants: tripsTable.maxParticipants,
      status: tripsTable.status,
      tourId: tripsTable.tourId,
      boatId: tripsTable.boatId,
      tourName: tours.name,
      tourPrice: tours.price,
      boatName: boats.name,
      // Recurring trip fields
      isRecurring: tripsTable.isRecurring,
      recurrencePattern: tripsTable.recurrencePattern,
      recurringTemplateId: tripsTable.recurringTemplateId,
    })
    .from(tripsTable)
    .leftJoin(tours, eq(tripsTable.tourId, tours.id))
    .leftJoin(boats, eq(tripsTable.boatId, boats.id))
    .where(and(...conditions))
    .orderBy(tripsTable.date, tripsTable.startTime);

  // Get booking counts per trip
  const tripIds = rawTrips.map(t => t.id);
  const bookingCounts = tripIds.length > 0 ? await db
    .select({
      tripId: bookings.tripId,
      count: sql<number>`SUM(${bookings.participants})`,
    })
    .from(bookings)
    .where(sql`${bookings.tripId} IN ${tripIds}`)
    .groupBy(bookings.tripId) : [];

  const bookingCountMap = new Map(bookingCounts.map(b => [b.tripId, Number(b.count) || 0]));

  // Filter by view and transform
  const trips = rawTrips
    .filter((t) => {
      const bookedParticipants = bookingCountMap.get(t.id) || 0;
      if (view === "upcoming" && (t.status === "completed" || t.status === "cancelled")) return false;
      if (view === "past" && t.status !== "completed" && t.status !== "cancelled") return false;
      return true;
    })
    .map((t) => {
      const bookedParticipants = bookingCountMap.get(t.id) || 0;
      const maxParticipants = t.maxParticipants || 0;
      return {
        id: t.id,
        tour: { id: t.tourId, name: t.tourName || "Unknown Tour" },
        boat: { id: t.boatId, name: t.boatName || "TBD" },
        date: t.date,
        startTime: t.startTime,
        endTime: t.endTime || "",
        maxParticipants,
        bookedParticipants,
        status: bookedParticipants >= maxParticipants && maxParticipants > 0 ? "full" : t.status,
        revenue: (bookedParticipants * Number(t.tourPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 }),
        staff: [], // Staff would need separate query
        // Recurring trip info
        isRecurring: t.isRecurring,
        recurrencePattern: t.recurrencePattern,
        recurringTemplateId: t.recurringTemplateId,
        isTemplate: t.isRecurring && !t.recurringTemplateId, // Template has no parent
      };
    });

  // Group by date
  const tripsByDate: Record<string, typeof trips> = {};
  trips.forEach((trip) => {
    if (!tripsByDate[trip.date]) tripsByDate[trip.date] = [];
    tripsByDate[trip.date].push(trip);
  });

  return {
    trips,
    tripsByDate,
    total: trips.length,
    view,
    tourId,
    isPremium: ctx.isPremium,
  };
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
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{trip.tour.name}</p>
                            {trip.isRecurring && (
                              <span
                                className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700"
                                title={`Recurring ${trip.recurrencePattern || ""} trip${trip.isTemplate ? " (template)" : ""}`}
                              >
                                <svg className="w-3 h-3 inline mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                {trip.recurrencePattern}
                              </span>
                            )}
                          </div>
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

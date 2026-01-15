import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useNavigation, Link } from "react-router";
import { eq } from "drizzle-orm";
import { requireTenant } from "../../../../../lib/auth/org-context.server";
import { getTripWithFullDetails, getAllBoats, getAllTours } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";

export const meta: MetaFunction = () => [{ title: "Edit Trip - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const tripId = params.id;

  if (!tripId) {
    throw new Response("Trip ID required", { status: 400 });
  }

  const [tripData, boats, tours] = await Promise.all([
    getTripWithFullDetails(organizationId, tripId),
    getAllBoats(organizationId),
    getAllTours(organizationId),
  ]);

  if (!tripData) {
    throw new Response("Trip not found", { status: 404 });
  }

  // Helper to format dates as strings
  const formatDate = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return String(date);
  };

  const trip = {
    id: tripData.id,
    tourId: tripData.tour.id,
    tourName: tripData.tour.name,
    boatId: tripData.boat.id,
    boatName: tripData.boat.name,
    date: formatDate(tripData.date),
    startTime: tripData.startTime,
    endTime: tripData.endTime,
    maxParticipants: tripData.maxParticipants,
    price: tripData.price,
    status: tripData.status,
    weatherNotes: tripData.weatherNotes || "",
    notes: tripData.notes || "",
  };

  return { trip, boats, tours };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const tripId = params.id;

  if (!tripId) {
    throw new Response("Trip ID required", { status: 400 });
  }

  const formData = await request.formData();

  const tourId = formData.get("tourId") as string;
  const boatId = formData.get("boatId") as string;
  const date = formData.get("date") as string;
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const maxParticipants = parseInt(formData.get("maxParticipants") as string) || 10;
  const price = formData.get("price") as string;
  const status = formData.get("status") as string;
  const weatherNotes = formData.get("weatherNotes") as string;
  const notes = formData.get("notes") as string;

  // Update trip in database
  const { db, schema } = getTenantDb(organizationId);

  await db
    .update(schema.trips)
    .set({
      tourId,
      boatId,
      date,
      startTime,
      endTime,
      maxParticipants,
      price,
      status,
      weatherNotes,
      notes,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.trips.organizationId, organizationId), eq(schema.trips.id, tripId)));

  return redirect(`/app/trips/${tripId}`);
}

export default function EditTripPage() {
  const { trip, boats, tours } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to={`/app/trips/${trip.id}`} className="text-blue-600 hover:underline text-sm">
          ← Back to Trip
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Trip</h1>
        <p className="text-gray-500">{trip.tourName} - {trip.date}</p>
      </div>

      <form method="post" className="space-y-6">
        {/* Trip Details */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Trip Details</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="tourId" className="block text-sm font-medium mb-1">
                Tour *
              </label>
              <select
                id="tourId"
                name="tourId"
                required
                defaultValue={trip.tourId}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {tours.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="boatId" className="block text-sm font-medium mb-1">
                Boat *
              </label>
              <select
                id="boatId"
                name="boatId"
                required
                defaultValue={trip.boatId}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {boats.map((boat) => (
                  <option key={boat.id} value={boat.id}>
                    {boat.name} ({boat.capacity} pax)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-medium mb-1">
                Date *
              </label>
              <input
                type="date"
                id="date"
                name="date"
                required
                defaultValue={trip.date ?? ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  required
                  defaultValue={trip.startTime}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="endTime" className="block text-sm font-medium mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  required
                  defaultValue={trip.endTime}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Capacity & Pricing */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Capacity & Pricing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="maxParticipants" className="block text-sm font-medium mb-1">
                Max Participants *
              </label>
              <input
                type="number"
                id="maxParticipants"
                name="maxParticipants"
                required
                min="1"
                max="100"
                defaultValue={trip.maxParticipants}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="price" className="block text-sm font-medium mb-1">
                Price per Person ($) *
              </label>
              <input
                type="number"
                id="price"
                name="price"
                required
                step="0.01"
                min="0"
                defaultValue={trip.price}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Status</h2>
          <div>
            <label htmlFor="status" className="block text-sm font-medium mb-1">
              Trip Status *
            </label>
            <select
              id="status"
              name="status"
              required
              defaultValue={trip.status}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="open">Open</option>
              <option value="confirmed">Confirmed</option>
              <option value="full">Full</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Notes</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="weatherNotes" className="block text-sm font-medium mb-1">
                Weather Notes
              </label>
              <textarea
                id="weatherNotes"
                name="weatherNotes"
                rows={2}
                placeholder="Weather conditions, forecast..."
                defaultValue={trip.weatherNotes}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                Internal Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Notes visible only to staff..."
                defaultValue={trip.notes}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <Link
            to={`/app/trips/${trip.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

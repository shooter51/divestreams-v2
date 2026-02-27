import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useNavigation, Link } from "react-router";
import { eq, and } from "drizzle-orm";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getTripWithFullDetails, getAllBoats, getAllTours, getStaff } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import { redirectWithNotification } from "../../../../../lib/use-notification";
import { CsrfInput } from "../../../../components/CsrfInput";

export const meta: MetaFunction = () => [{ title: "Edit Trip - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const tripId = params.id;

  if (!tripId) {
    throw new Response("Trip ID required", { status: 400 });
  }

  const [tripData, boats, tours, staffData] = await Promise.all([
    getTripWithFullDetails(organizationId, tripId),
    getAllBoats(organizationId),
    getAllTours(organizationId),
    getStaff(organizationId, { activeOnly: true }),
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
    isPublic: tripData.isPublic ?? true,
    staffIds: tripData.staffIds ?? [],
    diveSites: tripData.diveSites ?? [],
  };

  const staff = staffData.map((s) => ({ id: s.id, name: s.name, role: s.role }));

  return { trip, boats, tours, staff };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
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
  const isPublic = formData.get("isPublic") === "true";
  const staffIds = formData.getAll("staffIds") as string[];

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
      isPublic,
      staffIds: staffIds.length > 0 ? staffIds : null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.trips.organizationId, organizationId), eq(schema.trips.id, tripId)));

  return redirect(redirectWithNotification(`/tenant/trips/${tripId}`, "Trip has been successfully updated", "success"));
}

export default function EditTripPage() {
  const { trip, boats, tours, staff } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to={`/tenant/trips/${trip.id}`} className="text-brand hover:underline text-sm">
          ← Back to Trip
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Trip</h1>
        <p className="text-foreground-muted">{trip.tourName} - {trip.date}</p>
      </div>

      <form method="post" className="space-y-6">
        <CsrfInput />
        {/* Trip Details */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                  defaultValue={trip.endTime ?? ""}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Capacity & Pricing */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
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
                defaultValue={trip.maxParticipants ?? ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                defaultValue={trip.price ?? ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
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
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            >
              <option value="open">Open</option>
              <option value="confirmed">Confirmed</option>
              <option value="full">Full</option>
              <option value="completed">Completed</option>
              <option value="canceled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isPublic"
                  value="true"
                  defaultChecked={trip.isPublic}
                  className="rounded"
                />
                <span className="text-sm font-medium">Show on public website</span>
              </label>
              <p className="text-xs text-foreground-muted mt-1">
                Make this trip visible on your public booking site
              </p>
            </div>
          </div>
        </div>

        {/* Dive Sites (from tour, read-only) */}
        {trip.diveSites.length > 0 && (
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-1">Dive Sites</h2>
            <p className="text-xs text-foreground-muted mb-3">From the selected tour</p>
            <div className="space-y-2">
              {trip.diveSites.map((site) => (
                <div key={site.id} className="flex items-center justify-between p-2 bg-surface-inset rounded-lg">
                  <span className="text-sm font-medium">{site.name}</span>
                  <div className="flex items-center gap-3 text-xs text-foreground-muted">
                    {site.maxDepth && <span>{site.maxDepth}m max</span>}
                    {site.difficulty && <span className="capitalize">{site.difficulty}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staff Assignment */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Staff Assignment</h2>
          {staff.length === 0 ? (
            <p className="text-sm text-foreground-muted">No staff members found. Add staff in Settings → Team.</p>
          ) : (
            <div className="space-y-2">
              {staff.map((member) => (
                <label key={member.id} className="flex items-center gap-3 p-2 hover:bg-surface-inset rounded cursor-pointer">
                  <input
                    type="checkbox"
                    name="staffIds"
                    value={member.id}
                    defaultChecked={trip.staffIds.includes(member.id)}
                    className="rounded"
                  />
                  <span>{member.name}</span>
                  <span className="text-sm text-foreground-muted">({member.role})</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <Link
            to={`/tenant/trips/${trip.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

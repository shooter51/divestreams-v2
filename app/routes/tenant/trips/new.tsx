import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, Link, useLoaderData, useSearchParams } from "react-router";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { tripSchema, validateFormData, getFormValues } from "../../../../lib/validation";
import { getTours, getBoats, getStaff, createTrip } from "../../../../lib/db/queries.server";

export const meta: MetaFunction = () => [{ title: "Schedule Trip - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const url = new URL(request.url);
  const tourId = url.searchParams.get("tourId");

  // Fetch real data from tenant database
  const [toursData, boatsData, staffData] = await Promise.all([
    getTours(tenant.schemaName, { activeOnly: true }),
    getBoats(tenant.schemaName, { activeOnly: true }),
    getStaff(tenant.schemaName, { activeOnly: true }),
  ]);

  // Map to expected format for the form
  const tours = toursData.map((t) => ({
    id: t.id,
    name: t.name,
    duration: t.duration,
    maxParticipants: t.maxParticipants,
    price: t.price.toFixed(2),
  }));

  const boats = boatsData.map((b) => ({
    id: b.id,
    name: b.name,
    capacity: b.capacity,
  }));

  const staff = staffData.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
  }));

  const selectedTour = tourId ? tours.find((t) => t.id === tourId) : null;

  return { tours, boats, staff, selectedTour };
}

export async function action({ request }: ActionFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const formData = await request.formData();

  // Convert staff array
  const staffIds = formData.getAll("staffIds");
  if (staffIds.length > 0) {
    formData.set("staffIds", JSON.stringify(staffIds));
  }

  const validation = validateFormData(formData, tripSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  await createTrip(tenant.schemaName, {
    tourId: formData.get("tourId") as string,
    boatId: (formData.get("boatId") as string) || undefined,
    date: formData.get("date") as string,
    startTime: formData.get("startTime") as string,
    endTime: (formData.get("endTime") as string) || undefined,
    maxParticipants: formData.get("maxParticipants") ? Number(formData.get("maxParticipants")) : undefined,
    price: formData.get("price") ? Number(formData.get("price")) : undefined,
    notes: (formData.get("notes") as string) || undefined,
  });

  return redirect("/app/trips");
}

export default function NewTripPage() {
  const { tours, boats, staff, selectedTour } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [searchParams] = useSearchParams();

  // Get tomorrow's date as default
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split("T")[0];

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/app/trips" className="text-blue-600 hover:underline text-sm">
          ← Back to Trips
        </Link>
        <h1 className="text-2xl font-bold mt-2">Schedule Trip</h1>
      </div>

      <form method="post" className="space-y-6">
        {/* Tour Selection */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Tour</h2>
          {selectedTour ? (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div>
                <p className="font-medium">{selectedTour.name}</p>
                <p className="text-sm text-gray-500">
                  ${selectedTour.price} • {selectedTour.duration} min • Max {selectedTour.maxParticipants} pax
                </p>
              </div>
              <Link to="/app/trips/new" className="text-sm text-blue-600 hover:underline">
                Change
              </Link>
              <input type="hidden" name="tourId" value={selectedTour.id} />
            </div>
          ) : (
            <div>
              <label htmlFor="tourId" className="block text-sm font-medium mb-1">
                Select Tour *
              </label>
              <select
                id="tourId"
                name="tourId"
                defaultValue={actionData?.values?.tourId || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Choose a tour...</option>
                {tours.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.name} (${tour.price}, {tour.duration}min)
                  </option>
                ))}
              </select>
              {actionData?.errors?.tourId && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.tourId}</p>
              )}
            </div>
          )}
        </div>

        {/* Date & Time */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Date & Time</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium mb-1">
                Date *
              </label>
              <input
                type="date"
                id="date"
                name="date"
                defaultValue={actionData?.values?.date || defaultDate}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              {actionData?.errors?.date && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.date}</p>
              )}
            </div>
            <div>
              <label htmlFor="startTime" className="block text-sm font-medium mb-1">
                Start Time *
              </label>
              <input
                type="time"
                id="startTime"
                name="startTime"
                defaultValue={actionData?.values?.startTime || "08:00"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              {actionData?.errors?.startTime && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.startTime}</p>
              )}
            </div>
            <div>
              <label htmlFor="endTime" className="block text-sm font-medium mb-1">
                End Time
              </label>
              <input
                type="time"
                id="endTime"
                name="endTime"
                defaultValue={actionData?.values?.endTime || "12:00"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Boat */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Boat</h2>
          <div>
            <label htmlFor="boatId" className="block text-sm font-medium mb-1">
              Select Boat
            </label>
            <select
              id="boatId"
              name="boatId"
              defaultValue={actionData?.values?.boatId || ""}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No boat assigned</option>
              {boats.map((boat) => (
                <option key={boat.id} value={boat.id}>
                  {boat.name} (capacity: {boat.capacity})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Capacity Override */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Capacity</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="maxParticipants" className="block text-sm font-medium mb-1">
                Max Participants
              </label>
              <input
                type="number"
                id="maxParticipants"
                name="maxParticipants"
                min="1"
                placeholder={selectedTour ? String(selectedTour.maxParticipants) : "From tour"}
                defaultValue={actionData?.values?.maxParticipants}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to use tour default
              </p>
            </div>
            <div>
              <label htmlFor="price" className="block text-sm font-medium mb-1">
                Price Override
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  id="price"
                  name="price"
                  step="0.01"
                  min="0"
                  placeholder={selectedTour ? selectedTour.price : "From tour"}
                  defaultValue={actionData?.values?.price}
                  className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to use tour price
              </p>
            </div>
          </div>
        </div>

        {/* Staff Assignment */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Staff Assignment</h2>
          <div className="space-y-2">
            {staff.map((member) => (
              <label key={member.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  name="staffIds"
                  value={member.id}
                  className="rounded"
                />
                <span>{member.name}</span>
                <span className="text-sm text-gray-500">({member.role})</span>
              </label>
            ))}
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
              <input
                type="text"
                id="weatherNotes"
                name="weatherNotes"
                placeholder="e.g., Light wind expected, good visibility"
                defaultValue={actionData?.values?.weatherNotes}
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
                rows={2}
                defaultValue={actionData?.values?.notes}
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
            {isSubmitting ? "Scheduling..." : "Schedule Trip"}
          </button>
          <Link
            to="/app/trips"
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

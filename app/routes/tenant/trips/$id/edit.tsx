import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useNavigation, Link } from "react-router";
import { eq, and } from "drizzle-orm";
import { requireOrgContext, requireRole} from "../../../../../lib/auth/org-context.server";
import { getTripWithFullDetails, getAllBoats, getAllTours, getStaff } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import { updateRecurringTrip, getRecurringTemplate } from "../../../../../lib/trips/recurring.server";
import { redirectWithNotification } from "../../../../../lib/use-notification";
import { CsrfInput } from "../../../../components/CsrfInput";
import { useT } from "../../../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "Edit Trip - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
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

  // Determine the recurring template ID for this trip (if it's part of a series)
  const recurringTemplateId = tripData.recurringTemplateId || (tripData.isRecurring ? tripData.id : null);
  let recurrencePattern: string | null = null;
  if (tripData.isRecurring) {
    if (tripData.recurrencePattern) {
      recurrencePattern = tripData.recurrencePattern;
    } else if (tripData.recurringTemplateId) {
      const template = await getRecurringTemplate(organizationId, tripId);
      recurrencePattern = template?.recurrencePattern ?? null;
    }
  }

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
    isRecurring: tripData.isRecurring ?? false,
    isRecurringTemplate: tripData.isRecurring && !tripData.recurringTemplateId,
    recurringTemplateId,
    recurrencePattern,
  };

  const staff = staffData.map((s) => ({ id: s.id, name: s.name, role: s.role }));

  return { trip, boats, tours, staff };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
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
  const maxParticipantsRaw = formData.get("maxParticipants") as string;
  const maxParticipants = maxParticipantsRaw ? parseInt(maxParticipantsRaw) || null : null;
  const price = formData.get("price") as string;
  const status = formData.get("status") as string;
  const weatherNotes = formData.get("weatherNotes") as string;
  const notes = formData.get("notes") as string;
  const isPublic = formData.get("isPublic") === "true";
  const staffIds = formData.getAll("staffIds") as string[];
  const editScope = formData.get("editScope") as string | null; // "single" | "series"
  const recurringTemplateId = formData.get("recurringTemplateId") as string | null;

  const { db, schema } = getTenantDb(organizationId);

  // If editing a recurring series and a templateId is available, use updateRecurringTrip
  if (editScope === "series" && recurringTemplateId) {
    await updateRecurringTrip(
      organizationId,
      recurringTemplateId,
      {
        tourId,
        boatId: boatId || null,
        startTime,
        endTime: endTime || null,
        maxParticipants,
        price: price ? Number(price) : null,
        notes: notes || null,
        staffIds: staffIds.length > 0 ? staffIds : null,
        weatherNotes: weatherNotes || null,
      },
      { updateFutureInstances: true }
    );
    return redirect(redirectWithNotification(`/tenant/trips/${tripId}`, "Series updated successfully", "success"));
  }

  // Otherwise update just this single trip
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
  const t = useT();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to={`/tenant/trips/${trip.id}`} className="text-brand hover:underline text-sm">
          {t("tenant.trips.backToTrip")}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{t("tenant.trips.editTrip")}</h1>
        <p className="text-foreground-muted">{trip.tourName} - {trip.date}</p>
      </div>

      <form method="post" className="space-y-6">
        <CsrfInput />
        {/* Recurring trip hidden fields and scope selector */}
        {trip.isRecurring && (
          <>
            <input type="hidden" name="recurringTemplateId" value={trip.recurringTemplateId ?? ""} />
            <div className="bg-brand-muted border border-brand rounded-xl p-4">
              <p className="text-sm font-medium text-brand mb-3">
                {t("tenant.trips.thisIsRecurring", { pattern: trip.recurrencePattern ?? "series" })}
              </p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="editScope"
                    value="single"
                    defaultChecked
                    className="accent-brand"
                  />
                  <span className="text-sm">{t("tenant.trips.thisTripOnly")}</span>
                </label>
                {trip.recurringTemplateId && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editScope"
                      value="series"
                      className="accent-brand"
                    />
                    <span className="text-sm">{t("tenant.trips.thisAndFuture")}</span>
                  </label>
                )}
                {trip.isRecurringTemplate && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editScope"
                      value="series"
                      className="accent-brand"
                    />
                    <span className="text-sm">{t("tenant.trips.allFuture")}</span>
                  </label>
                )}
              </div>
            </div>
          </>
        )}
        {/* Trip Details */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.trips.tripDetails")}</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="tourId" className="block text-sm font-medium mb-1">
                {t("common.tour")} *
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
                {t("common.boat")} *
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
                {t("common.date")} *
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
                  {t("tenant.trips.startTime")} *
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
                  {t("tenant.trips.endTime")} *
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
          <h2 className="font-semibold mb-4">{t("tenant.trips.capacityPricing")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="maxParticipants" className="block text-sm font-medium mb-1">
                {t("common.capacity")}
                <span className="text-foreground-muted font-normal text-xs ml-1">({t("tenant.trips.leaveBlankDefault")})</span>
              </label>
              <input
                type="number"
                id="maxParticipants"
                name="maxParticipants"
                min="1"
                max="100"
                defaultValue={trip.maxParticipants ?? ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label htmlFor="price" className="block text-sm font-medium mb-1">
                {t("tenant.trips.pricePerPerson")} ($) *
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
          <h2 className="font-semibold mb-4">{t("common.status")}</h2>
          <div>
            <label htmlFor="status" className="block text-sm font-medium mb-1">
              {t("tenant.trips.tripStatus")} *
            </label>
            <select
              id="status"
              name="status"
              required
              defaultValue={trip.status}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            >
              <option value="open">{t("tenant.trips.statusOpen")}</option>
              <option value="confirmed">{t("tenant.trips.statusConfirmed")}</option>
              <option value="full">{t("tenant.trips.statusFull")}</option>
              <option value="completed">{t("tenant.trips.statusCompleted")}</option>
              <option value="cancelled">{t("tenant.trips.statusCancelled")}</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("common.notes")}</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="weatherNotes" className="block text-sm font-medium mb-1">
                {t("tenant.trips.weatherNotes")}
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
                {t("tenant.trips.internalNotes")}
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
                <span className="text-sm font-medium">{t("tenant.trips.showOnPublicSite")}</span>
              </label>
              <p className="text-xs text-foreground-muted mt-1">
                {t("tenant.trips.publicSiteDesc")}
              </p>
            </div>
          </div>
        </div>

        {/* Dive Sites (from tour, read-only) */}
        {trip.diveSites.length > 0 && (
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-1">{t("tenant.trips.diveSites")}</h2>
            <p className="text-xs text-foreground-muted mb-3">{t("tenant.trips.fromSelectedTour")}</p>
            <div className="space-y-2">
              {trip.diveSites.map((site) => (
                <div key={site.id} className="flex items-center justify-between p-2 bg-surface-inset rounded-lg">
                  <span className="text-sm font-medium">{site.name}</span>
                  <div className="flex items-center gap-3 text-xs text-foreground-muted">
                    {site.maxDepth && <span>{site.maxDepth}m / {Math.round(site.maxDepth * 3.28084)}ft max</span>}
                    {site.difficulty && <span className="capitalize">{site.difficulty}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staff Assignment */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.trips.staffAssignment")}</h2>
          {staff.length === 0 ? (
            <p className="text-sm text-foreground-muted">{t("tenant.trips.noStaffFound")}</p>
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
            {isSubmitting ? t("common.saving") : t("common.saveChanges")}
          </button>
          <Link
            to={`/tenant/trips/${trip.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}

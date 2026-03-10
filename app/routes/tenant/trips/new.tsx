import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, Link, useLoaderData } from "react-router";
import { useState, useEffect } from "react";
import { requireOrgContext, requireRole} from "../../../../lib/auth/org-context.server";
import { tripSchema, validateFormData, getFormValues } from "../../../../lib/validation";
import { getTours, getBoats, getStaff, createTrip, getDiveSitesForTour } from "../../../../lib/db/queries.server";
import { createRecurringTrip, type RecurrencePattern } from "../../../../lib/trips/recurring.server";
import { redirectWithNotification } from "../../../../lib/use-notification";
import { CsrfInput } from "../../../components/CsrfInput";
import { useT } from "../../../i18n/use-t";

// Client-side helper to preview recurrence dates
function calculatePreviewDates(
  startDate: string,
  pattern: RecurrencePattern,
  selectedDays: number[],
  maxCount: number = 10
): string[] {
  if (!startDate) return [];

  const dates: string[] = [];
  let currentDate = startDate;

  const addDays = (dateStr: string, days: number): string => {
    const date = new Date(dateStr + "T00:00:00");
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  };

  const addMonths = (dateStr: string, months: number): string => {
    const date = new Date(dateStr + "T00:00:00");
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split("T")[0];
  };

  const getDayOfWeek = (dateStr: string): number => {
    return new Date(dateStr + "T00:00:00").getDay();
  };

  // For weekly patterns with selected days, find the effective days
  const effectiveDays = (pattern === "weekly" || pattern === "biweekly") && selectedDays.length > 0
    ? selectedDays
    : [getDayOfWeek(startDate)];

  while (dates.length < maxCount) {
    // Check if current date should be included
    if (pattern === "weekly" || pattern === "biweekly") {
      const dayOfWeek = getDayOfWeek(currentDate);
      if (effectiveDays.includes(dayOfWeek)) {
        dates.push(currentDate);
      }
    } else {
      dates.push(currentDate);
    }

    // Move to next date
    switch (pattern) {
      case "daily":
        currentDate = addDays(currentDate, 1);
        break;
      case "weekly":
        currentDate = addDays(currentDate, 1);
        break;
      case "biweekly": {
        // Track week parity for biweekly
        const startWeek = Math.floor(new Date(startDate + "T00:00:00").getTime() / (7 * 24 * 60 * 60 * 1000));
        currentDate = addDays(currentDate, 1);
        const nextWeek = Math.floor(new Date(currentDate + "T00:00:00").getTime() / (7 * 24 * 60 * 60 * 1000));
        if ((nextWeek - startWeek) % 2 !== 0) {
          currentDate = addDays(currentDate, 7);
        }
        break;
      }
      case "monthly":
        currentDate = addMonths(currentDate, 1);
        break;
    }

    // Safety: don't loop forever (max 1 year out)
    if (dates.length === 0 && currentDate > addDays(startDate, 365)) break;
    if (currentDate > addDays(startDate, 365)) break;
  }

  return dates.slice(0, maxCount);
}

export const meta: MetaFunction = () => [{ title: "Schedule Trip - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const organizationId = ctx.org.id;
  const url = new URL(request.url);
  const tourId = url.searchParams.get("tourId");

  // Fetch real data from tenant database
  const [toursData, boatsData, staffData, diveSitesForTour] = await Promise.all([
    getTours(organizationId, { activeOnly: true }),
    getBoats(organizationId, { activeOnly: true }),
    getStaff(organizationId, { activeOnly: true }),
    tourId ? getDiveSitesForTour(organizationId, tourId, 10) : Promise.resolve([]),
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

  return { tours, boats, staff, selectedTour, diveSitesForTour };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const organizationId = ctx.org.id;
  const formData = await request.formData();

  // Convert staff array
  const staffIds = formData.getAll("staffIds");
  if (staffIds.length > 0) {
    formData.set("staffIds", JSON.stringify(staffIds));
  }

  // Convert recurrence days array
  const recurrenceDays = formData.getAll("recurrenceDays");
  if (recurrenceDays.length > 0) {
    formData.set("recurrenceDays", JSON.stringify(recurrenceDays.map(Number)));
  }

  const validation = validateFormData(formData, tripSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  // Additional server-side price validation (if price override is provided)
  const priceStr = formData.get("price") as string;
  if (priceStr) {
    const priceNum = parseFloat(priceStr);
    if (isNaN(priceNum)) {
      return {
        errors: { price: "Price must be a valid number" },
        values: getFormValues(formData)
      };
    }
    if (priceNum < 1) {
      return {
        errors: { price: "Price must be at least $1" },
        values: getFormValues(formData)
      };
    }
  }

  const isRecurring = formData.get("isRecurring") === "true";

  if (isRecurring) {
    const recurrencePattern = formData.get("recurrencePattern") as RecurrencePattern;

    // For weekly/biweekly, if no days selected, use the start date's day
    let parsedRecurrenceDays: number[] | undefined;
    if (formData.get("recurrenceDays")) {
      try {
        parsedRecurrenceDays = JSON.parse(formData.get("recurrenceDays") as string);
      } catch {
        // If parsing fails, calculate from start date
        const startDate = formData.get("date") as string;
        const dayOfWeek = new Date(startDate + "T00:00:00").getDay();
        parsedRecurrenceDays = [dayOfWeek];
      }
    } else if (recurrencePattern === "weekly" || recurrencePattern === "biweekly") {
      const startDate = formData.get("date") as string;
      const dayOfWeek = new Date(startDate + "T00:00:00").getDay();
      parsedRecurrenceDays = [dayOfWeek];
    }

    await createRecurringTrip({
      organizationId,
      tourId: formData.get("tourId") as string,
      boatId: (formData.get("boatId") as string) || null,
      startDate: formData.get("date") as string,
      startTime: formData.get("startTime") as string,
      endTime: (formData.get("endTime") as string) || null,
      maxParticipants: formData.get("maxParticipants") ? Number(formData.get("maxParticipants")) : null,
      price: formData.get("price") ? Number(formData.get("price")) : null,
      notes: (formData.get("notes") as string) || null,
      staffIds: staffIds.length > 0 ? staffIds as string[] : null,
      weatherNotes: (formData.get("weatherNotes") as string) || null,
      isPublic: formData.get("isPublic") === "true",
      recurrencePattern,
      recurrenceDays: parsedRecurrenceDays || null,
      recurrenceEndDate: (formData.get("recurrenceEndDate") as string) || null,
      recurrenceCount: formData.get("recurrenceCount") ? Number(formData.get("recurrenceCount")) : null,
    });
  } else {
    await createTrip(organizationId, {
      tourId: formData.get("tourId") as string,
      boatId: (formData.get("boatId") as string) || undefined,
      date: formData.get("date") as string,
      startTime: formData.get("startTime") as string,
      endTime: (formData.get("endTime") as string) || undefined,
      maxParticipants: formData.get("maxParticipants") ? Number(formData.get("maxParticipants")) : undefined,
      price: formData.get("price") ? Number(formData.get("price")) : undefined,
      notes: (formData.get("notes") as string) || undefined,
      isPublic: formData.get("isPublic") === "true",
      staffIds: staffIds.length > 0 ? staffIds as string[] : undefined,
    });
  }

  return redirect(redirectWithNotification("/tenant/trips", "Trip has been successfully created", "success"));
}

// Day translation keys for weekly selection
const DAY_KEYS = [
  "tenant.trips.day.sun",
  "tenant.trips.day.mon",
  "tenant.trips.day.tue",
  "tenant.trips.day.wed",
  "tenant.trips.day.thu",
  "tenant.trips.day.fri",
  "tenant.trips.day.sat",
] as const;

export default function NewTripPage() {
  const { tours, boats, staff, selectedTour, diveSitesForTour } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const t = useT();
  const isSubmitting = navigation.state === "submitting";
  // Recurring trip state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>("weekly");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [recurrenceEndType, setRecurrenceEndType] = useState<"never" | "date" | "count">("never");
  const [previewDates, setPreviewDates] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");

  // Get tomorrow's date as default
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split("T")[0];

  // Calculate preview dates when recurrence settings change
  useEffect(() => {
    if (!isRecurring || !startDate) {
      setPreviewDates([]);
      return;
    }

    const dates = calculatePreviewDates(startDate, recurrencePattern, selectedDays, 10);
    setPreviewDates(dates);
  }, [isRecurring, startDate, recurrencePattern, selectedDays]);

  // Toggle day selection for weekly patterns
  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/tenant/trips" className="text-brand hover:underline text-sm">
          {t("tenant.trips.backToTrips")}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{t("tenant.trips.scheduleTrip")}</h1>
      </div>

      <form method="post" className="space-y-6">
        <CsrfInput />
        {/* Tour Selection */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("common.tour")}</h2>
          {selectedTour ? (
            <div className="flex items-center justify-between p-3 bg-brand-muted rounded-lg">
              <div>
                <p className="font-medium">{selectedTour.name}</p>
                <p className="text-sm text-foreground-muted">
                  ${selectedTour.price} • {selectedTour.duration} min • Max {selectedTour.maxParticipants} pax
                </p>
              </div>
              <Link to="/tenant/trips/new" className="text-sm text-brand hover:underline">
                {t("tenant.trips.change")}
              </Link>
              <input type="hidden" name="tourId" value={selectedTour.id} />
            </div>
          ) : (
            <div>
              <label htmlFor="tourId" className="block text-sm font-medium mb-1">
                {t("tenant.trips.selectTour")} *
              </label>
              <select
                id="tourId"
                name="tourId"
                defaultValue={actionData?.values?.tourId || ""}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                required
              >
                <option value="">{t("tenant.trips.chooseTour")}</option>
                {tours.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.name} (${tour.price}, {tour.duration}min)
                  </option>
                ))}
              </select>
              {actionData?.errors?.tourId && (
                <p className="text-danger text-sm mt-1">{actionData.errors.tourId}</p>
              )}
            </div>
          )}
        </div>

        {/* Dive Sites (read-only, shown when tour pre-selected) */}
        {selectedTour && diveSitesForTour.length > 0 && (
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-1">{t("tenant.trips.diveSites")}</h2>
            <p className="text-xs text-foreground-muted mb-3">{t("tenant.trips.fromSelectedTour")}</p>
            <div className="space-y-2">
              {diveSitesForTour.map((site) => (
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

        {/* Date & Time */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{isRecurring ? t("tenant.trips.startDateTime") : t("tenant.trips.dateTime")}</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium mb-1">
                {isRecurring ? t("tenant.trips.firstTripDate") : t("common.date")} *
              </label>
              <input
                type="date"
                id="date"
                name="date"
                value={startDate || actionData?.values?.date || defaultDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                required
              />
              {actionData?.errors?.date && (
                <p className="text-danger text-sm mt-1">{actionData.errors.date}</p>
              )}
            </div>
            <div>
              <label htmlFor="startTime" className="block text-sm font-medium mb-1">
                {t("tenant.trips.startTime")} *
              </label>
              <input
                type="time"
                id="startTime"
                name="startTime"
                defaultValue={actionData?.values?.startTime || "08:00"}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                required
              />
              {actionData?.errors?.startTime && (
                <p className="text-danger text-sm mt-1">{actionData.errors.startTime}</p>
              )}
            </div>
            <div>
              <label htmlFor="endTime" className="block text-sm font-medium mb-1">
                {t("tenant.trips.endTime")}
              </label>
              <input
                type="time"
                id="endTime"
                name="endTime"
                defaultValue={actionData?.values?.endTime || "12:00"}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Recurring Trip Options */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">{t("tenant.trips.recurringTrip")}</h2>
              <p className="text-sm text-foreground-muted">{t("tenant.trips.recurringDesc")}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="isRecurring"
                value="true"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-overlay peer-focus:ring-4 peer-focus:ring-brand rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-raised after:border-border-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
            </label>
          </div>

          {isRecurring && (
            <div className="space-y-4 pt-4 border-t">
              {/* Recurrence Pattern */}
              <div>
                <label htmlFor="recurrencePattern" className="block text-sm font-medium mb-1">
                  {t("tenant.trips.repeat")}
                </label>
                <select
                  id="recurrencePattern"
                  name="recurrencePattern"
                  value={recurrencePattern}
                  onChange={(e) => setRecurrencePattern(e.target.value as RecurrencePattern)}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  <option value="daily">{t("tenant.trips.recurrencePattern.daily")}</option>
                  <option value="weekly">{t("tenant.trips.recurrencePattern.weekly")}</option>
                  <option value="biweekly">{t("tenant.trips.recurrencePattern.biweekly")}</option>
                  <option value="monthly">{t("tenant.trips.recurrencePattern.monthly")}</option>
                </select>
              </div>

              {/* Day Selection for Weekly/Biweekly */}
              {(recurrencePattern === "weekly" || recurrencePattern === "biweekly") && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t("tenant.trips.onTheseDays")}
                  </label>
                  <div className="flex gap-2">
                    {DAY_KEYS.map((dayKey, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                          selectedDays.includes(idx)
                            ? "bg-brand text-white"
                            : "bg-surface-inset text-foreground hover:bg-surface-overlay"
                        }`}
                      >
                        {t(dayKey)}
                      </button>
                    ))}
                    {/* Hidden inputs for selected days */}
                    {selectedDays.map((day) => (
                      <input key={day} type="hidden" name="recurrenceDays" value={day} />
                    ))}
                  </div>
                  <p className="text-xs text-foreground-muted mt-1">
                    {selectedDays.length === 0 ? t("tenant.trips.willUseStartDay") : `${t("tenant.trips.selectedDays")}: ${selectedDays.map(d => t(DAY_KEYS[d])).join(", ")}`}
                  </p>
                </div>
              )}

              {/* End Type */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("tenant.trips.ends")}
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="recurrenceEndType"
                      value="never"
                      checked={recurrenceEndType === "never"}
                      onChange={() => setRecurrenceEndType("never")}
                      className="rounded"
                    />
                    <span className="text-sm">{t("tenant.trips.neverEnd")}</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="recurrenceEndType"
                      value="date"
                      checked={recurrenceEndType === "date"}
                      onChange={() => setRecurrenceEndType("date")}
                      className="rounded"
                    />
                    <span className="text-sm">{t("tenant.trips.onDate")}</span>
                    {recurrenceEndType === "date" && (
                      <input
                        type="date"
                        name="recurrenceEndDate"
                        min={startDate || defaultDate}
                        className="ml-2 px-2 py-1 border rounded text-sm"
                      />
                    )}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="recurrenceEndType"
                      value="count"
                      checked={recurrenceEndType === "count"}
                      onChange={() => setRecurrenceEndType("count")}
                      className="rounded"
                    />
                    <span className="text-sm">{t("tenant.trips.after")}</span>
                    {recurrenceEndType === "count" && (
                      <>
                        <input
                          type="number"
                          name="recurrenceCount"
                          min="1"
                          max="52"
                          defaultValue="10"
                          className="ml-2 w-16 px-2 py-1 border rounded text-sm"
                        />
                        <span className="text-sm">{t("tenant.trips.occurrences")}</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Preview Dates */}
              {previewDates.length > 0 && (
                <div className="pt-4 border-t">
                  <label className="block text-sm font-medium mb-2">
                    {t("tenant.trips.previewDates")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {previewDates.map((date, idx) => (
                      <span
                        key={date}
                        className={`text-xs px-2 py-1 rounded ${
                          idx === 0 ? "bg-brand-muted text-brand" : "bg-surface-inset text-foreground"
                        }`}
                      >
                        {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    ))}
                    {previewDates.length === 10 && (
                      <span className="text-xs text-foreground-muted self-center">...{t("tenant.trips.andMore")}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Boat */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("common.boat")}</h2>
          <div>
            <label htmlFor="boatId" className="block text-sm font-medium mb-1">
              {t("tenant.trips.selectBoat")}
            </label>
            <select
              id="boatId"
              name="boatId"
              defaultValue={actionData?.values?.boatId || ""}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            >
              <option value="">{t("tenant.trips.noBoat")}</option>
              {boats.map((boat) => (
                <option key={boat.id} value={boat.id}>
                  {boat.name} (capacity: {boat.capacity})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Capacity Override */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("common.capacity")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="maxParticipants" className="block text-sm font-medium mb-1">
                {t("common.capacity")}
              </label>
              <input
                type="number"
                id="maxParticipants"
                name="maxParticipants"
                min="1"
                placeholder={selectedTour ? String(selectedTour.maxParticipants) : t("tenant.trips.leaveBlankTour")}
                defaultValue={actionData?.values?.maxParticipants}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
              <p className="text-xs text-foreground-muted mt-1">
                {t("tenant.trips.leaveBlankDefault")}
              </p>
            </div>
            <div>
              <label htmlFor="price" className="block text-sm font-medium mb-1">
                {t("tenant.trips.priceOverride")}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-foreground-muted">$</span>
                <input
                  type="number"
                  id="price"
                  name="price"
                  step="0.01"
                  min="0"
                  placeholder={selectedTour ? selectedTour.price : t("tenant.trips.leaveBlankTour")}
                  defaultValue={actionData?.values?.price}
                  className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
              <p className="text-xs text-foreground-muted mt-1">
                {t("tenant.trips.leaveBlankPrice")}
              </p>
            </div>
          </div>
        </div>

        {/* Staff Assignment */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.trips.staffAssignment")}</h2>
          <div className="space-y-2">
            {staff.map((member) => (
              <label key={member.id} className="flex items-center gap-3 p-2 hover:bg-surface-inset rounded">
                <input
                  type="checkbox"
                  name="staffIds"
                  value={member.id}
                  className="rounded"
                />
                <span>{member.name}</span>
                <span className="text-sm text-foreground-muted">({member.role})</span>
              </label>
            ))}
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
              <input
                type="text"
                id="weatherNotes"
                name="weatherNotes"
                placeholder={t("tenant.trips.weatherPlaceholder")}
                defaultValue={actionData?.values?.weatherNotes}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                {t("tenant.trips.internalNotes")}
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                defaultValue={actionData?.values?.notes}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isPublic"
                  value="true"
                  defaultChecked={actionData?.values?.isPublic !== "false"}
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

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? t("common.creating") : t("tenant.trips.scheduleTrip")}
          </button>
          <Link
            to="/tenant/trips"
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}

import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, Link, useLoaderData, useSearchParams } from "react-router";
import { useState, useEffect } from "react";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { tripSchema, validateFormData, getFormValues } from "../../../../lib/validation";
import { getTours, getBoats, getStaff, createTrip } from "../../../../lib/db/queries.server";
import { createRecurringTrip, type RecurrencePattern } from "../../../../lib/trips/recurring.server";

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
  const { organizationId } = await requireTenant(request);
  const url = new URL(request.url);
  const tourId = url.searchParams.get("tourId");

  // Fetch real data from tenant database
  const [toursData, boatsData, staffData] = await Promise.all([
    getTours(organizationId, { activeOnly: true }),
    getBoats(organizationId, { activeOnly: true }),
    getStaff(organizationId, { activeOnly: true }),
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
  const { organizationId } = await requireTenant(request);
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
    });
  }

  return redirect("/tenant/trips");
}

// Day names for weekly selection
const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export default function NewTripPage() {
  const { tours, boats, staff, selectedTour } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [searchParams] = useSearchParams();

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
          ← Back to Trips
        </Link>
        <h1 className="text-2xl font-bold mt-2">Schedule Trip</h1>
      </div>

      <form method="post" className="space-y-6">
        {/* Tour Selection */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Tour</h2>
          {selectedTour ? (
            <div className="flex items-center justify-between p-3 bg-brand-muted rounded-lg">
              <div>
                <p className="font-medium">{selectedTour.name}</p>
                <p className="text-sm text-foreground-muted">
                  ${selectedTour.price} • {selectedTour.duration} min • Max {selectedTour.maxParticipants} pax
                </p>
              </div>
              <Link to="/tenant/trips/new" className="text-sm text-brand hover:underline">
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                <p className="text-danger text-sm mt-1">{actionData.errors.tourId}</p>
              )}
            </div>
          )}
        </div>

        {/* Date & Time */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{isRecurring ? "Start Date & Time" : "Date & Time"}</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium mb-1">
                {isRecurring ? "First Trip Date *" : "Date *"}
              </label>
              <input
                type="date"
                id="date"
                name="date"
                value={startDate || actionData?.values?.date || defaultDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                required
              />
              {actionData?.errors?.date && (
                <p className="text-danger text-sm mt-1">{actionData.errors.date}</p>
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                required
              />
              {actionData?.errors?.startTime && (
                <p className="text-danger text-sm mt-1">{actionData.errors.startTime}</p>
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {/* Recurring Trip Options */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Recurring Trip</h2>
              <p className="text-sm text-foreground-muted">Schedule this trip to repeat automatically</p>
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
                  Repeat
                </label>
                <select
                  id="recurrencePattern"
                  name="recurrencePattern"
                  value={recurrencePattern}
                  onChange={(e) => setRecurrencePattern(e.target.value as RecurrencePattern)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 Weeks</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Day Selection for Weekly/Biweekly */}
              {(recurrencePattern === "weekly" || recurrencePattern === "biweekly") && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    On these days
                  </label>
                  <div className="flex gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                          selectedDays.includes(day.value)
                            ? "bg-brand text-white"
                            : "bg-surface-inset text-foreground hover:bg-surface-overlay"
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                    {/* Hidden inputs for selected days */}
                    {selectedDays.map((day) => (
                      <input key={day} type="hidden" name="recurrenceDays" value={day} />
                    ))}
                  </div>
                  <p className="text-xs text-foreground-muted mt-1">
                    {selectedDays.length === 0 ? "Will use the start date's day of week" : `Selected: ${selectedDays.map(d => DAYS_OF_WEEK[d].label).join(", ")}`}
                  </p>
                </div>
              )}

              {/* End Type */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Ends
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
                    <span className="text-sm">Never (generate up to 3 months)</span>
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
                    <span className="text-sm">On date</span>
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
                    <span className="text-sm">After</span>
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
                        <span className="text-sm">occurrences</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Preview Dates */}
              {previewDates.length > 0 && (
                <div className="pt-4 border-t">
                  <label className="block text-sm font-medium mb-2">
                    Upcoming Dates Preview
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
                      <span className="text-xs text-foreground-muted self-center">...and more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Boat */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Boat</h2>
          <div>
            <label htmlFor="boatId" className="block text-sm font-medium mb-1">
              Select Boat
            </label>
            <select
              id="boatId"
              name="boatId"
              defaultValue={actionData?.values?.boatId || ""}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
              <p className="text-xs text-foreground-muted mt-1">
                Leave blank to use tour default
              </p>
            </div>
            <div>
              <label htmlFor="price" className="block text-sm font-medium mb-1">
                Price Override
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-foreground-muted">$</span>
                <input
                  type="number"
                  id="price"
                  name="price"
                  step="0.01"
                  min="0"
                  placeholder={selectedTour ? selectedTour.price : "From tour"}
                  defaultValue={actionData?.values?.price}
                  className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
              <p className="text-xs text-foreground-muted mt-1">
                Leave blank to use tour price
              </p>
            </div>
          </div>
        </div>

        {/* Staff Assignment */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Staff Assignment</h2>
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
                rows={2}
                defaultValue={actionData?.values?.notes}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
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
                <span className="text-sm font-medium">Show on public website</span>
              </label>
              <p className="text-xs text-foreground-muted mt-1">
                Make this trip visible on your public booking site
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
            {isSubmitting ? "Scheduling..." : "Schedule Trip"}
          </button>
          <Link
            to="/tenant/trips"
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

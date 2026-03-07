import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { useState } from "react";
import { requireOrgContext, requireRole } from "../../../../../lib/auth/org-context.server";
import { getCourses, createSeries } from "../../../../../lib/db/training.server";
import { redirectWithNotification } from "../../../../../lib/use-notification";
import { CsrfInput } from "../../../../components/CsrfInput";

export const meta: MetaFunction = () => [{ title: "New Training Series - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const courses = await getCourses(ctx.org.id);
  return { courses };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const courseId = formData.get("courseId") as string;
  const maxStudents = formData.get("maxStudents") as string;
  const priceOverride = formData.get("priceOverride") as string;
  const instructorName = formData.get("instructorName") as string;
  const notes = formData.get("notes") as string;

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Series name is required";
  if (!courseId) errors.courseId = "Please select a course";

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  // Parse dynamic session rows
  const sessions: Array<{
    startDate: string;
    endDate?: string;
    startTime?: string;
    location?: string;
    meetingPoint?: string;
    sessionType?: string;
  }> = [];
  let i = 0;
  while (formData.get(`sessions[${i}].startDate`)) {
    sessions.push({
      startDate: formData.get(`sessions[${i}].startDate`) as string,
      endDate: (formData.get(`sessions[${i}].endDate`) as string) || undefined,
      startTime: (formData.get(`sessions[${i}].startTime`) as string) || undefined,
      location: (formData.get(`sessions[${i}].location`) as string) || undefined,
      meetingPoint: (formData.get(`sessions[${i}].meetingPoint`) as string) || undefined,
      sessionType: (formData.get(`sessions[${i}].sessionType`) as string) || undefined,
    });
    i++;
  }

  await createSeries({
    organizationId: ctx.org.id,
    courseId,
    name,
    maxStudents: maxStudents ? parseInt(maxStudents) : undefined,
    priceOverride: priceOverride || undefined,
    instructorName: instructorName || undefined,
    notes: notes || undefined,
    status: "scheduled",
    sessions,
  });

  return redirect(redirectWithNotification("/tenant/training/series", "Series has been successfully created", "success"));
}

const SESSION_TYPES = [
  { value: "", label: "Not specified" },
  { value: "classroom", label: "Classroom" },
  { value: "pool", label: "Pool" },
  { value: "confined_water", label: "Confined Water" },
  { value: "open_water", label: "Open Water" },
  { value: "exam", label: "Exam" },
  { value: "other", label: "Other" },
];

interface SessionRow {
  id: number;
  startDate: string;
  endDate: string;
  startTime: string;
  location: string;
  meetingPoint: string;
  sessionType: string;
}

export default function NewSeriesPage() {
  const { courses } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [sessionRows, setSessionRows] = useState<SessionRow[]>([]);
  const [nextId, setNextId] = useState(0);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split("T")[0];

  const addSession = () => {
    setSessionRows((prev) => [
      ...prev,
      { id: nextId, startDate: defaultDate, endDate: "", startTime: "", location: "", meetingPoint: "", sessionType: "" },
    ]);
    setNextId((n) => n + 1);
  };

  const removeSession = (id: number) => {
    setSessionRows((prev) => prev.filter((row) => row.id !== id));
  };

  const updateSession = (id: number, field: keyof Omit<SessionRow, "id">, value: string) => {
    setSessionRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link to="/tenant/training/series" className="text-brand hover:underline text-sm">
          &larr; Back to Series
        </Link>
        <h1 className="text-2xl font-bold mt-2">Create Training Series</h1>
      </div>

      <form method="post" className="space-y-6">
        <CsrfInput />

        {/* Series Info */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Series Information</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Series Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                placeholder="e.g., Open Water Diver - Spring 2026"
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
              {actionData?.errors?.name && (
                <p className="text-danger text-sm mt-1">{actionData.errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="courseId" className="block text-sm font-medium mb-1">
                Course *
              </label>
              <select
                id="courseId"
                name="courseId"
                required
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              >
                <option value="">Choose a course...</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} {course.agencyName ? `(${course.agencyName})` : ""}
                  </option>
                ))}
              </select>
              {actionData?.errors?.courseId && (
                <p className="text-danger text-sm mt-1">{actionData.errors.courseId}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="maxStudents" className="block text-sm font-medium mb-1">
                  Max Students
                </label>
                <input
                  type="number"
                  id="maxStudents"
                  name="maxStudents"
                  min="1"
                  placeholder="8"
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              <div>
                <label htmlFor="priceOverride" className="block text-sm font-medium mb-1">
                  Price Override
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-foreground-muted">$</span>
                  <input
                    type="number"
                    id="priceOverride"
                    name="priceOverride"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
                <p className="text-xs text-foreground-muted mt-1">Leave blank to use course price</p>
              </div>
            </div>

            <div>
              <label htmlFor="instructorName" className="block text-sm font-medium mb-1">
                Instructor Name
              </label>
              <input
                type="text"
                id="instructorName"
                name="instructorName"
                placeholder="Instructor name"
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Any additional notes..."
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Sessions */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">Sessions ({sessionRows.length})</h2>
            <button
              type="button"
              onClick={addSession}
              className="px-3 py-1.5 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover"
            >
              + Add Session
            </button>
          </div>

          {sessionRows.length === 0 ? (
            <p className="text-foreground-muted text-sm text-center py-4">
              No sessions added yet. You can add sessions after creating the series, or add them now.
            </p>
          ) : (
            <div className="space-y-4">
              {sessionRows.map((row, idx) => (
                <div key={row.id} className="border border-border-strong rounded-lg p-4 relative">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-medium text-foreground-muted">Session {idx + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeSession(row.id)}
                      className="text-danger text-sm hover:underline"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Session Type</label>
                      <select
                        name={`sessions[${idx}].sessionType`}
                        value={row.sessionType}
                        onChange={(e) => updateSession(row.id, "sessionType", e.target.value)}
                        className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                      >
                        {SESSION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">Start Date *</label>
                      <input
                        type="date"
                        name={`sessions[${idx}].startDate`}
                        value={row.startDate}
                        onChange={(e) => updateSession(row.id, "startDate", e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">Start Time</label>
                      <input
                        type="time"
                        name={`sessions[${idx}].startTime`}
                        value={row.startTime}
                        onChange={(e) => updateSession(row.id, "startTime", e.target.value)}
                        className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">End Date</label>
                      <input
                        type="date"
                        name={`sessions[${idx}].endDate`}
                        value={row.endDate}
                        onChange={(e) => updateSession(row.id, "endDate", e.target.value)}
                        className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">Location</label>
                      <input
                        type="text"
                        name={`sessions[${idx}].location`}
                        value={row.location}
                        onChange={(e) => updateSession(row.id, "location", e.target.value)}
                        placeholder="e.g., Dive Center"
                        className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">Meeting Point</label>
                      <input
                        type="text"
                        name={`sessions[${idx}].meetingPoint`}
                        value={row.meetingPoint}
                        onChange={(e) => updateSession(row.id, "meetingPoint", e.target.value)}
                        placeholder="e.g., Front desk"
                        className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                      />
                    </div>
                  </div>
                </div>
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
            {isSubmitting ? "Creating..." : "Create Series"}
          </button>
          <Link
            to="/tenant/training/series"
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

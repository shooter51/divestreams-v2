import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, redirect } from "react-router";
import { useState } from "react";
import { requireOrgContext, requireRole } from "../../../../../lib/auth/org-context.server";
import {
  getSeriesById,
  getEnrollments,
  updateSeries,
  deleteSeries,
  addSessionToSeries,
  removeSessionFromSeries,
} from "../../../../../lib/db/training.server";
import { redirectWithNotification, useNotification } from "../../../../../lib/use-notification";
import { CsrfInput } from "../../../../components/CsrfInput";

export const meta: MetaFunction = () => [{ title: "Series Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const seriesId = params.id;

  if (!seriesId) {
    throw new Response("Series ID is required", { status: 400 });
  }

  const [series, enrollments] = await Promise.all([
    getSeriesById(ctx.org.id, seriesId),
    getEnrollments(ctx.org.id, { seriesId }),
  ]);

  if (!series) {
    throw new Response("Series not found", { status: 404 });
  }

  return { series, enrollments };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const seriesId = params.id!;

  if (intent === "update-series") {
    const updates: Parameters<typeof updateSeries>[2] = {};
    const name = formData.get("name") as string;
    const maxStudents = formData.get("maxStudents") as string;
    const priceOverride = formData.get("priceOverride") as string;
    const instructorName = formData.get("instructorName") as string;
    const notes = formData.get("notes") as string;
    const status = formData.get("status") as string;

    if (name) updates.name = name;
    if (status) updates.status = status;
    if (maxStudents) updates.maxStudents = parseInt(maxStudents, 10);
    if (priceOverride !== undefined) updates.priceOverride = priceOverride || null;
    if (instructorName !== undefined) updates.instructorName = instructorName || null;
    if (notes !== undefined) updates.notes = notes || null;

    await updateSeries(ctx.org.id, seriesId, updates);
    return redirect(redirectWithNotification(`/tenant/training/series/${seriesId}`, "Series updated successfully", "success"));
  }

  if (intent === "add-session") {
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const startTime = formData.get("startTime") as string;
    const location = formData.get("location") as string;
    const meetingPoint = formData.get("meetingPoint") as string;
    const sessionType = formData.get("sessionType") as string;

    if (!startDate) {
      return { error: "Start date is required" };
    }

    await addSessionToSeries(ctx.org.id, seriesId, {
      startDate,
      endDate: endDate || undefined,
      startTime: startTime || undefined,
      location: location || undefined,
      meetingPoint: meetingPoint || undefined,
      sessionType: sessionType || undefined,
    });
    return redirect(redirectWithNotification(`/tenant/training/series/${seriesId}`, "Session added successfully", "success"));
  }

  if (intent === "remove-session") {
    const sessionId = formData.get("sessionId") as string;
    await removeSessionFromSeries(ctx.org.id, sessionId);
    return redirect(redirectWithNotification(`/tenant/training/series/${seriesId}`, "Session removed successfully", "success"));
  }

  if (intent === "delete-series") {
    try {
      await deleteSeries(ctx.org.id, seriesId);
      return redirect(redirectWithNotification("/tenant/training/series", "Series deleted successfully", "success"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete series";
      return { error: message };
    }
  }

  return null;
}

const statusColors: Record<string, string> = {
  scheduled: "bg-brand-muted text-brand",
  in_progress: "bg-warning-muted text-warning",
  completed: "bg-success-muted text-success",
  cancelled: "bg-danger-muted text-danger",
};

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const sessionTypeLabels: Record<string, string> = {
  classroom: "Classroom",
  pool: "Pool",
  confined_water: "Confined Water",
  open_water: "Open Water",
  exam: "Exam",
  other: "Other",
};

const sessionTypeColors: Record<string, string> = {
  classroom: "bg-blue-100 text-blue-700",
  pool: "bg-cyan-100 text-cyan-700",
  confined_water: "bg-teal-100 text-teal-700",
  open_water: "bg-emerald-100 text-emerald-700",
  exam: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-700",
};

const enrollmentStatusColors: Record<string, string> = {
  enrolled: "bg-brand-muted text-brand",
  in_progress: "bg-warning-muted text-warning",
  completed: "bg-success-muted text-success",
  withdrawn: "bg-surface-inset text-foreground-muted",
  failed: "bg-danger-muted text-danger",
};

const enrollmentStatusLabels: Record<string, string> = {
  enrolled: "Enrolled",
  in_progress: "In Progress",
  completed: "Completed",
  withdrawn: "Withdrawn",
  dropped: "Dropped",
  failed: "Failed",
};

export default function SeriesDetailPage() {
  useNotification();

  const { series, enrollments } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ error?: string }>();
  const [isEditing, setIsEditing] = useState(false);
  const [showAddSession, setShowAddSession] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div>
      <div className="mb-6">
        <Link to="/tenant/training/series" className="text-brand hover:underline text-sm">
          &larr; Back to Series
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{series.name}</h1>
            <span
              className={`text-sm px-3 py-1 rounded-full ${
                statusColors[series.status] || "bg-surface-inset text-foreground"
              }`}
            >
              {statusLabels[series.status] || series.status}
            </span>
          </div>
          <p className="text-foreground-muted mt-1">
            {series.courseName}
            {series.agencyName && ` · ${series.agencyName}`}
          </p>
          {series.instructorName && (
            <p className="text-sm text-foreground-muted">Instructor: {series.instructorName}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            to={`/tenant/training/enrollments/new?seriesId=${series.id}`}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
          >
            Enroll Student
          </Link>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {isEditing ? "Cancel Edit" : "Edit"}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-danger border border-danger rounded-lg hover:bg-danger-muted"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Error Messages */}
      {fetcher.data?.error && (
        <div className="bg-danger-muted border border-danger text-danger px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
          {fetcher.data.error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{series.sessions?.length ?? 0}</p>
              <p className="text-foreground-muted text-sm">Sessions</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">
                {enrollments.filter((e) => e.status !== "withdrawn").length}
                {series.maxStudents ? `/${series.maxStudents}` : ""}
              </p>
              <p className="text-foreground-muted text-sm">Enrolled</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">
                {series.priceOverride ? `$${series.priceOverride}` : "—"}
              </p>
              <p className="text-foreground-muted text-sm">Price</p>
            </div>
          </div>

          {/* Edit Form */}
          {isEditing ? (
            <fetcher.Form method="post" className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <CsrfInput />
              <input type="hidden" name="intent" value="update-series" />
              <h2 className="font-semibold mb-4">Edit Series</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Series Name *</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={series.name}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Max Students</label>
                    <input
                      type="number"
                      name="maxStudents"
                      defaultValue={series.maxStudents || ""}
                      min="1"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Price Override</label>
                    <input
                      type="text"
                      name="priceOverride"
                      defaultValue={series.priceOverride || ""}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Instructor</label>
                    <input
                      type="text"
                      name="instructorName"
                      defaultValue={series.instructorName || ""}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <select
                      name="status"
                      defaultValue={series.status}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    name="notes"
                    defaultValue={series.notes || ""}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  type="submit"
                  disabled={fetcher.state === "submitting"}
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
                >
                  {fetcher.state === "submitting" ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  Cancel
                </button>
              </div>
            </fetcher.Form>
          ) : (
            series.notes && (
              <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
                <h2 className="font-semibold mb-2">Notes</h2>
                <p className="text-sm whitespace-pre-wrap">{series.notes}</p>
              </div>
            )
          )}

          {/* Sessions List */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Sessions ({series.sessions?.length ?? 0})</h2>
              <button
                type="button"
                onClick={() => setShowAddSession(!showAddSession)}
                className="px-3 py-1.5 text-sm border border-brand text-brand rounded-lg hover:bg-brand-muted"
              >
                {showAddSession ? "Cancel" : "+ Add Session"}
              </button>
            </div>

            {/* Add Session Form */}
            {showAddSession && (
              <fetcher.Form method="post" className="mb-4 p-4 border border-border-strong rounded-lg">
                <CsrfInput />
                <input type="hidden" name="intent" value="add-session" />
                <h3 className="text-sm font-semibold mb-3">New Session</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Session Type</label>
                    <select
                      name="sessionType"
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                    >
                      <option value="">Not specified</option>
                      <option value="classroom">Classroom</option>
                      <option value="pool">Pool</option>
                      <option value="confined_water">Confined Water</option>
                      <option value="open_water">Open Water</option>
                      <option value="exam">Exam</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Start Date *</label>
                    <input
                      type="date"
                      name="startDate"
                      required
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Start Time</label>
                    <input
                      type="time"
                      name="startTime"
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">End Date</label>
                    <input
                      type="date"
                      name="endDate"
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Location</label>
                    <input
                      type="text"
                      name="location"
                      placeholder="e.g., Dive Center"
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Meeting Point</label>
                    <input
                      type="text"
                      name="meetingPoint"
                      placeholder="e.g., Front desk"
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    type="submit"
                    disabled={fetcher.state === "submitting"}
                    className="px-3 py-1.5 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
                  >
                    {fetcher.state === "submitting" ? "Adding..." : "Add Session"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSession(false)}
                    className="px-3 py-1.5 text-sm border rounded-lg hover:bg-surface-inset"
                  >
                    Cancel
                  </button>
                </div>
              </fetcher.Form>
            )}

            {!series.sessions || series.sessions.length === 0 ? (
              <p className="text-foreground-muted text-sm">No sessions in this series yet.</p>
            ) : (
              <div className="space-y-2">
                {series.sessions
                  .slice()
                  .sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0))
                  .map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 bg-surface-inset rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground-muted min-w-[24px]">
                          {(session.seriesIndex ?? 0) + 1}.
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            {session.sessionType && (
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  sessionTypeColors[session.sessionType] || "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {sessionTypeLabels[session.sessionType] || session.sessionType}
                              </span>
                            )}
                            <Link
                              to={`/tenant/training/sessions/${session.id}`}
                              className="text-sm font-medium text-brand hover:underline"
                            >
                              {new Date(session.startDate + "T00:00:00").toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </Link>
                          </div>
                          {session.location && (
                            <p className="text-xs text-foreground-muted">@ {session.location}</p>
                          )}
                        </div>
                      </div>
                      <fetcher.Form method="post">
                        <CsrfInput />
                        <input type="hidden" name="intent" value="remove-session" />
                        <input type="hidden" name="sessionId" value={session.id} />
                        <button
                          type="submit"
                          className="text-xs text-danger hover:underline"
                          onClick={(e) => {
                            if (!confirm("Remove this session from the series?")) e.preventDefault();
                          }}
                        >
                          Remove
                        </button>
                      </fetcher.Form>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Enrollments */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Enrollments ({enrollments.length})</h2>
              <Link
                to={`/tenant/training/enrollments/new?seriesId=${series.id}`}
                className="text-sm text-brand hover:underline"
              >
                + Enroll Student
              </Link>
            </div>
            {enrollments.length === 0 ? (
              <p className="text-foreground-muted text-sm">No students enrolled in this series yet.</p>
            ) : (
              <div className="space-y-2">
                {enrollments.map((enrollment) => (
                  <Link
                    key={enrollment.id}
                    to={`/tenant/training/enrollments/${enrollment.id}`}
                    className="flex justify-between items-center p-3 bg-surface-inset rounded-lg hover:bg-surface-overlay"
                  >
                    <div>
                      <p className="font-medium">
                        {enrollment.customerFirstName} {enrollment.customerLastName}
                      </p>
                      <p className="text-sm text-foreground-muted">{enrollment.customerEmail}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        enrollmentStatusColors[enrollment.status] || "bg-surface-inset text-foreground"
                      }`}
                    >
                      {enrollmentStatusLabels[enrollment.status] || enrollment.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Series Info */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Details</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-foreground-muted">Course</p>
                <Link
                  to={`/tenant/training/courses/${series.courseId}`}
                  className="text-brand hover:underline"
                >
                  {series.courseName}
                </Link>
              </div>
              {series.agencyName && (
                <div>
                  <p className="text-foreground-muted">Agency</p>
                  <p>{series.agencyName}</p>
                </div>
              )}
              <div>
                <p className="text-foreground-muted">Max Students</p>
                <p>{series.maxStudents || "Unlimited"}</p>
              </div>
              <div>
                <p className="text-foreground-muted">Price</p>
                <p>{series.priceOverride ? `$${series.priceOverride}` : "Not set"}</p>
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-foreground-subtle">
            <p>Series ID: {series.id}</p>
            {series.createdAt && (
              <p>Created {new Date(series.createdAt).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Delete Series</h2>
            <p className="text-foreground-muted mb-6">
              Are you sure you want to delete this training series? This action cannot be undone.
              {enrollments.length > 0 && (
                <span className="block mt-2 text-danger">
                  Warning: This series has {enrollments.length} enrolled student(s). Please remove all enrollments first.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-surface-inset"
              >
                Cancel
              </button>
              <fetcher.Form method="post" className="flex-1">
                <CsrfInput />
                <input type="hidden" name="intent" value="delete-series" />
                <button
                  type="submit"
                  disabled={enrollments.length > 0}
                  className="w-full px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger-hover disabled:bg-danger-muted disabled:cursor-not-allowed"
                >
                  Delete Series
                </button>
              </fetcher.Form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

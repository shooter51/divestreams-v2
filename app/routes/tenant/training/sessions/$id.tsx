import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, redirect } from "react-router";
import { useCsrfFetcher } from "../../../../hooks/use-csrf-fetcher";
import { useState } from "react";
import { requireOrgContext, requireRole} from "../../../../../lib/auth/org-context.server";
import {
  getSessionById,
  getEnrollments,
  updateSession,
  deleteSession,
  getCourses,
} from "../../../../../lib/db/training.server";
import { redirectWithNotification, useNotification } from "../../../../../lib/use-notification";
import { useT } from "../../../../i18n/use-t";
import { CsrfInput } from "../../../../components/CsrfInput";

export const meta: MetaFunction = () => [{ title: "Session Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const sessionId = params.id;

  if (!sessionId) {
    throw new Response("Session ID is required", { status: 400 });
  }

  const [session, enrollments, courses] = await Promise.all([
    getSessionById(ctx.org.id, sessionId),
    getEnrollments(ctx.org.id, { sessionId }),
    getCourses(ctx.org.id),
  ]);

  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }

  // Compute enrolledCount from actual enrollments (the cached counter on the session can be stale)
  const enrolledCount = enrollments.filter(e => e.status !== "withdrawn").length;
  return { session: { ...session, enrolledCount }, enrollments, courses, isPremium: ctx.isPremium };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const sessionId = params.id!;

  if (intent === "update-status") {
    const newStatus = formData.get("status") as string;
    const allowedStatuses = ["scheduled", "in_progress", "completed", "cancelled"];
    if (!newStatus || !allowedStatuses.includes(newStatus)) {
      return { error: "Invalid status value" };
    }
    await updateSession(ctx.org.id, sessionId, { status: newStatus });
    return redirect(redirectWithNotification(`/tenant/training/sessions/${sessionId}`, "Session has been successfully updated", "success"));
  }

  if (intent === "update-session") {
    const updates: Parameters<typeof updateSession>[2] = {};

    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const startTime = formData.get("startTime") as string;
    const location = formData.get("location") as string;
    const meetingPoint = formData.get("meetingPoint") as string;
    const instructorName = formData.get("instructorName") as string;
    const maxStudents = formData.get("maxStudents") as string;
    const priceOverride = formData.get("priceOverride") as string;
    const notes = formData.get("notes") as string;

    if (startDate) updates.startDate = startDate;
    if (endDate !== undefined) updates.endDate = endDate || null;
    if (startTime !== undefined) updates.startTime = startTime || null;
    if (location !== undefined) updates.location = location || null;
    if (meetingPoint !== undefined) updates.meetingPoint = meetingPoint || null;
    if (instructorName !== undefined) updates.instructorName = instructorName || null;
    if (maxStudents) updates.maxStudents = parseInt(maxStudents, 10);
    if (priceOverride !== undefined) updates.priceOverride = priceOverride || null;
    if (notes !== undefined) updates.notes = notes || null;

    await updateSession(ctx.org.id, sessionId, updates);
    return redirect(redirectWithNotification(`/tenant/training/sessions/${sessionId}`, "Session has been successfully updated", "success"));
  }

  if (intent === "delete") {
    await deleteSession(ctx.org.id, sessionId);
    return redirect(redirectWithNotification("/tenant/training/sessions", "Session has been successfully deleted", "success"));
  }

  return null;
}

const statusColors: Record<string, string> = {
  scheduled: "bg-brand-muted text-brand",
  in_progress: "bg-warning-muted text-warning",
  completed: "bg-success-muted text-success",
  cancelled: "bg-danger-muted text-danger",
};

const enrollmentStatusColors: Record<string, string> = {
  enrolled: "bg-brand-muted text-brand",
  in_progress: "bg-warning-muted text-warning",
  completed: "bg-success-muted text-success",
  withdrawn: "bg-surface-inset text-foreground-muted",
  failed: "bg-danger-muted text-danger",
};

export default function SessionDetailPage() {
  useNotification();
  const t = useT();

  const { session, enrollments } = useLoaderData<typeof loader>();
  const fetcher = useCsrfFetcher<{ error?: string }>();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const statusLabels: Record<string, string> = {
    scheduled: t("tenant.training.sessions.statusScheduled"),
    in_progress: t("tenant.training.sessions.statusInProgress"),
    completed: t("tenant.training.sessions.statusCompleted"),
    cancelled: t("tenant.training.sessions.statusCancelled"),
  };

  const paymentStatusLabels: Record<string, string> = {
    paid: t("tenant.training.sessions.paymentPaid"),
    partial: t("tenant.training.sessions.paymentPartial"),
    pending: t("tenant.training.sessions.paymentPending"),
    refunded: t("tenant.training.sessions.paymentRefunded"),
  };

  const enrollmentStatusLabels: Record<string, string> = {
    enrolled: t("tenant.training.sessions.enrollmentEnrolled"),
    in_progress: t("tenant.training.sessions.statusInProgress"),
    completed: t("tenant.training.sessions.statusCompleted"),
    withdrawn: t("tenant.training.sessions.enrollmentWithdrawn"),
    dropped: t("tenant.training.sessions.enrollmentDropped"),
    failed: t("tenant.training.sessions.enrollmentFailed"),
  };

  // If maxStudents is null/undefined, treat as unlimited (no calculation needed)
  const spotsAvailable = session.maxStudents ? session.maxStudents - (session.enrolledCount || 0) : null;
  const sessionPrice = session.priceOverride || session.coursePrice || "0";

  const handleStatusChange = (newStatus: string) => {
    fetcher.submit(
      { intent: "update-status", status: newStatus },
      { method: "post" }
    );
  };

  const handleDelete = () => {
    if (enrollments.length > 0) {
      alert(t("tenant.training.sessions.cannotDeleteWithStudents"));
      return;
    }
    fetcher.submit({ intent: "delete" }, { method: "post" });
    setShowDeleteConfirm(false);
  };

  const sessionDate = new Date(session.startDate + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <div className="mb-6">
        <Link to="/tenant/training/sessions" className="text-brand hover:underline text-sm">
          &larr; {t("tenant.training.sessions.backToSessions")}
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{session.courseName}</h1>
            <span
              className={`text-sm px-3 py-1 rounded-full ${
                statusColors[session.status] || "bg-surface-inset text-foreground"
              }`}
            >
              {statusLabels[session.status] || session.status}
            </span>
          </div>
          <p className="text-foreground-muted">
            {sessionDate}
            {session.startTime && ` ${t("tenant.training.sessions.at")} ${(() => { const [h, m] = session.startTime.split(":"); const hr = parseInt(h, 10); return `${hr === 0 ? 12 : hr > 12 ? hr - 12 : hr}:${m || "00"} ${hr >= 12 ? "PM" : "AM"}`; })()}`}
          </p>
          {session.agencyName && (
            <p className="text-sm text-foreground-muted mt-1">
              {session.agencyName}
              {session.levelName && ` - ${session.levelName}`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {session.status !== "cancelled" && session.status !== "completed" && (spotsAvailable === null || spotsAvailable > 0) && (
            <Link
              to={`/tenant/training/enrollments/new?sessionId=${session.id}`}
              className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
            >
              {t("tenant.training.sessions.enrollStudent")}
            </Link>
          )}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {isEditing ? t("tenant.training.sessions.cancelEdit") : t("common.edit")}
          </button>
          {session.status !== "cancelled" && session.status !== "completed" && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 text-danger border border-danger rounded-lg hover:bg-danger-muted"
            >
              {t("common.delete")}
            </button>
          )}
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
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">
                {session.enrolledCount || 0}{session.maxStudents ? `/${session.maxStudents}` : ""}
              </p>
              <p className="text-foreground-muted text-sm">{t("tenant.training.sessions.enrolled")}</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className={`text-2xl font-bold ${spotsAvailable !== null && spotsAvailable > 0 ? "text-success" : spotsAvailable === 0 ? "text-danger" : ""}`}>
                {spotsAvailable !== null ? spotsAvailable : "∞"}
              </p>
              <p className="text-foreground-muted text-sm">{t("tenant.training.sessions.spotsLeft")}</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">${sessionPrice}</p>
              <p className="text-foreground-muted text-sm">{t("common.price")}</p>
            </div>
            <div className="bg-surface-raised rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{session.completedCount || 0}</p>
              <p className="text-foreground-muted text-sm">{t("tenant.training.sessions.certified")}</p>
            </div>
          </div>

          {/* Session Details / Edit Form */}
          {isEditing ? (
            <fetcher.Form method="post" className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <CsrfInput />
              <input type="hidden" name="intent" value="update-session" />
              <h2 className="font-semibold mb-4">{t("tenant.training.sessions.editSession")}</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("tenant.training.sessions.startDate")} *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    defaultValue={session.startDate}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("tenant.training.sessions.endDate")}
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    defaultValue={session.endDate || ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("tenant.training.sessions.startTime")}
                  </label>
                  <input
                    type="time"
                    name="startTime"
                    defaultValue={session.startTime || ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("tenant.training.sessions.maxStudents")}
                  </label>
                  <input
                    type="number"
                    name="maxStudents"
                    defaultValue={session.maxStudents || ""}
                    min="1"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("tenant.training.sessions.location")}
                  </label>
                  <input
                    type="text"
                    name="location"
                    defaultValue={session.location || ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("tenant.training.sessions.meetingPoint")}
                  </label>
                  <input
                    type="text"
                    name="meetingPoint"
                    defaultValue={session.meetingPoint || ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("tenant.training.sessions.instructorName")}
                  </label>
                  <input
                    type="text"
                    name="instructorName"
                    defaultValue={session.instructorName || ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("tenant.training.sessions.priceOverride")}
                  </label>
                  <input
                    type="text"
                    name="priceOverride"
                    defaultValue={session.priceOverride || ""}
                    placeholder={session.coursePrice ? t("tenant.training.sessions.coursePricePlaceholder", { price: session.coursePrice }) : ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t("common.notes")}
                  </label>
                  <textarea
                    name="notes"
                    defaultValue={session.notes || ""}
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
                  {fetcher.state === "submitting" ? t("common.saving") : t("common.saveChanges")}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </fetcher.Form>
          ) : (
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">{t("tenant.training.sessions.sessionDetails")}</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-foreground-muted">{t("common.date")}</p>
                  <p>
                    {sessionDate}
                    {session.endDate && session.endDate !== session.startDate && (
                      <> {t("tenant.training.sessions.toDate", { date: new Date(session.endDate + "T00:00:00").toLocaleDateString() })}</>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-foreground-muted">{t("common.time")}</p>
                  <p>{session.startTime ? (() => { const [h, m] = session.startTime!.split(":"); const hr = parseInt(h, 10); return `${hr === 0 ? 12 : hr > 12 ? hr - 12 : hr}:${String(parseInt(m, 10)).padStart(2, "0")} ${hr >= 12 ? "PM" : "AM"}`; })() : t("tenant.training.sessions.notSet")}</p>
                </div>
                <div>
                  <p className="text-foreground-muted">{t("tenant.training.sessions.course")}</p>
                  <Link to={`/tenant/training/courses/${session.courseId}`} className="text-brand hover:underline">
                    {session.courseName}
                  </Link>
                </div>
                <div>
                  <p className="text-foreground-muted">{t("common.duration")}</p>
                  <p>{session.courseDurationDays ? t("tenant.training.sessions.durationDays", { count: session.courseDurationDays }) : t("tenant.training.sessions.notSpecified")}</p>
                </div>
                <div>
                  <p className="text-foreground-muted">{t("tenant.training.sessions.instructor")}</p>
                  <p>{session.instructorName || t("tenant.training.sessions.notAssigned")}</p>
                </div>
                <div>
                  <p className="text-foreground-muted">{t("tenant.training.sessions.location")}</p>
                  <p>{session.location || t("tenant.training.sessions.notSet")}</p>
                </div>
                {session.meetingPoint && (
                  <div className="col-span-2">
                    <p className="text-foreground-muted">{t("tenant.training.sessions.meetingPoint")}</p>
                    <p>{session.meetingPoint}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {session.notes && !isEditing && (
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">{t("common.notes")}</h2>
              <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
            </div>
          )}

          {/* Enrolled Students */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">{t("tenant.training.sessions.enrolledStudents", { count: enrollments.length })}</h2>
            </div>
            {enrollments.length === 0 ? (
              <p className="text-foreground-muted text-sm">{t("tenant.training.sessions.noStudentsYet")}</p>
            ) : (
              <div className="space-y-3">
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
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {enrollment.paymentStatus && (
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              enrollment.paymentStatus === "paid"
                                ? "bg-success-muted text-success"
                                : enrollment.paymentStatus === "partial"
                                ? "bg-warning-muted text-warning"
                                : "bg-surface-inset text-foreground-muted"
                            }`}
                          >
                            {paymentStatusLabels[enrollment.paymentStatus] || enrollment.paymentStatus}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          enrollmentStatusColors[enrollment.status] || "bg-surface-inset text-foreground"
                        }`}
                      >
                        {enrollmentStatusLabels[enrollment.status] || enrollment.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Management */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("common.status")}</h2>
            <div className="space-y-2">
              {["scheduled", "in_progress", "completed", "cancelled"].map((statusOption) => (
                <button
                  key={statusOption}
                  onClick={() => handleStatusChange(statusOption)}
                  disabled={session.status === statusOption || fetcher.state === "submitting"}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    session.status === statusOption
                      ? `${statusColors[statusOption]} font-medium`
                      : "hover:bg-surface-overlay"
                  } disabled:cursor-not-allowed`}
                >
                  {statusLabels[statusOption]}
                  {session.status === statusOption && ` (${t("tenant.training.sessions.current")})`}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("common.actions")}</h2>
            <div className="space-y-2">
              <Link
                to={`/tenant/training/courses/${session.courseId}`}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-surface-inset rounded-lg"
              >
                {t("tenant.training.sessions.viewCourse")}
              </Link>
              <Link
                to="/tenant/training/enrollments"
                className="block w-full text-left px-3 py-2 text-sm hover:bg-surface-inset rounded-lg"
              >
                {t("tenant.training.sessions.allEnrollments")}
              </Link>
            </div>
          </div>

          {/* Capacity */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">{t("common.capacity")}</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t("tenant.training.sessions.maxStudents")}</span>
                <span>{session.maxStudents || t("common.unlimited")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t("tenant.training.sessions.enrolled")}</span>
                <span>{session.enrolledCount || 0}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>{t("tenant.training.sessions.available")}</span>
                <span className={spotsAvailable === 0 ? "text-danger" : spotsAvailable !== null ? "text-success" : ""}>
                  {spotsAvailable !== null ? spotsAvailable : t("common.unlimited")}
                </span>
              </div>
              {session.maxStudents && (
                <div className="mt-2 bg-surface-overlay rounded-full h-2">
                  <div
                    className="bg-brand rounded-full h-2"
                    style={{
                      width: `${Math.min(((session.enrolledCount || 0) / session.maxStudents) * 100, 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-foreground-subtle">
            <p>{t("tenant.training.sessions.created")} {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : t("tenant.training.sessions.unknown")}</p>
            {session.updatedAt && (
              <p>{t("tenant.training.sessions.updated")} {new Date(session.updatedAt).toLocaleDateString()}</p>
            )}
            <p>{t("tenant.training.sessions.sessionId")}: {session.id}</p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{t("tenant.training.sessions.deleteSession")}</h2>
            <p className="text-foreground-muted mb-6">
              {t("tenant.training.sessions.confirmDeleteMessage")}
              {enrollments.length > 0 && (
                <span className="block mt-2 text-danger">
                  {t("tenant.training.sessions.deleteWarningStudents", { count: enrollments.length })}
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-surface-inset"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={enrollments.length > 0}
                className="flex-1 px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger-hover disabled:bg-danger-muted disabled:cursor-not-allowed"
              >
                {t("tenant.training.sessions.deleteSession")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

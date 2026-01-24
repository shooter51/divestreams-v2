import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, useNavigate } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getSessionById,
  getEnrollments,
  updateSession,
  deleteSession,
  getCourses,
} from "../../../../../lib/db/training.server";

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

  return { session, enrollments, courses, isPremium: ctx.isPremium };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const sessionId = params.id!;

  if (intent === "update-status") {
    const newStatus = formData.get("status") as string;
    if (newStatus) {
      await updateSession(ctx.org.id, sessionId, { status: newStatus });
      return { success: true, message: `Session status updated to ${newStatus}` };
    }
    return { error: "Status is required" };
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
    return { success: true, message: "Session updated successfully" };
  }

  if (intent === "delete") {
    await deleteSession(ctx.org.id, sessionId);
    return { success: true, deleted: true };
  }

  return null;
}

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const enrollmentStatusColors: Record<string, string> = {
  enrolled: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  withdrawn: "bg-gray-100 text-gray-600",
  failed: "bg-red-100 text-red-700",
};

export default function SessionDetailPage() {
  const { session, enrollments, courses } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ success?: boolean; message?: string; error?: string; deleted?: boolean }>();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Redirect after delete
  if (fetcher.data?.deleted) {
    navigate("/tenant/training/sessions");
    return null;
  }

  const spotsAvailable = (session.maxStudents || 0) - (session.enrolledCount || 0);
  const sessionPrice = session.priceOverride || session.coursePrice || "0";

  const handleStatusChange = (newStatus: string) => {
    fetcher.submit(
      { intent: "update-status", status: newStatus },
      { method: "post" }
    );
  };

  const handleDelete = () => {
    if (enrollments.length > 0) {
      alert("Cannot delete session with enrolled students. Please remove all enrollments first.");
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
        <Link to="/tenant/training/sessions" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Sessions
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{session.courseName}</h1>
            <span
              className={`text-sm px-3 py-1 rounded-full ${
                statusColors[session.status] || "bg-gray-100 text-gray-700"
              }`}
            >
              {statusLabels[session.status] || session.status}
            </span>
          </div>
          <p className="text-gray-500">
            {sessionDate}
            {session.startTime && ` at ${session.startTime}`}
          </p>
          {session.agencyName && (
            <p className="text-sm text-gray-500 mt-1">
              {session.agencyName}
              {session.levelName && ` - ${session.levelName}`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {session.status !== "cancelled" && session.status !== "completed" && spotsAvailable > 0 && (
            <Link
              to={`/app/training/enrollments/new?sessionId=${session.id}`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Enroll Student
            </Link>
          )}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            {isEditing ? "Cancel Edit" : "Edit"}
          </button>
          {session.status !== "cancelled" && session.status !== "completed" && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      {fetcher.data?.success && fetcher.data?.message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {fetcher.data.message}
        </div>
      )}
      {fetcher.data?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {fetcher.data.error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">
                {session.enrolledCount || 0}/{session.maxStudents || "?"}
              </p>
              <p className="text-gray-500 text-sm">Enrolled</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold text-green-600">{spotsAvailable}</p>
              <p className="text-gray-500 text-sm">Spots Left</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">${sessionPrice}</p>
              <p className="text-gray-500 text-sm">Price</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{session.completedCount || 0}</p>
              <p className="text-gray-500 text-sm">Certified</p>
            </div>
          </div>

          {/* Session Details / Edit Form */}
          {isEditing ? (
            <fetcher.Form method="post" className="bg-white rounded-xl p-6 shadow-sm">
              <input type="hidden" name="intent" value="update-session" />
              <h2 className="font-semibold mb-4">Edit Session</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    defaultValue={session.startDate}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    defaultValue={session.endDate || ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    name="startTime"
                    defaultValue={session.startTime || ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Students
                  </label>
                  <input
                    type="number"
                    name="maxStudents"
                    defaultValue={session.maxStudents || ""}
                    min="1"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    defaultValue={session.location || ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meeting Point
                  </label>
                  <input
                    type="text"
                    name="meetingPoint"
                    defaultValue={session.meetingPoint || ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instructor Name
                  </label>
                  <input
                    type="text"
                    name="instructorName"
                    defaultValue={session.instructorName || ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price Override
                  </label>
                  <input
                    type="text"
                    name="priceOverride"
                    defaultValue={session.priceOverride || ""}
                    placeholder={session.coursePrice ? `Course price: $${session.coursePrice}` : ""}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    defaultValue={session.notes || ""}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  type="submit"
                  disabled={fetcher.state === "submitting"}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {fetcher.state === "submitting" ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </fetcher.Form>
          ) : (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Session Details</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Date</p>
                  <p>
                    {sessionDate}
                    {session.endDate && session.endDate !== session.startDate && (
                      <> to {new Date(session.endDate + "T00:00:00").toLocaleDateString()}</>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Time</p>
                  <p>{session.startTime || "Not set"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Course</p>
                  <Link to={`/app/training/courses/${session.courseId}`} className="text-blue-600 hover:underline">
                    {session.courseName}
                  </Link>
                </div>
                <div>
                  <p className="text-gray-500">Duration</p>
                  <p>{session.courseDurationDays ? `${session.courseDurationDays} days` : "Not specified"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Instructor</p>
                  <p>{session.instructorName || "Not assigned"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Location</p>
                  <p>{session.location || "Not set"}</p>
                </div>
                {session.meetingPoint && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Meeting Point</p>
                    <p>{session.meetingPoint}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {session.notes && !isEditing && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Notes</h2>
              <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
            </div>
          )}

          {/* Enrolled Students */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Enrolled Students ({enrollments.length})</h2>
              {spotsAvailable > 0 && session.status !== "cancelled" && session.status !== "completed" && (
                <Link
                  to={`/app/training/enrollments/new?sessionId=${session.id}`}
                  className="text-blue-600 text-sm hover:underline"
                >
                  + Enroll Student
                </Link>
              )}
            </div>
            {enrollments.length === 0 ? (
              <p className="text-gray-500 text-sm">No students enrolled yet.</p>
            ) : (
              <div className="space-y-3">
                {enrollments.map((enrollment) => (
                  <Link
                    key={enrollment.id}
                    to={`/app/training/enrollments/${enrollment.id}`}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-medium">
                        {enrollment.customerFirstName} {enrollment.customerLastName}
                      </p>
                      <p className="text-sm text-gray-500">{enrollment.customerEmail}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {enrollment.paymentStatus && (
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              enrollment.paymentStatus === "paid"
                                ? "bg-green-100 text-green-700"
                                : enrollment.paymentStatus === "partial"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {enrollment.paymentStatus}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          enrollmentStatusColors[enrollment.status] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {enrollment.status}
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
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Status</h2>
            <div className="space-y-2">
              {["scheduled", "in_progress", "completed", "cancelled"].map((statusOption) => (
                <button
                  key={statusOption}
                  onClick={() => handleStatusChange(statusOption)}
                  disabled={session.status === statusOption || fetcher.state === "submitting"}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    session.status === statusOption
                      ? `${statusColors[statusOption]} font-medium`
                      : "hover:bg-gray-100"
                  } disabled:cursor-not-allowed`}
                >
                  {statusLabels[statusOption]}
                  {session.status === statusOption && " (current)"}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <Link
                to={`/app/training/enrollments/new?sessionId=${session.id}`}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
              >
                Add Enrollment
              </Link>
              <Link
                to={`/app/training/courses/${session.courseId}`}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
              >
                View Course
              </Link>
              <Link
                to="/tenant/training/enrollments"
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
              >
                All Enrollments
              </Link>
            </div>
          </div>

          {/* Capacity */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Capacity</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Max Students</span>
                <span>{session.maxStudents || "Unlimited"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Enrolled</span>
                <span>{session.enrolledCount || 0}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Available</span>
                <span className={spotsAvailable === 0 ? "text-red-600" : "text-green-600"}>
                  {session.maxStudents ? spotsAvailable : "Unlimited"}
                </span>
              </div>
              {session.maxStudents && (
                <div className="mt-2 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 rounded-full h-2"
                    style={{
                      width: `${Math.min(((session.enrolledCount || 0) / session.maxStudents) * 100, 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400">
            <p>Created {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : "Unknown"}</p>
            {session.updatedAt && (
              <p>Updated {new Date(session.updatedAt).toLocaleDateString()}</p>
            )}
            <p>Session ID: {session.id}</p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Delete Session</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this training session? This action cannot be undone.
              {enrollments.length > 0 && (
                <span className="block mt-2 text-red-600">
                  Warning: This session has {enrollments.length} enrolled student(s).
                  Please remove all enrollments before deleting.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={enrollments.length > 0}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed"
              >
                Delete Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

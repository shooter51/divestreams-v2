/**
 * Session Detail Route
 *
 * Displays details for a specific training session including enrolled students,
 * attendance tracking, and skill checkoffs.
 * Part of the Training Module (premium feature).
 */

import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getCourseSessionById,
  getEnrollmentsForSession,
  getSkillCheckoffsForSession,
  updateCourseSession,
  recordSkillCheckoff,
  updateSkillCheckoff,
  deleteCourseSession,
} from "../../../../../lib/db/training.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  {
    title: data?.session?.course?.name
      ? `${data.session.course.name} Session - Training - DiveStreams`
      : "Session - Training - DiveStreams",
  },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const sessionId = params.sessionId;

  if (!sessionId) {
    throw new Response("Session ID required", { status: 400 });
  }

  // Check freemium access - training is a premium feature
  if (!ctx.isPremium) {
    return {
      hasAccess: false,
      session: null,
      enrolledStudents: [],
      skillCheckoffs: [],
      userId: null,
    };
  }

  // Get session data with course
  const session = await getCourseSessionById(ctx.org.id, sessionId);

  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }

  // Get enrolled students and skill checkoffs for this session
  const [enrolledStudents, skillCheckoffs] = await Promise.all([
    getEnrollmentsForSession(ctx.org.id, sessionId),
    getSkillCheckoffsForSession(ctx.org.id, sessionId),
  ]);

  return {
    hasAccess: true,
    session,
    enrolledStudents,
    skillCheckoffs,
    userId: ctx.user?.id || null,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const sessionId = params.sessionId!;

  if (intent === "update-status") {
    const status = formData.get("status") as string;
    await updateCourseSession(ctx.org.id, sessionId, { status });
    return { updated: true };
  }

  if (intent === "cancel") {
    await updateCourseSession(ctx.org.id, sessionId, { status: "cancelled" });
    return { cancelled: true };
  }

  if (intent === "delete") {
    await deleteCourseSession(ctx.org.id, sessionId);
    return { deleted: true };
  }

  if (intent === "record-checkoff") {
    const enrollmentId = formData.get("enrollmentId") as string;
    const skillName = formData.get("skillName") as string;
    const skillCategory = formData.get("skillCategory") as string;
    const status = formData.get("status") as string;
    const notes = formData.get("notes") as string;

    await recordSkillCheckoff(ctx.org.id, {
      enrollmentId,
      sessionId,
      skillName,
      skillCategory,
      status,
      instructorId: ctx.user?.id || "",
      notes: notes || undefined,
    });
    return { checkoffRecorded: true };
  }

  if (intent === "update-checkoff") {
    const checkoffId = formData.get("checkoffId") as string;
    const status = formData.get("status") as string;
    const notes = formData.get("notes") as string;

    await updateSkillCheckoff(ctx.org.id, checkoffId, {
      status,
      instructorId: ctx.user?.id || "",
      notes: notes || undefined,
    });
    return { checkoffUpdated: true };
  }

  return null;
}

const sessionTypeLabels: Record<string, { label: string; color: string }> = {
  classroom: { label: "Classroom", color: "bg-blue-100 text-blue-800" },
  pool: { label: "Pool", color: "bg-cyan-100 text-cyan-800" },
  open_water: { label: "Open Water", color: "bg-green-100 text-green-800" },
  confined_water: { label: "Confined Water", color: "bg-teal-100 text-teal-800" },
  exam: { label: "Exam", color: "bg-purple-100 text-purple-800" },
};

const statusColors: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Scheduled", color: "bg-yellow-100 text-yellow-800" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800" },
};

const enrollmentStatusColors: Record<string, string> = {
  pending_scheduling: "bg-yellow-100 text-yellow-800",
  scheduled: "bg-blue-100 text-blue-800",
  enrolled: "bg-green-100 text-green-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-gray-100 text-gray-800",
  certified: "bg-emerald-100 text-emerald-800",
  withdrawn: "bg-red-100 text-red-800",
};

// Sample skill list by session type - in production this would come from course config
const getSkillsForSessionType = (sessionType: string): Array<{ name: string; category: string }> => {
  const skills: Record<string, Array<{ name: string; category: string }>> = {
    pool: [
      { name: "Mask clearing", category: "basic" },
      { name: "Regulator recovery", category: "basic" },
      { name: "Buoyancy control", category: "basic" },
      { name: "Fin pivots", category: "intermediate" },
      { name: "Controlled emergency swimming ascent", category: "intermediate" },
      { name: "Buddy breathing", category: "advanced" },
    ],
    open_water: [
      { name: "Pre-dive safety check", category: "basic" },
      { name: "Controlled descent", category: "basic" },
      { name: "Neutral buoyancy", category: "intermediate" },
      { name: "Underwater navigation", category: "intermediate" },
      { name: "Emergency ascent", category: "advanced" },
      { name: "Surface marker deployment", category: "advanced" },
    ],
    confined_water: [
      { name: "Equipment assembly", category: "basic" },
      { name: "Water entry", category: "basic" },
      { name: "Breathing underwater", category: "basic" },
      { name: "Clearing a flooded mask", category: "intermediate" },
    ],
    classroom: [
      { name: "Written exam", category: "basic" },
      { name: "Theory comprehension", category: "basic" },
    ],
    exam: [
      { name: "Final exam", category: "basic" },
    ],
  };
  return skills[sessionType] || [];
};

export default function SessionDetailPage() {
  const { hasAccess, session, enrolledStudents, skillCheckoffs, userId } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  // Format time for display
  const formatTime = (time: string) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // Premium gate
  if (!hasAccess || !session) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">📅</div>
        <h1 className="text-2xl font-bold mb-4">Training Session</h1>
        <p className="text-gray-600 mb-6">
          View and manage training session details. Available on Premium plans.
        </p>
        <Link
          to="/app/settings/billing"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Upgrade to Premium
        </Link>
      </div>
    );
  }

  const handleCancel = () => {
    if (confirm("Are you sure you want to cancel this session?")) {
      fetcher.submit({ intent: "cancel" }, { method: "post" });
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this session? This cannot be undone.")) {
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  // Redirect after delete
  if (fetcher.data?.deleted) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Session deleted successfully.</p>
        <Link to="/app/training/sessions" className="text-blue-600 hover:underline">
          Return to Sessions
        </Link>
      </div>
    );
  }

  // Get skills for the session type
  const availableSkills = getSkillsForSessionType(session.session.sessionType);

  // Group checkoffs by student
  const checkoffsByStudent: Record<string, typeof skillCheckoffs> = {};
  skillCheckoffs.forEach((item) => {
    const customerId = item.customer?.id || "unknown";
    if (!checkoffsByStudent[customerId]) {
      checkoffsByStudent[customerId] = [];
    }
    checkoffsByStudent[customerId].push(item);
  });

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          to="/app/training/sessions"
          className="text-blue-600 hover:underline text-sm"
        >
          &larr; Back to Sessions
        </Link>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{session.course?.name}</h1>
            <span
              className={`inline-flex px-2 py-1 text-xs rounded-full ${
                sessionTypeLabels[session.session.sessionType]?.color ||
                "bg-gray-100 text-gray-800"
              }`}
            >
              {sessionTypeLabels[session.session.sessionType]?.label ||
                session.session.sessionType}
            </span>
            <span
              className={`inline-flex px-2 py-1 text-xs rounded-full ${
                statusColors[session.session.status]?.color ||
                "bg-gray-100 text-gray-600"
              }`}
            >
              {statusColors[session.session.status]?.label ||
                session.session.status}
            </span>
          </div>
          <p className="text-gray-500 mt-1">
            Session {session.session.sessionNumber} -{" "}
            {formatDate(session.session.scheduledDate)}
          </p>
        </div>
        <div className="flex gap-2">
          {session.session.status === "scheduled" && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="update-status" />
              <input type="hidden" name="status" value="in_progress" />
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Start Session
              </button>
            </fetcher.Form>
          )}
          {session.session.status === "in_progress" && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="update-status" />
              <input type="hidden" name="status" value="completed" />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Complete Session
              </button>
            </fetcher.Form>
          )}
          <Link
            to={`/app/training/sessions/${session.session.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Edit
          </Link>
          {session.session.status !== "cancelled" && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Session Info */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Session Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Date</p>
                <p className="font-medium">
                  {formatDate(session.session.scheduledDate)}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Time</p>
                <p className="font-medium">
                  {formatTime(session.session.startTime)}
                  {session.session.endTime && (
                    <span className="text-gray-500">
                      {" - "}
                      {formatTime(session.session.endTime)}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Type</p>
                <p className="font-medium">
                  {sessionTypeLabels[session.session.sessionType]?.label ||
                    session.session.sessionType}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Location</p>
                <p className="font-medium">
                  {session.session.location || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Max Students</p>
                <p className="font-medium">
                  {session.session.maxStudents || "No limit"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Instructors</p>
                <p className="font-medium">
                  {(session.session.instructorIds as string[] | null)?.length || 0} assigned
                </p>
              </div>
            </div>
            {session.session.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-gray-500 text-sm">Notes</p>
                <p className="text-gray-700">{session.session.notes}</p>
              </div>
            )}
          </div>

          {/* Enrolled Students */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">
                Enrolled Students ({enrolledStudents.length})
              </h2>
              <Link
                to={`/app/training/enrollments/new?courseId=${session.course?.id}`}
                className="text-blue-600 text-sm hover:underline"
              >
                + Add Student
              </Link>
            </div>
            {enrolledStudents.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No students enrolled in this course yet.
              </p>
            ) : (
              <div className="divide-y">
                {enrolledStudents.map((item: any) => {
                  const studentCheckoffs =
                    checkoffsByStudent[item.customer?.id] || [];
                  const demonstratedCount = studentCheckoffs.filter(
                    (c) => c.checkoff.status === "demonstrated"
                  ).length;

                  return (
                    <div
                      key={item.enrollment.id}
                      className="py-4 flex justify-between items-center"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/app/training/enrollments/${item.enrollment.id}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {item.customer?.firstName} {item.customer?.lastName}
                          </Link>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              enrollmentStatusColors[item.enrollment.status] ||
                              "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {item.enrollment.status.replace("_", " ")}
                          </span>
                        </div>
                        {item.customer?.email && (
                          <p className="text-sm text-gray-500">
                            {item.customer.email}
                          </p>
                        )}
                        {studentCheckoffs.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            {demonstratedCount}/{studentCheckoffs.length} skills
                            demonstrated
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedStudent(item.enrollment.id);
                            setShowSkillForm(true);
                          }}
                          className="text-sm px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                        >
                          Record Skill
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Skill Checkoffs */}
          {skillCheckoffs.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">
                Skill Checkoffs ({skillCheckoffs.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-3">Student</th>
                      <th className="text-left py-2 px-3">Skill</th>
                      <th className="text-left py-2 px-3">Category</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-left py-2 px-3">Notes</th>
                      <th className="text-right py-2 px-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {skillCheckoffs.map((item: any) => (
                      <tr key={item.checkoff.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3">
                          {item.customer?.firstName} {item.customer?.lastName}
                        </td>
                        <td className="py-2 px-3">{item.checkoff.skillName}</td>
                        <td className="py-2 px-3 capitalize">
                          {item.checkoff.skillCategory}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                              item.checkoff.status === "demonstrated"
                                ? "bg-green-100 text-green-800"
                                : item.checkoff.status === "attempted"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {item.checkoff.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-500 max-w-[150px] truncate">
                          {item.checkoff.notes || "-"}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {item.checkoff.status !== "demonstrated" && (
                            <fetcher.Form method="post" className="inline">
                              <input
                                type="hidden"
                                name="intent"
                                value="update-checkoff"
                              />
                              <input
                                type="hidden"
                                name="checkoffId"
                                value={item.checkoff.id}
                              />
                              <input
                                type="hidden"
                                name="status"
                                value="demonstrated"
                              />
                              <button
                                type="submit"
                                className="text-green-600 hover:underline text-xs"
                              >
                                Mark Demonstrated
                              </button>
                            </fetcher.Form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Skill Checkoff Form Modal */}
          {showSkillForm && selectedStudent && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4">Record Skill Checkoff</h3>
                <fetcher.Form
                  method="post"
                  onSubmit={() => {
                    setShowSkillForm(false);
                    setSelectedStudent(null);
                  }}
                >
                  <input type="hidden" name="intent" value="record-checkoff" />
                  <input
                    type="hidden"
                    name="enrollmentId"
                    value={selectedStudent}
                  />

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Skill
                      </label>
                      <select
                        name="skillName"
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a skill...</option>
                        {availableSkills.map((skill) => (
                          <option key={skill.name} value={skill.name}>
                            {skill.name} ({skill.category})
                          </option>
                        ))}
                        <option value="custom">Custom skill...</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Category
                      </label>
                      <select
                        name="skillCategory"
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="basic">Basic</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Status
                      </label>
                      <select
                        name="status"
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="not_attempted">Not Attempted</option>
                        <option value="attempted">Attempted</option>
                        <option value="demonstrated">Demonstrated</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Notes (optional)
                      </label>
                      <textarea
                        name="notes"
                        rows={2}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Any observations or comments..."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSkillForm(false);
                        setSelectedStudent(null);
                      }}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Record Checkoff
                    </button>
                  </div>
                </fetcher.Form>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {session.session.status === "scheduled" && (
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="update-status" />
                  <input type="hidden" name="status" value="in_progress" />
                  <button
                    type="submit"
                    className="w-full text-center bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    Start Session
                  </button>
                </fetcher.Form>
              )}
              {session.session.status === "in_progress" && (
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="update-status" />
                  <input type="hidden" name="status" value="completed" />
                  <button
                    type="submit"
                    className="w-full text-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Complete Session
                  </button>
                </fetcher.Form>
              )}
              <Link
                to={`/app/training/courses/${session.course?.id}`}
                className="block w-full text-center border px-4 py-2 rounded-lg hover:bg-gray-50"
              >
                View Course
              </Link>
              <Link
                to={`/app/training/enrollments/new?courseId=${session.course?.id}`}
                className="block w-full text-center border px-4 py-2 rounded-lg hover:bg-gray-50"
              >
                Enroll Student
              </Link>
            </div>
          </div>

          {/* Course Info */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Course</h2>
            <Link
              to={`/app/training/courses/${session.course?.id}`}
              className="text-blue-600 hover:underline font-medium"
            >
              {session.course?.name}
            </Link>
            <p className="text-sm text-gray-500 mt-1">
              ${Number(session.course?.price || 0).toFixed(2)}
            </p>
            <p className="text-sm text-gray-500">
              {session.course?.totalSessions || 1} total sessions
            </p>
          </div>

          {/* Available Skills */}
          {availableSkills.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Skills for this Session</h2>
              <ul className="space-y-2 text-sm">
                {availableSkills.map((skill) => (
                  <li
                    key={skill.name}
                    className="flex justify-between items-center"
                  >
                    <span>{skill.name}</span>
                    <span className="text-xs text-gray-400 capitalize">
                      {skill.category}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Meta */}
          <div className="text-xs text-gray-400">
            <p>
              Created{" "}
              {new Date(session.session.createdAt).toLocaleDateString()}
            </p>
            <p>Session ID: {session.session.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

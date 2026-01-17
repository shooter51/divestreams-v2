/**
 * Course Detail Route
 *
 * Displays details for a specific training course including
 * upcoming sessions, recent enrollments, and actions.
 * Part of the Training Module (premium feature).
 */

import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getTrainingCourseById,
  getCourseSessions,
  getEnrollments,
  deleteTrainingCourse,
  updateTrainingCourse,
} from "../../../../../lib/db/training.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.course?.course?.name ? `${data.course.course.name} - Training - DiveStreams` : "Course - Training - DiveStreams" },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const courseId = params.courseId;

  if (!courseId) {
    throw new Response("Course ID required", { status: 400 });
  }

  // Check freemium access - training is a premium feature
  if (!ctx.isPremium) {
    return {
      hasAccess: false,
      course: null,
      upcomingSessions: [],
      recentEnrollments: [],
    };
  }

  // Get course data with agency and level
  const course = await getTrainingCourseById(ctx.org.id, courseId);

  if (!course) {
    throw new Response("Course not found", { status: 404 });
  }

  // Get upcoming sessions for this course
  const allSessions = await getCourseSessions(ctx.org.id, {
    courseId,
    status: "scheduled",
  });

  // Filter to future sessions and limit to 5
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingSessions = allSessions
    .filter((s) => new Date(s.session.scheduledDate) >= today)
    .slice(0, 5);

  // Get recent enrollments for this course
  const enrollmentsData = await getEnrollments(ctx.org.id, {
    courseId,
    limit: 5,
  });

  return {
    hasAccess: true,
    course,
    upcomingSessions,
    recentEnrollments: enrollmentsData.enrollments,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const courseId = params.courseId!;

  if (intent === "toggle-active") {
    // Get current course status and toggle it
    const course = await getTrainingCourseById(ctx.org.id, courseId);
    if (course) {
      await updateTrainingCourse(ctx.org.id, courseId, {
        isActive: !course.course.isActive,
      });
    }
    return { toggled: true };
  }

  if (intent === "delete") {
    await deleteTrainingCourse(ctx.org.id, courseId);
    return { deleted: true };
  }

  return null;
}

const sessionTypeLabels: Record<string, string> = {
  classroom: "Classroom",
  pool: "Pool",
  open_water: "Open Water",
  confined_water: "Confined Water",
};

const statusColors: Record<string, string> = {
  pending_scheduling: "bg-yellow-100 text-yellow-800",
  scheduled: "bg-blue-100 text-blue-800",
  enrolled: "bg-green-100 text-green-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-gray-100 text-gray-800",
  certified: "bg-emerald-100 text-emerald-800",
  withdrawn: "bg-red-100 text-red-800",
};

export default function CourseDetailPage() {
  const { hasAccess, course, upcomingSessions, recentEnrollments } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  // Premium gate
  if (!hasAccess || !course) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">📚</div>
        <h1 className="text-2xl font-bold mb-4">Training Course</h1>
        <p className="text-gray-600 mb-6">
          View and manage training course details. Available on Premium plans.
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

  const handleDelete = () => {
    if (
      confirm(
        "Are you sure you want to delete this course? This cannot be undone."
      )
    ) {
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  // Redirect after delete
  if (fetcher.data?.deleted) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Course deleted successfully.</p>
        <Link to="/app/training/courses" className="text-blue-600 hover:underline">
          Return to Courses
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          to="/app/training/courses"
          className="text-blue-600 hover:underline text-sm"
        >
          &larr; Back to Courses
        </Link>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{course.course.name}</h1>
            {!course.course.isActive && (
              <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">
                Inactive
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {course.agency?.name && (
              <span className="inline-flex px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                {course.agency.name}
              </span>
            )}
            {course.level?.name && (
              <span className="inline-flex px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                {course.level.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/app/training/courses/${course.course.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Edit
          </Link>
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
          {/* Description */}
          {course.course.description && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-3">Description</h2>
              <p className="text-gray-700">{course.course.description}</p>
            </div>
          )}

          {/* Course Details */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Course Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Price</p>
                <p className="font-medium">
                  ${Number(course.course.price || 0).toFixed(2)}
                </p>
              </div>
              {course.course.depositAmount && (
                <div>
                  <p className="text-gray-500">Deposit</p>
                  <p className="font-medium">
                    ${Number(course.course.depositAmount).toFixed(2)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-gray-500">Max Students</p>
                <p className="font-medium">{course.course.maxStudents || "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-500">Schedule Type</p>
                <p className="font-medium capitalize">
                  {course.course.scheduleType?.replace("_", " ") || "Fixed"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Total Sessions</p>
                <p className="font-medium">{course.course.totalSessions || 1}</p>
              </div>
              <div>
                <p className="text-gray-500">Min Instructors</p>
                <p className="font-medium">{course.course.minInstructors || 1}</p>
              </div>
              {course.course.hasExam && (
                <>
                  <div>
                    <p className="text-gray-500">Has Exam</p>
                    <p className="font-medium">Yes</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Pass Score</p>
                    <p className="font-medium">{course.course.examPassScore || 75}%</p>
                  </div>
                </>
              )}
              {course.course.minOpenWaterDives && (
                <div>
                  <p className="text-gray-500">Min Open Water Dives</p>
                  <p className="font-medium">{course.course.minOpenWaterDives}</p>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Sessions */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Upcoming Sessions</h2>
              <Link
                to={`/app/training/sessions/new?courseId=${course.course.id}`}
                className="text-blue-600 text-sm hover:underline"
              >
                + Add Session
              </Link>
            </div>
            {upcomingSessions.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No upcoming sessions scheduled.
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingSessions.map((item: any) => (
                  <Link
                    key={item.session.id}
                    to={`/app/training/sessions/${item.session.id}`}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(item.session.scheduledDate).toLocaleDateString()}{" "}
                        at {item.session.startTime}
                      </p>
                      <p className="text-sm text-gray-500">
                        {sessionTypeLabels[item.session.sessionType] ||
                          item.session.sessionType}{" "}
                        {item.session.location && `- ${item.session.location}`}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        item.session.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : item.session.status === "cancelled"
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {item.session.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent Enrollments */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Recent Enrollments</h2>
              <Link
                to={`/app/training/enrollments/new?courseId=${course.course.id}`}
                className="text-blue-600 text-sm hover:underline"
              >
                + Add Enrollment
              </Link>
            </div>
            {recentEnrollments.length === 0 ? (
              <p className="text-gray-500 text-sm">No enrollments yet.</p>
            ) : (
              <div className="space-y-3">
                {recentEnrollments.map((item: any) => (
                  <Link
                    key={item.enrollment.id}
                    to={`/app/training/enrollments/${item.enrollment.id}`}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-medium">
                        {item.customer?.firstName} {item.customer?.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        Enrolled{" "}
                        {new Date(item.enrollment.enrolledAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        statusColors[item.enrollment.status] ||
                        "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {item.enrollment.status.replace("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            {recentEnrollments.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Link
                  to={`/app/training/enrollments?courseId=${course.course.id}`}
                  className="text-blue-600 text-sm hover:underline"
                >
                  View all enrollments &rarr;
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                to={`/app/training/sessions/new?courseId=${course.course.id}`}
                className="block w-full text-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Schedule Session
              </Link>
              <Link
                to={`/app/training/enrollments/new?courseId=${course.course.id}`}
                className="block w-full text-center border px-4 py-2 rounded-lg hover:bg-gray-50"
              >
                Enroll Student
              </Link>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="toggle-active" />
                <button
                  type="submit"
                  className="w-full text-center border px-4 py-2 rounded-lg hover:bg-gray-50"
                >
                  {course.course.isActive ? "Deactivate Course" : "Activate Course"}
                </button>
              </fetcher.Form>
            </div>
          </div>

          {/* Agency & Level Info */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Certification</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500">Agency</p>
                <p className="font-medium">{course.agency?.name || "N/A"}</p>
                {course.agency?.code && (
                  <p className="text-xs text-gray-400">{course.agency.code}</p>
                )}
              </div>
              <div>
                <p className="text-gray-500">Certification Level</p>
                <p className="font-medium">{course.level?.name || "N/A"}</p>
                {course.level?.code && (
                  <p className="text-xs text-gray-400">{course.level.code}</p>
                )}
              </div>
              {course.level?.description && (
                <div>
                  <p className="text-gray-500">Level Description</p>
                  <p className="text-gray-700 text-xs">
                    {course.level.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400">
            <p>
              Created{" "}
              {new Date(course.course.createdAt).toLocaleDateString()}
            </p>
            <p>Course ID: {course.course.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

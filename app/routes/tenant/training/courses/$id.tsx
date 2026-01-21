import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, Link, useFetcher } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import {
  getCourseById,
  getSessions,
  deleteCourse,
  updateCourse,
} from "../../../../../lib/db/training.server";

export const meta: MetaFunction = () => [{ title: "Course Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const courseId = params.id;

  if (!courseId) {
    throw new Response("Course ID required", { status: 400 });
  }

  const course = await getCourseById(ctx.org.id, courseId);

  if (!course) {
    throw new Response("Course not found", { status: 404 });
  }

  // Get sessions for this course
  const sessions = await getSessions(ctx.org.id, { courseId });

  return { course, sessions };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const courseId = params.id!;

  if (intent === "toggle-active") {
    const course = await getCourseById(ctx.org.id, courseId);
    if (course) {
      await updateCourse(ctx.org.id, courseId, { isActive: !course.isActive });
    }
    return { toggled: true };
  }

  if (intent === "delete") {
    await deleteCourse(ctx.org.id, courseId);
    return redirect("/app/training/courses");
  }

  return null;
}

export default function CourseDetailPage() {
  const { course, sessions } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const handleDelete = () => {
    if (
      confirm(
        "Are you sure you want to delete this course? This cannot be undone."
      )
    ) {
      fetcher.submit({ intent: "delete" }, { method: "post" });
    }
  };

  // Calculate session stats
  const upcomingSessions = sessions.filter(
    (s) => s.status === "scheduled" && new Date(s.startDate) >= new Date()
  );
  const totalEnrolled = sessions.reduce((sum, s) => sum + (s.enrolledCount || 0), 0);

  return (
    <div>
      <div className="mb-6">
        <Link to="/app/training/courses" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Courses
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{course.name}</h1>
            {course.code && (
              <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {course.code}
              </span>
            )}
            {!course.isActive && (
              <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">
                Inactive
              </span>
            )}
          </div>
          <p className="text-gray-500">
            {course.agencyName || "No Agency"} - {course.levelName || "No Level"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/app/training/sessions/new?courseId=${course.id}`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Schedule Session
          </Link>
          <Link
            to={`/app/training/courses/${course.id}/edit`}
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
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">
                ${Number(course.price).toFixed(2)}
              </p>
              <p className="text-gray-500 text-sm">Price ({course.currency})</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{course.durationDays || 0}</p>
              <p className="text-gray-500 text-sm">Days</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{upcomingSessions.length}</p>
              <p className="text-gray-500 text-sm">Upcoming Sessions</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-2xl font-bold">{totalEnrolled}</p>
              <p className="text-gray-500 text-sm">Total Enrolled</p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-3">Description</h2>
            <p className="text-gray-700">
              {course.description || "No description provided."}
            </p>
          </div>

          {/* Course Structure */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Course Structure</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Classroom Hours</p>
                <p>{course.classroomHours ?? "Not specified"}</p>
              </div>
              <div>
                <p className="text-gray-500">Pool/Confined Water Hours</p>
                <p>{course.poolHours ?? "Not specified"}</p>
              </div>
              <div>
                <p className="text-gray-500">Open Water Dives</p>
                <p>{course.openWaterDives ?? "Not specified"}</p>
              </div>
              <div>
                <p className="text-gray-500">Max Students</p>
                <p>{course.maxStudents || "Not specified"}</p>
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Requirements</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Minimum Age</p>
                <p>{course.minAge ? `${course.minAge} years` : "No minimum"}</p>
              </div>
              <div>
                <p className="text-gray-500">Required Certification</p>
                <p>{course.requiredCertLevel || "None required"}</p>
              </div>
            </div>
            {course.prerequisites && (
              <div className="mt-4">
                <p className="text-gray-500 text-sm">Prerequisites</p>
                <p className="text-sm">{course.prerequisites}</p>
              </div>
            )}
            {course.medicalRequirements && (
              <div className="mt-4">
                <p className="text-gray-500 text-sm">Medical Requirements</p>
                <p className="text-sm">{course.medicalRequirements}</p>
              </div>
            )}
          </div>

          {/* Sessions List */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Sessions</h2>
              <Link
                to={`/app/training/sessions?courseId=${course.id}`}
                className="text-blue-600 text-sm hover:underline"
              >
                View all
              </Link>
            </div>
            {sessions.length === 0 ? (
              <p className="text-gray-500 text-sm">No sessions scheduled yet.</p>
            ) : (
              <div className="space-y-3">
                {sessions.slice(0, 5).map((session) => (
                  <Link
                    key={session.id}
                    to={`/app/training/sessions/${session.id}`}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(session.startDate).toLocaleDateString()}
                        {session.startTime && ` at ${session.startTime}`}
                      </p>
                      <p className="text-sm text-gray-500">
                        {session.location || "Location TBD"}
                        {session.instructorName && ` - ${session.instructorName}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {session.enrolledCount || 0}/{session.maxStudents || course.maxStudents || "?"}{" "}
                        students
                      </p>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          session.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : session.status === "cancelled"
                            ? "bg-red-100 text-red-700"
                            : session.status === "in_progress"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {session.status}
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
          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                to={`/app/training/sessions/new?courseId=${course.id}`}
                className="block w-full text-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Schedule Session
              </Link>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="toggle-active" />
                <button
                  type="submit"
                  className="w-full text-center border px-4 py-2 rounded-lg hover:bg-gray-50"
                >
                  {course.isActive ? "Deactivate Course" : "Activate Course"}
                </button>
              </fetcher.Form>
            </div>
          </div>

          {/* Included Items */}
          {(course.materialsIncluded ||
            course.equipmentIncluded ||
            (course.includedItems && course.includedItems.length > 0)) && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">What's Included</h2>
              <ul className="space-y-2 text-sm">
                {course.materialsIncluded && (
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">&#10003;</span>
                    Course Materials
                  </li>
                )}
                {course.equipmentIncluded && (
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">&#10003;</span>
                    Equipment
                  </li>
                )}
                {course.includedItems?.map((item: string, i: number) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-green-500">&#10003;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Required Items */}
          {course.requiredItems && course.requiredItems.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Students Must Bring</h2>
              <ul className="space-y-2 text-sm">
                {course.requiredItems.map((item: string, i: number) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-gray-400">&#8226;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Meta */}
          <div className="text-xs text-gray-400">
            <p>
              Created{" "}
              {course.createdAt
                ? new Date(course.createdAt).toLocaleDateString()
                : "Unknown"}
            </p>
            {course.updatedAt && (
              <p>
                Updated {new Date(course.updatedAt).toLocaleDateString()}
              </p>
            )}
            <p>Course ID: {course.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

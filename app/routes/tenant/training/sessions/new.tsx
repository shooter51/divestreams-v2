import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getCourseById, getCourses, createSession } from "../../../../../lib/db/training.server";

export const meta: MetaFunction = () => [{ title: "Schedule Session - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const url = new URL(request.url);
  const courseId = url.searchParams.get("courseId");

  // Get all courses for dropdown
  const courses = await getCourses(ctx.org.id);

  // If a courseId is provided, get that course's details
  let selectedCourse = null;
  if (courseId) {
    selectedCourse = await getCourseById(ctx.org.id, courseId);
  }

  return { courses, selectedCourse, courseId };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();

  const courseId = formData.get("courseId") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const startTime = formData.get("startTime") as string;
  const location = formData.get("location") as string;
  const meetingPoint = formData.get("meetingPoint") as string;
  const instructorName = formData.get("instructorName") as string;
  const maxStudents = formData.get("maxStudents") as string;
  const priceOverride = formData.get("priceOverride") as string;
  const notes = formData.get("notes") as string;

  // Validation
  const errors: Record<string, string> = {};

  if (!courseId) {
    errors.courseId = "Please select a course";
  }

  if (!startDate) {
    errors.startDate = "Start date is required";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  // Create the session
  const session = await createSession({
    organizationId: ctx.org.id,
    courseId,
    startDate,
    endDate: endDate || undefined,
    startTime: startTime || undefined,
    location: location || undefined,
    meetingPoint: meetingPoint || undefined,
    instructorName: instructorName || undefined,
    maxStudents: maxStudents ? parseInt(maxStudents) : undefined,
    priceOverride: priceOverride || undefined,
    notes: notes || undefined,
    status: "scheduled",
  });

  return redirect(`/app/training/sessions/${session.id}`);
}

export default function NewSessionPage() {
  const { courses, selectedCourse, courseId } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Get tomorrow's date as default
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split("T")[0];

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/app/training/sessions" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Sessions
        </Link>
        <h1 className="text-2xl font-bold mt-2">Schedule Training Session</h1>
        {selectedCourse && (
          <p className="text-gray-500">
            Creating session for: <strong>{selectedCourse.name}</strong>
          </p>
        )}
      </div>

      <form method="post" className="space-y-6">
        {/* Course Selection */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Course</h2>

          <div>
            <label htmlFor="courseId" className="block text-sm font-medium mb-1">
              Select Course *
            </label>
            <select
              id="courseId"
              name="courseId"
              required
              defaultValue={courseId || ""}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a course...</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name} {course.agencyName ? `(${course.agencyName})` : ""}
                </option>
              ))}
            </select>
            {actionData?.errors?.courseId && (
              <p className="text-red-500 text-sm mt-1">{actionData.errors.courseId}</p>
            )}
          </div>

          {selectedCourse && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
              <p><strong>Duration:</strong> {selectedCourse.durationDays || 1} day(s)</p>
              <p><strong>Price:</strong> ${Number(selectedCourse.price).toFixed(2)}</p>
              {selectedCourse.maxStudents && (
                <p><strong>Default Max Students:</strong> {selectedCourse.maxStudents}</p>
              )}
            </div>
          )}
        </div>

        {/* Date & Time */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Date & Time</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium mb-1">
                Start Date *
              </label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                required
                defaultValue={defaultDate}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {actionData?.errors?.startDate && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.startDate}</p>
              )}
            </div>

            <div>
              <label htmlFor="endDate" className="block text-sm font-medium mb-1">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Leave blank for single-day sessions</p>
            </div>

            <div>
              <label htmlFor="startTime" className="block text-sm font-medium mb-1">
                Start Time
              </label>
              <input
                type="time"
                id="startTime"
                name="startTime"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Location</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="location" className="block text-sm font-medium mb-1">
                Location / Venue
              </label>
              <input
                type="text"
                id="location"
                name="location"
                placeholder="e.g., Main Dive Center, Beach Site A"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="meetingPoint" className="block text-sm font-medium mb-1">
                Meeting Point
              </label>
              <input
                type="text"
                id="meetingPoint"
                name="meetingPoint"
                placeholder="e.g., Front desk at 8:00 AM"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Instructor & Capacity */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Instructor & Capacity</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="instructorName" className="block text-sm font-medium mb-1">
                Instructor Name
              </label>
              <input
                type="text"
                id="instructorName"
                name="instructorName"
                placeholder="Instructor name"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="maxStudents" className="block text-sm font-medium mb-1">
                Max Students
              </label>
              <input
                type="number"
                id="maxStudents"
                name="maxStudents"
                min="1"
                placeholder={selectedCourse?.maxStudents?.toString() || "8"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Leave blank to use course default</p>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Pricing</h2>

          <div>
            <label htmlFor="priceOverride" className="block text-sm font-medium mb-1">
              Price Override
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                id="priceOverride"
                name="priceOverride"
                min="0"
                step="0.01"
                placeholder={selectedCourse ? Number(selectedCourse.price).toFixed(2) : "0.00"}
                className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Leave blank to use course price
              {selectedCourse && ` ($${Number(selectedCourse.price).toFixed(2)})`}
            </p>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Additional Notes</h2>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium mb-1">
              Internal Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Any additional notes for this session..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? "Creating..." : "Create Session"}
          </button>
          <Link
            to="/app/training/sessions"
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

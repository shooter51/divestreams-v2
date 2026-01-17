/**
 * Course Detail for Booking Widget
 *
 * Displays course information and enrollment button.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link, useOutletContext } from "react-router";
import {
  getOrganizationBySlug,
  getPublicCourseById,
} from "../../../lib/db/queries.public";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  {
    title: data?.course
      ? `${data.course.name} - Enroll Now`
      : "Course Details",
  },
];

export async function loader({ params }: LoaderFunctionArgs) {
  const { tenant: subdomain, courseId } = params;
  if (!subdomain || !courseId) {
    throw new Response("Not found", { status: 404 });
  }

  const org = await getOrganizationBySlug(subdomain);
  if (!org) {
    throw new Response("Shop not found", { status: 404 });
  }

  const course = await getPublicCourseById(org.id, courseId);
  if (!course) {
    throw new Response("Course not found", { status: 404 });
  }

  return { course, tenantSlug: subdomain };
}

function formatPrice(price: string, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(parseFloat(price));
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

const sessionTypeLabels: Record<string, string> = {
  classroom: "Classroom",
  pool: "Confined Water",
  open_water: "Open Water",
};

export default function CourseDetailPage() {
  const { course, tenantSlug } = useLoaderData<typeof loader>();
  const { branding } = useOutletContext<{
    organization: { slug: string };
    branding: { primaryColor: string };
  }>();

  return (
    <div>
      {/* Back link */}
      <Link
        to={`/embed/${tenantSlug}/courses`}
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <svg
          className="w-4 h-4 mr-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Courses
      </Link>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Column - Course Details */}
        <div className="md:col-span-2">
          {/* Agency and Level badges */}
          <div className="flex items-center gap-3 mb-4">
            {course.agencyLogo ? (
              <img
                src={course.agencyLogo}
                alt={course.agencyName}
                className="h-8 object-contain"
              />
            ) : (
              <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded">
                {course.agencyCode}
              </span>
            )}
            <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded font-medium">
              {course.levelName}
            </span>
          </div>

          <h1 className="text-2xl font-bold mb-4">{course.name}</h1>

          {course.description && (
            <div className="prose prose-sm max-w-none text-gray-600 mb-6">
              <p>{course.description}</p>
            </div>
          )}

          {/* Course Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {course.totalSessions}
              </div>
              <div className="text-sm text-gray-500">Sessions</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {course.maxStudents}
              </div>
              <div className="text-sm text-gray-500">Max Students</div>
            </div>
            {course.hasExam && (
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-700">
                  <svg
                    className="w-6 h-6 mx-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="text-sm text-purple-600">Written Exam</div>
              </div>
            )}
            {course.minOpenWaterDives > 0 && (
              <div className="bg-cyan-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-cyan-700">
                  {course.minOpenWaterDives}
                </div>
                <div className="text-sm text-cyan-600">Open Water Dives</div>
              </div>
            )}
          </div>

          {/* What's Included */}
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-3">What You'll Learn</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-gray-600">
                <svg
                  className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Comprehensive dive theory and safety procedures
              </li>
              <li className="flex items-start gap-2 text-gray-600">
                <svg
                  className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Hands-on confined water skill development
              </li>
              {course.minOpenWaterDives > 0 && (
                <li className="flex items-start gap-2 text-gray-600">
                  <svg
                    className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {course.minOpenWaterDives} open water training dive
                  {course.minOpenWaterDives !== 1 ? "s" : ""}
                </li>
              )}
              <li className="flex items-start gap-2 text-gray-600">
                <svg
                  className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {course.agencyCode} {course.levelName} certification upon
                completion
              </li>
            </ul>
          </div>

          {/* Upcoming Sessions */}
          {course.upcomingSessions.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3">Upcoming Sessions</h3>
              <div className="space-y-2">
                {course.upcomingSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">
                        {sessionTypeLabels[session.sessionType] ||
                          session.sessionType}
                        {session.sessionNumber > 1 &&
                          ` #${session.sessionNumber}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(session.scheduledDate)} at{" "}
                        {formatTime(session.startTime)}
                        {session.endTime &&
                          ` - ${formatTime(session.endTime)}`}
                        {session.location && ` | ${session.location}`}
                      </div>
                    </div>
                    <span
                      className={`text-sm px-2 py-1 rounded ${
                        session.availableSpots > 0
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {session.availableSpots > 0
                        ? `${session.availableSpots} spots`
                        : "Full"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Enrollment Card */}
        <div>
          <div className="bg-gray-50 rounded-lg p-6 sticky top-4">
            <div className="flex items-baseline justify-between mb-2">
              <span
                className="text-3xl font-bold"
                style={{ color: branding.primaryColor }}
              >
                {formatPrice(course.price, course.currency)}
              </span>
            </div>

            {course.depositAmount && (
              <p className="text-sm text-gray-600 mb-4">
                Deposit:{" "}
                {formatPrice(course.depositAmount, course.currency)} due at
                enrollment
              </p>
            )}

            <div className="border-t pt-4 mb-4">
              <h4 className="font-medium mb-2">Course Includes:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {course.totalSessions} training session
                  {course.totalSessions !== 1 ? "s" : ""}
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Professional instruction
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {course.agencyCode} certification fees
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Digital learning materials
                </li>
              </ul>
            </div>

            <Link
              to={`/embed/${tenantSlug}/courses/${course.id}/enroll`}
              className="block w-full text-center py-3 rounded-lg text-white font-semibold transition-colors"
              style={{ backgroundColor: branding.primaryColor }}
            >
              Enroll Now
            </Link>

            <p className="text-xs text-gray-500 text-center mt-4">
              {course.scheduleType === "on_demand"
                ? "Flexible scheduling available"
                : "Contact us to schedule your sessions"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

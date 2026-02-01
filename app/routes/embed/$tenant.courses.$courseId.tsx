/**
 * Course Detail for Booking Widget
 *
 * Displays course information with available training sessions.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link, useOutletContext } from "react-router";
import { useState, useEffect } from "react";
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

function formatTime(timeString: string | null): string {
  if (!timeString) return "";
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export default function CourseDetailPage() {
  const { course, tenantSlug } = useLoaderData<typeof loader>();
  const { branding } = useOutletContext<{
    organization: { slug: string };
    branding: { primaryColor: string };
  }>();

  // Session selection state
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );

  // Auto-select single session for better UX
  useEffect(() => {
    if (course.upcomingSessions.length === 1 && !selectedSessionId) {
      setSelectedSessionId(course.upcomingSessions[0].id);
    }
  }, [course.upcomingSessions, selectedSessionId]);

  const totalHours = (course.classroomHours || 0) + (course.poolHours || 0);
  const totalDives = course.openWaterDives || 0;

  return (
    <div>
      {/* Back link */}
      <Link
        to={`/embed/${tenantSlug}/courses`}
        className="inline-flex items-center text-sm text-foreground-muted hover:text-foreground mb-4"
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
              <span className="text-sm font-semibold text-foreground bg-surface-overlay px-3 py-1 rounded">
                {course.agencyCode}
              </span>
            )}
            <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded font-medium">
              {course.levelName}
            </span>
          </div>

          <h1 className="text-2xl font-bold mb-4">{course.name}</h1>

          {course.description && (
            <div className="prose prose-sm max-w-none text-foreground-muted mb-6">
              <p>{course.description}</p>
            </div>
          )}

          {/* Course Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-surface-inset rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-foreground">
                {course.durationDays}
              </div>
              <div className="text-sm text-foreground-muted">Days</div>
            </div>
            <div className="bg-surface-inset rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-foreground">
                {course.maxStudents}
              </div>
              <div className="text-sm text-foreground-muted">Max Students</div>
            </div>
            {totalHours > 0 && (
              <div className="bg-info-muted rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-info">
                  {totalHours}
                </div>
                <div className="text-sm text-info">Training Hours</div>
              </div>
            )}
            {totalDives > 0 && (
              <div className="bg-cyan-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-cyan-700">
                  {totalDives}
                </div>
                <div className="text-sm text-cyan-600">Open Water Dives</div>
              </div>
            )}
          </div>

          {/* What's Included */}
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-3">What You'll Learn</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-foreground-muted">
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
              {course.classroomHours > 0 && (
                <li className="flex items-start gap-2 text-foreground-muted">
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
                  {course.classroomHours} hours of classroom instruction
                </li>
              )}
              {course.poolHours > 0 && (
                <li className="flex items-start gap-2 text-foreground-muted">
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
                  {course.poolHours} hours of confined water skill development
                </li>
              )}
              {totalDives > 0 && (
                <li className="flex items-start gap-2 text-foreground-muted">
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
                  {totalDives} open water training dive{totalDives !== 1 ? "s" : ""}
                </li>
              )}
              <li className="flex items-start gap-2 text-foreground-muted">
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
              <h3 className="font-semibold text-lg mb-3">
                Available Training Sessions
              </h3>
              <div className="space-y-2">
                {course.upcomingSessions.map((session) => {
                  const isSelected = selectedSessionId === session.id;
                  const handleSelect = (e: React.MouseEvent | React.KeyboardEvent) => {
                    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') {
                      return;
                    }
                    if ('key' in e) {
                      e.preventDefault();
                    }
                    setSelectedSessionId(session.id);
                  };

                  return (
                  <div
                    key={session.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select session on ${formatDate(session.startDate)}`}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isSelected ? 'bg-blue-50' : 'bg-surface-inset hover:bg-surface-overlay'
                    }`}
                    style={{
                      borderColor: isSelected ? branding.primaryColor : "#e5e7eb",
                    }}
                    onClick={handleSelect}
                    onKeyDown={handleSelect}
                  >
                    <div>
                      <div className="font-medium">
                        {formatDate(session.startDate)}
                        {session.endDate && session.endDate !== session.startDate &&
                          ` - ${formatDate(session.endDate)}`}
                      </div>
                      <div className="text-sm text-foreground-muted">
                        {session.startTime && formatTime(session.startTime)}
                        {session.location && ` | ${session.location}`}
                        {session.instructorName && ` | ${session.instructorName}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
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
                      {isSelected && (
                        <svg
                          className="w-6 h-6 text-green-500"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
          )}

          {course.upcomingSessions.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                No upcoming sessions scheduled at this time. Please contact us for
                more information about future course dates.
              </p>
            </div>
          )}
        </div>

        {/* Right Column - Enrollment Card */}
        <div>
          <div className="bg-surface-inset rounded-lg p-6 sticky top-4">
            <div className="flex items-baseline justify-between mb-2">
              <span
                className="text-3xl font-bold"
                style={{ color: branding.primaryColor }}
              >
                {formatPrice(course.price, course.currency)}
              </span>
            </div>

            {course.depositAmount && (
              <p className="text-sm text-foreground-muted mb-4">
                Deposit:{" "}
                {formatPrice(course.depositAmount, course.currency)} due at
                enrollment
              </p>
            )}

            <div className="border-t pt-4 mb-4">
              <h4 className="font-medium mb-2">Course Includes:</h4>
              <ul className="text-sm text-foreground-muted space-y-1">
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
                  {course.durationDays} day{course.durationDays !== 1 ? "s" : ""}{" "}
                  of training
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

            {course.upcomingSessions.length > 0 ? (
              selectedSessionId ? (
                <Link
                  to={`/embed/${tenantSlug}/courses/${course.id}/enroll?sessionId=${selectedSessionId}`}
                  className="w-full py-3 text-white font-semibold rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  Enroll Now
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              ) : (
                <>
                  <button
                    disabled
                    aria-disabled="true"
                    aria-describedby="enroll-helper-text-embed"
                    className="w-full py-3 text-white font-semibold rounded-lg opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ backgroundColor: branding.primaryColor }}
                  >
                    Enroll Now
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </button>
                  <p id="enroll-helper-text-embed" className="mt-2 text-sm text-center opacity-75">
                    Select a session below to enroll
                  </p>
                </>
              )
            ) : (
              <Link
                to={`/embed/${tenantSlug}/contact`}
                className="w-full py-3 text-white font-semibold rounded-lg flex items-center justify-center gap-2"
                style={{ backgroundColor: branding.primaryColor }}
              >
                Contact Us
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

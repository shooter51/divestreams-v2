/**
 * Enrollment Confirmation Page for Widget
 *
 * Displays enrollment confirmation details after successful registration.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link, useOutletContext } from "react-router";
import { getOrganizationBySlug } from "../../../lib/db/queries.public";
import { getEnrollmentDetails } from "../../../lib/db/mutations.public";

export const meta: MetaFunction = () => [
  { title: "Enrollment Confirmed - Thank You!" },
];

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { tenant: subdomain } = params;
  if (!subdomain) {
    throw new Response("Not found", { status: 404 });
  }

  const org = await getOrganizationBySlug(subdomain);
  if (!org) {
    throw new Response("Shop not found", { status: 404 });
  }

  // Get enrollmentId from query params
  const url = new URL(request.url);
  const enrollmentId = url.searchParams.get("enrollmentId");

  if (!enrollmentId) {
    throw new Response("No enrollment ID provided", { status: 400 });
  }

  const enrollment = await getEnrollmentDetails(org.id, enrollmentId);
  if (!enrollment) {
    throw new Response("Enrollment not found", { status: 404 });
  }

  return {
    enrollment,
    tenantSlug: subdomain,
  };
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
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
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

function formatDateTime(dateTimeString: string): string {
  const date = new Date(dateTimeString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function EnrollmentConfirmationPage() {
  const { enrollment, tenantSlug } = useLoaderData<typeof loader>();
  const { branding } = useOutletContext<{
    organization: { slug: string };
    branding: { primaryColor: string };
  }>();

  const enrollmentRef = enrollment.id.substring(0, 8).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: branding.primaryColor }}
        >
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold mb-2">Enrollment Confirmed!</h1>
        <p className="text-gray-600">
          Thank you for enrolling. We've received your registration and sent a
          confirmation email.
        </p>
      </div>

      {/* Enrollment Reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-600 font-medium">
              Enrollment Reference
            </p>
            <p className="text-2xl font-mono font-bold text-blue-900">
              {enrollmentRef}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-600">Status</p>
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                enrollment.status === "enrolled"
                  ? "bg-green-100 text-green-700"
                  : enrollment.status === "pending"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {enrollment.status.charAt(0).toUpperCase() +
                enrollment.status.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Enrollment Details */}
      <div className="bg-white rounded-lg border mb-6">
        {/* Course Information */}
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold mb-4">Course Details</h2>

          {/* Agency and Level */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded">
              {enrollment.course.agencyCode}
            </span>
            <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded font-medium">
              {enrollment.course.levelName}
            </span>
          </div>

          <h3 className="text-xl font-bold mb-2">
            {enrollment.course.name}
          </h3>

          {enrollment.course.description && (
            <p className="text-gray-600 mb-4">
              {enrollment.course.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {enrollment.course.durationDays} day
              {enrollment.course.durationDays !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Session Information */}
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold mb-4">Training Session</h2>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-gray-400 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <div>
                <p className="font-medium text-gray-900">
                  {formatDate(enrollment.session.startDate)}
                  {enrollment.session.endDate &&
                    enrollment.session.endDate !== enrollment.session.startDate &&
                    ` - ${formatDate(enrollment.session.endDate)}`}
                </p>
                {enrollment.session.startTime && (
                  <p className="text-sm text-gray-600">
                    Starts at {formatTime(enrollment.session.startTime)}
                  </p>
                )}
              </div>
            </div>

            {enrollment.session.location && (
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-gray-400 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Location</p>
                  <p className="text-sm text-gray-600">
                    {enrollment.session.location}
                  </p>
                </div>
              </div>
            )}

            {enrollment.session.instructorName && (
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-gray-400 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <div>
                  <p className="font-medium text-gray-900">Instructor</p>
                  <p className="text-sm text-gray-600">
                    {enrollment.session.instructorName}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Student Information */}
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold mb-4">Student Information</h2>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Name</span>
              <span className="font-medium">
                {enrollment.customer.firstName} {enrollment.customer.lastName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email</span>
              <span className="font-medium">{enrollment.customer.email}</span>
            </div>
            {enrollment.customer.phone && (
              <div className="flex justify-between">
                <span className="text-gray-600">Phone</span>
                <span className="font-medium">{enrollment.customer.phone}</span>
              </div>
            )}
          </div>

          {enrollment.notes && (
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
              <p className="text-sm text-gray-600">{enrollment.notes}</p>
            </div>
          )}
        </div>

        {/* Payment Information */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Payment Summary</h2>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Course Fee</span>
              <span className="font-medium">
                {formatPrice(enrollment.price, enrollment.currency)}
              </span>
            </div>
            {enrollment.depositAmount && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Deposit (if required)</span>
                <span>
                  {formatPrice(enrollment.depositAmount, enrollment.currency)}
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <span className="font-semibold">Payment Status</span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                enrollment.paymentStatus === "paid"
                  ? "bg-green-100 text-green-700"
                  : enrollment.paymentStatus === "partial"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {enrollment.paymentStatus.charAt(0).toUpperCase() +
                enrollment.paymentStatus.slice(1)}
            </span>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Enrolled on {formatDateTime(enrollment.enrolledAt)}
          </p>
        </div>
      </div>

      {/* What's Next Section */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          What's Next?
        </h2>

        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium text-gray-900">
                Confirmation Email Sent
              </p>
              <p className="text-sm text-gray-600">
                Check your email ({enrollment.customer.email}) for complete
                course details and next steps.
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium text-gray-900">
                Mark Your Calendar
              </p>
              <p className="text-sm text-gray-600">
                Your training session begins on{" "}
                {formatDate(enrollment.session.startDate)}
                {enrollment.session.startTime &&
                  ` at ${formatTime(enrollment.session.startTime)}`}
                .
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path
                fillRule="evenodd"
                d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium text-gray-900">
                Complete Required Forms
              </p>
              <p className="text-sm text-gray-600">
                You'll receive medical forms and liability waivers to complete
                before your first session.
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-cyan-500 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium text-gray-900">
                Earn Your Certification
              </p>
              <p className="text-sm text-gray-600">
                Upon successful completion, you'll receive your{" "}
                {enrollment.course.agencyCode} {enrollment.course.levelName}{" "}
                certification card.
              </p>
            </div>
          </li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          to={`/embed/${tenantSlug}/courses`}
          className="flex-1 text-center py-3 px-6 rounded-lg font-semibold transition-colors border-2"
          style={{
            borderColor: branding.primaryColor,
            color: branding.primaryColor,
          }}
        >
          Browse More Courses
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex-1 py-3 px-6 rounded-lg text-white font-semibold transition-colors"
          style={{ backgroundColor: branding.primaryColor }}
        >
          Print Confirmation
        </button>
      </div>

      {/* Contact Note */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          Questions about your enrollment? Contact us and reference{" "}
          <span className="font-mono font-semibold">{enrollmentRef}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Course Enrollment Confirmation Page
 *
 * Displays enrollment confirmation after successful registration.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link, useOutletContext } from "react-router";
import { getOrganizationBySlug } from "../../../lib/db/queries.public";
import { getEnrollmentDetails } from "../../../lib/db/mutations.public";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  {
    title: data?.enrollment
      ? `Enrollment Confirmed - ${data.enrollment.course.name}`
      : "Enrollment Confirmation",
  },
];

export async function loader({ params, request }: LoaderFunctionArgs) {
  const subdomain = params.tenant;
  if (!subdomain) {
    throw new Response("Shop not found", { status: 404 });
  }

  const url = new URL(request.url);
  const enrollmentId = url.searchParams.get("enrollmentId");

  if (!enrollmentId) {
    throw new Response("Enrollment not found", { status: 404 });
  }

  const org = await getOrganizationBySlug(subdomain);
  if (!org) {
    throw new Response("Shop not found", { status: 404 });
  }

  const enrollment = await getEnrollmentDetails(org.id, enrollmentId);
  if (!enrollment) {
    throw new Response("Enrollment not found", { status: 404 });
  }

  return {
    enrollment,
    tenantSlug: subdomain,
    tenantName: org.name,
  };
}

function formatPrice(price: string, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(parseFloat(price));
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function EnrollmentConfirmationPage() {
  const { enrollment, tenantSlug, tenantName } =
    useLoaderData<typeof loader>();
  const { branding } = useOutletContext<{
    organization: { slug: string };
    branding: { primaryColor: string };
  }>();

  return (
    <div className="max-w-2xl mx-auto">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: branding.primaryColor }}
        >
          <svg
            className="w-8 h-8 text-white"
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Enrollment Confirmed!
        </h1>
        <p className="text-gray-600">
          Your course enrollment with {tenantName} has been received.
        </p>
      </div>

      {/* Enrollment Details Card */}
      <div className="bg-white border rounded-lg overflow-hidden mb-6">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Enrollment Reference</p>
              <p className="font-mono font-bold text-lg">
                {enrollment.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                enrollment.status === "enrolled" ||
                enrollment.status === "scheduled"
                  ? "bg-green-100 text-green-700"
                  : enrollment.status === "pending_scheduling"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {enrollment.status === "pending_scheduling"
                ? "Pending Scheduling"
                : enrollment.status.charAt(0).toUpperCase() +
                  enrollment.status.slice(1).replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Course Details */}
        <div className="p-6 border-b">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: branding.primaryColor + "20" }}
            >
              <svg
                className="w-6 h-6"
                style={{ color: branding.primaryColor }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-500">
                  {enrollment.course.agencyCode}
                </span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  {enrollment.course.levelName}
                </span>
              </div>
              <h2 className="font-semibold text-lg">
                {enrollment.course.name}
              </h2>
              <div className="text-gray-600 mt-1 text-sm">
                {enrollment.course.totalSessions} training session
                {enrollment.course.totalSessions !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Student Info */}
        <div className="p-6 border-b">
          <h3 className="font-semibold mb-3">Student Information</h3>
          <div className="text-gray-600 space-y-1">
            <p>
              {enrollment.customer.firstName} {enrollment.customer.lastName}
            </p>
            <p>{enrollment.customer.email}</p>
            {enrollment.customer.phone && <p>{enrollment.customer.phone}</p>}
          </div>
        </div>

        {/* Pricing */}
        <div className="p-6">
          <h3 className="font-semibold mb-3">Payment Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Course Fee</span>
              <span>
                {formatPrice(enrollment.totalPrice, enrollment.currency)}
              </span>
            </div>
            {enrollment.depositAmount && (
              <div className="flex justify-between">
                <span className="text-gray-600">Deposit Amount</span>
                <span>
                  {formatPrice(enrollment.depositAmount, enrollment.currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-lg pt-2 border-t">
              <span>Balance Due</span>
              <span style={{ color: branding.primaryColor }}>
                {formatPrice(enrollment.balanceDue, enrollment.currency)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                enrollment.paymentStatus === "paid"
                  ? "bg-green-100 text-green-700"
                  : enrollment.paymentStatus === "deposit_paid"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {enrollment.paymentStatus === "paid"
                ? "Paid in Full"
                : enrollment.paymentStatus === "deposit_paid"
                ? "Deposit Paid"
                : "Payment Pending"}
            </span>
            {enrollment.paymentStatus === "pending" && (
              <span className="text-gray-500">
                Payment will be collected at first session
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {enrollment.studentNotes && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Your Notes</h3>
          <p className="text-gray-600">{enrollment.studentNotes}</p>
        </div>
      )}

      {/* Next Steps */}
      <div className="bg-blue-50 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-blue-900 mb-3">What's Next?</h3>
        <ul className="space-y-2 text-blue-800">
          <li className="flex items-start gap-2">
            <svg
              className="w-5 h-5 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <span>
              A confirmation email has been sent to {enrollment.customer.email}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <svg
              className="w-5 h-5 mt-0.5 flex-shrink-0"
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
            <span>
              We'll contact you to schedule your training sessions
            </span>
          </li>
          <li className="flex items-start gap-2">
            <svg
              className="w-5 h-5 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span>
              Complete any required medical forms and waivers before your first
              session
            </span>
          </li>
          <li className="flex items-start gap-2">
            <svg
              className="w-5 h-5 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            <span>Start your eLearning materials if applicable</span>
          </li>
        </ul>
      </div>

      {/* Certification Info */}
      <div className="bg-green-50 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-3 text-green-800">
          <svg
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
            />
          </svg>
          <div>
            <h4 className="font-semibold">
              {enrollment.course.agencyCode} Certification
            </h4>
            <p className="text-sm text-green-700">
              Upon successful completion, you'll receive an internationally
              recognized {enrollment.course.levelName} certification.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          to={`/embed/${tenantSlug}/courses`}
          className="flex-1 text-center py-3 border rounded-lg hover:bg-gray-50 transition-colors"
        >
          Browse More Courses
        </Link>
        <button
          onClick={() => window.print()}
          className="flex-1 py-3 rounded-lg text-white font-semibold transition-colors"
          style={{ backgroundColor: branding.primaryColor }}
        >
          Print Confirmation
        </button>
      </div>

      {/* Enrolled Date */}
      <p className="text-center text-xs text-gray-400 mt-6">
        Enrolled on {formatDate(enrollment.enrolledAt)}
      </p>
    </div>
  );
}

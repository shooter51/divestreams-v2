/**
 * Course Enrollment Form for Widget
 *
 * Collects student details and creates enrollment for a training session.
 */

import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from "react-router";
import {
  useLoaderData,
  useOutletContext,
  Form,
  useActionData,
  useNavigation,
  Link,
  useSearchParams,
} from "react-router";
import { redirect } from "react-router";
import {
  getOrganizationBySlug,
  getPublicCourseById,
} from "../../../lib/db/queries.public";
import { createWidgetEnrollment } from "../../../lib/db/mutations.public";

export const meta: MetaFunction = () => [{ title: "Complete Your Enrollment" }];

export async function loader({ params, request }: LoaderFunctionArgs) {
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
    throw new Response("Course not found or not available", { status: 404 });
  }

  // Get sessionId from query params
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    throw new Response("No training session selected", { status: 400 });
  }

  // Find the selected session
  const session = course.upcomingSessions.find((s) => s.id === sessionId);
  if (!session) {
    throw new Response("Training session not found", { status: 404 });
  }

  return {
    course,
    session,
    tenantSlug: subdomain,
    organizationId: org.id,
  };
}

export async function action({ params, request }: ActionFunctionArgs) {
  const { tenant: subdomain, courseId } = params;
  if (!subdomain || !courseId) {
    throw new Response("Not found", { status: 404 });
  }

  const org = await getOrganizationBySlug(subdomain);
  if (!org) {
    throw new Response("Shop not found", { status: 404 });
  }

  const formData = await request.formData();
  const sessionId = (formData.get("sessionId") as string)?.trim();
  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const phone = (formData.get("phone") as string)?.trim();
  const dateOfBirth = (formData.get("dateOfBirth") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim();

  // Validation
  const errors: Record<string, string> = {};

  if (!firstName) errors.firstName = "First name is required";
  if (!lastName) errors.lastName = "Last name is required";
  if (!email) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Invalid email address";
  }
  if (!sessionId) errors.form = "No training session selected";

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  try {
    // Create the enrollment
    const enrollment = await createWidgetEnrollment(org.id, {
      sessionId,
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      dateOfBirth: dateOfBirth || undefined,
      notes: notes || undefined,
    });

    // Redirect to confirmation page
    return redirect(
      `/embed/${subdomain}/courses/confirm?enrollmentId=${enrollment.id}`
    );
  } catch (error) {
    console.error("Enrollment creation failed:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create enrollment. Please try again.";
    return {
      errors: { form: message },
    };
  }
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

export default function EnrollmentFormPage() {
  const { course, session, tenantSlug } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { branding } = useOutletContext<{
    organization: { slug: string };
    branding: { primaryColor: string };
  }>();

  const isSubmitting = navigation.state === "submitting";

  const totalHours = (course.classroomHours || 0) + (course.poolHours || 0);
  const totalDives = course.openWaterDives || 0;

  return (
    <div>
      {/* Back link */}
      <Link
        to={`/embed/${tenantSlug}/courses/${course.id}`}
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
        Back
      </Link>

      <h1 className="text-2xl font-bold mb-6">Enroll in Course</h1>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Form */}
        <div className="md:col-span-2">
          <Form method="post" className="space-y-6">
            <input type="hidden" name="sessionId" value={session.id} />

            {actionData?.errors?.form && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {actionData.errors.form}
              </div>
            )}

            {/* Personal Details */}
            <fieldset>
              <legend className="text-lg font-semibold mb-4">
                Personal Information
              </legend>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {actionData?.errors?.firstName && (
                    <p className="text-red-600 text-sm mt-1">
                      {actionData.errors.firstName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {actionData?.errors?.lastName && (
                    <p className="text-red-600 text-sm mt-1">
                      {actionData.errors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {actionData?.errors?.email && (
                    <p className="text-red-600 text-sm mt-1">
                      {actionData.errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required for certification processing
                </p>
              </div>
            </fieldset>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes or Special Requirements
              </label>
              <textarea
                name="notes"
                rows={3}
                placeholder="Prior diving experience, scheduling preferences, medical conditions, etc."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-lg text-white font-semibold transition-colors disabled:opacity-50"
              style={{ backgroundColor: branding.primaryColor }}
            >
              {isSubmitting
                ? "Processing..."
                : `Enroll Now - ${formatPrice(course.price, course.currency)}`}
            </button>

            <p className="text-xs text-gray-500 text-center">
              By enrolling, you agree to the course policies and terms of
              service.
              {course.depositAmount && (
                <>
                  {" "}
                  A deposit of{" "}
                  {formatPrice(course.depositAmount, course.currency)} may be
                  collected to secure your spot.
                </>
              )}
            </p>
          </Form>
        </div>

        {/* Order Summary */}
        <div>
          <div className="bg-gray-50 rounded-lg p-6 sticky top-4">
            <h3 className="font-semibold mb-4">Enrollment Summary</h3>

            {/* Agency and Level */}
            <div className="flex items-center gap-2 mb-3">
              {course.agencyLogo ? (
                <img
                  src={course.agencyLogo}
                  alt={course.agencyName}
                  className="h-6 object-contain"
                />
              ) : (
                <span className="text-sm font-medium text-gray-700">
                  {course.agencyCode}
                </span>
              )}
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                {course.levelName}
              </span>
            </div>

            <h4 className="font-medium text-lg">{course.name}</h4>

            {/* Session Details */}
            <div className="mt-3 p-3 bg-white rounded border">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Training Session
              </p>
              <p className="text-sm text-gray-600">
                {formatDate(session.startDate)}
                {session.endDate && session.endDate !== session.startDate &&
                  ` - ${formatDate(session.endDate)}`}
              </p>
              {session.location && (
                <p className="text-xs text-gray-500 mt-1">{session.location}</p>
              )}
              {session.instructorName && (
                <p className="text-xs text-gray-500">
                  Instructor: {session.instructorName}
                </p>
              )}
            </div>

            <div className="text-sm text-gray-600 mt-3 space-y-1">
              <div className="flex items-center gap-2">
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
                {course.durationDays} day{course.durationDays !== 1 ? "s" : ""}
              </div>
              {totalHours > 0 && (
                <div className="flex items-center gap-2">
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {totalHours} training hours
                </div>
              )}
              {totalDives > 0 && (
                <div className="flex items-center gap-2">
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
                      d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                    />
                  </svg>
                  {totalDives} open water dive{totalDives !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            <div className="border-t mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Course Fee</span>
                <span>{formatPrice(course.price, course.currency)}</span>
              </div>
              {course.depositAmount && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Deposit (if required)</span>
                  <span>
                    {formatPrice(course.depositAmount, course.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                <span>Total</span>
                <span style={{ color: branding.primaryColor }}>
                  {formatPrice(course.price, course.currency)}
                </span>
              </div>
            </div>

            {/* Certification Badge */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <svg
                  className="w-5 h-5"
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
                <span className="text-sm font-medium">
                  {course.agencyCode} Certified
                </span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                You'll receive an internationally recognized certification upon
                successful completion.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

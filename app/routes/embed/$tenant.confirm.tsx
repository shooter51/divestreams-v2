/**
 * Booking Confirmation Page
 *
 * Displays booking confirmation after successful booking.
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link, useOutletContext } from "react-router";
import { getOrganizationBySlug } from "../../../lib/db/queries.public";
import { getBookingDetails } from "../../../lib/db/mutations.public";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.booking ? `Booking ${data.booking.bookingNumber} Confirmed` : "Booking Confirmation" },
];

export async function loader({ params, request }: LoaderFunctionArgs) {
  const subdomain = params.tenant;
  if (!subdomain) {
    throw new Response("Shop not found", { status: 404 });
  }

  const url = new URL(request.url);
  const bookingId = url.searchParams.get("bookingId");
  const bookingNumber = url.searchParams.get("bookingNumber");

  if (!bookingId || !bookingNumber) {
    throw new Response("Booking not found", { status: 404 });
  }

  const org = await getOrganizationBySlug(subdomain);
  if (!org) {
    throw new Response("Shop not found", { status: 404 });
  }

  const booking = await getBookingDetails(org.id, bookingId, bookingNumber);
  if (!booking) {
    throw new Response("Booking not found", { status: 404 });
  }

  return {
    booking,
    tenantSlug: subdomain,
    tenantName: org.name,
  };
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

function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatPrice(price: string | number, currency: string): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(num);
}

export default function BookingConfirmationPage() {
  const { booking, tenantName } = useLoaderData<typeof loader>();
  const { branding } = useOutletContext<{
    organization: { slug: string };
    branding: { primaryColor: string };
  }>();

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back Navigation */}
      <div className="mb-6">
        <Link
          to="/site/trips"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Tours</span>
        </Link>
      </div>

      {/* Success Header */}
      <div className="text-center mb-8">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: branding.primaryColor }}
        >
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Booking Confirmed!</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Your booking with {tenantName} has been received.
        </p>
      </div>

      {/* Booking Details Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-6">
        {/* Header */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Booking Reference</p>
              <p className="font-mono font-bold text-lg text-gray-900 dark:text-gray-100">{booking.bookingNumber}</p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                booking.status === "confirmed"
                  ? "bg-success-muted text-success"
                  : booking.status === "pending"
                  ? "bg-warning-muted text-warning"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {booking.status === "pending" ? "Pending Confirmation" : booking.status}
            </span>
          </div>
        </div>

        {/* Trip Details */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4">
            {booking.trip.primaryImage && (
              <img
                src={booking.trip.primaryImage}
                alt={booking.trip.tourName}
                className="w-24 h-24 object-cover rounded-lg"
              />
            )}
            <div>
              <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{booking.trip.tourName}</h2>
              <div className="text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatDate(booking.trip.date)}
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatTime(booking.trip.startTime)}
                  {booking.trip.endTime && ` - ${formatTime(booking.trip.endTime)}`}
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {booking.participants} participant{booking.participants !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Contact Information</h3>
          <div className="text-gray-600 dark:text-gray-400 space-y-1">
            <p>{booking.customer.firstName} {booking.customer.lastName}</p>
            <p>{booking.customer.email}</p>
            {booking.customer.phone && <p>{booking.customer.phone}</p>}
          </div>
        </div>

        {/* Pricing */}
        <div className="p-6">
          <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Payment Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
              <span className="text-gray-900 dark:text-gray-100">{formatPrice(booking.subtotal, booking.currency)}</span>
            </div>
            {parseFloat(booking.tax) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Tax</span>
                <span className="text-gray-900 dark:text-gray-100">{formatPrice(booking.tax, booking.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-900 dark:text-gray-100">Total</span>
              <span style={{ color: branding.primaryColor }}>
                {formatPrice(booking.total, booking.currency)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                booking.paymentStatus === "paid"
                  ? "bg-success-muted text-success"
                  : "bg-warning-muted text-warning"
              }`}
            >
              {booking.paymentStatus === "paid" ? "Paid" : "Payment Pending"}
            </span>
            {booking.paymentStatus === "pending" && (
              <span className="text-gray-500 dark:text-gray-400">
                Payment will be collected at check-in
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Special Requests */}
      {booking.specialRequests && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Special Requests</h3>
          <p className="text-gray-600 dark:text-gray-400">{booking.specialRequests}</p>
        </div>
      )}

      {/* Next Steps */}
      <div className="bg-brand-muted border border-brand rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-brand mb-3">What's Next?</h3>
        <ul className="space-y-2 text-brand">
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>A confirmation email has been sent to {booking.customer.email}</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Arrive 15-30 minutes before your scheduled time</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Bring a valid ID and any required certifications</span>
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          to="/site/trips"
          className="flex-1 text-center py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-gray-100"
        >
          Browse More Tours
        </Link>
        <button
          onClick={() => window.print()}
          className="flex-1 py-3 rounded-lg text-white font-semibold transition-colors"
          style={{ backgroundColor: branding.primaryColor }}
        >
          Print Confirmation
        </button>
      </div>

      {/* Print styles hint */}
      <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
        Save your booking reference: {booking.bookingNumber}
      </p>
    </div>
  );
}

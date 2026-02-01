/**
 * Public Site Booking Confirmation Page
 *
 * Task 21: Confirmation Page
 *
 * Features:
 * - Booking reference number
 * - Summary of booking details
 * - Next steps info
 * - Link to account/bookings
 * - Email confirmation notice
 */

import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { eq } from "drizzle-orm";
import { db } from "../../../../lib/db";
import { organization } from "../../../../lib/db/schema";
import { getBookingDetails, type BookingDetails } from "../../../../lib/db/mutations.public";
import { getCustomerBySession } from "../../../../lib/auth/customer-auth.server";

// ============================================================================
// TYPES
// ============================================================================

interface LoaderData {
  booking: BookingDetails;
  organizationName: string;
  isLoggedIn: boolean;
}

// ============================================================================
// META
// ============================================================================

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Booking Confirmation" }];

  return [
    { title: `Booking Confirmed - ${data.booking.bookingNumber}` },
    { name: "description", content: `Your booking ${data.booking.bookingNumber} has been confirmed` },
  ];
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getSubdomainFromHost(host: string): string | null {
  if (host.includes("localhost")) {
    const parts = host.split(".");
    if (parts.length >= 2 && parts[0] !== "localhost") {
      return parts[0].toLowerCase();
    }
    return null;
  }

  const parts = host.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0].toLowerCase();
    if (subdomain === "www" || subdomain === "admin") {
      return null;
    }
    return subdomain;
  }

  return null;
}

// ============================================================================
// LOADER
// ============================================================================

export async function loader({ request }: LoaderFunctionArgs): Promise<LoaderData> {
  const url = new URL(request.url);
  const host = url.host;
  const subdomain = getSubdomainFromHost(host);

  const bookingId = url.searchParams.get("id");
  const bookingRef = url.searchParams.get("ref");

  if (!bookingId || !bookingRef) {
    throw new Response("Missing booking information", { status: 400 });
  }

  // Get organization
  const [org] = subdomain
    ? await db
        .select()
        .from(organization)
        .where(eq(organization.slug, subdomain))
        .limit(1)
    : await db
        .select()
        .from(organization)
        .where(eq(organization.customDomain, host.split(":")[0]))
        .limit(1);

  if (!org) {
    throw new Response("Organization not found", { status: 404 });
  }

  // Get booking details
  const booking = await getBookingDetails(org.id, bookingId, bookingRef);

  if (!booking) {
    throw new Response("Booking not found", { status: 404 });
  }

  // Check if customer is logged in
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader
      .split("; ")
      .filter(Boolean)
      .map((c) => {
        const [key, ...rest] = c.split("=");
        return [key, rest.join("=")];
      })
  );
  const sessionToken = cookies["customer_session"];
  const customer = sessionToken ? await getCustomerBySession(sessionToken) : null;

  return {
    booking,
    organizationName: org.name,
    isLoggedIn: !!customer,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function BookingConfirmationPage() {
  const { booking, organizationName, isLoggedIn } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background-color)" }}>
      {/* Success Header */}
      <div
        className="border-b"
        style={{ backgroundColor: "var(--primary-color)" }}
      >
        <div className="max-w-3xl mx-auto px-4 py-8 text-center text-white">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20">
              <CheckIcon className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Booking Confirmed!</h1>
          <p className="opacity-90">
            Thank you for your booking with {organizationName}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Booking Reference Card */}
        <div
          className="rounded-xl p-6 shadow-lg mb-6"
          style={{
            backgroundColor: "var(--color-card-bg)",
            borderColor: "var(--color-border)",
            borderWidth: "1px",
          }}
        >
          <div className="text-center mb-6 pb-6 border-b" style={{ borderColor: "var(--color-border)" }}>
            <p className="text-sm opacity-75 mb-1">Booking Reference</p>
            <p
              className="text-3xl font-bold font-mono tracking-wider"
              style={{ color: "var(--primary-color)" }}
            >
              {booking.bookingNumber}
            </p>
            <p className="text-sm opacity-60 mt-2">
              Please save this reference for your records
            </p>
          </div>

          {/* Booking Status */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <StatusBadge status={booking.status} />
            <PaymentBadge status={booking.paymentStatus} />
          </div>

          {/* Trip Details */}
          <div className="space-y-4">
            <h2 className="font-semibold text-lg" style={{ color: "var(--text-color)" }}>
              Booking Details
            </h2>

            {/* Trip Info */}
            <div
              className="p-4 rounded-lg flex gap-4"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              {booking.trip.primaryImage && (
                <img
                  src={booking.trip.primaryImage}
                  alt={booking.trip.tourName}
                  className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg" style={{ color: "var(--text-color)" }}>
                  {booking.trip.tourName}
                </h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm opacity-75">
                  <span className="flex items-center gap-1.5">
                    <CalendarIcon className="w-4 h-4" />
                    {formatDate(booking.trip.date)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ClockIcon className="w-4 h-4" />
                    {formatTime(booking.trip.startTime)}
                    {booking.trip.endTime && ` - ${formatTime(booking.trip.endTime)}`}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <UsersIcon className="w-4 h-4" />
                    {booking.participants} participant{booking.participants > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="opacity-60 mb-1">Booked By</p>
                <p className="font-medium">
                  {booking.customer.firstName} {booking.customer.lastName}
                </p>
              </div>
              <div>
                <p className="opacity-60 mb-1">Email</p>
                <p className="font-medium">{booking.customer.email}</p>
              </div>
              {booking.customer.phone && (
                <div>
                  <p className="opacity-60 mb-1">Phone</p>
                  <p className="font-medium">{booking.customer.phone}</p>
                </div>
              )}
              <div>
                <p className="opacity-60 mb-1">Booking Date</p>
                <p className="font-medium">{formatDateTime(booking.createdAt)}</p>
              </div>
            </div>

            {/* Special Requests */}
            {booking.specialRequests && (
              <div className="text-sm">
                <p className="opacity-60 mb-1">Special Requests</p>
                <p className="font-medium">{booking.specialRequests}</p>
              </div>
            )}

            {/* Payment Summary */}
            <div className="pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
              <h3 className="font-semibold mb-3" style={{ color: "var(--text-color)" }}>
                Payment Summary
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="opacity-75">Subtotal</span>
                  <span>{formatCurrency(booking.subtotal, booking.currency)}</span>
                </div>
                {parseFloat(booking.tax) > 0 && (
                  <div className="flex justify-between">
                    <span className="opacity-75">Tax</span>
                    <span>{formatCurrency(booking.tax, booking.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
                  <span>Total</span>
                  <span style={{ color: "var(--primary-color)" }}>
                    {formatCurrency(booking.total, booking.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Email Notice */}
        <div
          className="rounded-xl p-6 shadow-sm mb-6 flex items-start gap-4"
          style={{
            backgroundColor: "var(--color-card-bg)",
            borderColor: "var(--color-border)",
            borderWidth: "1px",
          }}
        >
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            <EmailIcon className="w-5 h-5" style={{ color: "var(--primary-color)" }} />
          </div>
          <div>
            <h3 className="font-semibold mb-1" style={{ color: "var(--text-color)" }}>
              Confirmation Email Sent
            </h3>
            <p className="text-sm opacity-75">
              A confirmation email has been sent to{" "}
              <span className="font-medium">{booking.customer.email}</span>. Please check your inbox
              (and spam folder) for your booking details.
            </p>
          </div>
        </div>

        {/* Next Steps */}
        <div
          className="rounded-xl p-6 shadow-sm mb-6"
          style={{
            backgroundColor: "var(--color-card-bg)",
            borderColor: "var(--color-border)",
            borderWidth: "1px",
          }}
        >
          <h3 className="font-semibold mb-4" style={{ color: "var(--text-color)" }}>
            What's Next?
          </h3>
          <div className="space-y-4">
            <NextStep
              number={1}
              title="Check Your Email"
              description="You'll receive a detailed confirmation with all the information you need."
            />
            <NextStep
              number={2}
              title="Prepare for Your Trip"
              description="Review any equipment or documentation requirements before your booking date."
            />
            <NextStep
              number={3}
              title="Arrive On Time"
              description={`Please arrive at least 15 minutes before your scheduled time of ${formatTime(booking.trip.startTime)}.`}
            />
            {booking.paymentStatus === "pending" && (
              <NextStep
                number={4}
                title="Complete Payment"
                description="Payment will be collected on-site. Please bring a valid payment method."
              />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          {isLoggedIn ? (
            <Link
              to="/site/account/bookings"
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary-color)" }}
            >
              <BookingsIcon className="w-5 h-5" />
              View My Bookings
            </Link>
          ) : (
            <Link
              to={`/site/register?email=${encodeURIComponent(booking.customer.email)}`}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary-color)" }}
            >
              <UserPlusIcon className="w-5 h-5" />
              Create Account to Manage Bookings
            </Link>
          )}
          <Link
            to="/site"
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold border transition-colors hover:bg-gray-50"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--text-color)",
            }}
          >
            <HomeIcon className="w-5 h-5" />
            Back to Homepage
          </Link>
        </div>

        {/* Print/Download */}
        <div className="mt-6 text-center">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 text-sm opacity-75 hover:opacity-100 transition-opacity"
            style={{ color: "var(--primary-color)" }}
          >
            <PrintIcon className="w-4 h-4" />
            Print Confirmation
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; bgColor: string; textColor: string }> = {
    pending: { label: "Pending", bgColor: "var(--warning-muted)", textColor: "var(--warning)" },
    confirmed: { label: "Confirmed", bgColor: "var(--success-muted)", textColor: "var(--success)" },
    checked_in: { label: "Checked In", bgColor: "var(--brand-muted)", textColor: "var(--brand)" },
    completed: { label: "Completed", bgColor: "var(--surface-overlay)", textColor: "var(--foreground-muted)" },
    canceled: { label: "Canceled", bgColor: "var(--danger-muted)", textColor: "var(--danger)" },
    no_show: { label: "No Show", bgColor: "var(--accent-muted)", textColor: "var(--accent)" },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span
      className="px-3 py-1 rounded-full text-sm font-medium"
      style={{ backgroundColor: config.bgColor, color: config.textColor }}
    >
      {config.label}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; bgColor: string; textColor: string }> = {
    pending: { label: "Payment Pending", bgColor: "var(--warning-muted)", textColor: "var(--warning)" },
    partial: { label: "Partial Payment", bgColor: "var(--warning-muted)", textColor: "var(--warning)" },
    paid: { label: "Paid", bgColor: "var(--success-muted)", textColor: "var(--success)" },
    refunded: { label: "Refunded", bgColor: "var(--surface-overlay)", textColor: "var(--foreground-muted)" },
    failed: { label: "Payment Failed", bgColor: "var(--danger-muted)", textColor: "var(--danger)" },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span
      className="px-3 py-1 rounded-full text-sm font-medium"
      style={{ backgroundColor: config.bgColor, color: config.textColor }}
    >
      {config.label}
    </span>
  );
}

function NextStep({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white"
        style={{ backgroundColor: "var(--primary-color)" }}
      >
        {number}
      </div>
      <div>
        <h4 className="font-medium" style={{ color: "var(--text-color)" }}>
          {title}
        </h4>
        <p className="text-sm opacity-75">{description}</p>
      </div>
    </div>
  );
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(amount: string, currency: string): string {
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

// ============================================================================
// ICONS
// ============================================================================

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function EmailIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function BookingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    </svg>
  );
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
      />
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function PrintIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
      />
    </svg>
  );
}

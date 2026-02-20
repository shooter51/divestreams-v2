/**
 * Account Dashboard Page
 *
 * Shows:
 * - Welcome message with customer name
 * - Quick stats: upcoming bookings count, total trips
 * - Next upcoming booking card
 * - Quick links to bookings, profile
 */

import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { db } from "../../../../lib/db";
import { bookings, trips, tours } from "../../../../lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { getCustomerBySession } from "../../../../lib/auth/customer-auth.server";
import { StatusBadge, type BadgeStatus } from "../../../components/ui";

// ============================================================================
// TYPES
// ============================================================================

interface DashboardBooking {
  id: string;
  bookingNumber: string;
  status: string;
  total: string;
  participants: number;
  trip: {
    id: string;
    date: string;
    startTime: string | null;
    tour: {
      id: string;
      name: string;
      type: string;
    };
  };
}

interface DashboardStats {
  upcomingCount: number;
  totalTrips: number;
  totalSpent: string;
}

interface DashboardLoaderData {
  customer: {
    firstName: string;
    lastName: string;
    email: string;
  };
  stats: DashboardStats;
  nextBooking: DashboardBooking | null;
}

// ============================================================================
// LOADER
// ============================================================================

export async function loader({ request }: LoaderFunctionArgs): Promise<DashboardLoaderData> {
  // Get session token from cookie
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").filter(Boolean).map((c) => {
      const [key, ...rest] = c.split("=");
      return [key, rest.join("=")];
    })
  );

  const sessionToken = cookies["customer_session"];

  if (!sessionToken) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const customer = await getCustomerBySession(sessionToken);
  if (!customer) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  // Get upcoming bookings count
  const upcomingResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .innerJoin(trips, eq(bookings.tripId, trips.id))
    .where(
      and(
        eq(bookings.customerId, customer.id),
        eq(bookings.organizationId, customer.organizationId),
        gte(trips.date, today),
        sql`${bookings.status} NOT IN ('canceled', 'no_show')`
      )
    );

  // Get total trips count (completed)
  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        eq(bookings.customerId, customer.id),
        eq(bookings.organizationId, customer.organizationId),
        sql`${bookings.status} IN ('completed', 'checked_in')`
      )
    );

  // Get total spent
  const spentResult = await db
    .select({ total: sql<string>`COALESCE(sum(${bookings.total}), 0)::text` })
    .from(bookings)
    .where(
      and(
        eq(bookings.customerId, customer.id),
        eq(bookings.organizationId, customer.organizationId),
        sql`${bookings.paymentStatus} = 'paid'`
      )
    );

  // Get next upcoming booking
  const nextBookings = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      total: bookings.total,
      participants: bookings.participants,
      tripId: trips.id,
      tripDate: trips.date,
      tripStartTime: trips.startTime,
      tourId: tours.id,
      tourName: tours.name,
      tourType: tours.type,
    })
    .from(bookings)
    .innerJoin(trips, eq(bookings.tripId, trips.id))
    .innerJoin(tours, eq(trips.tourId, tours.id))
    .where(
      and(
        eq(bookings.customerId, customer.id),
        eq(bookings.organizationId, customer.organizationId),
        gte(trips.date, today),
        sql`${bookings.status} NOT IN ('canceled', 'no_show')`
      )
    )
    .orderBy(trips.date, trips.startTime)
    .limit(1);

  const nextBooking = nextBookings[0]
    ? {
        id: nextBookings[0].id,
        bookingNumber: nextBookings[0].bookingNumber,
        status: nextBookings[0].status,
        total: nextBookings[0].total,
        participants: nextBookings[0].participants,
        trip: {
          id: nextBookings[0].tripId,
          date: nextBookings[0].tripDate,
          startTime: nextBookings[0].tripStartTime,
          tour: {
            id: nextBookings[0].tourId,
            name: nextBookings[0].tourName,
            type: nextBookings[0].tourType,
          },
        },
      }
    : null;

  return {
    customer: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
    },
    stats: {
      upcomingCount: upcomingResult[0]?.count || 0,
      totalTrips: totalResult[0]?.count || 0,
      totalSpent: spentResult[0]?.total || "0",
    },
    nextBooking,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AccountDashboard() {
  const { customer, stats, nextBooking } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: "var(--text-color)" }}>
          Welcome back, {customer.firstName}!
        </h2>
        <p className="mt-1 opacity-75">
          Here's an overview of your account and upcoming adventures.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Upcoming Bookings"
          value={stats.upcomingCount.toString()}
          icon={<CalendarIcon />}
        />
        <StatCard
          label="Total Trips"
          value={stats.totalTrips.toString()}
          icon={<WaveIcon />}
        />
        <StatCard
          label="Total Spent"
          value={`$${parseFloat(stats.totalSpent).toFixed(2)}`}
          icon={<CurrencyIcon />}
        />
      </div>

      {/* Next Booking */}
      <div>
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-color)" }}>
          Next Upcoming Booking
        </h3>
        {nextBooking ? (
          <div
            className="rounded-xl border p-6"
            style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card-bg)" }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h4 className="font-semibold text-lg" style={{ color: "var(--primary-color)" }}>
                  {nextBooking.trip.tour.name}
                </h4>
                <p className="text-sm opacity-75 mt-1">
                  Booking #{nextBooking.bookingNumber}
                </p>
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  <span className="flex items-center gap-1">
                    <CalendarSmallIcon className="w-4 h-4" />
                    {formatDate(nextBooking.trip.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-4 h-4" />
                    {formatTime(nextBooking.trip.startTime)}
                  </span>
                  <span className="flex items-center gap-1">
                    <UsersIcon className="w-4 h-4" />
                    {nextBooking.participants} {nextBooking.participants === 1 ? "person" : "people"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={mapBookingStatusToBadgeStatus(nextBooking.status)} />
                <Link
                  to={`/site/account/bookings`}
                  className="text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ color: "var(--primary-color)" }}
                >
                  View Details
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rounded-xl border p-8 text-center"
            style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card-bg)" }}
          >
            <WaveIcon className="w-12 h-12 mx-auto opacity-40 mb-4" />
            <p className="opacity-75">No upcoming bookings</p>
            <Link
              to="/site/trips"
              className="inline-block mt-4 px-6 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary-color)" }}
            >
              Browse Trips
            </Link>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div>
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-color)" }}>
          Quick Links
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <QuickLinkCard
            to="/site/account/bookings"
            icon={<CalendarIcon />}
            title="My Bookings"
            description="View and manage all your bookings"
          />
          <QuickLinkCard
            to="/site/account/profile"
            icon={<UserIcon />}
            title="Profile Settings"
            description="Update your personal information"
          />
          <QuickLinkCard
            to="/site/trips"
            icon={<WaveIcon />}
            title="Browse Trips"
            description="Discover new diving adventures"
          />
          <QuickLinkCard
            to="/site/courses"
            icon={<BookIcon />}
            title="Browse Courses"
            description="Explore certifications and courses"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card-bg)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "var(--accent-color)", color: "var(--primary-color)" }}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color: "var(--text-color)" }}>
            {value}
          </p>
          <p className="text-sm opacity-75">{label}</p>
        </div>
      </div>
    </div>
  );
}

function QuickLinkCard({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border p-5 flex items-start gap-4 transition-shadow hover:shadow-md"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card-bg)" }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: "var(--accent-color)", color: "var(--primary-color)" }}
      >
        {icon}
      </div>
      <div>
        <h4 className="font-semibold" style={{ color: "var(--text-color)" }}>
          {title}
        </h4>
        <p className="text-sm opacity-75 mt-1">{description}</p>
      </div>
    </Link>
  );
}

/**
 * Maps booking status strings to BadgeStatus types
 * Handles database values like 'canceled' and 'no_show' that don't directly match BadgeStatus
 */
function mapBookingStatusToBadgeStatus(status: string): BadgeStatus {
  // Map database status to BadgeStatus type
  const statusMap: Record<string, BadgeStatus> = {
    pending: "pending",
    confirmed: "confirmed",
    checked_in: "checked_in",
    completed: "completed",
    canceled: "cancelled", // Map to 'cancelled' (UK spelling used in BadgeStatus)
    no_show: "cancelled", // Map no_show to cancelled as closest match
  };

  return statusMap[status] || "pending";
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "Time TBA";
  const [hours, minutes] = timeStr.split(":");
  const date = new Date();
  date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ============================================================================
// ICONS
// ============================================================================

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function CalendarSmallIcon({ className }: { className?: string }) {
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

function WaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
      />
    </svg>
  );
}

function CurrencyIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
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

function UserIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  );
}

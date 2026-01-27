/**
 * Account Bookings Page
 *
 * Shows:
 * - List of all bookings (upcoming and past)
 * - Filter by status (all/upcoming/completed/cancelled)
 * - Booking cards with trip/course name, date, status, price
 * - Link to receipt/details
 */

import { useState } from "react";
import { Link, useLoaderData, useSearchParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { db } from "../../../../lib/db";
import { bookings, trips, tours } from "../../../../lib/db/schema";
import { eq, and, gte, lt, desc, sql } from "drizzle-orm";
import { getCustomerBySession } from "../../../../lib/auth/customer-auth.server";

// ============================================================================
// TYPES
// ============================================================================

interface BookingItem {
  id: string;
  bookingNumber: string;
  status: string;
  paymentStatus: string;
  total: string;
  currency: string;
  participants: number;
  createdAt: string;
  trip: {
    id: string;
    date: string;
    startTime: string;
    tour: {
      id: string;
      name: string;
      type: string;
    };
  };
}

interface BookingsLoaderData {
  bookings: BookingItem[];
  filter: string;
}

// ============================================================================
// LOADER
// ============================================================================

export async function loader({ request }: LoaderFunctionArgs): Promise<BookingsLoaderData> {
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

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "all";
  const today = new Date().toISOString().split("T")[0];

  // Build conditions based on filter
  let statusCondition;
  let dateCondition;

  switch (filter) {
    case "upcoming":
      statusCondition = sql`${bookings.status} NOT IN ('canceled', 'no_show', 'completed')`;
      dateCondition = gte(trips.date, today);
      break;
    case "completed":
      statusCondition = sql`${bookings.status} = 'completed'`;
      dateCondition = undefined;
      break;
    case "cancelled":
      statusCondition = sql`${bookings.status} IN ('canceled', 'no_show')`;
      dateCondition = undefined;
      break;
    default:
      statusCondition = undefined;
      dateCondition = undefined;
  }

  const conditions = [
    eq(bookings.customerId, customer.id),
    eq(bookings.organizationId, customer.organizationId),
  ];

  if (statusCondition) {
    conditions.push(statusCondition);
  }
  if (dateCondition) {
    conditions.push(dateCondition);
  }

  const results = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      total: bookings.total,
      currency: bookings.currency,
      participants: bookings.participants,
      createdAt: bookings.createdAt,
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
    .where(and(...conditions))
    .orderBy(desc(trips.date), desc(trips.startTime))
    .limit(50);

  return {
    bookings: results.map((r) => ({
      id: r.id,
      bookingNumber: r.bookingNumber,
      status: r.status,
      paymentStatus: r.paymentStatus,
      total: r.total,
      currency: r.currency,
      participants: r.participants,
      createdAt: r.createdAt.toISOString(),
      trip: {
        id: r.tripId,
        date: r.tripDate,
        startTime: r.tripStartTime,
        tour: {
          id: r.tourId,
          name: r.tourName,
          type: r.tourType,
        },
      },
    })),
    filter,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AccountBookings() {
  const { bookings, filter } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const filterOptions = [
    { value: "all", label: "All Bookings" },
    { value: "upcoming", label: "Upcoming" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const handleFilterChange = (newFilter: string) => {
    if (newFilter === "all") {
      searchParams.delete("filter");
    } else {
      searchParams.set("filter", newFilter);
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: "var(--text-color)" }}>
            My Bookings
          </h2>
          <p className="mt-1 opacity-75">
            View and manage all your bookings
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        className="flex gap-1 p-1 rounded-lg"
        style={{ backgroundColor: "var(--accent-color)" }}
      >
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => handleFilterChange(option.value)}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === option.value ? "shadow" : ""
            }`}
            style={{
              backgroundColor: filter === option.value ? "white" : "transparent",
              color: filter === option.value ? "var(--primary-color)" : "var(--text-color)",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function BookingCard({ booking }: { booking: BookingItem }) {
  const isUpcoming = new Date(booking.trip.date) >= new Date(new Date().toISOString().split("T")[0]);
  const isCancelled = booking.status === "canceled" || booking.status === "no_show";

  return (
    <div
      className={`rounded-xl border p-5 ${isCancelled ? "opacity-60" : ""}`}
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card-bg)" }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Left Side - Trip Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              <TripTypeIcon type={booking.trip.tour.type} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate" style={{ color: "var(--text-color)" }}>
                {booking.trip.tour.name}
              </h3>
              <p className="text-sm opacity-75">
                Booking #{booking.bookingNumber}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-wrap gap-4 mt-4 text-sm">
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 opacity-60" />
              {formatDate(booking.trip.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4 opacity-60" />
              {formatTime(booking.trip.startTime)}
            </span>
            <span className="flex items-center gap-1.5">
              <UsersIcon className="w-4 h-4 opacity-60" />
              {booking.participants} {booking.participants === 1 ? "person" : "people"}
            </span>
          </div>
        </div>

        {/* Right Side - Status & Price */}
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={booking.status} />
            <PaymentBadge status={booking.paymentStatus} />
          </div>
          <p className="text-lg font-semibold" style={{ color: "var(--text-color)" }}>
            {formatCurrency(booking.total, booking.currency)}
          </p>
          {isUpcoming && !isCancelled && (
            <Link
              to={`/site/trips/${booking.trip.tour.id}`}
              className="text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: "var(--primary-color)" }}
            >
              View Trip Details
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ filter }: { filter: string }) {
  const messages: Record<string, { title: string; description: string }> = {
    all: {
      title: "No bookings yet",
      description: "Start your diving adventure by booking your first trip!",
    },
    upcoming: {
      title: "No upcoming bookings",
      description: "You don't have any upcoming trips scheduled.",
    },
    completed: {
      title: "No completed trips",
      description: "You haven't completed any trips yet.",
    },
    cancelled: {
      title: "No cancelled bookings",
      description: "You don't have any cancelled bookings.",
    },
  };

  const content = messages[filter] || messages.all;

  return (
    <div
      className="rounded-xl border p-12 text-center"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card-bg)" }}
    >
      <div
        className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4"
        style={{ backgroundColor: "var(--accent-color)" }}
      >
        <CalendarIcon className="w-8 h-8" style={{ color: "var(--primary-color)" }} />
      </div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-color)" }}>
        {content.title}
      </h3>
      <p className="opacity-75 mb-6">{content.description}</p>
      <Link
        to="/site/trips"
        className="inline-block px-6 py-2.5 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--primary-color)" }}
      >
        Browse Trips
      </Link>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "#fef3c7", text: "#d97706", label: "Pending" },
    confirmed: { bg: "#d1fae5", text: "#059669", label: "Confirmed" },
    checked_in: { bg: "#dbeafe", text: "#2563eb", label: "Checked In" },
    completed: { bg: "#e5e7eb", text: "#6b7280", label: "Completed" },
    canceled: { bg: "#fee2e2", text: "#dc2626", label: "Cancelled" },
    no_show: { bg: "#fee2e2", text: "#dc2626", label: "No Show" },
  };

  const style = statusStyles[status] || statusStyles.pending;

  return (
    <span
      className="px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "#fef3c7", text: "#d97706", label: "Unpaid" },
    partial: { bg: "#fef3c7", text: "#d97706", label: "Partial" },
    paid: { bg: "#d1fae5", text: "#059669", label: "Paid" },
    refunded: { bg: "#e5e7eb", text: "#6b7280", label: "Refunded" },
  };

  const style = statusStyles[status] || statusStyles.pending;

  return (
    <span
      className="px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
}

function TripTypeIcon({ type }: { type: string }) {
  // Simple icon based on trip type
  const isCourse = type.toLowerCase().includes("course") || type.toLowerCase().includes("cert");

  return isCourse ? (
    <svg className="w-5 h-5" style={{ color: "var(--primary-color)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ) : (
    <svg className="w-5 h-5" style={{ color: "var(--primary-color)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
    </svg>
  );
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

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const date = new Date();
  date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCurrency(amount: string, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(parseFloat(amount));
}

// ============================================================================
// ICONS
// ============================================================================

function CalendarIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

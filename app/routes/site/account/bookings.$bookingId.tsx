/**
 * Booking Detail Page
 *
 * Shows detailed information about a specific booking including:
 * - Booking reference and status
 * - Trip information
 * - Payment summary
 * - Cancellation information (if cancelled)
 * - Cancel booking button (if eligible)
 *
 * KAN-652: Customer booking cancellation feature
 */

import { useState } from "react";
import { Link, useLoaderData, useNavigate, Form } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { db } from "../../../../lib/db";
import { bookings, trips, tours } from "../../../../lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCustomerBySession } from "../../../../lib/auth/customer-auth.server";
import { syncBookingCancellationToCalendar } from "../../../../lib/integrations/google-calendar-bookings.server";

// ============================================================================
// TYPES
// ============================================================================

interface BookingDetailData {
  booking: {
    id: string;
    bookingNumber: string;
    status: string;
    paymentStatus: string;
    total: string;
    subtotal: string;
    discount: string;
    tax: string;
    currency: string;
    participants: number;
    createdAt: string;
    cancelledAt: string | null;
    cancellationReason: string | null;
    specialRequests: string | null;
    trip: {
      id: string;
      date: string;
      startTime: string;
      endTime: string | null;
      tour: {
        id: string;
        name: string;
        type: string;
        description: string | null;
      };
    };
  };
}

// ============================================================================
// LOADER
// ============================================================================

export async function loader({ request, params }: LoaderFunctionArgs): Promise<BookingDetailData> {
  const { bookingId } = params;
  if (!bookingId) {
    throw new Response("Booking not found", { status: 404 });
  }

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

  // Fetch booking with trip and tour details
  const results = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      total: bookings.total,
      subtotal: bookings.subtotal,
      discount: bookings.discount,
      tax: bookings.tax,
      currency: bookings.currency,
      participants: bookings.participants,
      createdAt: bookings.createdAt,
      cancelledAt: bookings.cancelledAt,
      cancellationReason: bookings.cancellationReason,
      specialRequests: bookings.specialRequests,
      tripId: trips.id,
      tripDate: trips.date,
      tripStartTime: trips.startTime,
      tripEndTime: trips.endTime,
      tourId: tours.id,
      tourName: tours.name,
      tourType: tours.type,
      tourDescription: tours.description,
    })
    .from(bookings)
    .innerJoin(trips, eq(bookings.tripId, trips.id))
    .innerJoin(tours, eq(trips.tourId, tours.id))
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.customerId, customer.id),
        eq(bookings.organizationId, customer.organizationId)
      )
    )
    .limit(1);

  if (results.length === 0) {
    throw new Response("Booking not found", { status: 404 });
  }

  const result = results[0];

  return {
    booking: {
      id: result.id,
      bookingNumber: result.bookingNumber,
      status: result.status,
      paymentStatus: result.paymentStatus,
      total: result.total,
      subtotal: result.subtotal,
      discount: result.discount ?? "0",
      tax: result.tax ?? "0",
      currency: result.currency,
      participants: result.participants,
      createdAt: result.createdAt.toISOString(),
      cancelledAt: result.cancelledAt ? result.cancelledAt.toISOString() : null,
      cancellationReason: result.cancellationReason ?? null,
      specialRequests: result.specialRequests,
      trip: {
        id: result.tripId,
        date: result.tripDate,
        startTime: result.tripStartTime,
        endTime: result.tripEndTime,
        tour: {
          id: result.tourId,
          name: result.tourName,
          type: result.tourType,
          description: result.tourDescription,
        },
      },
    },
  };
}

// ============================================================================
// ACTION
// ============================================================================

export async function action({ request, params }: ActionFunctionArgs) {
  const { bookingId } = params;
  if (!bookingId) {
    throw new Response("Booking not found", { status: 404 });
  }

  // Get session token
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").filter(Boolean).map((c) => {
      const [key, ...rest] = c.split("=");
      return [key, rest.join("=")];
    })
  );

  const sessionToken = cookies["customer_session"];
  if (!sessionToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const customer = await getCustomerBySession(sessionToken);
  if (!customer) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse form data
  const formData = await request.formData();
  const action = formData.get("_action");

  if (action === "cancel") {
    const reason = formData.get("reason") as string;
    if (!reason) {
      return new Response(JSON.stringify({ error: "Cancellation reason is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify booking belongs to customer
    const [booking] = await db
      .select({
        id: bookings.id,
        status: bookings.status,
        tripId: bookings.tripId,
        organizationId: bookings.organizationId,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.customerId, customer.id),
          eq(bookings.organizationId, customer.organizationId)
        )
      )
      .limit(1);

    if (!booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if booking can be cancelled
    if (booking.status === "canceled" || booking.status === "no_show" || booking.status === "completed") {
      return new Response(
        JSON.stringify({ error: "This booking cannot be cancelled" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update booking status
    await db
      .update(bookings)
      .set({
        status: "canceled",
        cancelledAt: new Date(),
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    // Sync cancellation to Google Calendar (remove customer from attendees)
    try {
      await syncBookingCancellationToCalendar(
        booking.organizationId,
        booking.tripId
        // timezone defaults to UTC
      );
    } catch (error) {
      // Log error but don't block cancellation
      console.error("Failed to sync cancellation to Google Calendar:", error);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function BookingDetail() {
  const { booking } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const isCancelled = booking.status === "canceled" || booking.status === "no_show";
  const isCompleted = booking.status === "completed";
  const canCancel = !isCancelled && !isCompleted;

  const predefinedReasons = [
    "Schedule conflict",
    "Weather concerns",
    "Medical reasons",
    "Found alternative",
    "Financial reasons",
    "Other (please specify)",
  ];

  const handleCancelBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const reasonToSubmit = cancelReason === "Other (please specify)" ? customReason : cancelReason;

    try {
      const formData = new FormData();
      formData.append("_action", "cancel");
      formData.append("reason", reasonToSubmit);

      const response = await fetch(`/site/account/bookings/${booking.id}`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setSuccessMessage("Your booking has been cancelled successfully.");
        setShowCancelModal(false);
        // Reload the page to show updated status
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to cancel booking");
      }
    } catch (error) {
      alert("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmButtonDisabled =
    !cancelReason ||
    (cancelReason === "Other (please specify)" && !customReason.trim()) ||
    isSubmitting;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/site/account/bookings")}
          className="p-2 rounded-lg transition-colors hover:bg-gray-100"
          style={{ color: "var(--text-color)" }}
        >
          <BackIcon className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-color)" }}>
            Booking Details
          </h1>
          <p className="mt-1 opacity-75">Booking Reference: {booking.bookingNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={booking.status} />
          <PaymentBadge status={booking.paymentStatus} />
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div
          className="rounded-lg border p-4"
          style={{ backgroundColor: "#d1fae5", borderColor: "#059669", color: "#065f46" }}
        >
          {successMessage}
        </div>
      )}

      {/* Trip Information */}
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card-bg)" }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-color)" }}>
          Trip Information
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="opacity-75">Trip Name:</span>
            <span className="font-medium">{booking.trip.tour.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-75">Date:</span>
            <span className="font-medium">{formatDate(booking.trip.date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-75">Time:</span>
            <span className="font-medium">{formatTime(booking.trip.startTime)}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-75">Participants:</span>
            <span className="font-medium">
              {booking.participants} {booking.participants === 1 ? "person" : "people"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-75">Booked:</span>
            <span className="font-medium">{formatDate(booking.createdAt.split("T")[0])}</span>
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card-bg)" }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-color)" }}>
          Payment Summary
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="opacity-75">Subtotal:</span>
            <span>{formatCurrency(booking.subtotal, booking.currency)}</span>
          </div>
          {parseFloat(booking.discount) > 0 && (
            <div className="flex justify-between">
              <span className="opacity-75">Discount:</span>
              <span className="text-green-600">
                -{formatCurrency(booking.discount, booking.currency)}
              </span>
            </div>
          )}
          {parseFloat(booking.tax) > 0 && (
            <div className="flex justify-between">
              <span className="opacity-75">Tax:</span>
              <span>{formatCurrency(booking.tax, booking.currency)}</span>
            </div>
          )}
          <div className="border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex justify-between">
              <span className="font-semibold text-lg" style={{ color: "var(--text-color)" }}>
                Total:
              </span>
              <span className="font-semibold text-lg" style={{ color: "var(--text-color)" }}>
                {formatCurrency(booking.total, booking.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cancellation Information */}
      {isCancelled && (
        <div
          className="rounded-xl border p-6"
          style={{ borderColor: "var(--danger-bg)", backgroundColor: "var(--danger-bg)" }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--danger-text)" }}>
            Cancellation Information
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="opacity-75">Cancelled on:</span>
              <span className="font-medium">
                {booking.cancelledAt ? formatDate(booking.cancelledAt.split("T")[0]) : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-75">Reason:</span>
              <span className="font-medium">{booking.cancellationReason || "No reason provided"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Special Requests */}
      {booking.specialRequests && (
        <div
          className="rounded-xl border p-6"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-card-bg)" }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-color)" }}>
            Special Requests
          </h2>
          <p className="opacity-75">{booking.specialRequests}</p>
        </div>
      )}

      {/* Actions */}
      {canCancel && (
        <div className="flex gap-3">
          <button
            onClick={() => setShowCancelModal(true)}
            className="px-6 py-2.5 rounded-lg font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger-text)" }}
          >
            Cancel Booking
          </button>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-xl max-w-md w-full p-6"
            style={{ backgroundColor: "var(--color-card-bg)" }}
          >
            <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-color)" }}>
              Cancel Booking
            </h3>
            <p className="text-sm opacity-75 mb-4">
              <strong>Warning:</strong> This action cannot be undone. Please select a reason for
              cancellation.
            </p>

            <form onSubmit={handleCancelBooking} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-color)" }}>
                  Cancellation Reason
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    borderColor: "var(--color-border)",
                    backgroundColor: "white",
                    color: "var(--text-color)",
                  }}
                  required
                >
                  <option value="">Select a reason...</option>
                  {predefinedReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              {cancelReason === "Other (please specify)" && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-color)" }}>
                    Please specify your reason
                  </label>
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter your reason for cancellation..."
                    className="w-full px-3 py-2 rounded-lg border"
                    style={{
                      borderColor: "var(--color-border)",
                      backgroundColor: "white",
                      color: "var(--text-color)",
                    }}
                    rows={3}
                    required
                  />
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 rounded-lg border"
                  style={{ borderColor: "var(--color-border)", color: "var(--text-color)" }}
                  disabled={isSubmitting}
                >
                  Keep Booking
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "var(--danger-bg)", color: "var(--danger-text)" }}
                  disabled={confirmButtonDisabled}
                >
                  {isSubmitting ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "#fef3c7", text: "#d97706", label: "Pending" },
    confirmed: { bg: "#d1fae5", text: "#059669", label: "Confirmed" },
    checked_in: { bg: "#dbeafe", text: "#2563eb", label: "Checked In" },
    completed: { bg: "#e5e7eb", text: "#6b7280", label: "Completed" },
    canceled: { bg: "var(--danger-bg)", text: "var(--danger-text)", label: "CANCELLED" },
    no_show: { bg: "var(--danger-bg)", text: "var(--danger-text)", label: "No Show" },
  };

  const style = statusStyles[status] || statusStyles.pending;

  return (
    <span
      className="px-3 py-1.5 rounded-full text-sm font-medium"
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
      className="px-3 py-1.5 rounded-full text-sm font-medium"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
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

function BackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
      />
    </svg>
  );
}

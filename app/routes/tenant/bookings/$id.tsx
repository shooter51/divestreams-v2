import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher } from "react-router";
import { useState } from "react";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { getBookingWithFullDetails, getPaymentsByBookingId, updateBookingStatus, recordPayment } from "../../../../lib/db/queries.server";
import { useNotification, redirectWithNotification } from "../../../../lib/use-notification";
import { redirect } from "react-router";
import { StatusBadge, type BadgeStatus } from "../../../components/ui";

export const meta: MetaFunction = () => [{ title: "Booking Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const bookingId = params.id;

  if (!bookingId) {
    throw new Response("Booking ID is required", { status: 400 });
  }

  // Fetch booking details and payments from database
  const [booking, payments] = await Promise.all([
    getBookingWithFullDetails(organizationId, bookingId),
    getPaymentsByBookingId(organizationId, bookingId),
  ]);

  if (!booking) {
    throw new Response("Booking not found", { status: 404 });
  }

  // Helper to format dates as strings
  const formatDate = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString().split("T")[0];
    }
    return String(date);
  };

  // Format payment dates
  const formattedPayments = payments.map((payment) => ({
    ...payment,
    date: formatDate(payment.date),
  }));

  // Add payments to booking object and format dates
  const bookingWithPayments = {
    ...booking,
    payments: formattedPayments,
    createdAt: formatDate(booking.createdAt),
    updatedAt: formatDate(booking.updatedAt),
    // Format nested trip date
    trip: {
      ...booking.trip,
      date: formatDate(booking.trip.date),
    },
  };

  return { booking: bookingWithPayments };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const bookingId = params.id!;

  if (intent === "cancel") {
    await updateBookingStatus(organizationId, bookingId, "cancelled");
    return redirect(redirectWithNotification(`/tenant/bookings/${bookingId}`, "Booking has been successfully cancelled", "success"));
  }

  if (intent === "confirm") {
    await updateBookingStatus(organizationId, bookingId, "confirmed");
    return redirect(redirectWithNotification(`/tenant/bookings/${bookingId}`, "Booking has been successfully confirmed", "success"));
  }

  if (intent === "complete") {
    await updateBookingStatus(organizationId, bookingId, "completed");
    return redirect(redirectWithNotification(`/tenant/bookings/${bookingId}`, "Booking has been successfully marked as complete", "success"));
  }

  if (intent === "no-show") {
    await updateBookingStatus(organizationId, bookingId, "no_show");
    return redirect(redirectWithNotification(`/tenant/bookings/${bookingId}`, "Booking has been successfully marked as no-show", "success"));
  }

  if (intent === "add-payment") {
    const amountStr = formData.get("amount") as string;
    const amount = parseFloat(amountStr);
    const paymentMethod = formData.get("paymentMethod") as string;
    const notes = formData.get("notes") as string;

    // Validate amount is a valid number
    if (isNaN(amount)) {
      return { error: "Payment amount must be a valid number" };
    }

    // Allow $0 OR >= $1 (but not $0.01-$0.99)
    if (amount > 0 && amount < 1) {
      return { error: "Payment amount must be at least $1 (or $0)" };
    }

    // Don't allow negative amounts
    if (amount < 0) {
      return { error: "Payment amount cannot be negative" };
    }

    if (!paymentMethod) {
      return { error: "Payment method is required" };
    }

    await recordPayment(organizationId, {
      bookingId,
      amount,
      paymentMethod,
      notes: notes || undefined,
    });

    return { paymentAdded: true, message: `Payment of $${amount.toFixed(2)} recorded successfully` };
  }

  if (intent === "send-confirmation") {
    // Email sending would integrate with the email module
    // For now, return success - can be expanded later
    return { emailSent: true };
  }

  return null;
}

export default function BookingDetailPage() {
  useNotification();

  const { booking } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ error?: string; message?: string; paymentAdded?: boolean }>();
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleCancel = () => {
    if (confirm("Are you sure you want to cancel this booking?")) {
      fetcher.submit({ intent: "cancel" }, { method: "post" });
    }
  };

  const handleRecordPayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("intent", "add-payment");
    fetcher.submit(formData, { method: "post" });
    setShowPaymentModal(false);
  };

  const handlePrintBooking = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Booking ${booking.bookingNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 24px; margin-bottom: 5px; }
          .subtitle { color: #666; margin-bottom: 20px; }
          .section { margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
          .section h2 { font-size: 16px; margin: 0 0 10px 0; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .item label { font-size: 12px; color: #666; display: block; }
          .item span { font-weight: bold; }
          .total { font-size: 20px; font-weight: bold; text-align: right; margin-top: 15px; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 14px; }
          .status-confirmed {
            background: var(--success-muted, #d1fae5);
            color: var(--success, #065f46);
          }
          .status-pending {
            background: var(--warning-muted, #fef3c7);
            color: var(--warning, #92400e);
          }
          @media print {
            body { padding: 0; }
            /* Force light mode colors for print */
            .status-confirmed { background: #d1fae5; color: #065f46; }
            .status-pending { background: #fef3c7; color: #92400e; }
          }
        </style>
      </head>
      <body>
        <h1>Booking Confirmation</h1>
        <p class="subtitle">${booking.bookingNumber} • <span class="status status-${booking.status}">${booking.status}</span></p>

        <div class="section">
          <h2>Trip Details</h2>
          <div class="grid">
            <div class="item"><label>Tour</label><span>${booking.trip?.tourName || "N/A"}</span></div>
            <div class="item"><label>Date</label><span>${booking.trip?.date || "N/A"}</span></div>
            <div class="item"><label>Time</label><span>${booking.trip?.startTime || "N/A"} - ${booking.trip?.endTime || "N/A"}</span></div>
            <div class="item"><label>Boat</label><span>${booking.trip?.boatName || "N/A"}</span></div>
          </div>
        </div>

        <div class="section">
          <h2>Customer</h2>
          <div class="grid">
            <div class="item"><label>Name</label><span>${booking.customer?.firstName || ""} ${booking.customer?.lastName || ""}</span></div>
            <div class="item"><label>Email</label><span>${booking.customer?.email || "N/A"}</span></div>
            <div class="item"><label>Phone</label><span>${booking.customer?.phone || "N/A"}</span></div>
            <div class="item"><label>Participants</label><span>${booking.participants}</span></div>
          </div>
        </div>

        <div class="section">
          <h2>Payment Summary</h2>
          <div class="grid">
            <div class="item"><label>Subtotal</label><span>$${booking.pricing?.subtotal || booking.subtotal}</span></div>
            <div class="item"><label>Discount</label><span>-$${booking.pricing?.discount || booking.discount || 0}</span></div>
            <div class="item"><label>Paid</label><span>$${booking.paidAmount}</span></div>
            <div class="item"><label>Balance Due</label><span>$${booking.balanceDue}</span></div>
          </div>
          <div class="total">Total: $${booking.pricing?.total || booking.total}</div>
        </div>

        ${booking.specialRequests ? `
        <div class="section">
          <h2>Special Requests</h2>
          <p>${booking.specialRequests}</p>
        </div>
        ` : ""}

        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  return (
    <div>
      <div className="mb-6">
        <Link to="/tenant/bookings" className="text-brand hover:underline text-sm">
          ← Back to Bookings
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{booking.bookingNumber}</h1>
            <StatusBadge status={booking.status as BadgeStatus} size="md" />
          </div>
          <p className="text-foreground-muted">Created {booking.createdAt}</p>
        </div>
        <div className="flex gap-2">
          {booking.status === "pending" && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="confirm" />
              <button
                type="submit"
                className="bg-success text-white px-4 py-2 rounded-lg hover:bg-success-hover"
              >
                Confirm
              </button>
            </fetcher.Form>
          )}
          {booking.status === "confirmed" && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="complete" />
              <button
                type="submit"
                className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover"
              >
                Mark Complete
              </button>
            </fetcher.Form>
          )}
          <Link
            to={`/tenant/bookings/${booking.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Edit
          </Link>
          {booking.status !== "cancelled" && booking.status !== "completed" && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-danger border border-danger rounded-lg hover:bg-danger-muted"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      {fetcher.data?.message && (
        <div className="bg-success-muted border border-success text-success px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
          {fetcher.data.message}
        </div>
      )}
      {fetcher.data?.error && (
        <div className="bg-danger-muted border border-danger text-danger px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
          {fetcher.data.error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Trip Info */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Trip Details</h2>
            <div className="flex justify-between items-start">
              <div>
                <Link
                  to={`/tenant/tours/${booking.trip.tourId}`}
                  className="text-lg font-medium text-brand hover:underline"
                >
                  {booking.trip.tourName}
                </Link>
                <div className="mt-2 space-y-1 text-sm">
                  <p>
                    <span className="text-foreground-muted">Date:</span> {booking.trip.date}
                  </p>
                  <p>
                    <span className="text-foreground-muted">Time:</span> {booking.trip.startTime} - {booking.trip.endTime}
                  </p>
                  <p>
                    <span className="text-foreground-muted">Boat:</span> {booking.trip.boatName}
                  </p>
                </div>
              </div>
              <Link
                to={`/tenant/trips/${booking.trip.id}`}
                className="text-sm text-brand hover:underline"
              >
                View Trip →
              </Link>
            </div>
          </div>

          {/* Participants */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">
              Participants ({booking.participants})
            </h2>
            <div className="space-y-3">
              {(Array.isArray(booking.participantDetails) ? booking.participantDetails : []).map((p: { name: string; certLevel?: string }, i: number) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-3 bg-surface-inset rounded-lg"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    {p.certLevel && (
                      <p className="text-sm text-foreground-muted">{p.certLevel}</p>
                    )}
                  </div>
                  <span className="text-sm text-foreground-subtle">#{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Equipment */}
          {Array.isArray(booking.equipmentRental) && booking.equipmentRental.length > 0 && (
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Equipment Rental</h2>
              <div className="space-y-2">
                {(Array.isArray(booking.equipmentRental) ? booking.equipmentRental : []).map((item: { item: string; quantity: number; price: number }, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>
                      {item.item} x{item.quantity}
                    </span>
                    <span>${item.price}</span>
                  </div>
                ))}
                <div className="flex justify-between font-medium pt-2 border-t">
                  <span>Equipment Total</span>
                  <span>${booking.pricing.equipmentTotal}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment History */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Payment History</h2>
              {parseFloat(booking.balanceDue) > 0 && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="text-sm text-brand hover:underline"
                >
                  + Record Payment
                </button>
              )}
            </div>
            {booking.payments.length === 0 ? (
              <p className="text-foreground-muted text-sm">No payments recorded.</p>
            ) : (
              <div className="space-y-3">
                {booking.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex justify-between items-center p-3 bg-surface-inset rounded-lg"
                  >
                    <div>
                      <p className="font-medium">${payment.amount}</p>
                      <p className="text-sm text-foreground-muted">
                        {payment.method} • {payment.date}
                      </p>
                      {payment.note && (
                        <p className="text-xs text-foreground-subtle">{payment.note}</p>
                      )}
                    </div>
                    <span className="text-success text-sm">Paid</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {(booking.specialRequests || booking.internalNotes) && (
            <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Notes</h2>
              <div className="space-y-4 text-sm">
                {booking.specialRequests && (
                  <div>
                    <p className="text-foreground-muted mb-1">Special Requests:</p>
                    <p>{booking.specialRequests}</p>
                  </div>
                )}
                {booking.internalNotes && (
                  <div>
                    <p className="text-foreground-muted mb-1">Internal Notes:</p>
                    <p>{booking.internalNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Customer</h2>
            <div className="space-y-2">
              <Link
                to={`/tenant/customers/${booking.customer.id}`}
                className="font-medium text-brand hover:underline"
              >
                {booking.customer.firstName} {booking.customer.lastName}
              </Link>
              <p className="text-sm">{booking.customer.email}</p>
              <p className="text-sm">{booking.customer.phone}</p>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Pricing</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>
                  ${booking.pricing.basePrice} x {booking.pricing.participants} pax
                </span>
                <span>${booking.pricing.subtotal}</span>
              </div>
              {parseFloat(booking.pricing.equipmentTotal) > 0 && (
                <div className="flex justify-between">
                  <span>Equipment</span>
                  <span>${booking.pricing.equipmentTotal}</span>
                </div>
              )}
              {parseFloat(booking.pricing.discount) > 0 && (
                <div className="flex justify-between text-success">
                  <span>Discount</span>
                  <span>-${booking.pricing.discount}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span>${booking.pricing.total}</span>
              </div>
              <div className="flex justify-between text-success">
                <span>Paid</span>
                <span>${booking.paidAmount}</span>
              </div>
              {parseFloat(booking.balanceDue) > 0 && (
                <div className="flex justify-between text-danger font-medium">
                  <span>Balance Due</span>
                  <span>${booking.balanceDue}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="send-confirmation" />
                <button
                  type="submit"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface-inset rounded-lg"
                >
                  📧 Send Confirmation Email
                </button>
              </fetcher.Form>
              <button
                onClick={handlePrintBooking}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-inset rounded-lg"
              >
                🖨️ Print Booking
              </button>
              <Link
                to={`/tenant/trips/${booking.trip?.id}`}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-surface-inset rounded-lg"
              >
                📋 View Trip Manifest
              </Link>
              {booking.status === "confirmed" && (
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="no-show" />
                  <button
                    type="submit"
                    className="w-full text-left px-3 py-2 text-sm text-accent hover:bg-accent-muted rounded-lg"
                  >
                    Mark as No-Show
                  </button>
                </fetcher.Form>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-foreground-subtle space-y-1">
            <p>Source: {booking.source}</p>
            <p>Updated: {booking.updatedAt}</p>
            <p>ID: {booking.id}</p>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Record Payment</h2>
                <p className="text-sm text-foreground-muted">
                  Balance due: ${booking.balanceDue}
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-foreground-subtle hover:text-foreground-muted"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-foreground-muted">$</span>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0.01"
                    max={booking.balanceDue}
                    defaultValue={booking.balanceDue}
                    required
                    className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Payment Method *</label>
                <select
                  name="paymentMethod"
                  required
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  <option value="">Select method...</option>
                  <option value="cash">Cash</option>
                  <option value="card">Credit/Debit Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="stripe">Stripe</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <input
                  type="text"
                  name="notes"
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder="Optional payment notes..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetcher.state === "submitting"}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
                >
                  {fetcher.state === "submitting" ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, useFetcher, redirect } from "react-router";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { getBookingWithFullDetails, getPaymentsByBookingId, updateBookingStatus } from "../../../../lib/db/queries.server";

export const meta: MetaFunction = () => [{ title: "Booking Details - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const bookingId = params.id;

  if (!bookingId) {
    throw new Response("Booking ID is required", { status: 400 });
  }

  // Fetch booking details and payments from database
  const [booking, payments] = await Promise.all([
    getBookingWithFullDetails(tenant.schemaName, bookingId),
    getPaymentsByBookingId(tenant.schemaName, bookingId),
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
  const { tenant } = await requireTenant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const bookingId = params.id!;

  if (intent === "cancel") {
    await updateBookingStatus(tenant.schemaName, bookingId, "cancelled");
    return { cancelled: true };
  }

  if (intent === "confirm") {
    await updateBookingStatus(tenant.schemaName, bookingId, "confirmed");
    return { confirmed: true };
  }

  if (intent === "complete") {
    await updateBookingStatus(tenant.schemaName, bookingId, "completed");
    return { completed: true };
  }

  if (intent === "no-show") {
    await updateBookingStatus(tenant.schemaName, bookingId, "no_show");
    return { noShow: true };
  }

  if (intent === "add-payment") {
    // Payment recording would require a separate transactions insert
    // For now, return success - can be expanded later
    return { paymentAdded: true };
  }

  if (intent === "send-confirmation") {
    // Email sending would integrate with the email module
    // For now, return success - can be expanded later
    return { emailSent: true };
  }

  return null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-orange-100 text-orange-700",
};

export default function BookingDetailPage() {
  const { booking } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const handleCancel = () => {
    if (confirm("Are you sure you want to cancel this booking?")) {
      fetcher.submit({ intent: "cancel" }, { method: "post" });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link to="/app/bookings" className="text-blue-600 hover:underline text-sm">
          ← Back to Bookings
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{booking.bookingNumber}</h1>
            <span
              className={`text-sm px-3 py-1 rounded-full ${
                statusColors[booking.status] || "bg-gray-100 text-gray-700"
              }`}
            >
              {booking.status}
            </span>
          </div>
          <p className="text-gray-500">Created {booking.createdAt}</p>
        </div>
        <div className="flex gap-2">
          {booking.status === "pending" && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="confirm" />
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
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
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Mark Complete
              </button>
            </fetcher.Form>
          )}
          <Link
            to={`/app/bookings/${booking.id}/edit`}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Edit
          </Link>
          {booking.status !== "cancelled" && booking.status !== "completed" && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-6">
          {/* Trip Info */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Trip Details</h2>
            <div className="flex justify-between items-start">
              <div>
                <Link
                  to={`/app/tours/${booking.trip.tourId}`}
                  className="text-lg font-medium text-blue-600 hover:underline"
                >
                  {booking.trip.tourName}
                </Link>
                <div className="mt-2 space-y-1 text-sm">
                  <p>
                    <span className="text-gray-500">Date:</span> {booking.trip.date}
                  </p>
                  <p>
                    <span className="text-gray-500">Time:</span> {booking.trip.startTime} - {booking.trip.endTime}
                  </p>
                  <p>
                    <span className="text-gray-500">Boat:</span> {booking.trip.boatName}
                  </p>
                </div>
              </div>
              <Link
                to={`/app/trips/${booking.trip.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                View Trip →
              </Link>
            </div>
          </div>

          {/* Participants */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">
              Participants ({booking.participants})
            </h2>
            <div className="space-y-3">
              {(Array.isArray(booking.participantDetails) ? booking.participantDetails : []).map((p: { name: string; certLevel?: string }, i: number) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    {p.certLevel && (
                      <p className="text-sm text-gray-500">{p.certLevel}</p>
                    )}
                  </div>
                  <span className="text-sm text-gray-400">#{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Equipment */}
          {Array.isArray(booking.equipmentRental) && booking.equipmentRental.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
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
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Payment History</h2>
              {parseFloat(booking.balanceDue) > 0 && (
                <button className="text-sm text-blue-600 hover:underline">
                  + Record Payment
                </button>
              )}
            </div>
            {booking.payments.length === 0 ? (
              <p className="text-gray-500 text-sm">No payments recorded.</p>
            ) : (
              <div className="space-y-3">
                {booking.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">${payment.amount}</p>
                      <p className="text-sm text-gray-500">
                        {payment.method} • {payment.date}
                      </p>
                      {payment.note && (
                        <p className="text-xs text-gray-400">{payment.note}</p>
                      )}
                    </div>
                    <span className="text-green-600 text-sm">Paid</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {(booking.specialRequests || booking.internalNotes) && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold mb-4">Notes</h2>
              <div className="space-y-4 text-sm">
                {booking.specialRequests && (
                  <div>
                    <p className="text-gray-500 mb-1">Special Requests:</p>
                    <p>{booking.specialRequests}</p>
                  </div>
                )}
                {booking.internalNotes && (
                  <div>
                    <p className="text-gray-500 mb-1">Internal Notes:</p>
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
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Customer</h2>
            <div className="space-y-2">
              <Link
                to={`/app/customers/${booking.customer.id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {booking.customer.firstName} {booking.customer.lastName}
              </Link>
              <p className="text-sm">{booking.customer.email}</p>
              <p className="text-sm">{booking.customer.phone}</p>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
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
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-${booking.pricing.discount}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span>${booking.pricing.total}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Paid</span>
                <span>${booking.paidAmount}</span>
              </div>
              {parseFloat(booking.balanceDue) > 0 && (
                <div className="flex justify-between text-red-600 font-medium">
                  <span>Balance Due</span>
                  <span>${booking.balanceDue}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="send-confirmation" />
                <button
                  type="submit"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
                >
                  📧 Send Confirmation Email
                </button>
              </fetcher.Form>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">
                🖨️ Print Booking
              </button>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg">
                📋 Add to Manifest
              </button>
              {booking.status === "confirmed" && (
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="no-show" />
                  <button
                    type="submit"
                    className="w-full text-left px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg"
                  >
                    Mark as No-Show
                  </button>
                </fetcher.Form>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400 space-y-1">
            <p>Source: {booking.source}</p>
            <p>Updated: {booking.updatedAt}</p>
            <p>ID: {booking.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

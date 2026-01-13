import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useNavigation, Link } from "react-router";
import { eq } from "drizzle-orm";
import { requireTenant } from "../../../../../lib/auth/tenant-auth.server";
import { getBookingWithFullDetails } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";

export const meta: MetaFunction = () => [{ title: "Edit Booking - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const bookingId = params.id;

  if (!bookingId) {
    throw new Response("Booking ID required", { status: 400 });
  }

  const bookingData = await getBookingWithFullDetails(tenant.schemaName, bookingId);

  if (!bookingData) {
    throw new Response("Booking not found", { status: 404 });
  }

  const booking = {
    id: bookingData.id,
    bookingNumber: bookingData.bookingNumber,
    customerId: bookingData.customer.id,
    customerName: `${bookingData.customer.firstName} ${bookingData.customer.lastName}`,
    tripId: bookingData.trip.id,
    tripName: bookingData.trip.tourName,
    participants: bookingData.participants,
    status: bookingData.status,
    totalAmount: bookingData.pricing.total,
    specialRequests: bookingData.specialRequests || "",
    internalNotes: bookingData.internalNotes || "",
  };

  return { booking };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const bookingId = params.id;

  if (!bookingId) {
    throw new Response("Booking ID required", { status: 400 });
  }

  const formData = await request.formData();

  // Get the values we can update
  const participants = parseInt(formData.get("participants") as string) || 1;
  const status = formData.get("status") as string;
  const specialRequests = formData.get("specialRequests") as string;
  const internalNotes = formData.get("internalNotes") as string;

  // Update booking in database
  const { db, schema } = getTenantDb(tenant.schemaName);

  await db
    .update(schema.bookings)
    .set({
      participants,
      status,
      specialRequests,
      internalNotes,
      updatedAt: new Date(),
    })
    .where(eq(schema.bookings.id, bookingId));

  return redirect(`/app/bookings/${bookingId}`);
}

export default function EditBookingPage() {
  const { booking } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to={`/app/bookings/${booking.id}`} className="text-blue-600 hover:underline text-sm">
          ← Back to Booking
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Booking</h1>
        <p className="text-gray-500">{booking.bookingNumber}</p>
      </div>

      <form method="post" className="space-y-6">
        {/* Booking Info (Read-only) */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Booking Details</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Customer</span>
              <Link to={`/app/customers/${booking.customerId}`} className="text-blue-600 hover:underline">
                {booking.customerName}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Trip</span>
              <Link to={`/app/trips/${booking.tripId}`} className="text-blue-600 hover:underline">
                {booking.tripName}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Amount</span>
              <span className="font-medium">${booking.totalAmount}</span>
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Update Booking</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="participants" className="block text-sm font-medium mb-1">
                  Number of Participants *
                </label>
                <input
                  type="number"
                  id="participants"
                  name="participants"
                  required
                  min="1"
                  max="20"
                  defaultValue={booking.participants}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium mb-1">
                  Status *
                </label>
                <select
                  id="status"
                  name="status"
                  required
                  defaultValue={booking.status}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="specialRequests" className="block text-sm font-medium mb-1">
                Special Requests
              </label>
              <textarea
                id="specialRequests"
                name="specialRequests"
                rows={3}
                placeholder="Any special requirements or requests from the customer..."
                defaultValue={booking.specialRequests}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="internalNotes" className="block text-sm font-medium mb-1">
                Internal Notes
              </label>
              <textarea
                id="internalNotes"
                name="internalNotes"
                rows={3}
                placeholder="Notes visible only to staff..."
                defaultValue={booking.internalNotes}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <Link
            to={`/app/bookings/${booking.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

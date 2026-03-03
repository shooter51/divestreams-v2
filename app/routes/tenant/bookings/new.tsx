import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, Link, useLoaderData } from "react-router";
import { requireOrgContext, requireRole} from "../../../../lib/auth/org-context.server";
import { bookingSchema, validateFormData, getFormValues } from "../../../../lib/validation";
import { getCustomers, getTrips, getEquipment, createBooking, getCustomerById, getTripById } from "../../../../lib/db/queries.server";
import { triggerBookingConfirmation, getNotificationSettings } from "../../../../lib/email/triggers";
import { redirectWithNotification } from "../../../../lib/use-notification";
import { CsrfInput } from "../../../components/CsrfInput";

export const meta: MetaFunction = () => [{ title: "New Booking - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const organizationId = ctx.org.id;
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");
  const tripId = url.searchParams.get("tripId");

  // Get today's date for filtering upcoming trips
  const today = new Date().toISOString().split("T")[0];

  // Fetch real data from tenant database
  const [customersResult, tripsData, equipmentData] = await Promise.all([
    getCustomers(organizationId, { limit: 100 }),
    getTrips(organizationId, { fromDate: today, status: "scheduled", limit: 50 }),
    getEquipment(organizationId, { isRentable: true, status: "available" }),
  ]);

  // Map customers to expected format
  const customers = customersResult.customers.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
  }));

  // Map trips to expected format with availability
  const upcomingTrips = tripsData.map((t) => {
    const hasCapacityLimit = (t.maxParticipants ?? 0) > 0;
    const bookedParticipants = t.bookedParticipants || 0;
    const spotsAvailable = hasCapacityLimit ? Math.max(0, t.maxParticipants! - bookedParticipants) : null;
    return {
      id: t.id,
      tourName: t.tourName || "Trip",
      date: typeof t.date === "string" ? t.date : new Date(t.date).toISOString().split("T")[0],
      startTime: t.startTime || "00:00",
      spotsAvailable,
      price: t.price ? t.price.toFixed(2) : "0.00",
    };
  }).filter((t) => t.spotsAvailable === null || t.spotsAvailable > 0);

  // Group equipment by name+price so multiple physical units appear as one entry
  const equipmentGroups = new Map<string, { name: string; price: string; count: number; ids: string[] }>();
  for (const e of equipmentData) {
    const price = e.rentalPrice ? e.rentalPrice.toFixed(2) : "0.00";
    const key = `${e.name}|${price}`;
    if (!equipmentGroups.has(key)) {
      equipmentGroups.set(key, { name: e.name, price, count: 0, ids: [] });
    }
    const entry = equipmentGroups.get(key)!;
    entry.count++;
    entry.ids.push(e.id);
  }
  const rentalEquipment = Array.from(equipmentGroups.values());

  const selectedCustomer = customerId ? customers.find((c) => c.id === customerId) : null;

  // If tripId is provided, fetch it directly so it always pre-fills regardless of status/capacity
  let selectedTrip = tripId ? upcomingTrips.find((t) => t.id === tripId) : null;
  if (tripId && !selectedTrip) {
    const tripData = await getTripById(organizationId, tripId);
    if (tripData) {
      const hasCapacityLimit = (tripData.maxParticipants ?? 0) > 0;
      const bookedParticipants = tripData.bookedParticipants || 0;
      const spotsAvailable = hasCapacityLimit ? Math.max(0, tripData.maxParticipants! - bookedParticipants) : null;
      selectedTrip = {
        id: tripData.id,
        tourName: tripData.tourName || "Trip",
        date: typeof tripData.date === "string" ? tripData.date : new Date(tripData.date).toISOString().split("T")[0],
        startTime: tripData.startTime || "00:00",
        spotsAvailable,
        price: tripData.price ? tripData.price.toFixed(2) : "0.00",
      };
    }
  }

  return { customers, upcomingTrips, rentalEquipment, selectedCustomer, selectedTrip };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const organizationId = ctx.org.id;
  const formData = await request.formData();

  const validation = validateFormData(formData, bookingSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  const data = validation.data;

  // Get customer and trip details for pricing and email
  const [customer, trip] = await Promise.all([
    getCustomerById(organizationId, data.customerId),
    getTripById(organizationId, data.tripId),
  ]);

  if (!customer) {
    return { errors: { customerId: "Customer not found" }, values: getFormValues(formData) };
  }

  if (!trip) {
    return { errors: { tripId: "Trip not found" }, values: getFormValues(formData) };
  }

  // Calculate pricing
  const pricePerPerson = trip.price || 0;
  const participants = data.participants || 1;
  const subtotal = pricePerPerson * participants;
  const total = subtotal; // Could add tax/discounts here

  // Create the booking (transactional with availability check)
  let booking;
  try {
    booking = await createBooking(organizationId, {
      tripId: data.tripId,
      customerId: data.customerId,
      participants,
      subtotal,
      total,
      currency: "USD",
      specialRequests: data.specialRequests,
      source: data.source || "direct",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("spots")) {
      return { errors: { tripId: error.message }, values: getFormValues(formData) };
    }
    throw error;
  }

  // Queue confirmation email if notification settings allow it
  const notifSettings = getNotificationSettings(ctx.org.metadata);
  if (notifSettings.emailBookingConfirmation) {
    try {
      await triggerBookingConfirmation({
        customerEmail: customer.email,
        customerName: `${customer.firstName} ${customer.lastName}`,
        tripName: trip.tourName || "Trip",
        tripDate: typeof trip.date === "string" ? trip.date : new Date(trip.date).toISOString().split("T")[0],
        tripTime: trip.startTime || "",
        participants,
        totalCents: Math.round(total * 100), // Convert to cents for email formatting
        bookingNumber: booking.bookingNumber,
        shopName: ctx.org.name,
        tenantId: ctx.org.id,
      });
    } catch (emailError) {
      console.error("Failed to queue booking confirmation email:", emailError);
    }
  }

  return redirect(redirectWithNotification("/tenant/bookings", "Booking has been successfully created", "success"));
}

function formatTime(t: string | null | undefined): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function NewBookingPage() {
  const { customers, upcomingTrips, rentalEquipment, selectedCustomer, selectedTrip } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/tenant/bookings" className="text-brand hover:underline text-sm">
          ← Back to Bookings
        </Link>
        <h1 className="text-2xl font-bold mt-2">New Booking</h1>
      </div>

      <form method="post" className="space-y-6">
        <CsrfInput />
        {/* Customer Selection */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Customer</h2>
          {selectedCustomer ? (
            <div className="flex items-center justify-between p-3 bg-brand-muted rounded-lg">
              <div>
                <p className="font-medium">
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </p>
                <p className="text-sm text-foreground-muted">{selectedCustomer.email}</p>
              </div>
              <Link
                to="/tenant/bookings/new"
                className="text-sm text-brand hover:underline"
              >
                Change
              </Link>
              <input type="hidden" name="customerId" value={selectedCustomer.id} />
            </div>
          ) : (
            <div>
              <label htmlFor="customerId" className="block text-sm font-medium mb-1">
                Select Customer *
              </label>
              <select
                id="customerId"
                name="customerId"
                defaultValue={actionData?.values?.customerId || ""}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                required
              >
                <option value="">Choose a customer...</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.firstName} {customer.lastName} ({customer.email})
                  </option>
                ))}
              </select>
              {actionData?.errors?.customerId && (
                <p className="text-danger text-sm mt-1">{actionData.errors.customerId}</p>
              )}
              <p className="text-sm text-foreground-muted mt-2">
                <Link to="/tenant/customers/new" className="text-brand hover:underline">
                  + Add new customer
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Trip Selection */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Trip</h2>
          {selectedTrip ? (
            <div className="flex items-center justify-between p-3 bg-brand-muted rounded-lg">
              <div>
                <p className="font-medium">{selectedTrip.tourName}</p>
                <p className="text-sm text-foreground-muted">
                  {selectedTrip.date} at {formatTime(selectedTrip.startTime)} • ${selectedTrip.price}/person
                </p>
                <p className="text-sm text-success">
                  {selectedTrip.spotsAvailable} spots available
                </p>
              </div>
              <Link
                to={`/tenant/bookings/new${selectedCustomer ? `?customerId=${selectedCustomer.id}` : ""}`}
                className="text-sm text-brand hover:underline"
              >
                Change
              </Link>
              <input type="hidden" name="tripId" value={selectedTrip.id} />
            </div>
          ) : (
            <div>
              <label htmlFor="tripId" className="block text-sm font-medium mb-1">
                Select Trip *
              </label>
              <select
                id="tripId"
                name="tripId"
                defaultValue={actionData?.values?.tripId || ""}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                required
              >
                <option value="">Choose a trip...</option>
                {upcomingTrips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.tourName} - {trip.date} at {formatTime(trip.startTime)} (${trip.price}, {trip.spotsAvailable !== null ? `${trip.spotsAvailable} spots` : "unlimited spots"})
                  </option>
                ))}
              </select>
              {actionData?.errors?.tripId && (
                <p className="text-danger text-sm mt-1">{actionData.errors.tripId}</p>
              )}
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Participants</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="participants" className="block text-sm font-medium mb-1">
                Number of Participants *
              </label>
              <input
                type="number"
                id="participants"
                name="participants"
                min="1"
                max={selectedTrip?.spotsAvailable ?? undefined}
                defaultValue={actionData?.values?.participants || "1"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                required
              />
              {selectedTrip && (
                <p className="text-sm text-foreground-muted mt-1">
                  {selectedTrip.spotsAvailable !== null ? `Max ${selectedTrip.spotsAvailable} available` : "Unlimited availability"}
                </p>
              )}
            </div>
          </div>

          {/* Participant Details (optional expansion) */}
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-foreground-muted mb-2">
              Add participant details (optional - can be added later)
            </p>
            <div className="space-y-3">
              <div className="p-3 bg-surface-inset rounded-lg">
                <input
                  type="text"
                  name="participant1Name"
                  placeholder="Participant 1 name"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Equipment Rental */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Equipment Rental</h2>
          <p className="text-sm text-foreground-muted mb-4">Select equipment to rent for this booking</p>
          <div className="grid grid-cols-2 gap-3">
            {rentalEquipment.map((item) => (
              <label
                key={item.name}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-surface-inset cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="equipment"
                    value={item.ids[0]}
                    className="w-4 h-4 text-brand rounded focus:ring-brand"
                  />
                  <span className="text-sm font-medium">
                    {item.name}
                    <span className="text-foreground-muted font-normal"> ({item.count} available)</span>
                  </span>
                </div>
                <span className="text-sm text-foreground-muted">${item.price}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-foreground-subtle mt-3">
            Equipment prices are per person per day. Full Gear Package includes BCD, Regulator, Wetsuit, Mask, Snorkel, and Fins.
          </p>
        </div>

        {/* Notes */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Notes</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="specialRequests" className="block text-sm font-medium mb-1">
                Special Requests
              </label>
              <textarea
                id="specialRequests"
                name="specialRequests"
                rows={2}
                placeholder="Any special requirements from the customer..."
                defaultValue={actionData?.values?.specialRequests}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label htmlFor="internalNotes" className="block text-sm font-medium mb-1">
                Internal Notes
              </label>
              <textarea
                id="internalNotes"
                name="internalNotes"
                rows={2}
                placeholder="Notes visible only to staff..."
                defaultValue={actionData?.values?.internalNotes}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {/* Source */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <label htmlFor="source" className="block text-sm font-medium mb-1">
            Booking Source
          </label>
          <select
            id="source"
            name="source"
            defaultValue={actionData?.values?.source || "direct"}
            className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
          >
            <option value="direct">Direct (Walk-in/Phone)</option>
            <option value="website">Website</option>
            <option value="partner">Partner/Agent</option>
            <option value="repeat">Repeat Customer</option>
            <option value="referral">Referral</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Summary & Actions */}
        {selectedTrip && (
          <div className="bg-brand-muted rounded-xl p-6">
            <h3 className="font-semibold mb-2">Booking Summary</h3>
            <div className="text-sm space-y-1">
              <p>{selectedTrip.tourName}</p>
              <p>{selectedTrip.date} at {formatTime(selectedTrip.startTime)}</p>
              <p className="text-lg font-bold mt-2">
                ${parseFloat(selectedTrip.price).toFixed(2)} per person
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? "Creating..." : "Create Booking"}
          </button>
          <Link
            to="/tenant/bookings"
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

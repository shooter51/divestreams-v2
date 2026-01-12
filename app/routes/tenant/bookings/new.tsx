import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, Link, useLoaderData, useSearchParams } from "react-router";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";
import { bookingSchema, validateFormData, getFormValues } from "../../../../lib/validation";

export const meta: MetaFunction = () => [{ title: "New Booking - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant, db } = await requireTenant(request);
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");
  const tripId = url.searchParams.get("tripId");

  // Mock data - will query tenant DB
  const customers = [
    { id: "1", firstName: "John", lastName: "Smith", email: "john.smith@example.com" },
    { id: "2", firstName: "Sarah", lastName: "Johnson", email: "sarah.j@example.com" },
    { id: "3", firstName: "Mike", lastName: "Wilson", email: "mike.wilson@example.com" },
  ];

  const upcomingTrips = [
    {
      id: "t1",
      tourName: "Morning 2-Tank Dive",
      date: "2026-01-15",
      startTime: "08:00",
      spotsAvailable: 4,
      price: "150.00",
    },
    {
      id: "t2",
      tourName: "Night Dive Adventure",
      date: "2026-01-18",
      startTime: "18:00",
      spotsAvailable: 3,
      price: "120.00",
    },
    {
      id: "t3",
      tourName: "Sunset Dive",
      date: "2026-01-16",
      startTime: "16:00",
      spotsAvailable: 6,
      price: "85.00",
    },
    {
      id: "t4",
      tourName: "Discover Scuba",
      date: "2026-01-20",
      startTime: "09:00",
      spotsAvailable: 2,
      price: "199.00",
    },
  ];

  const selectedCustomer = customerId ? customers.find((c) => c.id === customerId) : null;
  const selectedTrip = tripId ? upcomingTrips.find((t) => t.id === tripId) : null;

  return { customers, upcomingTrips, selectedCustomer, selectedTrip };
}

export async function action({ request }: ActionFunctionArgs) {
  const { tenant, db } = await requireTenant(request);
  const formData = await request.formData();

  const validation = validateFormData(formData, bookingSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  // TODO: Create booking in tenant database
  // Generate booking number: BK-YYYY-XXX
  // const bookingNumber = `BK-${new Date().getFullYear()}-${String(nextId).padStart(3, '0')}`;

  return redirect("/app/bookings");
}

export default function NewBookingPage() {
  const { customers, upcomingTrips, selectedCustomer, selectedTrip } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [searchParams] = useSearchParams();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/app/bookings" className="text-blue-600 hover:underline text-sm">
          ← Back to Bookings
        </Link>
        <h1 className="text-2xl font-bold mt-2">New Booking</h1>
      </div>

      <form method="post" className="space-y-6">
        {/* Customer Selection */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Customer</h2>
          {selectedCustomer ? (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div>
                <p className="font-medium">
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </p>
                <p className="text-sm text-gray-500">{selectedCustomer.email}</p>
              </div>
              <Link
                to="/app/bookings/new"
                className="text-sm text-blue-600 hover:underline"
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                <p className="text-red-500 text-sm mt-1">{actionData.errors.customerId}</p>
              )}
              <p className="text-sm text-gray-500 mt-2">
                <Link to="/app/customers/new" className="text-blue-600 hover:underline">
                  + Add new customer
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Trip Selection */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Trip</h2>
          {selectedTrip ? (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div>
                <p className="font-medium">{selectedTrip.tourName}</p>
                <p className="text-sm text-gray-500">
                  {selectedTrip.date} at {selectedTrip.startTime} • ${selectedTrip.price}/person
                </p>
                <p className="text-sm text-green-600">
                  {selectedTrip.spotsAvailable} spots available
                </p>
              </div>
              <Link
                to={`/app/bookings/new${selectedCustomer ? `?customerId=${selectedCustomer.id}` : ""}`}
                className="text-sm text-blue-600 hover:underline"
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Choose a trip...</option>
                {upcomingTrips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.tourName} - {trip.date} at {trip.startTime} (${trip.price}, {trip.spotsAvailable} spots)
                  </option>
                ))}
              </select>
              {actionData?.errors?.tripId && (
                <p className="text-red-500 text-sm mt-1">{actionData.errors.tripId}</p>
              )}
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
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
                max={selectedTrip?.spotsAvailable || 10}
                defaultValue={actionData?.values?.participants || "1"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              {selectedTrip && (
                <p className="text-sm text-gray-500 mt-1">
                  Max {selectedTrip.spotsAvailable} available
                </p>
              )}
            </div>
          </div>

          {/* Participant Details (optional expansion) */}
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500 mb-2">
              Add participant details (optional - can be added later)
            </p>
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <input
                  type="text"
                  name="participant1Name"
                  placeholder="Participant 1 name"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
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
                rows={2}
                placeholder="Notes visible only to staff..."
                defaultValue={actionData?.values?.internalNotes}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Source */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <label htmlFor="source" className="block text-sm font-medium mb-1">
            Booking Source
          </label>
          <select
            id="source"
            name="source"
            defaultValue={actionData?.values?.source || "direct"}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
          <div className="bg-blue-50 rounded-xl p-6">
            <h3 className="font-semibold mb-2">Booking Summary</h3>
            <div className="text-sm space-y-1">
              <p>{selectedTrip.tourName}</p>
              <p>{selectedTrip.date} at {selectedTrip.startTime}</p>
              <p className="text-lg font-bold mt-2">
                Total: ${(parseFloat(selectedTrip.price) * 1).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">(Price updates based on participants)</p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? "Creating..." : "Create Booking"}
          </button>
          <Link
            to="/app/bookings"
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

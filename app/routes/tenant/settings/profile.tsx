import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { requireTenant } from "../../../../lib/auth/tenant-auth.server";

export const meta: MetaFunction = () => [{ title: "Shop Profile - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant, db } = await requireTenant(request);

  // Mock tenant profile data
  const profile = {
    name: "Coral Bay Diving",
    subdomain: "coralbay",
    email: "info@coralbaydiving.com",
    phone: "+1 (555) 123-4567",
    website: "https://coralbaydiving.com",
    timezone: "America/Los_Angeles",
    currency: "USD",
    address: {
      street: "123 Ocean Drive",
      city: "Coral Bay",
      state: "CA",
      country: "United States",
      postalCode: "90210",
    },
    businessHours: {
      monday: { open: "08:00", close: "18:00", closed: false },
      tuesday: { open: "08:00", close: "18:00", closed: false },
      wednesday: { open: "08:00", close: "18:00", closed: false },
      thursday: { open: "08:00", close: "18:00", closed: false },
      friday: { open: "08:00", close: "18:00", closed: false },
      saturday: { open: "08:00", close: "16:00", closed: false },
      sunday: { open: "", close: "", closed: true },
    },
    bookingSettings: {
      minAdvanceBooking: 24, // hours
      maxAdvanceBooking: 90, // days
      cancellationPolicy: "24h",
      requireDeposit: true,
      depositPercent: 25,
    },
  };

  return { profile };
}

export async function action({ request }: ActionFunctionArgs) {
  const { tenant, db } = await requireTenant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-profile") {
    // TODO: Update tenant profile
    return { success: true, message: "Profile updated successfully" };
  }

  if (intent === "update-booking-settings") {
    // TODO: Update booking settings
    return { success: true, message: "Booking settings updated" };
  }

  return null;
}

const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "GMT/UTC" },
  { value: "Europe/Paris", label: "Central European Time (CET)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET)" },
];

const currencies = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "AUD", label: "AUD (A$)" },
  { value: "CAD", label: "CAD (C$)" },
  { value: "JPY", label: "JPY (¥)" },
  { value: "MXN", label: "MXN ($)" },
  { value: "THB", label: "THB (฿)" },
  { value: "IDR", label: "IDR (Rp)" },
  { value: "PHP", label: "PHP (₱)" },
];

export default function ProfileSettingsPage() {
  const { profile } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link to="/app/settings" className="text-blue-600 hover:underline text-sm">
          ← Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Shop Profile</h1>
        <p className="text-gray-500">Manage your dive shop information</p>
      </div>

      {actionData?.success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          {actionData.message}
        </div>
      )}

      {/* Basic Info */}
      <form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="update-profile" />

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Business Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  defaultValue={profile.name}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subdomain</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={profile.subdomain}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500"
                  />
                  <span className="ml-2 text-gray-500 text-sm whitespace-nowrap">
                    .divestreams.com
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Contact support to change subdomain</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  defaultValue={profile.email}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  defaultValue={profile.phone}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="website" className="block text-sm font-medium mb-1">
                Website
              </label>
              <input
                type="url"
                id="website"
                name="website"
                defaultValue={profile.website}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Location</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="street" className="block text-sm font-medium mb-1">
                Street Address
              </label>
              <input
                type="text"
                id="street"
                name="street"
                defaultValue={profile.address.street}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium mb-1">
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  defaultValue={profile.address.city}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium mb-1">
                  State/Province
                </label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  defaultValue={profile.address.state}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="country" className="block text-sm font-medium mb-1">
                  Country
                </label>
                <input
                  type="text"
                  id="country"
                  name="country"
                  defaultValue={profile.address.country}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="postalCode" className="block text-sm font-medium mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  id="postalCode"
                  name="postalCode"
                  defaultValue={profile.address.postalCode}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Regional Settings */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Regional Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium mb-1">
                Timezone
              </label>
              <select
                id="timezone"
                name="timezone"
                defaultValue={profile.timezone}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="currency" className="block text-sm font-medium mb-1">
                Currency
              </label>
              <select
                id="currency"
                name="currency"
                defaultValue={profile.currency}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {currencies.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Booking Settings */}
      <form method="post" className="mt-8">
        <input type="hidden" name="intent" value="update-booking-settings" />

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Booking Settings</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="minAdvance" className="block text-sm font-medium mb-1">
                  Minimum Advance Booking (hours)
                </label>
                <input
                  type="number"
                  id="minAdvance"
                  name="minAdvanceBooking"
                  min="0"
                  defaultValue={profile.bookingSettings.minAdvanceBooking}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How far in advance customers must book
                </p>
              </div>
              <div>
                <label htmlFor="maxAdvance" className="block text-sm font-medium mb-1">
                  Max Advance Booking (days)
                </label>
                <input
                  type="number"
                  id="maxAdvance"
                  name="maxAdvanceBooking"
                  min="1"
                  defaultValue={profile.bookingSettings.maxAdvanceBooking}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How far in future customers can book
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="cancellation" className="block text-sm font-medium mb-1">
                Cancellation Policy
              </label>
              <select
                id="cancellation"
                name="cancellationPolicy"
                defaultValue={profile.bookingSettings.cancellationPolicy}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="24h">Free cancellation up to 24 hours before</option>
                <option value="48h">Free cancellation up to 48 hours before</option>
                <option value="72h">Free cancellation up to 72 hours before</option>
                <option value="7d">Free cancellation up to 7 days before</option>
                <option value="none">No free cancellation</option>
              </select>
            </div>

            <div className="border-t pt-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="requireDeposit"
                  value="true"
                  defaultChecked={profile.bookingSettings.requireDeposit}
                  className="rounded"
                />
                <div>
                  <span className="font-medium">Require deposit for bookings</span>
                  <p className="text-sm text-gray-500">
                    Collect a percentage upfront when booking
                  </p>
                </div>
              </label>

              <div className="mt-4 ml-6">
                <label htmlFor="depositPercent" className="block text-sm font-medium mb-1">
                  Deposit Percentage
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    id="depositPercent"
                    name="depositPercent"
                    min="0"
                    max="100"
                    defaultValue={profile.bookingSettings.depositPercent}
                    className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isSubmitting ? "Saving..." : "Save Booking Settings"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

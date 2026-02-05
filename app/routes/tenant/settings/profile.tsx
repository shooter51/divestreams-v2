import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { organization } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export const meta: MetaFunction = () => [{ title: "Shop Profile - DiveStreams" }];

// Type for organization metadata
interface OrgMetadata {
  email?: string;
  phone?: string;
  website?: string;
  timezone?: string;
  currency?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  booking?: {
    minAdvanceBooking?: number;
    maxAdvanceBooking?: number;
    cancellationPolicy?: string;
    requireDeposit?: boolean;
    depositPercent?: number;
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Parse metadata from JSON string
  const metadata: OrgMetadata = ctx.org.metadata ? JSON.parse(ctx.org.metadata) : {};

  const profile = {
    name: ctx.org.name,
    slug: ctx.org.slug,
    email: metadata.email || "",
    phone: metadata.phone || "",
    website: metadata.website || "",
    timezone: metadata.timezone || "America/New_York",
    currency: metadata.currency || "USD",
    address: {
      street: metadata.address?.street || "",
      city: metadata.address?.city || "",
      state: metadata.address?.state || "",
      country: metadata.address?.country || "",
      postalCode: metadata.address?.postalCode || "",
    },
    bookingSettings: {
      minAdvanceBooking: metadata.booking?.minAdvanceBooking ?? 24,
      maxAdvanceBooking: metadata.booking?.maxAdvanceBooking ?? 90,
      cancellationPolicy: metadata.booking?.cancellationPolicy || "24h",
      requireDeposit: metadata.booking?.requireDeposit ?? false,
      depositPercent: metadata.booking?.depositPercent ?? 25,
    },
  };

  return { profile, orgId: ctx.org.id, isPremium: ctx.isPremium };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // Parse current metadata from JSON string
  const currentMetadata: OrgMetadata = ctx.org.metadata ? JSON.parse(ctx.org.metadata) : {};

  if (intent === "update-profile") {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = (formData.get("phone") as string) || undefined;
    const website = (formData.get("website") as string) || undefined;
    const timezone = formData.get("timezone") as string;
    const currency = formData.get("currency") as string;

    const address = {
      street: (formData.get("street") as string) || undefined,
      city: (formData.get("city") as string) || undefined,
      state: (formData.get("state") as string) || undefined,
      country: (formData.get("country") as string) || undefined,
      postalCode: (formData.get("postalCode") as string) || undefined,
    };

    // Store metadata as JSON string
    const newMetadata = JSON.stringify({
      ...currentMetadata,
      email,
      phone,
      website,
      timezone,
      currency,
      address,
    });

    await db
      .update(organization)
      .set({
        name,
        metadata: newMetadata,
      })
      .where(eq(organization.id, ctx.org.id));

    return { success: true, message: "Profile updated successfully" };
  }

  if (intent === "update-booking-settings") {
    const minAdvanceBooking = Number(formData.get("minAdvanceBooking")) || 24;
    const maxAdvanceBooking = Number(formData.get("maxAdvanceBooking")) || 90;
    const cancellationPolicy = (formData.get("cancellationPolicy") as string) || "24h";
    const requireDeposit = formData.get("requireDeposit") === "true";
    const depositPercentStr = formData.get("depositPercent") as string;
    const depositPercent = parseFloat(depositPercentStr);

    // Validate deposit percentage (0-100)
    if (isNaN(depositPercent)) {
      return { error: "Deposit percentage must be a valid number" };
    }
    if (depositPercent < 0 || depositPercent > 100) {
      return { error: "Deposit percentage must be between 0 and 100" };
    }

    // Store metadata as JSON string
    const newMetadata = JSON.stringify({
      ...currentMetadata,
      booking: {
        ...currentMetadata.booking,
        minAdvanceBooking,
        maxAdvanceBooking,
        cancellationPolicy,
        requireDeposit,
        depositPercent,
      },
    });

    await db
      .update(organization)
      .set({
        metadata: newMetadata,
      })
      .where(eq(organization.id, ctx.org.id));

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
        <Link to="/tenant/settings" className="text-brand hover:underline text-sm">
          ← Back to Settings
        </Link>
        <h1 className="text-2xl font-bold mt-2">Shop Profile</h1>
        <p className="text-foreground-muted">Manage your dive shop information</p>
      </div>

      {actionData?.success && (
        <div className="bg-success-muted border border-success-muted text-success px-4 py-3 rounded-lg max-w-4xl break-words mb-6">
          {actionData.message}
        </div>
      )}

      {/* Basic Info */}
      <form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="update-profile" />

        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
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
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">URL Slug</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={profile.slug}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-surface-inset text-foreground-muted"
                  />
                  <span className="ml-2 text-foreground-muted text-sm whitespace-nowrap">
                    .divestreams.com
                  </span>
                </div>
                <p className="text-xs text-foreground-muted mt-1">Contact support to change URL slug</p>
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
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
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
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Regional Settings */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
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
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-muted"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Booking Settings */}
      <form method="post" className="mt-8">
        <input type="hidden" name="intent" value="update-booking-settings" />

        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
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
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
                <p className="text-xs text-foreground-muted mt-1">
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
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
                <p className="text-xs text-foreground-muted mt-1">
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
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                  <p className="text-sm text-foreground-muted">
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
                    className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  />
                  <span className="text-foreground-muted">%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-muted"
            >
              {isSubmitting ? "Saving..." : "Save Booking Settings"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

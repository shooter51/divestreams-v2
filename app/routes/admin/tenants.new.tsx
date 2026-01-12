import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { db } from "../../../lib/db";
import { subscriptionPlans } from "../../../lib/db/schema";
import { createTenant, isSubdomainAvailable } from "../../../lib/db/tenant.server";
import { seedDemoData } from "../../../lib/db/seed-demo-data.server";
import { eq } from "drizzle-orm";

export const meta: MetaFunction = () => [{ title: "Create Tenant - DiveStreams Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const plans = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true));

  return { plans };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const subdomain = (formData.get("subdomain") as string)?.toLowerCase().trim();
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const timezone = formData.get("timezone") as string;
  const currency = formData.get("currency") as string;
  const planId = formData.get("planId") as string;
  const populateDemoData = formData.get("populateDemoData") === "on";

  // Validation
  const errors: Record<string, string> = {};
  if (!subdomain) errors.subdomain = "Subdomain is required";
  else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(subdomain)) {
    errors.subdomain = "Invalid subdomain format";
  }
  if (!name) errors.name = "Name is required";
  if (!email) errors.email = "Email is required";

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  // Check subdomain availability
  const available = await isSubdomainAvailable(subdomain);
  if (!available) {
    return { errors: { subdomain: "This subdomain is already taken" } };
  }

  try {
    const tenant = await createTenant({
      subdomain,
      name,
      email,
      phone: phone || undefined,
      timezone: timezone || "UTC",
      currency: currency || "USD",
      planId: planId || undefined,
    });

    // Seed demo data if requested
    if (populateDemoData) {
      try {
        await seedDemoData(tenant.schemaName);
      } catch (seedError) {
        console.error("Failed to seed demo data:", seedError);
        // Don't fail the whole operation if seeding fails
      }
    }

    return redirect("/dashboard");
  } catch (error) {
    console.error("Failed to create tenant:", error);
    return { errors: { form: "Failed to create tenant. Please try again." } };
  }
}

const timezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const currencies = ["USD", "EUR", "GBP", "AUD", "CAD", "JPY", "THB", "MXN", "BRL"];

export default function CreateTenantPage() {
  const { plans } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/dashboard" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Tenants
        </Link>
        <h1 className="text-2xl font-bold mt-2">Create Tenant</h1>
      </div>

      <form method="post" className="bg-white rounded-xl p-6 shadow-sm space-y-6">
        {actionData?.errors?.form && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {actionData.errors.form}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label htmlFor="subdomain" className="block text-sm font-medium mb-1">
              Subdomain *
            </label>
            <div className="flex items-center">
              <input
                type="text"
                id="subdomain"
                name="subdomain"
                placeholder="myshop"
                pattern="[a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9]"
                className="flex-1 px-3 py-2 border rounded-l-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              <span className="bg-gray-100 px-3 py-2 border border-l-0 rounded-r-lg text-gray-500">
                .divestreams.com
              </span>
            </div>
            {actionData?.errors?.subdomain && (
              <p className="text-red-500 text-sm mt-1">{actionData.errors.subdomain}</p>
            )}
          </div>

          <div className="col-span-2">
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Business Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            {actionData?.errors?.name && (
              <p className="text-red-500 text-sm mt-1">{actionData.errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Owner Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            {actionData?.errors?.email && (
              <p className="text-red-500 text-sm mt-1">{actionData.errors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-1">
              Phone
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="timezone" className="block text-sm font-medium mb-1">
              Timezone
            </label>
            <select
              id="timezone"
              name="timezone"
              defaultValue="UTC"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
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
              defaultValue="USD"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label htmlFor="planId" className="block text-sm font-medium mb-1">
              Subscription Plan
            </label>
            <select
              id="planId"
              name="planId"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a plan...</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.displayName} (${(plan.monthlyPrice / 100).toFixed(0)}/mo)
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2 pt-2">
            <label className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100">
              <input
                type="checkbox"
                name="populateDemoData"
                className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium text-blue-900">Populate with demo data</span>
                <p className="text-sm text-blue-700">
                  Add sample customers, dive sites, boats, equipment, tours, and bookings
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {isSubmitting ? "Creating..." : "Create Tenant"}
          </button>
          <Link to="/dashboard" className="px-6 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

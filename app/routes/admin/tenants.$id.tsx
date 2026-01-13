import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { db } from "../../../lib/db";
import { tenants, subscriptionPlans } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";
import { deleteTenant } from "../../../lib/db/tenant.server";

export const meta: MetaFunction = () => [{ title: "Edit Tenant - DiveStreams Admin" }];

export async function loader({ params }: LoaderFunctionArgs) {
  const tenantId = params.id;
  if (!tenantId) throw new Response("Not found", { status: 404 });

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) throw new Response("Not found", { status: 404 });

  const plans = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true));

  return {
    tenant: {
      ...tenant,
      trialEndsAt: tenant.trialEndsAt?.toISOString().split("T")[0] || "",
      currentPeriodEnd: tenant.currentPeriodEnd?.toISOString().split("T")[0] || "",
    },
    plans,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const tenantId = params.id;
  if (!tenantId) throw new Response("Not found", { status: 404 });

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    await deleteTenant(tenantId);
    return redirect("/dashboard");
  }

  // Update tenant
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const timezone = formData.get("timezone") as string;
  const currency = formData.get("currency") as string;
  const planId = formData.get("planId") as string;
  const subscriptionStatus = formData.get("subscriptionStatus") as string;
  const trialEndsAt = formData.get("trialEndsAt") as string;
  const isActive = formData.get("isActive") === "on";

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Name is required";
  if (!email) errors.email = "Email is required";

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  try {
    await db
      .update(tenants)
      .set({
        name,
        email,
        phone: phone || null,
        timezone: timezone || "UTC",
        currency: currency || "USD",
        planId: planId || null,
        subscriptionStatus: subscriptionStatus || "trialing",
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    return { success: true };
  } catch (error) {
    console.error("Failed to update tenant:", error);
    return { errors: { form: "Failed to update tenant. Please try again." } };
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

const statuses = ["trialing", "active", "past_due", "canceled"];

export default function EditTenantPage() {
  const { tenant, plans } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${tenant.name}"? This will remove all their data and cannot be undone.`)) {
      const form = document.createElement("form");
      form.method = "post";
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "intent";
      input.value = "delete";
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/dashboard" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Tenants
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Tenant</h1>
        <p className="text-gray-600">{tenant.subdomain}.divestreams.com</p>
      </div>

      <form method="post" className="bg-white rounded-xl p-6 shadow-sm space-y-6">
        {actionData?.errors?.form && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {actionData.errors.form}
          </div>
        )}

        {actionData?.success && (
          <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm">
            Tenant updated successfully
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1 text-gray-600">
              Subdomain (cannot be changed)
            </label>
            <div className="flex items-center">
              <input
                type="text"
                value={tenant.subdomain}
                disabled
                className="flex-1 px-3 py-2 border rounded-l-lg bg-gray-50 text-gray-600"
              />
              <span className="bg-gray-100 px-3 py-2 border border-l-0 rounded-r-lg text-gray-600">
                .divestreams.com
              </span>
            </div>
          </div>

          <div className="col-span-2">
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Business Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={tenant.name}
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
              defaultValue={tenant.email}
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
              defaultValue={tenant.phone || ""}
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
              defaultValue={tenant.timezone}
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
              defaultValue={tenant.currency}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="planId" className="block text-sm font-medium mb-1">
              Subscription Plan
            </label>
            <select
              id="planId"
              name="planId"
              defaultValue={tenant.planId || ""}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.displayName} (${(plan.monthlyPrice / 100).toFixed(0)}/mo)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="subscriptionStatus" className="block text-sm font-medium mb-1">
              Status
            </label>
            <select
              id="subscriptionStatus"
              name="subscriptionStatus"
              defaultValue={tenant.subscriptionStatus}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="trialEndsAt" className="block text-sm font-medium mb-1">
              Trial Ends At
            </label>
            <input
              type="date"
              id="trialEndsAt"
              name="trialEndsAt"
              defaultValue={tenant.trialEndsAt}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="col-span-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={tenant.isActive}
                className="rounded"
              />
              <span className="text-sm font-medium">Active</span>
            </label>
            <p className="text-xs text-gray-600 mt-1">
              Inactive tenants cannot access their dashboard
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
            <Link to="/dashboard" className="px-6 py-2 border rounded-lg hover:bg-gray-50">
              Cancel
            </Link>
          </div>

          <div className="flex gap-3">
            <a
              href={`https://${tenant.subdomain}.divestreams.com/app`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              Open Dashboard &rarr;
            </a>
            <button
              type="button"
              onClick={handleDelete}
              className="text-sm text-red-600 hover:underline"
            >
              Delete Tenant
            </button>
          </div>
        </div>
      </form>

      {/* Stripe Info */}
      {(tenant.stripeCustomerId || tenant.stripeSubscriptionId) && (
        <div className="mt-6 bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Stripe Integration</h2>
          <div className="text-sm space-y-2">
            {tenant.stripeCustomerId && (
              <p>
                <span className="text-gray-600">Customer ID:</span>{" "}
                <code className="bg-gray-100 px-2 py-1 rounded">{tenant.stripeCustomerId}</code>
              </p>
            )}
            {tenant.stripeSubscriptionId && (
              <p>
                <span className="text-gray-600">Subscription ID:</span>{" "}
                <code className="bg-gray-100 px-2 py-1 rounded">{tenant.stripeSubscriptionId}</code>
              </p>
            )}
            {tenant.currentPeriodEnd && (
              <p>
                <span className="text-gray-600">Current Period Ends:</span> {tenant.currentPeriodEnd}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { db } from "../../../lib/db";
import { subscriptionPlans } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";
import { FEATURE_LABELS, type PlanFeaturesObject, type PlanFeatureKey, type PlanLimits } from "../../../lib/plan-features";

export const meta: MetaFunction = () => [{ title: "Edit Plan - DiveStreams Admin" }];

export async function loader({ params }: LoaderFunctionArgs) {
  const planId = params.id;

  // Handle "new" plan
  if (planId === "new") {
    return {
      plan: null,
      isNew: true,
    };
  }

  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId!))
    .limit(1);

  if (!plan) throw new Response("Not found", { status: 404 });

  return { plan, isNew: false };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const planId = params.id;
  const formData = await request.formData();

  const name = (formData.get("name") as string)?.toLowerCase().trim();
  const displayName = formData.get("displayName") as string;
  const monthlyPrice = Math.round(parseFloat(formData.get("monthlyPrice") as string) * 100);
  const yearlyPrice = Math.round(parseFloat(formData.get("yearlyPrice") as string) * 100);
  const monthlyPriceId = formData.get("monthlyPriceId") as string;
  const yearlyPriceId = formData.get("yearlyPriceId") as string;

  // Parse boolean feature flags from checkboxes
  const featureFlags: Record<string, boolean> = {};
  for (const key of Object.keys(FEATURE_LABELS)) {
    featureFlags[key] = formData.get(`feature_${key}`) === "on";
  }

  // Parse marketing descriptions (one per line)
  const descriptionsRaw = formData.get("featureDescriptions") as string;
  const descriptions = descriptionsRaw
    ? descriptionsRaw.split("\n").map((f) => f.trim()).filter(Boolean)
    : [];

  // Combine into features object
  const features: PlanFeaturesObject = {
    ...featureFlags,
    descriptions,
  };

  const limitUsers = parseInt(formData.get("limitUsers") as string) || -1;
  const limitCustomers = parseInt(formData.get("limitCustomers") as string) || -1;
  const limitTours = parseInt(formData.get("limitTours") as string) || -1;
  const limitStorage = parseInt(formData.get("limitStorage") as string) || -1;
  const isActive = formData.get("isActive") === "on";

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Name is required";
  if (!displayName) errors.displayName = "Display name is required";
  if (isNaN(monthlyPrice)) errors.monthlyPrice = "Invalid monthly price";
  if (isNaN(yearlyPrice)) errors.yearlyPrice = "Invalid yearly price";

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const limits = {
    users: limitUsers,
    customers: limitCustomers,
    toursPerMonth: limitTours,
    storageGb: limitStorage,
  };

  try {
    if (planId === "new") {
      // Create new plan
      await db.insert(subscriptionPlans).values({
        name,
        displayName,
        monthlyPrice,
        yearlyPrice,
        monthlyPriceId: monthlyPriceId || null,
        yearlyPriceId: yearlyPriceId || null,
        features,
        limits,
        isActive,
      });
    } else {
      // Update existing plan
      await db
        .update(subscriptionPlans)
        .set({
          name,
          displayName,
          monthlyPrice,
          yearlyPrice,
          monthlyPriceId: monthlyPriceId || null,
          yearlyPriceId: yearlyPriceId || null,
          features,
          limits,
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionPlans.id, planId!));
    }

    return redirect("/plans");
  } catch (error) {
    console.error("Failed to save plan:", error);
    return { errors: { form: "Failed to save plan. Please try again." } };
  }
}

export default function EditPlanPage() {
  const { plan, isNew } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const limits = plan?.limits as PlanLimits | undefined;

  // Handle both old format (string[]) and new format (PlanFeaturesObject)
  const rawFeatures = plan?.features;
  const planFeatures: PlanFeaturesObject | undefined = Array.isArray(rawFeatures)
    ? { descriptions: rawFeatures } // Legacy: convert string[] to { descriptions: string[] }
    : (rawFeatures as PlanFeaturesObject | undefined);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/plans" className="text-brand hover:underline text-sm">
          &larr; Back to Plans
        </Link>
        <h1 className="text-2xl font-bold mt-2">
          {isNew ? "Create Plan" : "Edit Plan"}
        </h1>
      </div>

      <form method="post" className="bg-surface-raised rounded-xl p-6 shadow-sm space-y-6">
        {actionData?.errors?.form && (
          <div className="bg-danger-muted text-danger p-3 rounded-lg text-sm">
            {actionData.errors.form}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Internal Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={plan?.name || ""}
              placeholder="e.g., starter, pro, enterprise"
              pattern="[a-z0-9_-]+"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand font-mono"
              required
            />
            {actionData?.errors?.name && (
              <p className="text-danger text-sm mt-1">{actionData.errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium mb-1">
              Display Name *
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              defaultValue={plan?.displayName || ""}
              placeholder="e.g., Starter, Professional"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              required
            />
            {actionData?.errors?.displayName && (
              <p className="text-danger text-sm mt-1">{actionData.errors.displayName}</p>
            )}
          </div>

          <div>
            <label htmlFor="monthlyPrice" className="block text-sm font-medium mb-1">
              Monthly Price (USD) *
            </label>
            <input
              type="number"
              id="monthlyPrice"
              name="monthlyPrice"
              step="0.01"
              min="0"
              defaultValue={plan ? (plan.monthlyPrice / 100).toFixed(2) : ""}
              placeholder="49.00"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              required
            />
            {actionData?.errors?.monthlyPrice && (
              <p className="text-danger text-sm mt-1">{actionData.errors.monthlyPrice}</p>
            )}
          </div>

          <div>
            <label htmlFor="yearlyPrice" className="block text-sm font-medium mb-1">
              Yearly Price (USD) *
            </label>
            <input
              type="number"
              id="yearlyPrice"
              name="yearlyPrice"
              step="0.01"
              min="0"
              defaultValue={plan ? (plan.yearlyPrice / 100).toFixed(2) : ""}
              placeholder="470.00"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              required
            />
            {actionData?.errors?.yearlyPrice && (
              <p className="text-danger text-sm mt-1">{actionData.errors.yearlyPrice}</p>
            )}
          </div>

          <div>
            <label htmlFor="monthlyPriceId" className="block text-sm font-medium mb-1">
              Stripe Monthly Price ID
            </label>
            <input
              type="text"
              id="monthlyPriceId"
              name="monthlyPriceId"
              defaultValue={plan?.monthlyPriceId || ""}
              placeholder="price_..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand font-mono text-sm"
            />
          </div>

          <div>
            <label htmlFor="yearlyPriceId" className="block text-sm font-medium mb-1">
              Stripe Yearly Price ID
            </label>
            <input
              type="text"
              id="yearlyPriceId"
              name="yearlyPriceId"
              defaultValue={plan?.yearlyPriceId || ""}
              placeholder="price_..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand font-mono text-sm"
            />
          </div>

          <div className="col-span-2">
            <h3 className="text-sm font-medium mb-3">Plan Features</h3>
            <div className="grid grid-cols-2 gap-3 p-4 bg-surface-inset rounded-lg">
              {(Object.entries(FEATURE_LABELS) as [PlanFeatureKey, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name={`feature_${key}`}
                    defaultChecked={planFeatures?.[key] === true}
                    className="rounded border-strong text-brand focus:ring-brand"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="col-span-2">
            <label htmlFor="featureDescriptions" className="block text-sm font-medium mb-1">
              Feature Descriptions (for pricing page, one per line)
            </label>
            <textarea
              id="featureDescriptions"
              name="featureDescriptions"
              rows={5}
              defaultValue={planFeatures?.descriptions?.join("\n") || ""}
              placeholder="Up to 3 users, 1,000 customers, Basic reporting..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
            <p className="text-xs text-foreground-muted mt-1">
              Marketing text displayed on the pricing page (separate from technical feature flags above)
            </p>
          </div>

          <div className="col-span-2">
            <h3 className="text-sm font-medium mb-3">Limits (-1 for unlimited)</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label htmlFor="limitUsers" className="block text-xs text-foreground-muted mb-1">
                  Team Members
                </label>
                <input
                  type="number"
                  id="limitUsers"
                  name="limitUsers"
                  min={-1}
                  defaultValue={limits?.users ?? -1}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label htmlFor="limitCustomers" className="block text-xs text-foreground-muted mb-1">
                  Customers
                </label>
                <input
                  type="number"
                  id="limitCustomers"
                  name="limitCustomers"
                  min={-1}
                  defaultValue={limits?.customers ?? -1}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label htmlFor="limitTours" className="block text-xs text-foreground-muted mb-1">
                  Tours per Month
                </label>
                <input
                  type="number"
                  id="limitTours"
                  name="limitTours"
                  min={-1}
                  defaultValue={limits?.toursPerMonth ?? -1}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label htmlFor="limitStorage" className="block text-xs text-foreground-muted mb-1">
                  Storage GB
                </label>
                <input
                  type="number"
                  id="limitStorage"
                  name="limitStorage"
                  min={0}
                  step="0.1"
                  defaultValue={limits?.storageGb ?? -1}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
          </div>

          <div className="col-span-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={plan?.isActive ?? true}
                className="rounded"
              />
              <span className="text-sm font-medium">Active</span>
            </label>
            <p className="text-xs text-foreground-muted mt-1">
              Inactive plans won't be shown on the pricing page
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? "Saving..." : isNew ? "Create Plan" : "Save Changes"}
          </button>
          <Link to="/plans" className="px-6 py-2 border rounded-lg hover:bg-surface-inset">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

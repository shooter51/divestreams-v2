import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, useLoaderData, Link } from "react-router";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { tourSchema, validateFormData, getFormValues } from "../../../../lib/validation";
import { createTour } from "../../../../lib/db/queries.server";
import { requireLimit } from "../../../../lib/require-feature.server";
import { DEFAULT_PLAN_LIMITS } from "../../../../lib/plan-features";
import { redirectWithNotification, useNotification } from "../../../../lib/use-notification";

export const meta: MetaFunction = () => [{ title: "Create Tour - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const limits = ctx.subscription?.planDetails?.limits ?? DEFAULT_PLAN_LIMITS.free;
  const limitCheck = await requireLimit(ctx.org.id, "toursPerMonth", limits);
  return {
    limitRemaining: limitCheck.remaining,
    limitMax: limitCheck.limit,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const formData = await request.formData();

  // Parse inclusions/exclusions from comma-separated strings
  const inclusionsStr = formData.get("inclusionsStr") as string;
  const exclusionsStr = formData.get("exclusionsStr") as string;
  const requirementsStr = formData.get("requirementsStr") as string;

  if (inclusionsStr) {
    formData.set("inclusions", JSON.stringify(inclusionsStr.split(",").map((s) => s.trim()).filter(Boolean)));
  }
  if (exclusionsStr) {
    formData.set("exclusions", JSON.stringify(exclusionsStr.split(",").map((s) => s.trim()).filter(Boolean)));
  }
  if (requirementsStr) {
    formData.set("requirements", JSON.stringify(requirementsStr.split(",").map((s) => s.trim()).filter(Boolean)));
  }

  // Convert numeric fields
  const price = formData.get("price");
  if (price) formData.set("price", price.toString());
  const maxParticipants = formData.get("maxParticipants");
  if (maxParticipants) formData.set("maxParticipants", maxParticipants.toString());
  const minParticipants = formData.get("minParticipants");
  if (minParticipants) formData.set("minParticipants", minParticipants.toString());
  const duration = formData.get("duration");
  if (duration) formData.set("duration", duration.toString());
  const minAge = formData.get("minAge");
  if (minAge) formData.set("minAge", minAge.toString());

  const validation = validateFormData(formData, tourSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  // Additional server-side price validation
  const priceStr = formData.get("price") as string;
  const priceNum = parseFloat(priceStr);
  if (isNaN(priceNum)) {
    return {
      errors: { price: "Price must be a valid number" },
      values: getFormValues(formData)
    };
  }
  if (priceNum < 1) {
    return {
      errors: { price: "Price must be at least $1" },
      values: getFormValues(formData)
    };
  }

  let newTour;
  try {
    newTour = await createTour(organizationId, {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || undefined,
      type: formData.get("type") as string,
      duration: formData.get("duration") ? Number(formData.get("duration")) : undefined,
      maxParticipants: Number(formData.get("maxParticipants")),
      minParticipants: formData.get("minParticipants") ? Number(formData.get("minParticipants")) : undefined,
      price: Number(formData.get("price")),
      currency: (formData.get("currency") as string) || undefined,
      includesEquipment: formData.get("includesEquipment") === "true",
      includesMeals: formData.get("includesMeals") === "true",
      includesTransport: formData.get("includesTransport") === "true",
      minCertLevel: (formData.get("minCertLevel") as string) || undefined,
      minAge: formData.get("minAge") ? Number(formData.get("minAge")) : undefined,
    });
  } catch (error: any) {
    // Handle unique constraint violation
    if (error?.code === "23505" || error?.message?.includes("duplicate") || error?.message?.includes("unique")) {
      return {
        errors: { name: "A tour with this name already exists" },
        values: getFormValues(formData)
      };
    }
    // Re-throw other errors
    throw error;
  }

  const tourName = formData.get("name") as string;
  // Redirect to edit page to allow image upload
  return redirect(redirectWithNotification(`/tenant/tours/${newTour.id}/edit`, `Tour "${tourName}" created! Now add images to complete your tour listing.`, "success"));
}

export default function NewTourPage() {
  const { limitRemaining, limitMax } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const isNearLimit = limitMax !== -1 && limitRemaining <= Math.ceil(limitMax * 0.2);

  // Show notifications from URL params
  useNotification();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/tenant/tours" className="text-brand hover:underline text-sm">
          ← Back to Tours
        </Link>
        <h1 className="text-2xl font-bold mt-2">Create Tour</h1>
        <p className="text-foreground-muted">
          Create a tour template that can be scheduled as trips.
        </p>
      </div>

      <form method="post" className="space-y-6">
        {/* Basic Info */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Tour Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                defaultValue={actionData?.values?.name}
                placeholder="e.g., Morning 2-Tank Dive"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                required
              />
              {actionData?.errors?.name && (
                <p className="text-danger text-sm mt-1">{actionData.errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={actionData?.values?.description}
                placeholder="Describe the tour experience..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="type" className="block text-sm font-medium mb-1">
                  Tour Type *
                </label>
                <select
                  id="type"
                  name="type"
                  defaultValue={actionData?.values?.type || "single_dive"}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  required
                >
                  <option value="single_dive">Single Dive</option>
                  <option value="multi_dive">Multi-Dive</option>
                  <option value="course">Course</option>
                  <option value="snorkel">Snorkel</option>
                  <option value="night_dive">Night Dive</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="duration" className="block text-sm font-medium mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  id="duration"
                  name="duration"
                  min="1"
                  defaultValue={actionData?.values?.duration || "120"}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pricing & Capacity */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Pricing & Capacity</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium mb-1">
                Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-foreground-muted">$</span>
                <input
                  type="number"
                  id="price"
                  name="price"
                  step="0.01"
                  min="0"
                  defaultValue={actionData?.values?.price}
                  className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                  required
                />
              </div>
              {actionData?.errors?.price && (
                <p className="text-danger text-sm mt-1">{actionData.errors.price}</p>
              )}
            </div>

            <div>
              <label htmlFor="currency" className="block text-sm font-medium mb-1">
                Currency
              </label>
              <select
                id="currency"
                name="currency"
                defaultValue={actionData?.values?.currency || "USD"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="AUD">AUD</option>
                <option value="THB">THB</option>
                <option value="IDR">IDR</option>
                <option value="MXN">MXN</option>
              </select>
            </div>

            <div>
              <label htmlFor="maxParticipants" className="block text-sm font-medium mb-1">
                Max Participants *
              </label>
              <input
                type="number"
                id="maxParticipants"
                name="maxParticipants"
                min="1"
                defaultValue={actionData?.values?.maxParticipants || "8"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                required
              />
              {actionData?.errors?.maxParticipants && (
                <p className="text-danger text-sm mt-1">{actionData.errors.maxParticipants}</p>
              )}
            </div>

            <div>
              <label htmlFor="minParticipants" className="block text-sm font-medium mb-1">
                Min Participants
              </label>
              <input
                type="number"
                id="minParticipants"
                name="minParticipants"
                min="1"
                defaultValue={actionData?.values?.minParticipants || "1"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {/* Inclusions */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">What's Included</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="includesEquipment"
                  value="true"
                  defaultChecked={actionData?.values?.includesEquipment === "true"}
                  className="rounded"
                />
                <span className="text-sm">Equipment Rental</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="includesMeals"
                  value="true"
                  defaultChecked={actionData?.values?.includesMeals === "true"}
                  className="rounded"
                />
                <span className="text-sm">Meals/Snacks</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="includesTransport"
                  value="true"
                  defaultChecked={actionData?.values?.includesTransport === "true"}
                  className="rounded"
                />
                <span className="text-sm">Transport</span>
              </label>
            </div>

            <div>
              <label htmlFor="inclusionsStr" className="block text-sm font-medium mb-1">
                Additional Inclusions
              </label>
              <input
                type="text"
                id="inclusionsStr"
                name="inclusionsStr"
                placeholder="Bottled water, Towels, Photos (comma-separated)"
                defaultValue={actionData?.values?.inclusionsStr}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label htmlFor="exclusionsStr" className="block text-sm font-medium mb-1">
                Exclusions
              </label>
              <input
                type="text"
                id="exclusionsStr"
                name="exclusionsStr"
                placeholder="Certification fees, Marine park fees (comma-separated)"
                defaultValue={actionData?.values?.exclusionsStr}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Requirements</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="minCertLevel" className="block text-sm font-medium mb-1">
                Minimum Certification
              </label>
              <select
                id="minCertLevel"
                name="minCertLevel"
                defaultValue={actionData?.values?.minCertLevel || ""}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              >
                <option value="">None Required</option>
                <option value="Open Water">Open Water</option>
                <option value="Advanced Open Water">Advanced Open Water</option>
                <option value="Rescue Diver">Rescue Diver</option>
                <option value="Divemaster">Divemaster</option>
              </select>
            </div>

            <div>
              <label htmlFor="minAge" className="block text-sm font-medium mb-1">
                Minimum Age
              </label>
              <input
                type="number"
                id="minAge"
                name="minAge"
                min="1"
                placeholder="e.g., 10"
                defaultValue={actionData?.values?.minAge}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="requirementsStr" className="block text-sm font-medium mb-1">
              Other Requirements
            </label>
            <input
              type="text"
              id="requirementsStr"
              name="requirementsStr"
              placeholder="Must swim, Medical clearance required (comma-separated)"
              defaultValue={actionData?.values?.requirementsStr}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>

        {/* Status */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={actionData?.values?.isActive !== "false"}
              className="rounded"
            />
            <span className="font-medium">Active</span>
            <span className="text-foreground-muted text-sm">
              (Inactive tours cannot be scheduled)
            </span>
          </label>
        </div>

        {/* Limit Warning */}
        {isNearLimit && (
          <div className="mb-4 p-3 bg-warning-muted border border-warning rounded-lg">
            <p className="text-warning text-sm">
              {limitRemaining} of {limitMax} tours per month remaining.{" "}
              <Link to="/tenant/settings/billing" className="underline font-medium">
                Upgrade for more
              </Link>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Tour"}
          </button>
          <Link
            to="/tenant/tours"
            className={`px-6 py-2 border rounded-lg hover:bg-surface-inset ${isSubmitting ? "pointer-events-none opacity-50" : ""}`}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

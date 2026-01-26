import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, Link, useLoaderData } from "react-router";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { diveSiteSchema, validateFormData, getFormValues } from "../../../../lib/validation";
import { createDiveSite } from "../../../../lib/db/queries.server";

export const meta: MetaFunction = () => [{ title: "Add Dive Site - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireTenant(request);
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const formData = await request.formData();

  // Convert highlights array
  const highlightsRaw = formData.get("highlights") as string;
  if (highlightsRaw) {
    formData.set("highlights", JSON.stringify(highlightsRaw.split(",").map((s) => s.trim()).filter(Boolean)));
  }

  const validation = validateFormData(formData, diveSiteSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  await createDiveSite(organizationId, {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    latitude: formData.get("latitude") ? Number(formData.get("latitude")) : undefined,
    longitude: formData.get("longitude") ? Number(formData.get("longitude")) : undefined,
    maxDepth: formData.get("maxDepth") ? Number(formData.get("maxDepth")) : undefined,
    minDepth: formData.get("minDepth") ? Number(formData.get("minDepth")) : undefined,
    difficulty: (formData.get("difficulty") as string) || undefined,
    currentStrength: (formData.get("currentStrength") as string) || undefined,
    visibility: (formData.get("visibility") as string) || undefined,
  });

  return redirect("/tenant/dive-sites");
}

export default function NewDiveSitePage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/tenant/dive-sites" className="text-brand hover:underline text-sm">
          ← Back to Dive Sites
        </Link>
        <h1 className="text-2xl font-bold mt-2">Add Dive Site</h1>
      </div>

      <form method="post" className="space-y-6">
        {/* Basic Info */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Site Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                defaultValue={actionData?.values?.name}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
              {actionData?.errors?.name && (
                <p className="text-danger text-sm mt-1">{actionData.errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium mb-1">
                Location *
              </label>
              <input
                type="text"
                id="location"
                name="location"
                required
                placeholder="e.g., South Bay, Outer Reef"
                defaultValue={actionData?.values?.location}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
              {actionData?.errors?.location && (
                <p className="text-danger text-sm mt-1">{actionData.errors.location}</p>
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
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {/* Dive Details */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Dive Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="maxDepth" className="block text-sm font-medium mb-1">
                Maximum Depth (meters) *
              </label>
              <input
                type="number"
                id="maxDepth"
                name="maxDepth"
                required
                min="1"
                max="100"
                defaultValue={actionData?.values?.maxDepth}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
              {actionData?.errors?.maxDepth && (
                <p className="text-danger text-sm mt-1">{actionData.errors.maxDepth}</p>
              )}
            </div>

            <div>
              <label htmlFor="difficulty" className="block text-sm font-medium mb-1">
                Difficulty Level *
              </label>
              <select
                id="difficulty"
                name="difficulty"
                required
                defaultValue={actionData?.values?.difficulty || "intermediate"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            <div className="col-span-2">
              <label htmlFor="conditions" className="block text-sm font-medium mb-1">
                Typical Conditions
              </label>
              <input
                type="text"
                id="conditions"
                name="conditions"
                placeholder="e.g., Strong currents, calm waters, tidal dependent"
                defaultValue={actionData?.values?.conditions}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {/* Coordinates */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">GPS Coordinates</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="latitude" className="block text-sm font-medium mb-1">
                Latitude
              </label>
              <input
                type="number"
                id="latitude"
                name="latitude"
                step="0.000001"
                min="-90"
                max="90"
                placeholder="e.g., 7.165"
                defaultValue={actionData?.values?.latitude}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label htmlFor="longitude" className="block text-sm font-medium mb-1">
                Longitude
              </label>
              <input
                type="number"
                id="longitude"
                name="longitude"
                step="0.000001"
                min="-180"
                max="180"
                placeholder="e.g., 134.271"
                defaultValue={actionData?.values?.longitude}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
          <p className="text-xs text-foreground-muted mt-2">
            Used for navigation and map display
          </p>
        </div>

        {/* Highlights */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Highlights & Features</h2>
          <div>
            <label htmlFor="highlights" className="block text-sm font-medium mb-1">
              Key Attractions
            </label>
            <input
              type="text"
              id="highlights"
              name="highlights"
              placeholder="e.g., Sharks, Corals, Wall dive, Wreck (comma-separated)"
              defaultValue={actionData?.values?.highlights}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
            />
            <p className="text-xs text-foreground-muted mt-1">
              Separate multiple highlights with commas
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={actionData?.values?.isActive !== "false"}
              className="rounded"
            />
            <span className="font-medium">Active</span>
          </label>
          <p className="text-sm text-foreground-muted mt-1 ml-6">
            Active sites can be selected when scheduling trips
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? "Saving..." : "Add Dive Site"}
          </button>
          <Link
            to="/tenant/dive-sites"
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

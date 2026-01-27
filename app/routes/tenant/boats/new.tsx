import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, Link, useLoaderData } from "react-router";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { boatSchema, validateFormData, getFormValues } from "../../../../lib/validation";
import { createBoat } from "../../../../lib/db/queries.server";
import { redirectWithNotification } from "../../../../lib/use-notification";

export const meta: MetaFunction = () => [{ title: "Add Boat - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireTenant(request);
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const formData = await request.formData();

  // Convert amenities array
  const amenitiesRaw = formData.get("amenities") as string;
  if (amenitiesRaw) {
    formData.set("amenities", JSON.stringify(amenitiesRaw.split(",").map((s) => s.trim()).filter(Boolean)));
  }

  const validation = validateFormData(formData, boatSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  // Parse amenities from JSON string
  const amenitiesStr = formData.get("amenities") as string;
  const amenities = amenitiesStr ? JSON.parse(amenitiesStr) as string[] : undefined;

  await createBoat(organizationId, {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    capacity: Number(formData.get("capacity")),
    type: (formData.get("type") as string) || undefined,
    registrationNumber: (formData.get("registrationNumber") as string) || undefined,
    amenities,
    isActive: formData.get("isActive") === "true",
  });

  const boatName = formData.get("name") as string;
  return redirect(redirectWithNotification("/tenant/boats", `Boat "${boatName}" has been successfully created`, "success"));
}

export default function NewBoatPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/tenant/boats" className="text-brand hover:underline text-sm">
          ← Back to Boats
        </Link>
        <h1 className="text-2xl font-bold mt-2">Add Boat</h1>
      </div>

      <form method="post" className="space-y-6">
        {/* Basic Info */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Boat Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                defaultValue={actionData?.values?.name}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
              {actionData?.errors?.name && (
                <p className="text-danger text-sm mt-1">{actionData.errors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="type" className="block text-sm font-medium mb-1">
                  Boat Type
                </label>
                <select
                  id="type"
                  name="type"
                  defaultValue={actionData?.values?.type || ""}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  <option value="">Select type...</option>
                  <option value="Dive Boat">Dive Boat</option>
                  <option value="Speed Boat">Speed Boat</option>
                  <option value="Catamaran">Catamaran</option>
                  <option value="Yacht">Yacht</option>
                  <option value="RIB">RIB (Rigid Inflatable)</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="capacity" className="block text-sm font-medium mb-1">
                  Passenger Capacity *
                </label>
                <input
                  type="number"
                  id="capacity"
                  name="capacity"
                  required
                  min="1"
                  max="100"
                  defaultValue={actionData?.values?.capacity}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
                {actionData?.errors?.capacity && (
                  <p className="text-danger text-sm mt-1">{actionData.errors.capacity}</p>
                )}
              </div>
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
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Registration */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Registration</h2>
          <div>
            <label htmlFor="registrationNumber" className="block text-sm font-medium mb-1">
              Registration Number
            </label>
            <input
              type="text"
              id="registrationNumber"
              name="registrationNumber"
              placeholder="e.g., PW-1234-DV"
              defaultValue={actionData?.values?.registrationNumber}
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
            />
          </div>
        </div>

        {/* Amenities */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Amenities & Features</h2>
          <div>
            <label htmlFor="amenities" className="block text-sm font-medium mb-1">
              Amenities
            </label>
            <input
              type="text"
              id="amenities"
              name="amenities"
              placeholder="e.g., Dive platform, Sun deck, Toilet, Shower (comma-separated)"
              defaultValue={actionData?.values?.amenities}
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
            />
            <p className="text-xs text-foreground-muted mt-1">
              Separate multiple amenities with commas
            </p>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Common amenities:</p>
            <div className="flex flex-wrap gap-2">
              {[
                "Dive platform",
                "Sun deck",
                "Toilet",
                "Freshwater shower",
                "Camera station",
                "Storage lockers",
                "Shade cover",
                "First aid kit",
                "Sound system",
                "BBQ grill",
              ].map((amenity) => (
                <button
                  key={amenity}
                  type="button"
                  onClick={(e) => {
                    const input = document.getElementById("amenities") as HTMLInputElement;
                    const current = input.value;
                    const amenitiesArray = current.split(",").map((s) => s.trim()).filter(Boolean);

                    if (amenitiesArray.includes(amenity)) {
                      // Remove amenity
                      input.value = amenitiesArray.filter((a) => a !== amenity).join(", ");
                    } else {
                      // Add amenity
                      input.value = current ? `${current}, ${amenity}` : amenity;
                    }
                  }}
                  className="text-xs bg-surface-inset hover:bg-surface-overlay px-2 py-1 rounded"
                >
                  + {amenity}
                </button>
              ))}
            </div>
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
            Active boats can be assigned to trips
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? "Saving..." : "Add Boat"}
          </button>
          <Link
            to="/tenant/boats"
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

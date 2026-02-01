import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, Link, useLoaderData } from "react-router";
import { useState } from "react";
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

  const newBoat = await createBoat(organizationId, {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    capacity: Number(formData.get("capacity")),
    type: (formData.get("type") as string) || undefined,
    registrationNumber: (formData.get("registrationNumber") as string) || undefined,
    amenities,
    isActive: formData.get("isActive") === "true",
  });

  const boatName = formData.get("name") as string;
  // Redirect to detail page where user can immediately add images via ImageManager
  return redirect(redirectWithNotification(`/tenant/boats/${newBoat.id}`, `Boat "${boatName}" created successfully! Add images below to complete your boat listing.`, "success"));
}

export default function NewBoatPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Parse initial amenities from actionData
  const initialAmenities = actionData?.values?.amenities
    ? actionData.values.amenities.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(initialAmenities);

  const commonAmenities = [
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
  ];

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity)
        ? prev.filter((a) => a !== amenity)
        : [...prev, amenity]
    );
  };

  const removeAmenity = (amenity: string) => {
    setSelectedAmenities((prev) => prev.filter((a) => a !== amenity));
  };

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

          {/* Hidden input to store selected amenities as comma-separated string */}
          <input
            type="hidden"
            name="amenities"
            value={selectedAmenities.join(", ")}
          />

          {/* Selected amenities as removable chips */}
          {selectedAmenities.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Selected Amenities
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedAmenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="inline-flex items-center gap-1 bg-brand-muted text-brand px-3 py-1 rounded-full text-sm"
                  >
                    {amenity}
                    <button
                      type="button"
                      onClick={() => removeAmenity(amenity)}
                      className="hover:text-brand-hover"
                      aria-label={`Remove ${amenity}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Common amenities - hide already selected ones */}
          <div>
            <p className="text-sm font-medium mb-2">Add Amenities:</p>
            <div className="flex flex-wrap gap-2">
              {commonAmenities
                .filter((amenity) => !selectedAmenities.includes(amenity))
                .map((amenity) => (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    className="text-xs bg-surface-inset hover:bg-brand hover:text-white px-3 py-1 rounded transition-colors"
                  >
                    + {amenity}
                  </button>
                ))}
              {commonAmenities.every((amenity) => selectedAmenities.includes(amenity)) && (
                <p className="text-xs text-foreground-muted italic">
                  All common amenities added! You can remove any by clicking the × button above.
                </p>
              )}
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

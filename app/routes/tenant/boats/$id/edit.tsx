import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { useState } from "react";
import { eq, and, asc } from "drizzle-orm";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getBoatById } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import { boatSchema, validateFormData, getFormValues } from "../../../../../lib/validation";
import { ImageManager, type Image } from "../../../../../app/components/ui";
import { redirectWithNotification, useNotification } from "../../../../../lib/use-notification";

export const meta: MetaFunction = () => [{ title: "Edit Boat - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const boatId = params.id;

  if (!boatId) {
    throw new Response("Boat ID required", { status: 400 });
  }

  // Get tenant database for images query
  const { db, schema } = getTenantDb(organizationId);

  const [boatData, boatImages] = await Promise.all([
    getBoatById(organizationId, boatId),
    db
      .select({
        id: schema.images.id,
        url: schema.images.url,
        thumbnailUrl: schema.images.thumbnailUrl,
        filename: schema.images.filename,
        width: schema.images.width,
        height: schema.images.height,
        alt: schema.images.alt,
        sortOrder: schema.images.sortOrder,
        isPrimary: schema.images.isPrimary,
      })
      .from(schema.images)
      .where(
        and(
          eq(schema.images.organizationId, organizationId),
          eq(schema.images.entityType, "boat"),
          eq(schema.images.entityId, boatId)
        )
      )
      .orderBy(asc(schema.images.sortOrder)),
  ]);

  if (!boatData) {
    throw new Response("Boat not found", { status: 404 });
  }

  const boat = {
    id: boatData.id,
    name: boatData.name,
    type: boatData.type || "",
    capacity: boatData.capacity,
    description: boatData.description || "",
    registrationNumber: boatData.registrationNumber || "",
    amenities: boatData.amenities || [],
    isActive: boatData.isActive,
  };

  // Format images for the component
  const images: Image[] = boatImages.map((img) => ({
    id: img.id,
    url: img.url,
    thumbnailUrl: img.thumbnailUrl || img.url,
    filename: img.filename,
    width: img.width ?? undefined,
    height: img.height ?? undefined,
    alt: img.alt ?? undefined,
    sortOrder: img.sortOrder,
    isPrimary: img.isPrimary,
  }));

  return { boat, images };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const boatId = params.id;

  if (!boatId) {
    throw new Response("Boat ID required", { status: 400 });
  }

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

  // Update boat in database
  const { db, schema } = getTenantDb(organizationId);

  await db
    .update(schema.boats)
    .set({
      name: validation.data.name,
      type: validation.data.type,
      capacity: validation.data.capacity,
      description: validation.data.description,
      registrationNumber: validation.data.registrationNumber,
      amenities: validation.data.amenities,
      isActive: validation.data.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.boats.organizationId, organizationId), eq(schema.boats.id, boatId)));

  return redirect(redirectWithNotification(`/tenant/boats/${boatId}`, `Boat "${validation.data.name}" has been successfully updated`, "success"));
}

export default function EditBoatPage() {
  const { boat, images } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Show notifications from URL params
  useNotification();

  // Parse initial amenities from actionData or boat data
  const initialAmenities = actionData?.values?.amenities
    ? actionData.values.amenities.split(",").map((s: string) => s.trim()).filter(Boolean)
    : boat.amenities || [];

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
        <Link to={`/tenant/boats/${boat.id}`} className="text-brand hover:underline text-sm">
          ← Back to Boat
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit Boat</h1>
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
                defaultValue={actionData?.values?.name || boat.name}
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
                  defaultValue={actionData?.values?.type || boat.type}
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
                  defaultValue={actionData?.values?.capacity || boat.capacity}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                />
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
                defaultValue={actionData?.values?.description || boat.description}
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Boat Images</h2>
          <ImageManager
            entityType="boat"
            entityId={boat.id}
            images={images}
            maxImages={5}
          />
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
              defaultValue={actionData?.values?.registrationNumber || boat.registrationNumber}
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
              defaultChecked={actionData?.values?.isActive !== "false" && boat.isActive}
              className="rounded"
            />
            <span className="font-medium">Active</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <Link
            to={`/tenant/boats/${boat.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

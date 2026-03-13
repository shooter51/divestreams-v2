import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { redirect, useLoaderData, useActionData, useNavigation, Link } from "react-router";
import { useState } from "react";
import { eq, and, asc } from "drizzle-orm";
import { requireOrgContext, requireRole} from "../../../../../lib/auth/org-context.server";
import { getBoatById } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import { boatSchema, validateFormData, getFormValues } from "../../../../../lib/validation";
import { ImageManager, type Image } from "../../../../../app/components/ui";
import { redirectWithNotification, useNotification } from "../../../../../lib/use-notification";
import { CsrfInput } from "../../../../components/CsrfInput";
import { enqueueTranslation } from "../../../../../lib/jobs/index";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "../../../../i18n/types";
import { useT } from "../../../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "Edit Boat - DiveStreams" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
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
  requireRole(ctx, ["owner", "admin"]);
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

  // Enqueue auto-translation for translatable fields
  const fieldsToTranslate = [
    { field: "name", text: validation.data.name },
    { field: "description", text: validation.data.description || "" },
  ].filter((f) => f.text?.trim());

  for (const locale of SUPPORTED_LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    await enqueueTranslation({
      orgId: organizationId,
      entityType: "boat",
      entityId: boatId,
      fields: fieldsToTranslate,
      targetLocale: locale,
    });
  }

  return redirect(redirectWithNotification(`/tenant/boats/${boatId}`, `Boat "${validation.data.name}" has been successfully updated`, "success"));
}

export default function EditBoatPage() {
  const { boat, images } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const t = useT();
  const isSubmitting = navigation.state === "submitting";

  // Show notifications from URL params
  useNotification();

  // Parse initial amenities from actionData or boat data
  const initialAmenities = actionData?.values?.amenities
    ? actionData.values.amenities.split(",").map((s: string) => s.trim()).filter(Boolean)
    : boat.amenities || [];

  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(initialAmenities);

  const amenityTranslations: Record<string, string> = {
    "Dive platform": t("tenant.boats.amenity.divePlatform"),
    "Sun deck": t("tenant.boats.amenity.sunDeck"),
    "Toilet": t("tenant.boats.amenity.toilet"),
    "Freshwater shower": t("tenant.boats.amenity.freshwaterShower"),
    "Camera station": t("tenant.boats.amenity.cameraStation"),
    "Storage lockers": t("tenant.boats.amenity.storageLockers"),
    "Shade cover": t("tenant.boats.amenity.shadeCover"),
    "First aid kit": t("tenant.boats.amenity.firstAidKit"),
    "Sound system": t("tenant.boats.amenity.soundSystem"),
    "BBQ grill": t("tenant.boats.amenity.bbqGrill"),
  };

  const commonAmenities = Object.keys(amenityTranslations);

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
          {t("tenant.boats.backToBoat")}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{t("tenant.boats.editBoat")}</h1>
      </div>

      <form method="post" className="space-y-6">
        <CsrfInput />
        {/* Basic Info */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("common.basicInfo")}</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                {t("tenant.boats.boatName")} *
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
                  {t("tenant.boats.boatType")}
                </label>
                <select
                  id="type"
                  name="type"
                  defaultValue={actionData?.values?.type || boat.type}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  <option value="">{t("tenant.boats.selectType")}</option>
                  <option value="Dive Boat">{t("tenant.boats.type.diveBoat")}</option>
                  <option value="Speed Boat">{t("tenant.boats.type.speedBoat")}</option>
                  <option value="Catamaran">{t("tenant.boats.type.catamaran")}</option>
                  <option value="Yacht">{t("tenant.boats.type.yacht")}</option>
                  <option value="RIB">{t("tenant.boats.type.rib")}</option>
                  <option value="Other">{t("tenant.boats.type.other")}</option>
                </select>
              </div>

              <div>
                <label htmlFor="capacity" className="block text-sm font-medium mb-1">
                  {t("tenant.boats.passengerCapacity")} *
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
                {t("common.description")}
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
          <h2 className="font-semibold mb-4">{t("tenant.boats.boatImages")}</h2>
          <ImageManager
            entityType="boat"
            entityId={boat.id}
            images={images}
            maxImages={5}
          />
        </div>

        {/* Registration */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.boats.registration")}</h2>
          <div>
            <label htmlFor="registrationNumber" className="block text-sm font-medium mb-1">
              {t("tenant.boats.registrationNumber")}
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
          <h2 className="font-semibold mb-4">{t("tenant.boats.amenitiesFeatures")}</h2>

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
                {t("tenant.boats.selectedAmenities")}
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedAmenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="inline-flex items-center gap-1 bg-brand-muted text-brand px-3 py-1 rounded-full text-sm"
                  >
                    {amenityTranslations[amenity] || amenity}
                    <button
                      type="button"
                      onClick={() => removeAmenity(amenity)}
                      className="hover:text-brand-hover"
                      aria-label={`Remove ${amenityTranslations[amenity] || amenity}`}
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
            <p className="text-sm font-medium mb-2">{t("tenant.boats.addAmenities")}:</p>
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
                    + {amenityTranslations[amenity] || amenity}
                  </button>
                ))}
              {commonAmenities.every((amenity) => selectedAmenities.includes(amenity)) && (
                <p className="text-xs text-foreground-muted italic">
                  {t("tenant.boats.allAmenitiesAdded")}
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
            <span className="font-medium">{t("common.active")}</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? t("common.saving") : t("common.saveChanges")}
          </button>
          <Link
            to={`/tenant/boats/${boat.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}

import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, Link } from "react-router";
import { useState } from "react";
import { requireOrgContext, requireRole} from "../../../../lib/auth/org-context.server";
import { boatSchema, validateFormData, getFormValues } from "../../../../lib/validation";
import { createBoat } from "../../../../lib/db/queries.server";
import { redirectWithNotification } from "../../../../lib/use-notification";
import { uploadToS3, getImageKey, processImage, isValidImageType, getWebPMimeType, getS3Client } from "../../../../lib/storage";
import { getTenantDb } from "../../../../lib/db/tenant.server";
import { CsrfInput } from "../../../components/CsrfInput";
import { enqueueTranslation } from "../../../../lib/jobs/index";
import { SUPPORTED_LOCALES } from "../../../i18n/types";
import { resolveLocale } from "../../../i18n/resolve-locale";
import { useT } from "../../../i18n/use-t";

export const meta: MetaFunction = () => [{ title: "Add Boat - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  console.log("[boats/new] Action started");
  const ctx = await requireOrgContext(request);
  requireRole(ctx, ["owner", "admin"]);
  const organizationId = ctx.org.id;
  console.log("[boats/new] Org:", ctx.org.slug, "OrgId:", organizationId);
  const formData = await request.formData();
  console.log("[boats/new] Form data - name:", formData.get("name"), "capacity:", formData.get("capacity"));

  // Extract image files before processing other form data
  const imageFiles: File[] = [];
  const allImages = formData.getAll("images");
  for (const item of allImages) {
    if (item instanceof File && item.size > 0) {
      imageFiles.push(item);
    }
  }
  // Remove images from formData before validation (schema expects strings, not File objects)
  formData.delete("images");

  // Convert amenities array
  const amenitiesRaw = formData.get("amenities") as string;
  if (amenitiesRaw) {
    formData.set("amenities", JSON.stringify(amenitiesRaw.split(",").map((s) => s.trim()).filter(Boolean)));
  }

  const validation = validateFormData(formData, boatSchema);
  console.log("[boats/new] Validation result:", validation.success, validation.success ? "" : JSON.stringify((validation as { errors: unknown }).errors));

  if (!validation.success) {
    console.log("[boats/new] Validation failed, returning errors");
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  // Parse amenities from JSON string
  const amenitiesStr = formData.get("amenities") as string;
  const amenities = amenitiesStr ? JSON.parse(amenitiesStr) as string[] : undefined;

  console.log("[boats/new] Creating boat...");
  const newBoat = await createBoat(organizationId, {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    capacity: Number(formData.get("capacity")),
    type: (formData.get("type") as string) || undefined,
    registrationNumber: (formData.get("registrationNumber") as string) || undefined,
    amenities,
    isActive: formData.get("isActive") === "true",
  });
  console.log("[boats/new] Boat created with ID:", newBoat.id);

  // Enqueue auto-translation for translatable fields
  const fieldsToTranslate = [
    { field: "name", text: formData.get("name") as string },
    { field: "description", text: formData.get("description") as string },
  ].filter((f) => f.text?.trim());

  const sourceLocale = resolveLocale(request);
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === sourceLocale) continue;
    await enqueueTranslation({
      orgId: organizationId,
      entityType: "boat",
      entityId: newBoat.id,
      fields: fieldsToTranslate,
      sourceLocale,
      targetLocale: locale,
    });
  }

  // Process uploaded images if any
  if (imageFiles.length > 0) {
    // Check if storage is configured BEFORE attempting uploads
    const s3Client = getS3Client();
    if (!s3Client) {
      const boatName = formData.get("name") as string;
      return redirect(redirectWithNotification(
        `/tenant/boats/${newBoat.id}/edit`,
        `Boat "${boatName}" created, but image storage is not configured. Contact support to enable image uploads.`,
        "warning"
      ));
    }

    const { db, schema } = getTenantDb(ctx.org.slug);
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    let uploadedCount = 0;
    const skippedFiles: string[] = [];
    const failedFiles: string[] = [];

    for (let i = 0; i < Math.min(imageFiles.length, 5); i++) {
      const file = imageFiles[i];

      // Validate file type
      if (!isValidImageType(file.type)) {
        skippedFiles.push(`${file.name} (invalid type: ${file.type})`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        skippedFiles.push(`${file.name} (exceeds 10MB limit)`);
        continue;
      }

      try {
        // Process image
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const processed = await processImage(buffer);

        // Generate storage keys
        const baseKey = getImageKey(ctx.org.slug, "boat", newBoat.id, file.name);
        const originalKey = `${baseKey}.webp`;
        const thumbnailKey = `${baseKey}-thumb.webp`;

        // Upload to S3/B2
        const originalUpload = await uploadToS3(originalKey, processed.original, getWebPMimeType());
        if (!originalUpload) {
          failedFiles.push(`${file.name} (storage error)`);
          continue;
        }

        const thumbnailUpload = await uploadToS3(thumbnailKey, processed.thumbnail, getWebPMimeType());

        // Save to database
        await db.insert(schema.images).values({
          organizationId,
          entityType: "boat",
          entityId: newBoat.id,
          url: originalUpload.cdnUrl,
          thumbnailUrl: thumbnailUpload?.cdnUrl || originalUpload.cdnUrl,
          filename: file.name,
          mimeType: getWebPMimeType(),
          sizeBytes: processed.original.length,
          width: processed.width,
          height: processed.height,
          alt: file.name,
          sortOrder: i,
          isPrimary: i === 0,
        });

        uploadedCount++;
      } catch (error) {
        console.error(`Failed to upload image ${file.name}:`, error);
        failedFiles.push(`${file.name} (upload failed)`);
      }
    }

    const boatName = formData.get("name") as string;

    // Build detailed message based on results
    let message: string;
    let messageType: "success" | "warning" | "error" = "success";

    if (uploadedCount === imageFiles.length) {
      message = `Boat "${boatName}" created with ${uploadedCount} image${uploadedCount > 1 ? "s" : ""}!`;
    } else if (uploadedCount > 0) {
      message = `Boat "${boatName}" created with ${uploadedCount} of ${imageFiles.length} images.`;
      if (skippedFiles.length > 0) message += ` Skipped: ${skippedFiles.join(", ")}`;
      if (failedFiles.length > 0) message += ` Failed: ${failedFiles.join(", ")}`;
      messageType = "warning";
    } else {
      message = `Boat "${boatName}" created, but all ${imageFiles.length} image(s) failed to upload.`;
      if (skippedFiles.length > 0) message += ` Skipped: ${skippedFiles.join(", ")}`;
      if (failedFiles.length > 0) message += ` Failed: ${failedFiles.join(", ")}`;
      messageType = "error";
    }

    return redirect(redirectWithNotification(`/tenant/boats/${newBoat.id}/edit`, message, messageType));
  }

  const boatName = formData.get("name") as string;
  // Redirect to edit page where user can immediately add images via ImageManager
  return redirect(redirectWithNotification(`/tenant/boats/${newBoat.id}/edit`, `Boat "${boatName}" created successfully! Add images below to complete your boat listing.`, "success"));
}

export default function NewBoatPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const t = useT();
  const isSubmitting = navigation.state === "submitting";

  // Parse initial amenities from actionData
  const initialAmenities = actionData?.values?.amenities
    ? actionData.values.amenities.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

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
        <Link to="/tenant/boats" className="text-brand hover:underline text-sm">
          {t("tenant.boats.backToBoats")}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{t("tenant.boats.addBoat")}</h1>
      </div>

      <form method="post" encType="multipart/form-data" className="space-y-6">
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
                  {t("tenant.boats.boatType")}
                </label>
                <select
                  id="type"
                  name="type"
                  defaultValue={actionData?.values?.type || ""}
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
                {t("common.description")}
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
          <h2 className="font-semibold mb-4">{t("tenant.boats.registration")}</h2>
          <div>
            <label htmlFor="registrationNumber" className="block text-sm font-medium mb-1">
              {t("tenant.boats.registrationNumber")}
            </label>
            <input
              type="text"
              id="registrationNumber"
              name="registrationNumber"
              placeholder={t("tenant.boats.registrationPlaceholder")}
              defaultValue={actionData?.values?.registrationNumber}
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

        {/* Images */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">{t("tenant.boats.imagesOptional")}</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="images" className="block text-sm font-medium mb-2">
                {t("tenant.boats.uploadUpTo5")}
              </label>
              <input
                type="file"
                id="images"
                name="images"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="block w-full text-sm text-foreground-muted
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-brand file:text-white
                  hover:file:bg-brand-hover
                  file:cursor-pointer cursor-pointer"
              />
              <p className="mt-2 text-sm text-foreground-muted">
                {t("tenant.boats.imageFormats")}
              </p>
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
            <span className="font-medium">{t("common.active")}</span>
          </label>
          <p className="text-sm text-foreground-muted mt-1 ml-6">
            {t("tenant.boats.activeBoatsAssigned")}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? t("common.saving") : t("tenant.boats.addBoat")}
          </button>
          <Link
            to="/tenant/boats"
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}

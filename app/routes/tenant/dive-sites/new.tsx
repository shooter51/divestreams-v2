import type { MetaFunction, ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation, Link, useLoaderData } from "react-router";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { diveSiteSchema, validateFormData, getFormValues } from "../../../../lib/validation";
import { createDiveSite } from "../../../../lib/db/queries.server";
import { redirectWithNotification, useNotification } from "../../../../lib/use-notification";
import { uploadToB2, getImageKey, processImage, isValidImageType, getWebPMimeType, getS3Client } from "../../../../lib/storage";
import { getTenantDb } from "../../../../lib/db/tenant.server";

export const meta: MetaFunction = () => [{ title: "Add Dive Site - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireTenant(request);
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  const { tenant, organizationId } = await requireTenant(request);
  const formData = await request.formData();

  // Extract image files before processing other form data
  const imageFiles: File[] = [];
  const allImages = formData.getAll("images");
  for (const item of allImages) {
    if (item instanceof File && item.size > 0) {
      imageFiles.push(item);
    }
  }

  // Convert highlights array
  const highlightsRaw = formData.get("highlights") as string;
  if (highlightsRaw) {
    formData.set("highlights", JSON.stringify(highlightsRaw.split(",").map((s) => s.trim()).filter(Boolean)));
  }

  const validation = validateFormData(formData, diveSiteSchema);

  if (!validation.success) {
    return { errors: validation.errors, values: getFormValues(formData) };
  }

  const newSite = await createDiveSite(organizationId, {
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

  // Process uploaded images if any
  if (imageFiles.length > 0 && tenant) {
    // Check if storage is configured BEFORE attempting uploads
    const s3Client = getS3Client();
    if (!s3Client) {
      const diveSiteName = formData.get("name") as string;
      return redirect(redirectWithNotification(
        `/tenant/dive-sites/${newSite.id}/edit`,
        `Dive Site "${diveSiteName}" created, but image storage is not configured. Contact support to enable image uploads.`,
        "warning"
      ));
    }

    const { db, schema } = getTenantDb(tenant.subdomain);
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
        const baseKey = getImageKey(tenant.subdomain, "diveSite", newSite.id, file.name);
        const originalKey = `${baseKey}.webp`;
        const thumbnailKey = `${baseKey}-thumb.webp`;

        // Upload to S3/B2
        const originalUpload = await uploadToB2(originalKey, processed.original, getWebPMimeType());
        if (!originalUpload) {
          failedFiles.push(`${file.name} (storage error)`);
          continue;
        }

        const thumbnailUpload = await uploadToB2(thumbnailKey, processed.thumbnail, getWebPMimeType());

        // Save to database
        await db.insert(schema.images).values({
          organizationId,
          entityType: "diveSite",
          entityId: newSite.id,
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

    const diveSiteName = formData.get("name") as string;

    // Build detailed message based on results
    let message: string;
    let messageType: "success" | "warning" | "error" = "success";

    if (uploadedCount === imageFiles.length) {
      message = `Dive Site "${diveSiteName}" created with ${uploadedCount} image${uploadedCount > 1 ? "s" : ""}!`;
    } else if (uploadedCount > 0) {
      message = `Dive Site "${diveSiteName}" created with ${uploadedCount} of ${imageFiles.length} images.`;
      if (skippedFiles.length > 0) message += ` Skipped: ${skippedFiles.join(", ")}`;
      if (failedFiles.length > 0) message += ` Failed: ${failedFiles.join(", ")}`;
      messageType = "warning";
    } else {
      message = `Dive Site "${diveSiteName}" created, but all ${imageFiles.length} image(s) failed to upload.`;
      if (skippedFiles.length > 0) message += ` Skipped: ${skippedFiles.join(", ")}`;
      if (failedFiles.length > 0) message += ` Failed: ${failedFiles.join(", ")}`;
      messageType = "error";
    }

    return redirect(redirectWithNotification(`/tenant/dive-sites/${newSite.id}/edit`, message, messageType));
  }

  const diveSiteName = formData.get("name") as string;
  // Redirect to edit page where user can immediately add images via ImageManager
  return redirect(redirectWithNotification(`/tenant/dive-sites/${newSite.id}/edit`, `Dive Site "${diveSiteName}" created successfully! Add images below to complete your site listing.`, "success"));
}

export default function NewDiveSitePage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Show notifications from URL params
  useNotification();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link to="/tenant/dive-sites" className="text-brand hover:underline text-sm">
          ← Back to Dive Sites
        </Link>
        <h1 className="text-2xl font-bold mt-2">Add Dive Site</h1>
      </div>

      <form method="post" encType="multipart/form-data" className="space-y-6">
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
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
            />
            <p className="text-xs text-foreground-muted mt-1">
              Separate multiple highlights with commas
            </p>
          </div>
        </div>

        {/* Images */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Images (Optional)</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="images" className="block text-sm font-medium mb-2">
                Upload up to 5 images
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
                JPEG, PNG, WebP, or GIF. Max 10MB each. You can add more images later.
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

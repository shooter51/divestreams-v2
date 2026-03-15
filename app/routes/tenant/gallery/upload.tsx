/**
 * Gallery Image Upload Route
 *
 * POST /tenant/gallery/upload
 * Handles image uploads specifically for gallery/albums (gallery_images table)
 *
 * Different from /tenant/images/upload which handles entity-based uploads
 * (tours, boats, equipment using the generic images table)
 */

import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { requireOrgContext, requireRole} from "../../../../lib/auth/org-context.server";
import { resolveLocale } from "../../../i18n/resolve-locale";
import { uploadToS3, getWebPMimeType, processImage, isValidImageType, getS3Client } from "../../../../lib/storage";
import { createGalleryImage } from "../../../../lib/db/gallery.server";
import { redirectWithNotification } from "../../../../lib/use-notification";
import { storageLogger } from "../../../../lib/logger";
import { enqueueTranslation } from "../../../../lib/jobs/index";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "../../../i18n/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const ctx = await requireOrgContext(request);
    requireRole(ctx, ["owner", "admin"]);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return redirect(redirectWithNotification(
        "/tenant/gallery",
        "Failed to process upload. The file may be too large (max 10MB).",
        "error"
      ));
    }

    const albumId = formData.get("albumId") as string | null;
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const category = formData.get("category") as string | null;
    const location = formData.get("location") as string | null;
    const photographer = formData.get("photographer") as string | null;
    const tagsStr = formData.get("tags") as string | null;

    // Extract image files
    const imageFiles: File[] = [];
    const allFiles = formData.getAll("file");
    for (const item of allFiles) {
      if (item instanceof File && item.size > 0) {
        imageFiles.push(item);
      }
    }

    if (imageFiles.length === 0) {
      const redirectUrl = albumId ? `/tenant/gallery/${albumId}` : "/tenant/gallery";
      return redirect(redirectWithNotification(redirectUrl, "No files selected for upload", "error"));
    }

    // Check if storage is configured
    const s3Client = getS3Client();
    if (!s3Client) {
      const redirectUrl = albumId ? `/tenant/gallery/${albumId}` : "/tenant/gallery";
      return redirect(redirectWithNotification(
        redirectUrl,
        "Image storage is not configured. Contact support to enable image uploads.",
        "error"
      ));
    }

    const tags = tagsStr ? tagsStr.split(",").map(t => t.trim()).filter(Boolean) : [];

    let uploadedCount = 0;
    const skippedFiles: string[] = [];
    const failedFiles: string[] = [];

    for (const file of imageFiles) {
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

        // Generate storage keys for gallery images
        const timestamp = Date.now();
        const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const baseKey = `${ctx.org.slug}/gallery/${albumId || "uncategorized"}/${timestamp}-${safeFilename}`;
        const originalKey = `${baseKey}.webp`;
        const thumbnailKey = `${baseKey}-thumb.webp`;

        // Upload to S3
        const originalUpload = await uploadToS3(originalKey, processed.original, getWebPMimeType());
        if (!originalUpload) {
          failedFiles.push(`${file.name} (storage error)`);
          continue;
        }

        const thumbnailUpload = await uploadToS3(thumbnailKey, processed.thumbnail, getWebPMimeType());

        // Save to gallery_images table
        const imageTitle = title || file.name;
        const createdImage = await createGalleryImage(ctx.org.id, {
          albumId: albumId || null,
          title: imageTitle,
          description: description || null,
          imageUrl: originalUpload.cdnUrl,
          thumbnailUrl: thumbnailUpload?.cdnUrl || originalUpload.cdnUrl,
          category: category || null,
          tags,
          location: location || null,
          photographer: photographer || null,
          width: processed.width,
          height: processed.height,
          sortOrder: uploadedCount,
          isFeatured: false,
          status: "published",
        });

        // Enqueue translation for image title and description
        const imageFields = [
          { field: "title", text: imageTitle },
          ...(description?.trim() ? [{ field: "description", text: description }] : []),
        ];
        const srcLocale = resolveLocale(request);
        for (const locale of SUPPORTED_LOCALES) {
          if (locale === srcLocale) continue;
          await enqueueTranslation({
            orgId: ctx.org.id,
            entityType: "gallery_image",
            entityId: createdImage.id,
            fields: imageFields,
            sourceLocale: srcLocale,
            targetLocale: locale,
          });
        }

        uploadedCount++;
      } catch (error) {
        storageLogger.error({ err: error, filename: file.name }, "Failed to upload gallery image");
        failedFiles.push(`${file.name} (upload failed)`);
      }
    }

    // Build detailed message based on results
    const redirectUrl = albumId ? `/tenant/gallery/${albumId}` : "/tenant/gallery";
    let message: string;
    let messageType: "success" | "warning" | "error" = "success";

    if (uploadedCount === imageFiles.length) {
      message = `Successfully uploaded ${uploadedCount} image${uploadedCount > 1 ? "s" : ""}!`;
    } else if (uploadedCount > 0) {
      message = `Uploaded ${uploadedCount} of ${imageFiles.length} images.`;
      if (skippedFiles.length > 0) message += ` Skipped: ${skippedFiles.join(", ")}`;
      if (failedFiles.length > 0) message += ` Failed: ${failedFiles.join(", ")}`;
      messageType = "warning";
    } else {
      message = `All ${imageFiles.length} image(s) failed to upload.`;
      if (skippedFiles.length > 0) message += ` Skipped: ${skippedFiles.join(", ")}`;
      if (failedFiles.length > 0) message += ` Failed: ${failedFiles.join(", ")}`;
      messageType = "error";
    }

    return redirect(redirectWithNotification(redirectUrl, message, messageType));
  } catch (error) {
    // Re-throw Response objects (redirects, 403s from requireOrgContext/requireRole)
    // so React Router handles them correctly instead of swallowing them as 500s.
    if (!(error instanceof Error)) throw error;

    storageLogger.error({ err: error }, "Gallery upload action error");
    return redirect(redirectWithNotification(
      "/tenant/gallery",
      "An unexpected error occurred during upload. Please try again.",
      "error"
    ));
  }
}

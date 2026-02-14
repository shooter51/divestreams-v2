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
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { uploadToB2, getImageKey, getWebPMimeType, processImage, isValidImageType, getS3Client } from "../../../../lib/storage";
import { createGalleryImage } from "../../../../lib/db/gallery.server";
import { redirectWithNotification } from "../../../../lib/use-notification";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const ctx = await requireOrgContext(request);
  const formData = await request.formData();

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

      // Upload to B2
      const originalUpload = await uploadToB2(originalKey, processed.original, getWebPMimeType());
      if (!originalUpload) {
        failedFiles.push(`${file.name} (storage error)`);
        continue;
      }

      const thumbnailUpload = await uploadToB2(thumbnailKey, processed.thumbnail, getWebPMimeType());

      // Save to gallery_images table
      await createGalleryImage(ctx.org.id, {
        albumId: albumId || null,
        title: title || file.name,
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

      uploadedCount++;
    } catch (error) {
      console.error(`Failed to upload gallery image ${file.name}:`, error);
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
}

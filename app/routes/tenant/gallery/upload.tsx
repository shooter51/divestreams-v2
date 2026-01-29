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
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { uploadToB2, getImageKey, getWebPMimeType, processImage, isValidImageType } from "../../../../lib/storage";
import { createGalleryImage } from "../../../../lib/db/gallery.server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { tenant, organizationId } = await requireTenant(request);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const albumId = formData.get("albumId") as string | null;
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const category = formData.get("category") as string | null;
    const location = formData.get("location") as string | null;
    const photographer = formData.get("photographer") as string | null;
    const tagsStr = formData.get("tags") as string | null;

    // Validate inputs
    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!isValidImageType(file.type)) {
      return Response.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "File too large. Maximum size: 10MB" },
        { status: 400 }
      );
    }

    // Process tags
    const tags = tagsStr ? tagsStr.split(",").map(t => t.trim()).filter(Boolean) : [];

    // Process image
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const processed = await processImage(buffer);

    // Generate storage keys for gallery images
    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const baseKey = `${tenant.subdomain}/gallery/${albumId || "uncategorized"}/${timestamp}-${safeFilename}`;
    const originalKey = `${baseKey}.webp`;
    const thumbnailKey = `${baseKey}-thumb.webp`;

    // Upload to B2
    const originalUpload = await uploadToB2(originalKey, processed.original, getWebPMimeType());
    if (!originalUpload) {
      console.error("B2 storage not configured. Missing environment variables: B2_ENDPOINT, B2_KEY_ID, B2_APP_KEY");
      return Response.json(
        { error: "Image storage is not configured. Please contact support." },
        { status: 503 }
      );
    }

    const thumbnailUpload = await uploadToB2(thumbnailKey, processed.thumbnail, getWebPMimeType());

    // Save to gallery_images table (not generic images table)
    const image = await createGalleryImage(organizationId, {
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
      sortOrder: 0, // Default sort order
      isFeatured: false,
      status: "published", // Default to published
    });

    return Response.json({
      success: true,
      image: {
        id: image.id,
        title: image.title,
        imageUrl: image.imageUrl,
        thumbnailUrl: image.thumbnailUrl,
        width: image.width,
        height: image.height,
        category: image.category,
        tags: image.tags,
        location: image.location,
        photographer: image.photographer,
      },
    });
  } catch (error) {
    console.error("Gallery image upload error:", error);

    // Provide more specific error message in development
    const errorMessage = process.env.NODE_ENV === "development" && error instanceof Error
      ? `Failed to upload gallery image: ${error.message}`
      : "Failed to upload image";

    return Response.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

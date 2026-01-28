/**
 * Image Upload API
 *
 * POST /tenant/images/upload
 * Handles multipart form data for image uploads.
 */

import type { ActionFunctionArgs } from "react-router";
import { eq, and, count } from "drizzle-orm";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { uploadToB2, getImageKey, getWebPMimeType } from "../../../../lib/storage";
import { processImage, isValidImageType } from "../../../../lib/storage";
import { getTenantDb } from "../../../../lib/db/tenant.server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGES_PER_ENTITY = 5;

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { tenant, organizationId } = await requireTenant(request);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as string;
    const entityId = formData.get("entityId") as string;
    const alt = formData.get("alt") as string | null;

    // Validate inputs
    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (!entityType || !entityId) {
      return Response.json(
        { error: "entityType and entityId are required" },
        { status: 400 }
      );
    }

    // Validate allowed entity types
    const allowedTypes = ["tour", "diveSite", "boat", "equipment", "staff", "course"];
    if (!allowedTypes.includes(entityType)) {
      return Response.json(
        { error: `Invalid entityType. Allowed: ${allowedTypes.join(", ")}` },
        { status: 400 }
      );
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

    // Check image count limit
    const { db, schema } = getTenantDb(tenant.subdomain);

    const [countResult] = await db
      .select({ count: count() })
      .from(schema.images)
      .where(
        and(
          eq(schema.images.entityType, entityType),
          eq(schema.images.entityId, entityId)
        )
      );

    if (countResult.count >= MAX_IMAGES_PER_ENTITY) {
      return Response.json(
        { error: `Maximum ${MAX_IMAGES_PER_ENTITY} images allowed per ${entityType}` },
        { status: 400 }
      );
    }

    // Process image
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const processed = await processImage(buffer);

    // Generate storage keys
    const baseKey = getImageKey(tenant.subdomain, entityType, entityId, file.name);
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

    // Determine sort order (next available)
    const nextOrder = countResult.count;

    // Save to database
    const [image] = await db
      .insert(schema.images)
      .values({
        organizationId, // Now using actual organization ID from context
        entityType,
        entityId,
        url: originalUpload.cdnUrl,
        thumbnailUrl: thumbnailUpload?.cdnUrl || originalUpload.cdnUrl,
        filename: file.name,
        mimeType: getWebPMimeType(),
        sizeBytes: processed.original.length,
        width: processed.width,
        height: processed.height,
        alt: alt || file.name,
        sortOrder: nextOrder,
        isPrimary: nextOrder === 0, // First image is primary
      })
      .returning();

    return Response.json({
      success: true,
      image: {
        id: image.id,
        url: image.url,
        thumbnailUrl: image.thumbnailUrl,
        filename: image.filename,
        width: image.width,
        height: image.height,
        alt: image.alt,
        sortOrder: image.sortOrder,
        isPrimary: image.isPrimary,
      },
    });
  } catch (error) {
    console.error("Image upload error:", error);

    // Provide more specific error message in development
    const errorMessage = process.env.NODE_ENV === "development" && error instanceof Error
      ? `Failed to upload image: ${error.message}`
      : "Failed to upload image";

    return Response.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export default function ImageUpload() {
  return null;
}

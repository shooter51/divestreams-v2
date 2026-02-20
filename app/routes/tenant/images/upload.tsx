/**
 * Image Upload API
 *
 * POST /tenant/images/upload
 * Handles multipart form data for image uploads.
 */

import type { ActionFunctionArgs } from "react-router";
import { eq, and, count } from "drizzle-orm";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { uploadToS3, getImageKey, getWebPMimeType } from "../../../../lib/storage";
import { processImage, isValidImageType } from "../../../../lib/storage";
import { getTenantDb } from "../../../../lib/db/tenant.server";
import { storageLogger } from "../../../../lib/logger";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGES_PER_ENTITY = 5;

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const ctx = await requireOrgContext(request);
    const organizationId = ctx.org.id;

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
    const allowedTypes = ["tour", "dive-site", "boat", "equipment", "staff", "course", "product"];
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
        { error: `"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size: 10MB` },
        { status: 400 }
      );
    }

    // Check image count limit
    const { db, schema } = getTenantDb(ctx.org.slug);

    const [countResult] = await db
      .select({ count: count() })
      .from(schema.images)
      .where(
        and(
          eq(schema.images.organizationId, organizationId),
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
    const baseKey = getImageKey(ctx.org.slug, entityType, entityId, file.name);
    const originalKey = `${baseKey}.webp`;
    const thumbnailKey = `${baseKey}-thumb.webp`;

    // Upload to B2
    const originalUpload = await uploadToS3(originalKey, processed.original, getWebPMimeType());
    if (!originalUpload) {
      storageLogger.error("B2 storage not configured - missing environment variables");
      return Response.json(
        { error: "Image storage is not configured. Contact your administrator." },
        { status: 503 }
      );
    }

    const thumbnailUpload = await uploadToS3(thumbnailKey, processed.thumbnail, getWebPMimeType());

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

    return new Response(
      JSON.stringify({
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
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    storageLogger.error({ err: error }, "Image upload error");

    // Differentiate error types for better debugging
    let errorMessage = "Failed to upload image";
    if (error instanceof Error) {
      if (error.name === "S3ServiceException" || error.message.includes("S3") || error.message.includes("bucket") || error.message.includes("AccessDenied")) {
        errorMessage = "Storage service unavailable. Please check B2 configuration.";
      } else if (error.message.includes("sharp") || error.message.includes("Sharp") || error.message.includes("Input buffer") || error.message.includes("unsupported image format")) {
        errorMessage = "Image processing failed. The file may be corrupt.";
      } else if (process.env.NODE_ENV === "development") {
        errorMessage = `Failed to upload image: ${error.message}`;
      }
    }

    return Response.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

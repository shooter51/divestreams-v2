/**
 * Image Delete API
 *
 * POST /tenant/images/delete
 * Deletes an image from storage and database.
 */

import type { ActionFunctionArgs } from "react-router";
import { eq, and } from "drizzle-orm";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { deleteFromB2 } from "../../../../lib/storage";
import { getTenantDb } from "../../../../lib/db/tenant.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { tenant } = await requireTenant(request);

    const formData = await request.formData();
    const imageId = formData.get("imageId") as string;

    if (!imageId) {
      return Response.json({ error: "imageId is required" }, { status: 400 });
    }

    const { db, schema } = getTenantDb(tenant.subdomain);

    // Find the image
    const [image] = await db
      .select()
      .from(schema.images)
      .where(eq(schema.images.id, imageId));

    if (!image) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    // Extract storage keys from URLs
    // CDN URL format: https://cdn.divestreams.com/{key}
    // B2 URL format: https://s3.us-west-000.backblazeb2.com/DiveStreams/{key}
    const extractKey = (url: string): string | null => {
      try {
        const urlObj = new URL(url);
        // Get path after first segment (bucket name or cdn path)
        const pathParts = urlObj.pathname.split("/").filter(Boolean);
        // Skip bucket name if present, return rest of path
        if (pathParts.length > 1) {
          return pathParts.slice(1).join("/");
        }
        return pathParts.join("/");
      } catch {
        return null;
      }
    };

    // Delete from B2 storage
    const originalKey = extractKey(image.url);
    const thumbnailKey = image.thumbnailUrl ? extractKey(image.thumbnailUrl) : null;

    if (originalKey) {
      await deleteFromB2(originalKey);
    }
    if (thumbnailKey && thumbnailKey !== originalKey) {
      await deleteFromB2(thumbnailKey);
    }

    // Delete from database
    await db.delete(schema.images).where(eq(schema.images.id, imageId));

    // If this was the primary image, set a new primary
    if (image.isPrimary) {
      const [nextImage] = await db
        .select()
        .from(schema.images)
        .where(
          and(
            eq(schema.images.entityType, image.entityType),
            eq(schema.images.entityId, image.entityId)
          )
        )
        .orderBy(schema.images.sortOrder)
        .limit(1);

      if (nextImage) {
        await db
          .update(schema.images)
          .set({ isPrimary: true })
          .where(eq(schema.images.id, nextImage.id));
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Image delete error:", error);
    return Response.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}

export default function ImageDelete() {
  return null;
}

/**
 * Image Reorder API
 *
 * POST /tenant/images/reorder
 * Updates image order and primary status.
 */

import type { ActionFunctionArgs } from "react-router";
import { eq, and, inArray } from "drizzle-orm";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { getTenantDb } from "../../../../lib/db/tenant.server";

interface ReorderItem {
  id: string;
  sortOrder: number;
  isPrimary?: boolean;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { tenant } = await requireTenant(request);

    const body = await request.json();
    const { entityType, entityId, images } = body as {
      entityType: string;
      entityId: string;
      images: ReorderItem[];
    };

    if (!entityType || !entityId || !Array.isArray(images)) {
      return Response.json(
        { error: "entityType, entityId, and images array are required" },
        { status: 400 }
      );
    }

    const { db, schema } = getTenantDb(tenant.subdomain);

    // Verify all images belong to this entity
    const imageIds = images.map((img) => img.id);
    const existingImages = await db
      .select({ id: schema.images.id })
      .from(schema.images)
      .where(
        and(
          eq(schema.images.entityType, entityType),
          eq(schema.images.entityId, entityId),
          inArray(schema.images.id, imageIds)
        )
      );

    if (existingImages.length !== images.length) {
      return Response.json(
        { error: "One or more images do not belong to this entity" },
        { status: 400 }
      );
    }

    // First, reset all primary flags for this entity
    await db
      .update(schema.images)
      .set({ isPrimary: false })
      .where(
        and(
          eq(schema.images.entityType, entityType),
          eq(schema.images.entityId, entityId)
        )
      );

    // Update each image's sort order and primary status
    for (const img of images) {
      await db
        .update(schema.images)
        .set({
          sortOrder: img.sortOrder,
          isPrimary: img.isPrimary || false,
        })
        .where(eq(schema.images.id, img.id));
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Image reorder error:", error);
    return Response.json(
      { error: "Failed to reorder images" },
      { status: 500 }
    );
  }
}

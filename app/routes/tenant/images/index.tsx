/**
 * Image List API
 *
 * GET /app/images?entityType=tour&entityId=123
 * Lists images for a specific entity.
 */

import type { LoaderFunctionArgs } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { requireTenant } from "../../../../lib/auth/org-context.server";
import { getTenantDb } from "../../../../lib/db/tenant.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);

  const url = new URL(request.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");

  if (!entityType || !entityId) {
    return Response.json(
      { error: "entityType and entityId are required" },
      { status: 400 }
    );
  }

  const { db, schema } = getTenantDb(tenant.subdomain);

  const images = await db
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
        eq(schema.images.entityType, entityType),
        eq(schema.images.entityId, entityId)
      )
    )
    .orderBy(asc(schema.images.sortOrder));

  return Response.json({ images });
}

export default function ImageList() {
  return null;
}

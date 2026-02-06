import type { LoaderFunctionArgs } from "react-router";
import { db } from "../../../lib/db";
import { organization } from "../../../lib/db/schema/auth";
import { requireAdminAuth } from "../../../lib/auth/admin";

/**
 * Debug endpoint to list organizations.
 * SECURITY: Requires admin authentication and only available in development.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available in production" }, { status: 404 });
  }

  // Require admin authentication
  try {
    await requireAdminAuth(request);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orgs = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
      })
      .from(organization);

    return Response.json({
      status: "ok",
      count: orgs.length,
      organizations: orgs.map(o => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        createdAt: o.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    return Response.json({
      status: "error",
      error: String(error),
    }, { status: 500 });
  }
}

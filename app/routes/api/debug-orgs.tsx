import type { LoaderFunctionArgs } from "react-router";
import { db } from "../../../lib/db";
import { organization } from "../../../lib/db/schema/auth";

export async function loader({ request }: LoaderFunctionArgs) {
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

export default function DebugOrgs() {
  return null;
}

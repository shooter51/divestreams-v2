/**
 * Zapier Test Endpoint
 *
 * GET /api/zapier/test
 *
 * Used to verify API key and connection during Zapier app setup.
 */

import type { LoaderFunctionArgs } from "react-router";
import { validateZapierApiKey } from "../../../../lib/integrations/zapier-enhanced.server.js";
import { db } from "../../../../lib/db/index.js";
import { organization } from "../../../../lib/db/schema/auth.js";
import { eq } from "drizzle-orm";

export async function loader({ request }: LoaderFunctionArgs) {
  // Authenticate request using API key
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return Response.json(
      { error: "Missing API key. Provide X-API-Key header." },
      { status: 401 }
    );
  }

  const orgId = await validateZapierApiKey(apiKey);
  if (!orgId) {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  }

  // Get organization details
  const [org] = await db
    .select({
      id: organization.id,
      name: organization.name,
      subdomain: organization.subdomain,
    })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);

  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  return Response.json({
    success: true,
    message: "API key is valid",
    organization: {
      id: org.id,
      name: org.name,
      subdomain: org.subdomain,
    },
    timestamp: new Date().toISOString(),
  });
}

export default function ZapierTest() {
  return null;
}

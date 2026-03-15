/**
 * Zapier Test Endpoint
 *
 * GET /api/zapier/test
 *
 * Used to verify API key and connection during Zapier app setup.
 */

import type { LoaderFunctionArgs } from "react-router";
import { validateZapierApiKey } from "../../../../lib/integrations/zapier-enhanced.server.js";
import { apiSuccess, apiError } from "../../../../lib/api/response";
import { db } from "../../../../lib/db/index.js";
import { organization } from "../../../../lib/db/schema/auth.js";
import { eq } from "drizzle-orm";
import { checkRateLimit, getClientIp } from "../../../../lib/utils/rate-limit";

export async function loader({ request }: LoaderFunctionArgs) {
  // Rate limit API key auth attempts by IP
  const clientIp = getClientIp(request);
  const rateResult = await checkRateLimit(`zapier:auth:${clientIp}`, { maxAttempts: 20, windowMs: 60 * 1000 });
  if (!rateResult.allowed) {
    return apiError("Rate limit exceeded. Please try again later.", 429);
  }

  // Authenticate request using API key
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return apiError("Missing API key. Provide X-API-Key header.", 401);
  }

  const orgId = await validateZapierApiKey(apiKey);
  if (!orgId) {
    return apiError("Invalid API key", 401);
  }

  // Get organization details
  const [org] = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);

  if (!org) {
    return apiError("Organization not found", 404);
  }

  return apiSuccess({
    message: "API key is valid",
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
    },
    timestamp: new Date().toISOString(),
  });
}

export default function ZapierTest() {
  return null;
}

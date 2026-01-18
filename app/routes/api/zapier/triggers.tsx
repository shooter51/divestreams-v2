/**
 * Zapier Triggers List Endpoint
 *
 * GET /api/zapier/triggers - List available triggers and sample data
 *
 * Used by Zapier to discover available triggers and their data structure.
 */

import type { LoaderFunctionArgs } from "react-router";
import {
  ZAPIER_TRIGGERS,
  ZAPIER_TRIGGER_DESCRIPTIONS,
  getSampleTriggerData,
} from "../../../../lib/integrations/zapier.server.js";
import { validateZapierApiKey } from "../../../../lib/integrations/zapier-enhanced.server.js";

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

  // Return list of available triggers with sample data
  const triggers = ZAPIER_TRIGGERS.map((trigger) => ({
    key: trigger,
    name: trigger
      .split(".")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    description: ZAPIER_TRIGGER_DESCRIPTIONS[trigger],
    sample: getSampleTriggerData(trigger),
  }));

  return Response.json({
    triggers,
    count: triggers.length,
  });
}

export default function ZapierTriggers() {
  return null;
}

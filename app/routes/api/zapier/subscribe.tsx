/**
 * Zapier Webhook Subscription Endpoint
 *
 * POST /api/zapier/subscribe - Subscribe to a trigger
 * DELETE /api/zapier/subscribe - Unsubscribe from a trigger
 *
 * Implements REST Hooks pattern for Zapier instant triggers.
 */

import type { ActionFunctionArgs } from "react-router";
import {
  validateZapierApiKey,
  subscribeWebhook,
  unsubscribeWebhook,
} from "../../../../lib/integrations/zapier-enhanced.server.js";

export async function action({ request }: ActionFunctionArgs) {
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

  if (request.method === "POST") {
    // Subscribe to trigger
    try {
      const body = await request.json();
      const { event_type, target_url } = body;

      if (!event_type || !target_url) {
        return Response.json(
          { error: "Missing required fields: event_type, target_url" },
          { status: 400 }
        );
      }

      const subscription = await subscribeWebhook(orgId, event_type, target_url);

      return Response.json({
        id: subscription.id,
        event_type: subscription.eventType,
        target_url: subscription.targetUrl,
        created_at: subscription.createdAt,
      });
    } catch (error) {
      return Response.json(
        {
          error: error instanceof Error ? error.message : "Failed to subscribe",
        },
        { status: 500 }
      );
    }
  }

  if (request.method === "DELETE") {
    // Unsubscribe from trigger
    try {
      const body = await request.json();
      const { target_url, event_type } = body;

      if (!target_url) {
        return Response.json(
          { error: "Missing required field: target_url" },
          { status: 400 }
        );
      }

      const success = await unsubscribeWebhook(orgId, target_url, event_type);

      if (success) {
        return Response.json({ success: true });
      } else {
        return Response.json({ error: "Subscription not found" }, { status: 404 });
      }
    } catch (error) {
      return Response.json(
        {
          error: error instanceof Error ? error.message : "Failed to unsubscribe",
        },
        { status: 500 }
      );
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}

// No loader needed for webhook endpoint
export default function ZapierSubscribe() {
  return null;
}

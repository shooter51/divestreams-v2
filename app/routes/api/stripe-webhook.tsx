import type { ActionFunctionArgs } from "react-router";
import { handleStripeWebhook } from "../../../lib/stripe/webhook.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  // Enhanced logging for debugging
  console.log("[WEBHOOK] Received Stripe webhook");
  console.log("[WEBHOOK] Payload length:", payload.length);
  console.log("[WEBHOOK] Signature present:", !!signature);
  console.log("[WEBHOOK] Webhook secret configured:", !!process.env.STRIPE_WEBHOOK_SECRET);
  console.log("[WEBHOOK] Webhook secret length:", process.env.STRIPE_WEBHOOK_SECRET?.length || 0);

  if (!signature) {
    console.error("[WEBHOOK] Missing stripe-signature header");
    return new Response("No signature", { status: 400 });
  }

  const result = await handleStripeWebhook(payload, signature);

  if (!result.success) {
    console.error("[WEBHOOK] Handler failed:", result.message);
    return new Response(result.message, { status: 400 });
  }

  console.log("[WEBHOOK] Handler success:", result.message);
  return new Response(result.message, { status: 200 });
}

// Webhooks don't render anything
export default function StripeWebhook() {
  return null;
}

import type { ActionFunctionArgs } from "react-router";
import { handleStripeWebhook } from "../../../lib/stripe/webhook.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  const result = await handleStripeWebhook(payload, signature);

  if (!result.success) {
    return new Response(result.message, { status: 400 });
  }

  return new Response(result.message, { status: 200 });
}

// Webhooks don't render anything
export default function StripeWebhook() {
  return null;
}

import Stripe from "stripe";
import { stripe, handleSubscriptionUpdated, handleSubscriptionDeleted, setDefaultPaymentMethod } from "./index";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Verify and handle Stripe webhooks
export async function handleStripeWebhook(
  payload: string,
  signature: string
): Promise<{ success: boolean; message: string }> {
  if (!stripe || !webhookSecret) {
    return { success: false, message: "Stripe not configured" };
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return { success: false, message: `Webhook error: ${message}` };
  }

  // Handle the event
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscription);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log("Payment succeeded for invoice:", invoice.id);
      // Could send confirmation email here
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log("Payment failed for invoice:", invoice.id);
      // Could send failed payment email here
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("Checkout completed:", session.id);

      // Handle setup mode checkout (payment method added)
      if (session.mode === "setup" && session.setup_intent && session.customer) {
        try {
          const setupIntent = await stripe.setupIntents.retrieve(
            typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent.id
          );

          if (setupIntent.payment_method && typeof setupIntent.payment_method === "string") {
            const customerId = typeof session.customer === "string"
              ? session.customer
              : session.customer.id;
            await setDefaultPaymentMethod(customerId, setupIntent.payment_method);
            console.log("Set default payment method for customer:", customerId);
          }
        } catch (error) {
          console.error("Error setting default payment method:", error);
        }
      }
      // For subscription mode, the subscription events will handle the actual update
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return { success: true, message: "Webhook handled" };
}

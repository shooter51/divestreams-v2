import Stripe from "stripe";
import { stripe, handleSubscriptionUpdated, handleSubscriptionDeleted, setDefaultPaymentMethod } from "./index";
import {
  syncSubscriptionToDatabase,
  syncInvoiceToDatabase,
  syncPaymentToDatabase,
} from "./stripe-billing.server";

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
  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        // Update legacy subscription table
        await handleSubscriptionUpdated(subscription);
        // Sync to new comprehensive subscription tracking
        await syncSubscriptionToDatabase(subscription);
        console.log("Subscription updated:", subscription.id);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        // Update legacy subscription table
        await handleSubscriptionDeleted(subscription);
        // Sync to new comprehensive subscription tracking
        await syncSubscriptionToDatabase(subscription);
        console.log("Subscription deleted:", subscription.id);
        break;
      }

      case "invoice.created":
      case "invoice.updated":
      case "invoice.finalized": {
        const invoice = event.data.object as Stripe.Invoice;
        await syncInvoiceToDatabase(invoice);
        console.log("Invoice synced:", invoice.id);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await syncInvoiceToDatabase(invoice);
        console.log("Payment succeeded for invoice:", invoice.id);
        // TODO: Send confirmation email
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await syncInvoiceToDatabase(invoice);
        console.log("Payment failed for invoice:", invoice.id);
        // TODO: Send failed payment notification email
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await syncPaymentToDatabase(paymentIntent);
        console.log("Payment intent succeeded:", paymentIntent.id);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await syncPaymentToDatabase(paymentIntent);
        console.log("Payment intent failed:", paymentIntent.id);
        break;
      }

      case "payment_intent.canceled": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await syncPaymentToDatabase(paymentIntent);
        console.log("Payment intent canceled:", paymentIntent.id);
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

        // Handle subscription mode checkout
        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscriptionToDatabase(subscription);
          console.log("Subscription created from checkout:", subscription.id);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { success: true, message: "Webhook handled successfully" };
  } catch (error) {
    console.error("Error handling webhook event:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error processing webhook",
    };
  }
}

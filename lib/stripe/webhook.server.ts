import Stripe from "stripe";
import { stripe, handleSubscriptionUpdated, handleSubscriptionDeleted, setDefaultPaymentMethod } from "./index";
import {
  syncSubscriptionToDatabase,
  syncInvoiceToDatabase,
  syncPaymentToDatabase,
} from "./stripe-billing.server";
import { stripeLogger } from "../logger";

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
    stripeLogger.error({ message }, "Webhook signature verification failed");
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
        stripeLogger.info({ subscriptionId: subscription.id }, "Subscription updated");
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        // Update legacy subscription table
        await handleSubscriptionDeleted(subscription);
        // Sync to new comprehensive subscription tracking
        await syncSubscriptionToDatabase(subscription);
        stripeLogger.info({ subscriptionId: subscription.id }, "Subscription deleted");
        break;
      }

      case "invoice.created":
      case "invoice.updated":
      case "invoice.finalized": {
        const invoice = event.data.object as Stripe.Invoice;
        await syncInvoiceToDatabase(invoice);
        stripeLogger.info({ invoiceId: invoice.id }, "Invoice synced");
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await syncInvoiceToDatabase(invoice);
        stripeLogger.info({ invoiceId: invoice.id }, "Payment succeeded for invoice");

        // Send confirmation email
        try {
          const { sendPaymentSuccessEmail } = await import('./email-notifications.server');
          await sendPaymentSuccessEmail(invoice);
        } catch (emailError) {
          stripeLogger.error({ err: emailError, invoiceId: invoice.id }, "Failed to send payment success email");
          // Don't fail the webhook - email is best-effort
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await syncInvoiceToDatabase(invoice);
        stripeLogger.info({ invoiceId: invoice.id }, "Payment failed for invoice");

        // Send failed payment notification email
        try {
          const { sendPaymentFailedEmail } = await import('./email-notifications.server');
          await sendPaymentFailedEmail(invoice);
        } catch (emailError) {
          stripeLogger.error({ err: emailError, invoiceId: invoice.id }, "Failed to send payment failed email");
          // Don't fail the webhook - email is best-effort
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await syncPaymentToDatabase(paymentIntent);
        stripeLogger.info({ paymentIntentId: paymentIntent.id }, "Payment intent succeeded");
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await syncPaymentToDatabase(paymentIntent);
        stripeLogger.info({ paymentIntentId: paymentIntent.id }, "Payment intent failed");
        break;
      }

      case "payment_intent.canceled": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await syncPaymentToDatabase(paymentIntent);
        stripeLogger.info({ paymentIntentId: paymentIntent.id }, "Payment intent canceled");
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        stripeLogger.info({ sessionId: session.id }, "Checkout completed");

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
              stripeLogger.info({ customerId }, "Set default payment method for customer");
            }
          } catch (error) {
            stripeLogger.error({ err: error }, "Error setting default payment method");
          }
        }

        // Handle subscription mode checkout
        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscriptionToDatabase(subscription);
          stripeLogger.info({ subscriptionId: subscription.id }, "Subscription created from checkout");
        }
        break;
      }

      default:
        stripeLogger.debug({ eventType: event.type }, "Unhandled event type");
    }

    return { success: true, message: "Webhook handled successfully" };
  } catch (error) {
    stripeLogger.error({ err: error, eventType: event.type }, "Error handling webhook event");
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error processing webhook",
    };
  }
}

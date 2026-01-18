/**
 * Enhanced Stripe Billing Functions
 *
 * Comprehensive billing functions for managing subscriptions, payments, and invoices.
 * Integrates with the new stripe_* database tables for complete audit trail.
 */

import Stripe from "stripe";
import { db } from "../db";
import {
  stripeCustomers,
  stripeSubscriptions,
  stripePayments,
  stripeInvoices,
  type StripeInvoice,
  type StripePayment,
} from "../db/schema/stripe";
import { organization } from "../db/schema/auth";
import { eq, desc, and } from "drizzle-orm";
import { stripe } from "./index";

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

/**
 * Get or create Stripe customer for an organization
 */
export async function getOrCreateStripeCustomer(
  orgId: string
): Promise<string | null> {
  if (!stripe) {
    console.error("Stripe not initialized");
    return null;
  }

  // Check if customer already exists in our database
  const existingCustomer = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.organizationId, orgId))
    .limit(1);

  if (existingCustomer.length > 0) {
    return existingCustomer[0].stripeCustomerId;
  }

  // Get organization details
  const org = await db
    .select()
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);

  if (org.length === 0) {
    console.error(`Organization ${orgId} not found`);
    return null;
  }

  const orgData = org[0];

  // Create Stripe customer
  const customer = await stripe.customers.create({
    name: orgData.name,
    metadata: {
      organizationId: orgId,
      slug: orgData.slug,
    },
  });

  // Save to database
  await db.insert(stripeCustomers).values({
    organizationId: orgId,
    stripeCustomerId: customer.id,
    email: "", // Email will be updated from subscription
    name: orgData.name,
    metadata: customer.metadata as Record<string, string>,
  });

  return customer.id;
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Sync subscription data from Stripe to database
 */
export async function syncSubscriptionToDatabase(
  subscription: Stripe.Subscription
): Promise<void> {
  const orgId = subscription.metadata.organizationId;
  if (!orgId) {
    console.error("No organizationId in subscription metadata");
    return;
  }

  const item = subscription.items.data[0];
  const price = item?.price;

  // Upsert subscription record
  const existingSubscription = await db
    .select()
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.stripeSubscriptionId, subscription.id))
    .limit(1);

  const subscriptionData = {
    organizationId: orgId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    stripePriceId: price?.id || "",
    status: subscription.status,
    planName: subscription.metadata.planName || price?.nickname || null,
    planInterval: price?.recurring?.interval || null,
    amount: price?.unit_amount || 0,
    currency: price?.currency || "usd",
    currentPeriodStart: subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000)
      : null,
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000)
      : null,
    trialStart: subscription.trial_start
      ? new Date(subscription.trial_start * 1000)
      : null,
    trialEnd: subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null,
    metadata: subscription.metadata as Record<string, string>,
    updatedAt: new Date(),
  };

  if (existingSubscription.length > 0) {
    await db
      .update(stripeSubscriptions)
      .set(subscriptionData)
      .where(eq(stripeSubscriptions.id, existingSubscription[0].id));
  } else {
    await db.insert(stripeSubscriptions).values(subscriptionData);
  }
}

/**
 * Sync invoice to database
 */
export async function syncInvoiceToDatabase(
  invoice: Stripe.Invoice
): Promise<void> {
  if (!stripe) return;

  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;

  // Find organization by customer ID
  const customer = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.stripeCustomerId, customerId))
    .limit(1);

  if (customer.length === 0) {
    console.error(`Customer ${customerId} not found in database`);
    return;
  }

  const orgId = customer[0].organizationId;

  // Extract line items
  const lineItems = invoice.lines.data.map((line) => ({
    description: line.description || "",
    amount: line.amount,
    quantity: line.quantity || 1,
    currency: line.currency,
  }));

  const invoiceData = {
    organizationId: orgId,
    stripeInvoiceId: invoice.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId:
      typeof invoice.subscription === "string" ? invoice.subscription : null,
    invoiceNumber: invoice.number || null,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    amountRemaining: invoice.amount_remaining,
    subtotal: invoice.subtotal,
    total: invoice.total,
    tax: invoice.tax || 0,
    currency: invoice.currency,
    status: invoice.status || "draft",
    paid: invoice.paid,
    attemptCount: invoice.attempt_count,
    periodStart: invoice.period_start
      ? new Date(invoice.period_start * 1000)
      : null,
    periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
    dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
    hostedInvoiceUrl: invoice.hosted_invoice_url || null,
    invoicePdf: invoice.invoice_pdf || null,
    description: invoice.description || null,
    lineItems,
    metadata: invoice.metadata as Record<string, string>,
    updatedAt: new Date(),
  };

  // Upsert invoice
  const existing = await db
    .select()
    .from(stripeInvoices)
    .where(eq(stripeInvoices.stripeInvoiceId, invoice.id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(stripeInvoices)
      .set(invoiceData)
      .where(eq(stripeInvoices.id, existing[0].id));
  } else {
    await db.insert(stripeInvoices).values(invoiceData);
  }
}

/**
 * Sync payment intent to database
 */
export async function syncPaymentToDatabase(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  if (!stripe) return;

  const customerId =
    typeof paymentIntent.customer === "string"
      ? paymentIntent.customer
      : paymentIntent.customer?.id;
  if (!customerId) return;

  // Find organization by customer ID
  const customer = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.stripeCustomerId, customerId))
    .limit(1);

  if (customer.length === 0) {
    console.error(`Customer ${customerId} not found in database`);
    return;
  }

  const orgId = customer[0].organizationId;

  // Get payment method details if available
  const paymentMethod = paymentIntent.payment_method
    ? typeof paymentIntent.payment_method === "string"
      ? await stripe.paymentMethods.retrieve(paymentIntent.payment_method)
      : paymentIntent.payment_method
    : null;

  const paymentData = {
    organizationId: orgId,
    stripePaymentIntentId: paymentIntent.id,
    stripeCustomerId: customerId,
    stripeInvoiceId:
      typeof paymentIntent.invoice === "string"
        ? paymentIntent.invoice
        : null,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: paymentIntent.status,
    paymentMethodType: paymentMethod?.type || null,
    paymentMethodBrand: paymentMethod?.card?.brand || null,
    paymentMethodLast4: paymentMethod?.card?.last4 || null,
    failureCode: paymentIntent.last_payment_error?.code || null,
    failureMessage: paymentIntent.last_payment_error?.message || null,
    receiptEmail: paymentIntent.receipt_email || null,
    receiptUrl: (paymentIntent.charges.data[0] as any)?.receipt_url || null,
    description: paymentIntent.description || null,
    metadata: paymentIntent.metadata as Record<string, string>,
    updatedAt: new Date(),
  };

  // Upsert payment
  const existing = await db
    .select()
    .from(stripePayments)
    .where(eq(stripePayments.stripePaymentIntentId, paymentIntent.id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(stripePayments)
      .set(paymentData)
      .where(eq(stripePayments.id, existing[0].id));
  } else {
    await db.insert(stripePayments).values(paymentData);
  }
}

// ============================================================================
// RETRIEVAL FUNCTIONS
// ============================================================================

/**
 * Get invoice history for an organization
 */
export async function getInvoiceHistory(
  orgId: string,
  limit: number = 10
): Promise<StripeInvoice[]> {
  const invoices = await db
    .select()
    .from(stripeInvoices)
    .where(eq(stripeInvoices.organizationId, orgId))
    .orderBy(desc(stripeInvoices.createdAt))
    .limit(limit);

  return invoices;
}

/**
 * Get payment history for an organization
 */
export async function getPaymentHistory(
  orgId: string,
  limit: number = 10
): Promise<StripePayment[]> {
  const payments = await db
    .select()
    .from(stripePayments)
    .where(eq(stripePayments.organizationId, orgId))
    .orderBy(desc(stripePayments.createdAt))
    .limit(limit);

  return payments;
}

/**
 * Get current active subscription for an organization
 */
export async function getCurrentSubscription(orgId: string) {
  const subscription = await db
    .select()
    .from(stripeSubscriptions)
    .where(
      and(
        eq(stripeSubscriptions.organizationId, orgId),
        eq(stripeSubscriptions.status, "active")
      )
    )
    .orderBy(desc(stripeSubscriptions.createdAt))
    .limit(1);

  return subscription.length > 0 ? subscription[0] : null;
}

/**
 * Fetch and sync invoices from Stripe API
 */
export async function fetchInvoicesFromStripe(
  orgId: string,
  limit: number = 10
): Promise<void> {
  if (!stripe) return;

  const customerId = await getOrCreateStripeCustomer(orgId);
  if (!customerId) return;

  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  });

  for (const invoice of invoices.data) {
    await syncInvoiceToDatabase(invoice);
  }
}

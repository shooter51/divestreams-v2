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
import { stripeLogger } from "../logger";

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
    stripeLogger.error("Stripe not initialized");
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
    stripeLogger.error({ organizationId: orgId }, "Organization not found");
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
    stripeLogger.error({ subscriptionId: subscription.id }, "No organizationId in subscription metadata");
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
    currentPeriodStart:
      (subscription as any).current_period_start
        ? new Date((subscription as any).current_period_start * 1000)
        : null,
    currentPeriodEnd:
      (subscription as any).current_period_end
        ? new Date((subscription as any).current_period_end * 1000)
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
    stripeLogger.error({ customerId }, "Customer not found in database");
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
      typeof (invoice as any).subscription === "string" ? (invoice as any).subscription : null,
    invoiceNumber: invoice.number || null,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    amountRemaining: invoice.amount_remaining,
    subtotal: invoice.subtotal,
    total: invoice.total,
    tax: (invoice as any).tax || 0,
    currency: invoice.currency,
    status: invoice.status || "draft",
    paid: (invoice as any).paid || false,
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
    stripeLogger.error({ customerId }, "Customer not found in database");
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
      typeof (paymentIntent as any).invoice === "string"
        ? (paymentIntent as any).invoice
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
    receiptUrl: ((paymentIntent as any).charges?.data[0] as any)?.receipt_url || null,
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

// ============================================================================
// PRODUCT & PRICE MANAGEMENT
// ============================================================================

/**
 * Create Stripe Product and Prices for a subscription plan
 * Returns the price IDs for monthly and yearly billing
 */
export async function createStripeProductAndPrices(params: {
  planName: string;
  displayName: string;
  monthlyPriceInCents: number;
  yearlyPriceInCents: number;
  features?: string[];
}): Promise<{
  productId: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
} | null> {
  if (!stripe) {
    stripeLogger.error("Stripe not initialized - cannot create product/prices");
    return null;
  }

  const { planName, displayName, monthlyPriceInCents, yearlyPriceInCents, features = [] } = params;

  try {
    // Create Stripe Product
    const product = await stripe.products.create({
      name: displayName,
      description: `${displayName} subscription plan for DiveStreams`,
      metadata: {
        planName,
        source: "divestreams-admin",
      },
      // Add features as marketing features
      marketing_features: features.map(feature => ({ name: feature })),
    });

    stripeLogger.info({ productId: product.id, planName }, "Created Stripe product");

    // Create Monthly Price
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: monthlyPriceInCents,
      recurring: {
        interval: "month",
      },
      nickname: `${displayName} - Monthly`,
      metadata: {
        planName,
        billingPeriod: "monthly",
      },
    });

    stripeLogger.info({ priceId: monthlyPrice.id, amount: monthlyPriceInCents / 100, interval: "month" }, "Created monthly price");

    // Create Yearly Price
    const yearlyPrice = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: yearlyPriceInCents,
      recurring: {
        interval: "year",
      },
      nickname: `${displayName} - Yearly`,
      metadata: {
        planName,
        billingPeriod: "yearly",
      },
    });

    stripeLogger.info({ priceId: yearlyPrice.id, amount: yearlyPriceInCents / 100, interval: "year" }, "Created yearly price");

    return {
      productId: product.id,
      monthlyPriceId: monthlyPrice.id,
      yearlyPriceId: yearlyPrice.id,
    };
  } catch (error) {
    stripeLogger.error({ err: error, planName }, "Failed to create Stripe product/prices");
    return null;
  }
}

/**
 * Update existing Stripe Prices for a subscription plan
 * Note: Stripe prices are immutable, so this creates new prices and archives old ones
 */
export async function updateStripeProductAndPrices(params: {
  productId?: string;
  oldMonthlyPriceId?: string;
  oldYearlyPriceId?: string;
  planName: string;
  displayName: string;
  monthlyPriceInCents: number;
  yearlyPriceInCents: number;
  features?: string[];
}): Promise<{
  productId: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
} | null> {
  if (!stripe) {
    stripeLogger.error("Stripe not initialized - cannot update product/prices");
    return null;
  }

  const {
    productId,
    oldMonthlyPriceId,
    oldYearlyPriceId,
    planName,
    displayName,
    monthlyPriceInCents,
    yearlyPriceInCents,
    features = [],
  } = params;

  try {
    let finalProductId = productId;

    // If no product ID, create a new product
    if (!finalProductId) {
      const product = await stripe.products.create({
        name: displayName,
        description: `${displayName} subscription plan for DiveStreams`,
        metadata: {
          planName,
          source: "divestreams-admin",
        },
        marketing_features: features.map(feature => ({ name: feature })),
      });
      finalProductId = product.id;
      stripeLogger.info({ productId: finalProductId }, "Created new Stripe product");
    } else {
      // Update existing product name and features
      await stripe.products.update(finalProductId, {
        name: displayName,
        description: `${displayName} subscription plan for DiveStreams`,
        marketing_features: features.map(feature => ({ name: feature })),
      });
      stripeLogger.info({ productId: finalProductId }, "Updated Stripe product");
    }

    // Archive old prices if they exist
    if (oldMonthlyPriceId) {
      await stripe.prices.update(oldMonthlyPriceId, { active: false });
      stripeLogger.info({ priceId: oldMonthlyPriceId }, "Archived old monthly price");
    }
    if (oldYearlyPriceId) {
      await stripe.prices.update(oldYearlyPriceId, { active: false });
      stripeLogger.info({ priceId: oldYearlyPriceId }, "Archived old yearly price");
    }

    // Create new prices
    const monthlyPrice = await stripe.prices.create({
      product: finalProductId,
      currency: "usd",
      unit_amount: monthlyPriceInCents,
      recurring: {
        interval: "month",
      },
      nickname: `${displayName} - Monthly`,
      metadata: {
        planName,
        billingPeriod: "monthly",
      },
    });

    const yearlyPrice = await stripe.prices.create({
      product: finalProductId,
      currency: "usd",
      unit_amount: yearlyPriceInCents,
      recurring: {
        interval: "year",
      },
      nickname: `${displayName} - Yearly`,
      metadata: {
        planName,
        billingPeriod: "yearly",
      },
    });

    stripeLogger.info({ monthlyPriceId: monthlyPrice.id, yearlyPriceId: yearlyPrice.id }, "Created new prices");

    return {
      productId: finalProductId,
      monthlyPriceId: monthlyPrice.id,
      yearlyPriceId: yearlyPrice.id,
    };
  } catch (error) {
    stripeLogger.error({ err: error, planName }, "Failed to update Stripe product/prices");
    return null;
  }
}

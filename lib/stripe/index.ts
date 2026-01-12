import Stripe from "stripe";
import { db } from "../db";
import { tenants, subscriptionPlans } from "../db/schema";
import { eq } from "drizzle-orm";

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY not set - Stripe functionality disabled");
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey)
  : null;

// Create a Stripe customer for a tenant
export async function createStripeCustomer(tenantId: string): Promise<string | null> {
  if (!stripe) return null;

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  if (tenant.stripeCustomerId) {
    return tenant.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: tenant.email,
    name: tenant.name,
    metadata: {
      tenantId: tenant.id,
      subdomain: tenant.subdomain,
    },
  });

  await db
    .update(tenants)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  return customer.id;
}

// Create a checkout session for subscription
export async function createCheckoutSession(
  tenantId: string,
  planName: "starter" | "pro" | "enterprise",
  billingPeriod: "monthly" | "yearly",
  successUrl: string,
  cancelUrl: string
): Promise<string | null> {
  if (!stripe) return null;

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  // Get the plan
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.name, planName))
    .limit(1);

  if (!plan) {
    throw new Error("Plan not found");
  }

  // Get or create Stripe customer
  let customerId = tenant.stripeCustomerId;
  if (!customerId) {
    customerId = await createStripeCustomer(tenantId);
  }

  if (!customerId) {
    throw new Error("Could not create Stripe customer");
  }

  // Get the price ID
  const priceId = billingPeriod === "yearly" ? plan.yearlyPriceId : plan.monthlyPriceId;

  if (!priceId) {
    throw new Error(`No ${billingPeriod} price configured for ${planName} plan`);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        tenantId: tenant.id,
        planName,
      },
    },
    metadata: {
      tenantId: tenant.id,
    },
  });

  return session.url;
}

// Create a billing portal session
export async function createBillingPortalSession(
  tenantId: string,
  returnUrl: string
): Promise<string | null> {
  if (!stripe) return null;

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  if (!tenant?.stripeCustomerId) {
    throw new Error("Tenant has no Stripe customer");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}

// Handle subscription updated (from webhook)
export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const tenantId = subscription.metadata.tenantId;
  if (!tenantId) {
    console.error("No tenantId in subscription metadata");
    return;
  }

  let status: string;
  switch (subscription.status) {
    case "active":
      status = "active";
      break;
    case "trialing":
      status = "trialing";
      break;
    case "past_due":
      status = "past_due";
      break;
    case "canceled":
    case "unpaid":
      status = "canceled";
      break;
    default:
      status = subscription.status;
  }

  // Use type assertion for Stripe API response properties
  const sub = subscription as unknown as { current_period_end?: number };
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

  await db
    .update(tenants)
    .set({
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      currentPeriodEnd: periodEnd,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));
}

// Handle subscription deleted (from webhook)
export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const tenantId = subscription.metadata.tenantId;
  if (!tenantId) return;

  await db
    .update(tenants)
    .set({
      subscriptionStatus: "canceled",
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));
}

// Get subscription status
export async function getSubscriptionStatus(tenantId: string) {
  if (!stripe) return null;

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  if (!tenant?.stripeSubscriptionId) {
    return null;
  }

  const subscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);

  // Use type assertion for Stripe API response properties
  const sub = subscription as unknown as {
    status: string;
    current_period_end?: number;
    cancel_at_period_end?: boolean;
  };

  return {
    status: sub.status,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
  };
}

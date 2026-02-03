import Stripe from "stripe";
import { db } from "../db";
import { organization, subscription, subscriptionPlans } from "../db/schema";
import { eq, or } from "drizzle-orm";
import { invalidateSubscriptionCache } from "../cache/subscription.server";

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY not set - Stripe functionality disabled");
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey)
  : null;

// Helper to get organization and subscription data
async function getOrgWithSubscription(orgId: string) {
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);

  if (!org) return null;

  const [sub] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organizationId, orgId))
    .limit(1);

  return { org, sub };
}

// Create a Stripe customer for an organization
export async function createStripeCustomer(orgId: string): Promise<string | null> {
  if (!stripe) return null;

  const data = await getOrgWithSubscription(orgId);
  if (!data) {
    throw new Error("Organization not found");
  }

  const { org, sub } = data;

  // Return existing customer ID if we have one
  if (sub?.stripeCustomerId) {
    return sub.stripeCustomerId;
  }

  // Get email from organization metadata or use a default
  const metadata = org.metadata ? JSON.parse(org.metadata) : {};
  const email = metadata.email || `${org.slug}@divestreams.com`;

  const customer = await stripe.customers.create({
    email,
    name: org.name,
    metadata: {
      organizationId: org.id,
      slug: org.slug,
    },
  });

  // Update or create subscription record with Stripe customer ID
  if (sub) {
    await db
      .update(subscription)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(subscription.organizationId, orgId));
  } else {
    // Look up the free plan to get its ID
    const [freePlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, "free"))
      .limit(1);

    // Create a new subscription record if none exists
    await db.insert(subscription).values({
      organizationId: orgId,
      plan: "free",
      planId: freePlan?.id || null, // Set both plan and planId
      status: "active",
      stripeCustomerId: customer.id,
    });
  }

  return customer.id;
}

// Create a checkout session for subscription
export async function createCheckoutSession(
  orgId: string,
  planName: "starter" | "pro" | "enterprise",
  billingPeriod: "monthly" | "yearly",
  successUrl: string,
  cancelUrl: string
): Promise<string | null> {
  if (!stripe) return null;

  const data = await getOrgWithSubscription(orgId);
  if (!data) {
    throw new Error("Organization not found");
  }

  const { org, sub } = data;

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
  let customerId = sub?.stripeCustomerId;
  if (!customerId) {
    customerId = await createStripeCustomer(orgId);
  }

  if (!customerId) {
    throw new Error("Could not create Stripe customer");
  }

  // Get the price ID
  const priceId = billingPeriod === "yearly" ? plan.yearlyPriceId : plan.monthlyPriceId;

  if (!priceId) {
    throw new Error(
      `Subscription upgrade not available: The "${planName}" plan does not have a Stripe Price ID configured for ${billingPeriod} billing. ` +
      `Please contact support or try a different billing period.`
    );
  }

  // KAN-627 FIX: Check for saved payment method before redirecting to Checkout
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) {
      const defaultPaymentMethodId = (customer as Stripe.Customer).invoice_settings?.default_payment_method;

      // If customer has a saved payment method, use it directly
      if (defaultPaymentMethodId && typeof defaultPaymentMethodId === "string") {
        console.log(`✓ Using saved payment method for org ${orgId}: ${defaultPaymentMethodId}`);

        // Check if customer already has an active subscription
        if (sub?.stripeSubscriptionId && sub?.status === "active") {
          try {
            // Modify existing subscription
            const currentSubscription = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);

            if (currentSubscription.status === "active") {
              // SECURITY: Fetch prices from Stripe API to prevent manipulation
              const currentPriceId = currentSubscription.items.data[0].price.id;
              const currentStripePrice = await stripe.prices.retrieve(currentPriceId);
              const currentPriceAmount = currentStripePrice.unit_amount || 0;

              const newStripePrice = await stripe.prices.retrieve(priceId);
              const newPriceAmount = newStripePrice.unit_amount || 0;

              const isUpgrade = newPriceAmount > currentPriceAmount;

              // Update the subscription
              await stripe.subscriptions.update(sub.stripeSubscriptionId, {
                items: [{
                  id: currentSubscription.items.data[0].id,
                  price: priceId,
                }],
                proration_behavior: isUpgrade ? 'create_prorations' : 'none',
                billing_cycle_anchor: isUpgrade ? 'now' : 'unchanged',
                default_payment_method: defaultPaymentMethodId,
                metadata: {
                  organizationId: org.id,
                  planName,
                },
              });

              console.log(`✓ Updated subscription ${sub.stripeSubscriptionId} to ${planName}`);

              // Update local database immediately
              await db
                .update(subscription)
                .set({
                  planId: plan.id,
                  plan: planName,
                  stripePriceId: priceId,
                  updatedAt: new Date(),
                })
                .where(eq(subscription.organizationId, orgId));

              // Invalidate cache so user sees updated subscription immediately
              await invalidateSubscriptionCache(orgId);

              return successUrl;
            }
          } catch (error) {
            console.error("Failed to modify existing subscription:", error);
            // Fall through to create new subscription
          }
        }

        // No existing subscription - create new one with saved payment method
        try {
          const newSubscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            default_payment_method: defaultPaymentMethodId,
            metadata: {
              organizationId: org.id,
              planName,
            },
          });

          console.log(`✓ Created subscription ${newSubscription.id} with saved payment method`);

          // Use type assertion for Stripe API response properties
          const subData = newSubscription as unknown as {
            current_period_start?: number;
            current_period_end?: number;
          };

          // Update local database immediately
          await db
            .update(subscription)
            .set({
              stripeSubscriptionId: newSubscription.id,
              stripePriceId: priceId,
              planId: plan.id,
              plan: planName,
              status: newSubscription.status as "trialing" | "active" | "past_due" | "canceled",
              currentPeriodStart: subData.current_period_start ? new Date(subData.current_period_start * 1000) : null,
              currentPeriodEnd: subData.current_period_end ? new Date(subData.current_period_end * 1000) : null,
              updatedAt: new Date(),
            })
            .where(eq(subscription.organizationId, orgId));

          // Invalidate cache so user sees updated subscription immediately
          await invalidateSubscriptionCache(orgId);

          return successUrl;
        } catch (error) {
          console.error("Failed to create subscription with saved payment method:", error);
          // Fall through to Checkout session
        }
      }
    }
  } catch (error) {
    console.error("Error checking for saved payment method:", error);
    // Fall through to Checkout session
  }

  // No saved payment method OR modification failed - redirect to Checkout
  console.log(`→ Redirecting to Checkout for org ${orgId} (no saved payment method)`);

  // Check if customer already has an active subscription
  if (sub?.stripeSubscriptionId && sub?.status === "active") {
    try {
      // Modify existing subscription instead of creating a new one
      const currentSubscription = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);

      if (currentSubscription.status === "active") {
        // SECURITY: Fetch prices from Stripe API to prevent manipulation
        const currentPriceId = currentSubscription.items.data[0].price.id;
        const currentStripePrice = await stripe.prices.retrieve(currentPriceId);
        const currentPriceAmount = currentStripePrice.unit_amount || 0;

        const newStripePrice = await stripe.prices.retrieve(priceId);
        const newPriceAmount = newStripePrice.unit_amount || 0;

        const isUpgrade = newPriceAmount > currentPriceAmount;

        // Update the subscription
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          items: [{
            id: currentSubscription.items.data[0].id,
            price: priceId,
          }],
          proration_behavior: isUpgrade ? 'create_prorations' : 'none',
          billing_cycle_anchor: isUpgrade ? 'now' : 'unchanged',
          metadata: {
            organizationId: org.id,
            planName,
          },
        });

        // Return success URL directly (subscription already updated)
        return successUrl;
      }
    } catch (error) {
      console.error("Failed to modify existing subscription:", error);
      // Fall through to create new subscription if modification fails
    }
  }

  // Create new checkout session
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
        organizationId: org.id,
        planName,
      },
    },
    metadata: {
      organizationId: org.id,
    },
  });

  return session.url;
}

// Create a billing portal session
export async function createBillingPortalSession(
  orgId: string,
  returnUrl: string
): Promise<string | null> {
  if (!stripe) return null;

  const data = await getOrgWithSubscription(orgId);
  if (!data) {
    throw new Error("Organization not found");
  }

  // Get or create Stripe customer
  let customerId = data.sub?.stripeCustomerId;
  if (!customerId) {
    customerId = await createStripeCustomer(orgId);
  }

  if (!customerId) {
    throw new Error("Could not create Stripe customer");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

// Create a setup session for adding a payment method (used when no customer exists yet)
export async function createSetupSession(
  orgId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string | null> {
  if (!stripe) return null;

  const data = await getOrgWithSubscription(orgId);
  if (!data) {
    throw new Error("Organization not found");
  }

  const { org, sub } = data;

  // Get or create Stripe customer
  let customerId = sub?.stripeCustomerId;
  if (!customerId) {
    customerId = await createStripeCustomer(orgId);
  }

  if (!customerId) {
    throw new Error("Could not create Stripe customer");
  }

  // Create a Checkout session in setup mode to collect payment method
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "setup",
    payment_method_types: ["card"],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      organizationId: org.id,
    },
  });

  return session.url;
}

// Handle subscription updated (from webhook)
export async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
  const orgId = stripeSubscription.metadata.organizationId || stripeSubscription.metadata.tenantId;
  if (!orgId) {
    console.error("❌ No organizationId in subscription metadata:", stripeSubscription.id);
    return;
  }

  console.log(`📥 Processing subscription update for org ${orgId}: ${stripeSubscription.id}`);
  console.log(`   Status: ${stripeSubscription.status}`);

  // KAN-627 FIX: Map Stripe subscription status correctly
  let status: "active" | "trialing" | "past_due" | "canceled";
  switch (stripeSubscription.status) {
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
    case "incomplete_expired":
      status = "canceled";
      break;
    case "incomplete":
      // Keep as trialing if incomplete (waiting for payment)
      status = "trialing";
      break;
    default:
      console.warn(`⚠️ Unknown subscription status: ${stripeSubscription.status}`);
      status = "trialing";
  }

  // Use type assertion for Stripe API response properties
  const sub = stripeSubscription as unknown as {
    current_period_end?: number;
    current_period_start?: number;
  };
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : null;

  // Get the price ID from the subscription
  const item = stripeSubscription.items.data[0];
  const priceId = item?.price?.id;

  console.log(`   Price ID: ${priceId}`);

  // Look up the plan by matching the price ID (monthly or yearly)
  let planId: string | null = null;
  let planName = "free";

  if (priceId) {
    const [matchedPlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(
        or(
          eq(subscriptionPlans.monthlyPriceId, priceId),
          eq(subscriptionPlans.yearlyPriceId, priceId)
        )
      )
      .limit(1);

    if (matchedPlan) {
      planId = matchedPlan.id;
      planName = matchedPlan.name;
      console.log(`   ✓ Matched plan: ${planName} (${planId})`);
    } else {
      console.warn(`   ⚠️ No plan found for price ID: ${priceId}`);
    }
  }

  // Update subscription with plan reference
  try {
    const result = await db
      .update(subscription)
      .set({
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: priceId || null,
        planId: planId,
        plan: planName,
        status: status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscription.organizationId, orgId));

    console.log(`   ✅ Updated subscription in database: status=${status}, plan=${planName}`);

    // Invalidate cache so changes are immediately visible
    await invalidateSubscriptionCache(orgId);
    console.log(`   ✅ Invalidated subscription cache for org ${orgId}`);
  } catch (error) {
    console.error(`   ❌ Failed to update subscription in database:`, error);
    throw error;
  }
}

// Handle subscription deleted (from webhook)
export async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  const orgId = stripeSubscription.metadata.organizationId || stripeSubscription.metadata.tenantId;
  if (!orgId) return;

  await db
    .update(subscription)
    .set({
      status: "canceled",
      updatedAt: new Date(),
    })
    .where(eq(subscription.organizationId, orgId));
}

// Get subscription status
export async function getSubscriptionStatus(orgId: string) {
  if (!stripe) return null;

  const [sub] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organizationId, orgId))
    .limit(1);

  if (!sub?.stripeSubscriptionId) {
    return null;
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);

  // Use type assertion for Stripe API response properties
  const subData = stripeSubscription as unknown as {
    status: string;
    current_period_end?: number;
    cancel_at_period_end?: boolean;
  };

  return {
    status: subData.status,
    currentPeriodEnd: subData.current_period_end ? new Date(subData.current_period_end * 1000) : null,
    cancelAtPeriodEnd: subData.cancel_at_period_end ?? false,
  };
}

// Cancel subscription at period end
export async function cancelSubscription(orgId: string): Promise<boolean> {
  if (!stripe) return false;

  const [sub] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organizationId, orgId))
    .limit(1);

  if (!sub?.stripeSubscriptionId) {
    // No subscription to cancel - just mark as canceled
    await db
      .update(subscription)
      .set({
        status: "canceled",
        updatedAt: new Date(),
      })
      .where(eq(subscription.organizationId, orgId));
    return true;
  }

  // Cancel at period end (user keeps access until billing period ends)
  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await db
    .update(subscription)
    .set({
      status: "canceled",
      updatedAt: new Date(),
    })
    .where(eq(subscription.organizationId, orgId));

  return true;
}

// Set the default payment method for a customer from a setup intent
export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<void> {
  if (!stripe) return;

  try {
    // Attach payment method to customer if not already
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  } catch (error) {
    // Payment method might already be attached, that's ok
    const err = error as { code?: string };
    if (err.code !== "resource_already_exists") {
      throw error;
    }
  }

  // Set as default payment method for invoices
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}

// Get payment method details for an organization
export async function getPaymentMethod(orgId: string): Promise<{
  type: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
} | null> {
  if (!stripe) return null;

  const [sub] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organizationId, orgId))
    .limit(1);

  if (!sub?.stripeCustomerId) {
    return null;
  }

  try {
    // Get the customer's default payment method
    const customer = await stripe.customers.retrieve(sub.stripeCustomerId);

    if (customer.deleted) {
      return null;
    }

    // Check for invoice_settings.default_payment_method first
    const defaultPaymentMethodId =
      (customer as Stripe.Customer).invoice_settings?.default_payment_method;

    if (defaultPaymentMethodId && typeof defaultPaymentMethodId === "string") {
      const paymentMethod = await stripe.paymentMethods.retrieve(defaultPaymentMethodId);

      if (paymentMethod.type === "card" && paymentMethod.card) {
        return {
          type: "card",
          brand: paymentMethod.card.brand || "Card",
          last4: paymentMethod.card.last4 || "****",
          expiryMonth: paymentMethod.card.exp_month || 0,
          expiryYear: paymentMethod.card.exp_year || 0,
        };
      }
    }

    // Fallback: list payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: sub.stripeCustomerId,
      type: "card",
      limit: 1,
    });

    if (paymentMethods.data.length > 0) {
      const pm = paymentMethods.data[0];
      if (pm.card) {
        return {
          type: "card",
          brand: pm.card.brand || "Card",
          last4: pm.card.last4 || "****",
          expiryMonth: pm.card.exp_month || 0,
          expiryYear: pm.card.exp_year || 0,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error fetching payment method:", error);
    return null;
  }
}

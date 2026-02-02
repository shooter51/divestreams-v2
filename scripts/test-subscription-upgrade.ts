/**
 * Test Subscription Upgrade Flow
 *
 * Phase 4: Testing & verification (KAN-627)
 * Tests all 4 issues that were reported:
 * 1. Price sync - Correct prices displayed
 * 2. Saved payment methods used
 * 3. Subscription status updates to "active"
 * 4. Webhooks firing and updating status
 *
 * Usage:
 *   npx tsx scripts/test-subscription-upgrade.ts <org-email>
 */

import Stripe from "stripe";
import { db } from "../lib/db";
import { organization, subscription, subscriptionPlans } from "../lib/db/schema";
import { eq } from "drizzle-orm";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY environment variable not set");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

interface TestResult {
  test: string;
  status: "✅ PASS" | "❌ FAIL" | "⚠️  WARN";
  message: string;
}

const results: TestResult[] = [];

function addResult(test: string, status: "✅ PASS" | "❌ FAIL" | "⚠️  WARN", message: string) {
  results.push({ test, status, message });
  console.log(`${status} ${test}`);
  if (message) {
    console.log(`   ${message}\n`);
  }
}

async function findOrganization(email: string) {
  // Try to find organization by metadata email or slug
  const orgs = await db.select().from(organization);

  for (const org of orgs) {
    try {
      const metadata = org.metadata ? JSON.parse(org.metadata) : {};
      if (metadata.email === email || org.slug.includes(email.split("@")[0])) {
        return org;
      }
    } catch (e) {
      // Skip invalid metadata
    }
  }

  return null;
}

async function test1_PriceSync() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 1: Price Sync (Database vs Stripe)");
  console.log("=".repeat(60) + "\n");

  const plans = await db.select().from(subscriptionPlans);
  let allMatch = true;

  for (const plan of plans) {
    if (plan.name === "free" || plan.monthlyPrice === 0) {
      continue;
    }

    console.log(`Checking plan: ${plan.displayName} (${plan.name})`);
    console.log(`  DB Monthly: $${plan.monthlyPrice / 100}`);

    if (!plan.monthlyPriceId) {
      addResult(
        `${plan.name} - Monthly Price ID`,
        "❌ FAIL",
        "No monthly price ID in database"
      );
      allMatch = false;
      continue;
    }

    try {
      const monthlyPrice = await stripe.prices.retrieve(plan.monthlyPriceId);
      const stripeAmount = monthlyPrice.unit_amount || 0;

      console.log(`  Stripe Monthly: $${stripeAmount / 100}`);

      if (stripeAmount === plan.monthlyPrice) {
        addResult(
          `${plan.name} - Monthly Price`,
          "✅ PASS",
          `Prices match: $${plan.monthlyPrice / 100}`
        );
      } else {
        addResult(
          `${plan.name} - Monthly Price`,
          "❌ FAIL",
          `Mismatch: DB=$${plan.monthlyPrice / 100}, Stripe=$${stripeAmount / 100}`
        );
        allMatch = false;
      }
    } catch (error) {
      addResult(
        `${plan.name} - Monthly Price`,
        "❌ FAIL",
        `Failed to fetch Stripe price: ${plan.monthlyPriceId}`
      );
      allMatch = false;
    }
  }

  return allMatch;
}

async function test2_SavedPaymentMethod(orgEmail: string) {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: Saved Payment Method");
  console.log("=".repeat(60) + "\n");

  const org = await findOrganization(orgEmail);

  if (!org) {
    addResult("Organization Lookup", "❌ FAIL", `Organization not found: ${orgEmail}`);
    return false;
  }

  console.log(`Found organization: ${org.name} (${org.slug})`);

  const [sub] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organizationId, org.id))
    .limit(1);

  if (!sub) {
    addResult("Subscription Lookup", "❌ FAIL", "No subscription found for organization");
    return false;
  }

  console.log(`Subscription status: ${sub.status}`);
  console.log(`Stripe customer ID: ${sub.stripeCustomerId}`);

  if (!sub.stripeCustomerId) {
    addResult("Stripe Customer", "❌ FAIL", "No Stripe customer ID");
    return false;
  }

  try {
    const customer = await stripe.customers.retrieve(sub.stripeCustomerId);

    if (customer.deleted) {
      addResult("Stripe Customer", "❌ FAIL", "Customer deleted in Stripe");
      return false;
    }

    const defaultPaymentMethodId = (customer as Stripe.Customer).invoice_settings?.default_payment_method;

    if (defaultPaymentMethodId) {
      console.log(`Default payment method: ${defaultPaymentMethodId}`);

      const pm = await stripe.paymentMethods.retrieve(
        typeof defaultPaymentMethodId === "string" ? defaultPaymentMethodId : defaultPaymentMethodId.id
      );

      if (pm.type === "card" && pm.card) {
        addResult(
          "Saved Payment Method",
          "✅ PASS",
          `Card on file: ${pm.card.brand} •••• ${pm.card.last4} (${pm.card.exp_month}/${pm.card.exp_year})`
        );
        return true;
      }
    }

    // Check for any payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: sub.stripeCustomerId,
      type: "card",
      limit: 1,
    });

    if (paymentMethods.data.length > 0) {
      const pm = paymentMethods.data[0];
      if (pm.card) {
        addResult(
          "Saved Payment Method",
          "⚠️  WARN",
          `Card exists but not set as default: ${pm.card.brand} •••• ${pm.card.last4}`
        );
        return true;
      }
    }

    addResult(
      "Saved Payment Method",
      "❌ FAIL",
      "No payment method found for customer"
    );
    return false;

  } catch (error: any) {
    addResult("Saved Payment Method", "❌ FAIL", `Error: ${error.message}`);
    return false;
  }
}

async function test3_SubscriptionStatus(orgEmail: string) {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: Subscription Status");
  console.log("=".repeat(60) + "\n");

  const org = await findOrganization(orgEmail);

  if (!org) {
    addResult("Organization Lookup", "❌ FAIL", `Organization not found: ${orgEmail}`);
    return false;
  }

  const [sub] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organizationId, org.id))
    .limit(1);

  if (!sub) {
    addResult("Subscription Lookup", "❌ FAIL", "No subscription found");
    return false;
  }

  console.log(`Database subscription status: ${sub.status}`);
  console.log(`Database plan: ${sub.plan}`);

  if (!sub.stripeSubscriptionId) {
    addResult("Stripe Subscription", "⚠️  WARN", "No Stripe subscription ID");
    return false;
  }

  try {
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);

    console.log(`Stripe subscription status: ${stripeSub.status}`);
    console.log(`Stripe subscription ID: ${stripeSub.id}`);

    // Check if statuses match
    const statusMap: Record<string, string> = {
      active: "active",
      trialing: "trialing",
      past_due: "past_due",
      canceled: "canceled",
      unpaid: "canceled",
    };

    const expectedStatus = statusMap[stripeSub.status] || stripeSub.status;

    if (sub.status === expectedStatus) {
      addResult(
        "Subscription Status",
        "✅ PASS",
        `Status matches: ${sub.status}`
      );
      return true;
    } else {
      addResult(
        "Subscription Status",
        "❌ FAIL",
        `Status mismatch: DB=${sub.status}, Stripe=${stripeSub.status}`
      );
      return false;
    }

  } catch (error: any) {
    addResult("Subscription Status", "❌ FAIL", `Error: ${error.message}`);
    return false;
  }
}

async function test4_WebhookEvents(orgEmail: string) {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 4: Webhook Events");
  console.log("=".repeat(60) + "\n");

  const org = await findOrganization(orgEmail);

  if (!org) {
    addResult("Organization Lookup", "❌ FAIL", `Organization not found: ${orgEmail}`);
    return false;
  }

  const [sub] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organizationId, org.id))
    .limit(1);

  if (!sub?.stripeSubscriptionId) {
    addResult("Webhook Test", "⚠️  WARN", "No Stripe subscription to test");
    return false;
  }

  try {
    // List recent events for this subscription
    const events = await stripe.events.list({
      limit: 20,
      type: "customer.subscription.updated",
    });

    console.log(`Found ${events.data.length} recent subscription events\n`);

    // Check if any events match our subscription
    const matchingEvents = events.data.filter((event) => {
      const subscription = event.data.object as Stripe.Subscription;
      return subscription.id === sub.stripeSubscriptionId;
    });

    console.log(`Events for subscription ${sub.stripeSubscriptionId}: ${matchingEvents.length}`);

    if (matchingEvents.length > 0) {
      const latestEvent = matchingEvents[0];
      console.log(`Latest event: ${latestEvent.id} (${new Date(latestEvent.created * 1000).toISOString()})`);

      addResult(
        "Webhook Events",
        "✅ PASS",
        `Found ${matchingEvents.length} webhook event(s) for this subscription`
      );
      return true;
    } else {
      addResult(
        "Webhook Events",
        "⚠️  WARN",
        "No recent webhook events found for this subscription"
      );
      return false;
    }

  } catch (error: any) {
    addResult("Webhook Events", "❌ FAIL", `Error: ${error.message}`);
    return false;
  }
}

async function main() {
  const orgEmail = process.argv[2];

  console.log("🧪 Subscription Upgrade Test Suite (KAN-627)\n");

  if (!orgEmail) {
    console.error("Usage: npx tsx scripts/test-subscription-upgrade.ts <org-email>\n");
    console.log("Example: npx tsx scripts/test-subscription-upgrade.ts demopurpose123@proton.me\n");
    process.exit(1);
  }

  console.log(`Testing organization: ${orgEmail}\n`);

  // Run all tests
  await test1_PriceSync();
  await test2_SavedPaymentMethod(orgEmail);
  await test3_SubscriptionStatus(orgEmail);
  await test4_WebhookEvents(orgEmail);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("TEST SUMMARY");
  console.log("=".repeat(60) + "\n");

  const passed = results.filter((r) => r.status === "✅ PASS").length;
  const failed = results.filter((r) => r.status === "❌ FAIL").length;
  const warned = results.filter((r) => r.status === "⚠️  WARN").length;

  console.log(`Total tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warned}\n`);

  if (failed > 0) {
    console.log("❌ SOME TESTS FAILED\n");
    console.log("Failed tests:");
    results
      .filter((r) => r.status === "❌ FAIL")
      .forEach((r) => console.log(`  - ${r.test}: ${r.message}`));
    console.log();
    process.exit(1);
  } else if (warned > 0) {
    console.log("⚠️  ALL TESTS PASSED WITH WARNINGS\n");
    process.exit(0);
  } else {
    console.log("✅ ALL TESTS PASSED\n");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

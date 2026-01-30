/**
 * Test: Subscription Plan Persistence (DIVE-166)
 *
 * Verifies that plan upgrades persist to the database and survive deployments.
 * This test ensures that when a user upgrades their plan via Stripe:
 * 1. The planId foreign key is updated in the subscription table
 * 2. Feature checks query the correct plan from the database
 * 3. Plans don't reset to "free" on deployment
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { db } from "../lib/db";
import { subscription, subscriptionPlans, organization } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { handleSubscriptionUpdated } from "../lib/stripe/index";
import type Stripe from "stripe";

describe("Subscription Plan Persistence (DIVE-166)", () => {
  let testOrgId: string;
  let testPlanId: string;
  let testPriceId: string;

  beforeAll(async () => {
    // Ensure subscription plans exist in the test database
    const existingPlans = await db.select().from(subscriptionPlans).limit(1);

    if (existingPlans.length === 0) {
      // Seed the plans if they don't exist
      await db.insert(subscriptionPlans).values([
        {
          name: "free",
          displayName: "Free",
          monthlyPrice: 0,
          yearlyPrice: 0,
          features: {
            has_tours_bookings: true,
            has_equipment_boats: false,
            has_training: false,
            has_pos: false,
            has_public_site: false,
            has_advanced_notifications: false,
            has_integrations: false,
            has_api_access: false,
          },
          limits: {
            users: 1,
            customers: 50,
            toursPerMonth: 5,
            storageGb: 0.5,
          },
        },
        {
          name: "pro",
          displayName: "Pro",
          monthlyPriceId: "price_test_pro_monthly",
          yearlyPriceId: "price_test_pro_yearly",
          monthlyPrice: 9900,
          yearlyPrice: 95000,
          features: {
            has_tours_bookings: true,
            has_equipment_boats: true,
            has_training: true,
            has_pos: true,
            has_public_site: true,
            has_advanced_notifications: true,
            has_integrations: false,
            has_api_access: false,
          },
          limits: {
            users: 10,
            customers: 5000,
            toursPerMonth: 100,
            storageGb: 25,
          },
        },
      ]);

      // Verify plans were inserted (fixes CI race condition)
      const verifyPlans = await db.select().from(subscriptionPlans).limit(2);
      if (verifyPlans.length < 2) {
        throw new Error("Failed to seed subscription plans in beforeAll");
      }
    }
  }, 60000);

  beforeEach(async () => {
    // Create a test organization ID
    testOrgId = "test-org-" + Date.now();

    // Create a test organization (required for foreign key)
    await db.insert(organization).values({
      id: testOrgId,
      name: "Test Organization",
      slug: "test-org-" + Date.now(),
    });

    // Get the pro plan from the database
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, "pro"))
      .limit(1);

    if (!plan) {
      throw new Error("Pro plan not found in database after seeding");
    }

    testPlanId = plan.id;
    testPriceId = plan.monthlyPriceId || "price_test_123";

    // Create a test subscription (starting as free)
    await db.insert(subscription).values({
      organizationId: testOrgId,
      plan: "free",
      status: "active",
    });
  });

  afterEach(async () => {
    // Clean up test data (cascade will delete subscription)
    await db
      .delete(organization)
      .where(eq(organization.id, testOrgId));
  });

  it("should update planId when Stripe subscription is upgraded", async () => {
    // Simulate Stripe webhook payload for subscription upgrade
    const mockStripeSubscription = {
      id: "sub_test_123",
      status: "active",
      items: {
        data: [
          {
            price: {
              id: testPriceId,
            },
          },
        ],
      },
      metadata: {
        organizationId: testOrgId,
      },
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    } as unknown as Stripe.Subscription;

    // Process the webhook
    await handleSubscriptionUpdated(mockStripeSubscription);

    // Verify planId was updated in database
    const [updatedSub] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.organizationId, testOrgId))
      .limit(1);

    expect(updatedSub).toBeDefined();
    expect(updatedSub.planId).toBe(testPlanId);
    expect(updatedSub.plan).toBe("pro");
    expect(updatedSub.stripePriceId).toBe(testPriceId);
    expect(updatedSub.status).toBe("active");
  });

  it("should persist planId across application restarts", async () => {
    // Simulate upgrade
    const mockStripeSubscription = {
      id: "sub_test_456",
      status: "active",
      items: {
        data: [
          {
            price: {
              id: testPriceId,
            },
          },
        ],
      },
      metadata: {
        organizationId: testOrgId,
      },
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    } as unknown as Stripe.Subscription;

    await handleSubscriptionUpdated(mockStripeSubscription);

    // Simulate application restart by re-querying from database
    // (This simulates what happens on deployment)
    const [persistedSub] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.organizationId, testOrgId))
      .limit(1);

    // Fetch plan details via the foreign key
    if (!persistedSub.planId) {
      throw new Error("planId should be set after upgrade");
    }

    const [planDetails] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, persistedSub.planId))
      .limit(1);

    expect(planDetails).toBeDefined();
    expect(planDetails.name).toBe("pro");
    expect(planDetails.features).toBeDefined();
  });

  it("should handle yearly price IDs correctly", async () => {
    // Get a plan with a yearly price
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, "pro"))
      .limit(1);

    if (!plan?.yearlyPriceId) {
      console.warn("No yearly price configured - skipping test");
      return;
    }

    const mockStripeSubscription = {
      id: "sub_test_yearly",
      status: "active",
      items: {
        data: [
          {
            price: {
              id: plan.yearlyPriceId,
            },
          },
        ],
      },
      metadata: {
        organizationId: testOrgId,
      },
      current_period_end: Math.floor(Date.now() / 1000) + 365 * 86400,
    } as unknown as Stripe.Subscription;

    await handleSubscriptionUpdated(mockStripeSubscription);

    const [updatedSub] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.organizationId, testOrgId))
      .limit(1);

    expect(updatedSub.planId).toBe(plan.id);
    expect(updatedSub.plan).toBe("pro");
    expect(updatedSub.stripePriceId).toBe(plan.yearlyPriceId);
  });

  it("should fall back to free plan if price ID not found", async () => {
    const mockStripeSubscription = {
      id: "sub_test_unknown",
      status: "active",
      items: {
        data: [
          {
            price: {
              id: "price_unknown_999",
            },
          },
        ],
      },
      metadata: {
        organizationId: testOrgId,
      },
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    } as unknown as Stripe.Subscription;

    await handleSubscriptionUpdated(mockStripeSubscription);

    const [updatedSub] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.organizationId, testOrgId))
      .limit(1);

    // Should fall back to free if price not found
    expect(updatedSub.planId).toBeNull();
    expect(updatedSub.plan).toBe("free");
  });
});

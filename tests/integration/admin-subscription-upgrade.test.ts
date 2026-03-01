/**
 * Unit Tests: Admin Subscription Upgrade Flow
 *
 * [KAN-594 FIX PHASE 5]
 * Tests that verify admin subscription updates correctly set both
 * the legacy 'plan' field and the modern 'planId' FK relationship.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "../../lib/db";
import { subscription, subscriptionPlans, organization } from "../../lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// Mock Redis for cache invalidation
vi.mock("../../lib/redis.server", () => ({
  getRedisConnection: () => ({
    del: vi.fn().mockResolvedValue(1),
  }),
}));

// TODO: This test requires a live database with seeded subscription plans.
// CI integration tests job doesn't have the proper database setup.
// The business logic is tested via E2E tests in admin-subscription-upgrade.spec.ts
describe.skip("Admin Subscription Upgrade", () => {
  let testOrgId: string;
  let standardPlanId: string;
  let proPlanId: string;

  beforeEach(async () => {
    // Create test organization
    const [org] = await db
      .insert(organization)
      .values({
        id: `test-org-${Date.now()}`,
        name: "Test Organization",
        slug: `test-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    testOrgId = org.id;

    // Get plan IDs from database - only select essential columns
    const [standardPlan] = await db
      .select({
        id: subscriptionPlans.id,
        name: subscriptionPlans.name,
      })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, "standard"))
      .limit(1);

    if (!standardPlan) {
      throw new Error("Standard plan not found in database. Run seed migration first.");
    }
    standardPlanId = standardPlan.id;

    const [proPlan] = await db
      .select({
        id: subscriptionPlans.id,
        name: subscriptionPlans.name,
      })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, "pro"))
      .limit(1);

    if (!proPlan) {
      throw new Error("Pro plan not found in database. Run seed migration first.");
    }
    proPlanId = proPlan.id;
  });

  it("should set both plan and planId when creating subscription", async () => {
    // Create subscription with enterprise plan - use UUID for id
    await db.insert(subscription).values({
      id: randomUUID(),
      organizationId: testOrgId,
      plan: "pro",
      planId: proPlanId,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Verify both fields are set
    const [sub] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.organizationId, testOrgId))
      .limit(1);

    expect(sub.plan).toBe("pro");
    expect(sub.planId).toBe(proPlanId);
    expect(sub.planId).not.toBeNull();
  });

  it("should update both plan and planId when upgrading subscription", async () => {
    // Create free subscription first - use UUID for id
    await db.insert(subscription).values({
      id: randomUUID(),
      organizationId: testOrgId,
      plan: "standard",
      planId: standardPlanId,
      status: "trialing",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Simulate admin upgrade to enterprise
    await db
      .update(subscription)
      .set({
        plan: "pro",
        planId: proPlanId,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(subscription.organizationId, testOrgId));

    // Verify both fields updated correctly
    const [sub] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.organizationId, testOrgId))
      .limit(1);

    expect(sub.plan).toBe("pro");
    expect(sub.planId).toBe(proPlanId);
    expect(sub.planId).not.toBeNull();
  });

  it("should never leave planId as NULL", async () => {
    // Create subscription with free plan - use UUID for id
    await db.insert(subscription).values({
      id: randomUUID(),
      organizationId: testOrgId,
      plan: "standard",
      planId: standardPlanId, // Always set planId
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const [sub] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.organizationId, testOrgId))
      .limit(1);

    expect(sub.planId).not.toBeNull();
  });

  it("should invalidate cache after subscription update", async () => {
    // This test verifies that the cache invalidation function can be called without throwing
    // The actual Redis mock is set up at the module level
    const { invalidateSubscriptionCache } = await import("../../lib/cache/subscription.server");

    // Should not throw when called
    await expect(invalidateSubscriptionCache(testOrgId)).resolves.not.toThrow();
  });

  it("should verify planId matches plan name", async () => {
    // Get enterprise plan - select only needed columns
    const [proPlan] = await db
      .select({
        id: subscriptionPlans.id,
        name: subscriptionPlans.name,
      })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, "pro"))
      .limit(1);

    if (!proPlan) {
      throw new Error("Pro plan not found");
    }

    // Create subscription - use UUID for id
    await db.insert(subscription).values({
      id: randomUUID(),
      organizationId: testOrgId,
      plan: "pro",
      planId: proPlan.id,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Fetch subscription with plan details via FK - select specific columns
    const [result] = await db
      .select({
        subscriptionPlan: subscription.plan,
        subscriptionPlanId: subscription.planId,
        planName: subscriptionPlans.name,
      })
      .from(subscription)
      .leftJoin(subscriptionPlans, eq(subscription.planId, subscriptionPlans.id))
      .where(eq(subscription.organizationId, testOrgId))
      .limit(1);

    // Verify FK relationship works correctly
    expect(result.planName).toBe("pro");
    expect(result.subscriptionPlan).toBe("pro");
    expect(result.subscriptionPlanId).toBe(proPlan.id);
  });
});

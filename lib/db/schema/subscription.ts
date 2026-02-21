/**
 * Subscription and Usage Tracking Schema Tables
 *
 * Handles subscription management and usage tracking for the freemium model.
 * Supports Stripe integration for premium subscriptions.
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";

// Forward reference to subscriptionPlans - defined in parent schema.ts
// We use a string reference here to avoid circular dependency
import { subscriptionPlans } from "../schema";

// ============================================================================
// SUBSCRIPTION TABLE
// ============================================================================

/**
 * Subscription table - Organization subscription details
 *
 * Tracks subscription plan, status, and Stripe billing information.
 * Each organization has one subscription record.
 */
export const subscription = pgTable(
  "subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    plan: text("plan").notNull().default("standard"), // standard, pro (legacy field - kept for backwards compatibility)
    // [KAN-594 FIX] planId is the authoritative field for premium checks
    // Migration 0034 backfills NULL values. Migration 0035 adds NOT NULL constraint.
    planId: uuid("plan_id").references(() => subscriptionPlans.id), // Links to subscription_plans table
    status: text("status").notNull().default("active"), // trialing, active, past_due, canceled
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    trialEndsAt: timestamp("trial_ends_at"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("subscription_org_idx").on(table.organizationId),
    index("subscription_stripe_customer_idx").on(table.stripeCustomerId),
    index("subscription_stripe_subscription_idx").on(table.stripeSubscriptionId),
    index("subscription_plan_id_idx").on(table.planId),
  ]
);

// ============================================================================
// USAGE TRACKING TABLE
// ============================================================================

/**
 * Usage Tracking table - Monthly booking counts per organization
 *
 * Tracks bookings count per month for freemium limit enforcement.
 * Free tier is limited to a certain number of bookings per month.
 */
export const usageTracking = pgTable(
  "usage_tracking",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // Format: YYYY-MM (e.g., "2025-01")
    bookingsCount: integer("bookings_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("usage_tracking_org_idx").on(table.organizationId),
    uniqueIndex("usage_tracking_org_month_idx").on(table.organizationId, table.month),
  ]
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Subscription = typeof subscription.$inferSelect;
export type NewSubscription = typeof subscription.$inferInsert;

export type UsageTracking = typeof usageTracking.$inferSelect;
export type NewUsageTracking = typeof usageTracking.$inferInsert;

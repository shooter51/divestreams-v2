/**
 * Stripe Payment and Billing Schema Tables
 *
 * Comprehensive Stripe integration schema for subscription management,
 * payment processing, and invoice tracking in a multi-tenant environment.
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  uuid,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";

// ============================================================================
// STRIPE CUSTOMERS TABLE
// ============================================================================

/**
 * Stripe Customers - Links organizations to Stripe customer records
 *
 * Stores the mapping between DiveStreams organizations and Stripe customers.
 * Each organization should have exactly one Stripe customer record.
 */
export const stripeCustomers = pgTable(
  "stripe_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .unique()
      .references(() => organization.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull().unique(),
    email: text("email").notNull(),
    name: text("name"),
    // Stripe customer metadata as JSON
    metadata: jsonb("metadata").$type<Record<string, string>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("stripe_customers_org_idx").on(table.organizationId),
    index("stripe_customers_stripe_id_idx").on(table.stripeCustomerId),
  ]
);

// ============================================================================
// STRIPE SUBSCRIPTIONS TABLE
// ============================================================================

/**
 * Stripe Subscriptions - Tracks active and historical subscriptions
 *
 * Stores subscription records from Stripe. One organization can have multiple
 * subscriptions over time (upgrades, downgrades, cancellations).
 */
export const stripeSubscriptions = pgTable(
  "stripe_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripePriceId: text("stripe_price_id").notNull(),
    // Subscription status: incomplete, incomplete_expired, trialing, active, past_due, canceled, unpaid, paused
    status: text("status").notNull(),
    // Plan information
    planName: text("plan_name"), // e.g., "Professional", "Enterprise"
    planInterval: text("plan_interval"), // "month" or "year"
    // Pricing in cents
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("usd"),
    // Billing period
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    // Cancellation
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at"),
    // Trial information
    trialStart: timestamp("trial_start"),
    trialEnd: timestamp("trial_end"),
    // Metadata from Stripe
    metadata: jsonb("metadata").$type<Record<string, string>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("stripe_subscriptions_org_idx").on(table.organizationId),
    index("stripe_subscriptions_stripe_id_idx").on(table.stripeSubscriptionId),
    index("stripe_subscriptions_customer_idx").on(table.stripeCustomerId),
    index("stripe_subscriptions_status_idx").on(table.status),
  ]
);

// ============================================================================
// STRIPE PAYMENTS TABLE
// ============================================================================

/**
 * Stripe Payments - Payment transaction history
 *
 * Records all payment transactions (successful and failed) for audit trail
 * and billing history display.
 */
export const stripePayments = pgTable(
  "stripe_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    stripePaymentIntentId: text("stripe_payment_intent_id").notNull().unique(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeInvoiceId: text("stripe_invoice_id"), // Null for one-time payments
    // Amount in cents
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("usd"),
    // Payment status: succeeded, pending, failed, canceled, refunded
    status: text("status").notNull(),
    // Payment method details
    paymentMethodType: text("payment_method_type"), // card, bank_account, etc.
    paymentMethodBrand: text("payment_method_brand"), // visa, mastercard, etc.
    paymentMethodLast4: text("payment_method_last4"),
    // Failure information
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    // Receipt information
    receiptEmail: text("receipt_email"),
    receiptUrl: text("receipt_url"),
    // Metadata
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, string>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("stripe_payments_org_idx").on(table.organizationId),
    index("stripe_payments_intent_idx").on(table.stripePaymentIntentId),
    index("stripe_payments_customer_idx").on(table.stripeCustomerId),
    index("stripe_payments_invoice_idx").on(table.stripeInvoiceId),
    index("stripe_payments_status_idx").on(table.status),
    index("stripe_payments_created_idx").on(table.createdAt),
  ]
);

// ============================================================================
// STRIPE INVOICES TABLE
// ============================================================================

/**
 * Stripe Invoices - Invoice records for subscriptions and one-time charges
 *
 * Stores invoice data from Stripe for billing history and download links.
 */
export const stripeInvoices = pgTable(
  "stripe_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    stripeInvoiceId: text("stripe_invoice_id").notNull().unique(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id"), // Null for one-time invoices
    // Invoice details
    invoiceNumber: text("invoice_number"),
    // Amounts in cents
    amountDue: integer("amount_due").notNull(),
    amountPaid: integer("amount_paid").notNull(),
    amountRemaining: integer("amount_remaining").notNull(),
    subtotal: integer("subtotal").notNull(),
    total: integer("total").notNull(),
    tax: integer("tax"),
    currency: text("currency").notNull().default("usd"),
    // Invoice status: draft, open, paid, uncollectible, void
    status: text("status").notNull(),
    // Payment information
    paid: boolean("paid").notNull().default(false),
    attemptCount: integer("attempt_count").notNull().default(0),
    // Billing period
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    // Due date
    dueDate: timestamp("due_date"),
    // URLs
    hostedInvoiceUrl: text("hosted_invoice_url"), // Customer-facing URL
    invoicePdf: text("invoice_pdf"), // PDF download URL
    // Description
    description: text("description"),
    // Line items stored as JSON
    lineItems: jsonb("line_items").$type<
      Array<{
        description: string;
        amount: number;
        quantity: number;
        currency: string;
      }>
    >(),
    // Metadata
    metadata: jsonb("metadata").$type<Record<string, string>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("stripe_invoices_org_idx").on(table.organizationId),
    index("stripe_invoices_stripe_id_idx").on(table.stripeInvoiceId),
    index("stripe_invoices_customer_idx").on(table.stripeCustomerId),
    index("stripe_invoices_subscription_idx").on(table.stripeSubscriptionId),
    index("stripe_invoices_status_idx").on(table.status),
    index("stripe_invoices_created_idx").on(table.createdAt),
  ]
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type StripeCustomer = typeof stripeCustomers.$inferSelect;
export type NewStripeCustomer = typeof stripeCustomers.$inferInsert;

export type StripeSubscription = typeof stripeSubscriptions.$inferSelect;
export type NewStripeSubscription = typeof stripeSubscriptions.$inferInsert;

export type StripePayment = typeof stripePayments.$inferSelect;
export type NewStripePayment = typeof stripePayments.$inferInsert;

export type StripeInvoice = typeof stripeInvoices.$inferSelect;
export type NewStripeInvoice = typeof stripeInvoices.$inferInsert;

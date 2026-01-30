import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  uuid,
  jsonb,
  date,
  time,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// RE-EXPORT AUTH, SUBSCRIPTION, AND INTEGRATIONS SCHEMAS
// ============================================================================

export * from "./schema/auth";
export * from "./schema/subscription";
// API keys and webhooks removed - DIVE-031
// export * from "./schema/api-keys";
// export * from "./schema/webhooks";
export * from "./schema/integrations";
export * from "./schema/quickbooks";
export * from "./schema/public-site";
export * from "./schema/training";
export * from "./schema/gallery";
export * from "./schema/team";
// Note: page-content.ts exports TeamMember interface which conflicts with schema/team.ts TeamMember type
// We only need the table and types from team.ts, not the interface from page-content.ts
export {
  pageContent,
  pageContentHistory,
  pageContentRelations,
  pageContentHistoryRelations,
  type PageContentRow,
  type NewPageContent,
  type PageContentHistoryRow,
  type NewPageContentHistory,
  type ContentBlock,
  type PageContent,
  type HeadingBlock,
  type ParagraphBlock,
  type HtmlBlock,
  type ImageBlock,
  type GalleryBlock,
  type TeamSectionBlock,
  type ValuesGridBlock,
  type CtaBlock,
  type DividerBlock,
  type SpacerBlock,
  type ValueItem,
  type ContentBlockType,
} from "./schema/page-content";
export * from "./schema/stripe";
export * from "./schema/zapier";
export * from "./schema/onboarding";

// Import organization for foreign key references
import { organization } from "./schema/auth";

// ============================================================================
// PUBLIC SCHEMA - Shared across all tenants (LEGACY - to be removed)
// ============================================================================

// Import PlanFeaturesObject type for features column
import type { PlanFeaturesObject } from "../plan-features";

// Subscription plans available in the system
export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // starter, pro, enterprise
  displayName: text("display_name").notNull(),
  monthlyPriceId: text("monthly_price_id"), // Stripe price ID
  yearlyPriceId: text("yearly_price_id"), // Stripe price ID
  monthlyPrice: integer("monthly_price").notNull(), // in cents
  yearlyPrice: integer("yearly_price").notNull(), // in cents
  // Features now stores both boolean flags and marketing descriptions
  // Legacy string[] format is also supported for backward compatibility
  features: jsonb("features").notNull().$type<PlanFeaturesObject | string[]>(),
  limits: jsonb("limits").notNull().$type<{
    users: number;
    customers: number;
    toursPerMonth: number;
    storageGb: number;
  }>(),
  isActive: boolean("is_active").notNull().default(true),
  // [KAN-594] Prevents migration 0017/0020 from overwriting admin customizations
  adminModified: boolean("admin_modified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tenants (dive shops) - LEGACY: Will be removed after migration to organization
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  subdomain: text("subdomain").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  timezone: text("timezone").notNull().default("UTC"),
  currency: text("currency").notNull().default("USD"),
  locale: text("locale").notNull().default("en-US"),

  // Stripe integration
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),

  // Subscription info
  planId: uuid("plan_id").references(() => subscriptionPlans.id),
  subscriptionStatus: text("subscription_status").notNull().default("trialing"), // trialing, active, past_due, canceled
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodEnd: timestamp("current_period_end"),

  // Settings
  settings: jsonb("settings").$type<{
    website?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
    };
    branding?: {
      logo?: string;
      primaryColor?: string;
      secondaryColor?: string;
    };
    booking?: {
      minAdvanceBooking?: number; // hours
      maxAdvanceBooking?: number; // days
      requireDeposit?: boolean;
      depositPercent?: number;
      cancellationPolicy?: string;
    };
    notifications?: {
      emailBookingConfirmation?: boolean;
      emailReminders?: boolean;
      reminderDaysBefore?: number;
    };
  }>(),

  // Status
  isActive: boolean("is_active").notNull().default(true),
  schemaName: text("schema_name").notNull().unique(), // PostgreSQL schema name

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("tenants_subdomain_idx").on(table.subdomain),
  index("tenants_stripe_customer_idx").on(table.stripeCustomerId),
]);

// Relations for public schema
export const tenantsRelations = relations(tenants, ({ one }) => ({
  plan: one(subscriptionPlans, {
    fields: [tenants.planId],
    references: [subscriptionPlans.id],
  }),
}));

// ============================================================================
// BUSINESS TABLES - Single schema with organization_id
// ============================================================================

// Customers (divers)
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  dateOfBirth: date("date_of_birth"),

  // Emergency contact
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),

  // Medical info
  medicalConditions: text("medical_conditions"),
  medications: text("medications"),

  // Certifications
  certifications: jsonb("certifications").$type<{
    agency: string;
    level: string;
    number?: string;
    date?: string;
  }[]>(),

  // Address
  address: text("address"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country"),

  // Preferences
  preferredLanguage: text("preferred_language").default("en"),
  marketingOptIn: boolean("marketing_opt_in").default(false),

  // Public site account
  hasAccount: boolean("has_account").notNull().default(false),

  notes: text("notes"),
  tags: jsonb("tags").$type<string[]>(),

  // Stats (denormalized for performance)
  totalDives: integer("total_dives").default(0),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0"),
  lastDiveAt: timestamp("last_dive_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("customers_org_idx").on(table.organizationId),
  index("customers_org_email_idx").on(table.organizationId, table.email),
  index("customers_org_name_idx").on(table.organizationId, table.lastName, table.firstName),
]);

// Boats
export const boats = pgTable("boats", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  capacity: integer("capacity").notNull(),
  type: text("type"), // speedboat, catamaran, etc.
  registrationNumber: text("registration_number"),
  images: jsonb("images").$type<string[]>(),
  amenities: jsonb("amenities").$type<string[]>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("boats_org_idx").on(table.organizationId),
]);

// Dive sites
export const diveSites = pgTable("dive_sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  maxDepth: integer("max_depth"), // in meters
  minDepth: integer("min_depth"),
  difficulty: text("difficulty"), // beginner, intermediate, advanced
  currentStrength: text("current_strength"),
  visibility: text("visibility"), // typical visibility
  highlights: jsonb("highlights").$type<string[]>(), // marine life, features
  images: jsonb("images").$type<string[]>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("dive_sites_org_idx").on(table.organizationId),
]);

// Tours/Trips
export const tours = pgTable("tours", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // single_dive, multi_dive, course, snorkel, etc.
  duration: integer("duration"), // in minutes
  maxParticipants: integer("max_participants").notNull(),
  minParticipants: integer("min_participants").default(1),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),

  // What's included
  includesEquipment: boolean("includes_equipment").default(false),
  includesMeals: boolean("includes_meals").default(false),
  includesTransport: boolean("includes_transport").default(false),
  inclusions: jsonb("inclusions").$type<string[]>(),
  exclusions: jsonb("exclusions").$type<string[]>(),

  // Requirements
  minCertLevel: text("min_cert_level"),
  minAge: integer("min_age"),
  requirements: jsonb("requirements").$type<string[]>(),

  images: jsonb("images").$type<string[]>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("tours_org_idx").on(table.organizationId),
  uniqueIndex("tours_org_name_idx").on(table.organizationId, table.name),
]);

// Tour to dive site mapping
export const tourDiveSites = pgTable("tour_dive_sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  tourId: uuid("tour_id").notNull().references(() => tours.id, { onDelete: "cascade" }),
  diveSiteId: uuid("dive_site_id").notNull().references(() => diveSites.id, { onDelete: "cascade" }),
  order: integer("order").default(0),
}, (table) => [
  index("tour_dive_sites_org_idx").on(table.organizationId),
  index("tour_dive_sites_tour_idx").on(table.tourId),
]);

// Scheduled trips (instances of tours)
export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  tourId: uuid("tour_id").notNull().references(() => tours.id),
  boatId: uuid("boat_id").references(() => boats.id),

  date: date("date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time"),

  status: text("status").notNull().default("scheduled"), // scheduled, in_progress, completed, canceled

  // Override tour defaults if needed
  maxParticipants: integer("max_participants"),
  price: decimal("price", { precision: 10, scale: 2 }),

  // Public site visibility
  isPublic: boolean("is_public").notNull().default(false),

  // Recurring trip fields
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrencePattern: text("recurrence_pattern"), // daily, weekly, biweekly, monthly
  recurrenceDays: jsonb("recurrence_days").$type<number[]>(), // [0-6] for Sun-Sat, used with weekly/biweekly
  recurrenceEndDate: date("recurrence_end_date"), // optional end date for recurrence
  recurrenceCount: integer("recurrence_count"), // optional max occurrences
  recurringTemplateId: uuid("recurring_template_id"), // links instances to their template (self-referencing)
  recurrenceIndex: integer("recurrence_index"), // index of this occurrence in the series (0 = template)

  // Conditions
  weatherNotes: text("weather_notes"),
  conditions: jsonb("conditions").$type<{
    weather?: string;
    visibility?: string;
    currentStrength?: string;
    waterTemp?: number;
  }>(),

  notes: text("notes"),

  // Staff assignments
  staffIds: jsonb("staff_ids").$type<string[]>(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("trips_org_idx").on(table.organizationId),
  index("trips_org_date_idx").on(table.organizationId, table.date),
  index("trips_org_status_idx").on(table.organizationId, table.status),
  index("trips_recurring_template_idx").on(table.recurringTemplateId),
]);

// Bookings
export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  bookingNumber: text("booking_number").notNull(),

  tripId: uuid("trip_id").notNull().references(() => trips.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),

  // Participants (if booking for multiple people)
  participants: integer("participants").notNull().default(1),
  participantDetails: jsonb("participant_details").$type<{
    name: string;
    certLevel?: string;
    equipment?: string[];
  }[]>(),

  status: text("status").notNull().default("pending"), // pending, confirmed, checked_in, completed, canceled, no_show

  // Pricing
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),

  // Payment
  paymentStatus: text("payment_status").notNull().default("pending"), // pending, partial, paid, refunded
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
  depositPaidAt: timestamp("deposit_paid_at"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"),

  // Stripe
  stripePaymentIntentId: text("stripe_payment_intent_id"),

  // Equipment rental
  equipmentRental: jsonb("equipment_rental").$type<{
    item: string;
    size?: string;
    price: number;
  }[]>(),

  // Waivers and forms
  waiverSignedAt: timestamp("waiver_signed_at"),
  medicalFormSignedAt: timestamp("medical_form_signed_at"),

  specialRequests: text("special_requests"),
  internalNotes: text("internal_notes"),

  // Source tracking
  source: text("source").default("direct"), // direct, online, referral, etc.

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("bookings_org_idx").on(table.organizationId),
  uniqueIndex("bookings_org_number_idx").on(table.organizationId, table.bookingNumber),
  index("bookings_org_trip_idx").on(table.organizationId, table.tripId),
  index("bookings_org_customer_idx").on(table.organizationId, table.customerId),
  index("bookings_org_status_idx").on(table.organizationId, table.status),
  index("bookings_org_date_idx").on(table.organizationId, table.createdAt),
]);

// Equipment inventory
export const equipment = pgTable("equipment", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // bcd, regulator, wetsuit, mask, fins, tank, etc.
  name: text("name").notNull(),
  brand: text("brand"),
  model: text("model"),
  serialNumber: text("serial_number"),
  barcode: text("barcode"), // Barcode for quick equipment lookup/check-in/check-out
  size: text("size"),

  status: text("status").notNull().default("available"), // available, rented, maintenance, retired
  condition: text("condition").default("good"), // excellent, good, fair, poor

  // For rentals
  rentalPrice: decimal("rental_price", { precision: 10, scale: 2 }),
  isRentable: boolean("is_rentable").default(true),

  // Public site visibility
  isPublic: boolean("is_public").notNull().default(false),

  // Maintenance
  lastServiceDate: date("last_service_date"),
  nextServiceDate: date("next_service_date"),
  serviceNotes: text("service_notes"),

  purchaseDate: date("purchase_date"),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),

  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("equipment_org_idx").on(table.organizationId),
  index("equipment_org_category_idx").on(table.organizationId, table.category),
  index("equipment_org_status_idx").on(table.organizationId, table.status),
  index("equipment_org_barcode_idx").on(table.organizationId, table.barcode),
]);

// Transactions (for POS and payments)
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // sale, refund, deposit, payment

  bookingId: uuid("booking_id").references(() => bookings.id),
  customerId: uuid("customer_id").references(() => customers.id),
  userId: text("user_id"), // staff who processed (references auth.user)

  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),

  paymentMethod: text("payment_method").notNull(), // cash, card, stripe, bank_transfer
  stripePaymentId: text("stripe_payment_id"),

  // Line items for POS
  items: jsonb("items").$type<Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    type?: string;
    productId?: string;
    equipmentId?: string;
    tripId?: string;
    tourName?: string;
    days?: number;
    dailyRate?: number;
    participants?: number;
  }>>(),

  notes: text("notes"),

  // Refund tracking
  refundedTransactionId: uuid("refunded_transaction_id").references((): any => transactions.id, { onDelete: "set null" }),
  refundReason: text("refund_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("transactions_org_idx").on(table.organizationId),
  index("transactions_org_booking_idx").on(table.organizationId, table.bookingId),
  index("transactions_org_customer_idx").on(table.organizationId, table.customerId),
  index("transactions_org_date_idx").on(table.organizationId, table.createdAt),
]);

// Equipment rentals tracking
export const rentals = pgTable("rentals", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  transactionId: uuid("transaction_id").references(() => transactions.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  equipmentId: uuid("equipment_id").notNull().references(() => equipment.id),

  rentedAt: timestamp("rented_at").notNull().defaultNow(),
  dueAt: timestamp("due_at").notNull(),
  returnedAt: timestamp("returned_at"),

  dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).notNull(),
  totalCharge: decimal("total_charge", { precision: 10, scale: 2 }).notNull(),

  status: text("status").notNull().default("active"), // active, returned, overdue

  // Rental agreement
  agreementNumber: text("agreement_number").notNull(),
  agreementSignedAt: timestamp("agreement_signed_at"),
  agreementSignedBy: text("agreement_signed_by"),

  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("rentals_org_idx").on(table.organizationId),
  index("rentals_org_customer_idx").on(table.organizationId, table.customerId),
  index("rentals_org_equipment_idx").on(table.organizationId, table.equipmentId),
  index("rentals_org_status_idx").on(table.organizationId, table.status),
]);

// Products for POS (retail items)
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sku: text("sku"),
  barcode: text("barcode"), // Barcode for POS scanning (EAN-13, UPC-A, etc.)
  category: text("category").notNull(), // equipment, apparel, accessories, courses, rental
  description: text("description"),

  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }), // for margin calculation
  currency: text("currency").notNull().default("USD"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),

  // Sale pricing
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
  saleStartDate: timestamp("sale_start_date"),
  saleEndDate: timestamp("sale_end_date"),

  // Inventory tracking
  trackInventory: boolean("track_inventory").notNull().default(true),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").default(5),

  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("products_org_idx").on(table.organizationId),
  index("products_org_category_idx").on(table.organizationId, table.category),
  index("products_org_sku_idx").on(table.organizationId, table.sku),
  index("products_org_barcode_idx").on(table.organizationId, table.barcode),
]);

// Discount codes for bookings
export const discountCodes = pgTable("discount_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  description: text("description"),

  discountType: text("discount_type").notNull(), // 'percentage' | 'fixed'
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(), // e.g., 10 for 10% or $10

  minBookingAmount: decimal("min_booking_amount", { precision: 10, scale: 2 }), // optional minimum
  maxUses: integer("max_uses"), // null = unlimited
  usedCount: integer("used_count").notNull().default(0),

  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),

  isActive: boolean("is_active").notNull().default(true),
  applicableTo: text("applicable_to").notNull().default("all"), // 'all' | 'tours' | 'courses'

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("discount_codes_org_idx").on(table.organizationId),
  uniqueIndex("discount_codes_org_code_idx").on(table.organizationId, table.code),
  index("discount_codes_org_active_idx").on(table.organizationId, table.isActive),
]);

// Customer Communications (email logs)
export const customerCommunications = pgTable("customer_communications", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),

  type: text("type").notNull().default("email"), // email, sms, note
  subject: text("subject"),
  body: text("body").notNull(),

  status: text("status").notNull().default("sent"), // draft, sent, failed, delivered
  sentAt: timestamp("sent_at"),
  sentBy: text("sent_by"), // user ID who sent the message

  // For email tracking
  emailFrom: text("email_from"),
  emailTo: text("email_to"),

  // Metadata
  metadata: jsonb("metadata").$type<{
    templateId?: string;
    bookingId?: string;
    tripId?: string;
    openedAt?: string;
    clickedAt?: string;
  }>(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("customer_communications_org_idx").on(table.organizationId),
  index("customer_communications_customer_idx").on(table.customerId),
  index("customer_communications_type_idx").on(table.type),
]);

// Images (polymorphic - can belong to any entity)
export const images = pgTable("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(), // 'tour', 'dive_site', 'boat', 'equipment', 'staff'
  entityId: uuid("entity_id").notNull(),

  url: text("url").notNull(), // Full CDN URL
  thumbnailUrl: text("thumbnail_url"), // 200x200 thumbnail

  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),

  alt: text("alt"), // Accessibility text
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("images_org_idx").on(table.organizationId),
  index("images_org_entity_idx").on(table.organizationId, table.entityType, table.entityId),
]);

// ============================================================================
// ORGANIZATION SETTINGS
// ============================================================================

export const organizationSettings = pgTable("organization_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }).unique(),

  // Tax settings
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"), // e.g., 8.25 for 8.25%
  taxName: text("tax_name").default("Tax"), // e.g., "Sales Tax", "VAT", "GST"
  taxIncludedInPrice: boolean("tax_included_in_price").notNull().default(false),

  // Business settings
  currency: text("currency").notNull().default("USD"),
  timezone: text("timezone").notNull().default("UTC"),
  dateFormat: text("date_format").notNull().default("MM/DD/YYYY"),
  timeFormat: text("time_format").notNull().default("12h"), // "12h" or "24h"

  // Booking settings
  requireDepositForBooking: boolean("require_deposit_for_booking").notNull().default(false),
  depositPercentage: decimal("deposit_percentage", { precision: 5, scale: 2 }).default("0"),
  cancellationPolicyDays: integer("cancellation_policy_days").default(7),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("organization_settings_org_idx").on(table.organizationId),
]);

// ============================================================================
// MAINTENANCE LOGS (for boats)
// ============================================================================

export const maintenanceLogs = pgTable("maintenance_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  boatId: uuid("boat_id").notNull().references(() => boats.id, { onDelete: "cascade" }),

  type: text("type").notNull(), // "routine", "repair", "inspection", "emergency"
  description: text("description").notNull(),

  performedBy: text("performed_by"), // Name of person/company who did the maintenance
  performedAt: timestamp("performed_at").notNull().defaultNow(),

  cost: decimal("cost", { precision: 10, scale: 2 }),
  notes: text("notes"),

  // Next maintenance scheduling
  nextMaintenanceDate: date("next_maintenance_date"),
  nextMaintenanceType: text("next_maintenance_type"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by").references(() => organization.id), // User who logged it
}, (table) => [
  index("maintenance_logs_org_idx").on(table.organizationId),
  index("maintenance_logs_boat_idx").on(table.boatId),
  index("maintenance_logs_performed_at_idx").on(table.performedAt),
]);

// ============================================================================
// SERVICE RECORDS (for equipment)
// ============================================================================

export const serviceRecords = pgTable("service_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  equipmentId: uuid("equipment_id").notNull().references(() => equipment.id, { onDelete: "cascade" }),

  type: text("type").notNull(), // "inspection", "repair", "certification", "cleaning", "replacement"
  description: text("description").notNull(),

  performedBy: text("performed_by"), // Name of technician/company
  performedAt: timestamp("performed_at").notNull().defaultNow(),

  cost: decimal("cost", { precision: 10, scale: 2 }),
  notes: text("notes"),

  // For certification tracking (e.g., tank hydro tests)
  certificationExpiry: date("certification_expiry"),

  // Next service scheduling
  nextServiceDate: date("next_service_date"),
  nextServiceType: text("next_service_type"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by").references(() => organization.id), // User who logged it
}, (table) => [
  index("service_records_org_idx").on(table.organizationId),
  index("service_records_equipment_idx").on(table.equipmentId),
  index("service_records_performed_at_idx").on(table.performedAt),
]);

// ============================================================================
// RELATIONS
// ============================================================================

export const organizationSettingsRelations = relations(organizationSettings, ({ one }) => ({
  organization: one(organization, {
    fields: [organizationSettings.organizationId],
    references: [organization.id],
  }),
}));

export const maintenanceLogsRelations = relations(maintenanceLogs, ({ one }) => ({
  organization: one(organization, {
    fields: [maintenanceLogs.organizationId],
    references: [organization.id],
  }),
  boat: one(boats, {
    fields: [maintenanceLogs.boatId],
    references: [boats.id],
  }),
}));

export const serviceRecordsRelations = relations(serviceRecords, ({ one }) => ({
  organization: one(organization, {
    fields: [serviceRecords.organizationId],
    references: [organization.id],
  }),
  equipment: one(equipment, {
    fields: [serviceRecords.equipmentId],
    references: [equipment.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  organization: one(organization, {
    fields: [customers.organizationId],
    references: [organization.id],
  }),
  bookings: many(bookings),
  transactions: many(transactions),
  rentals: many(rentals),
  communications: many(customerCommunications),
}));

export const customerCommunicationsRelations = relations(customerCommunications, ({ one }) => ({
  organization: one(organization, {
    fields: [customerCommunications.organizationId],
    references: [organization.id],
  }),
  customer: one(customers, {
    fields: [customerCommunications.customerId],
    references: [customers.id],
  }),
}));

export const boatsRelations = relations(boats, ({ one, many }) => ({
  organization: one(organization, {
    fields: [boats.organizationId],
    references: [organization.id],
  }),
  trips: many(trips),
}));

export const diveSitesRelations = relations(diveSites, ({ one, many }) => ({
  organization: one(organization, {
    fields: [diveSites.organizationId],
    references: [organization.id],
  }),
  tourDiveSites: many(tourDiveSites),
}));

export const toursRelations = relations(tours, ({ one, many }) => ({
  organization: one(organization, {
    fields: [tours.organizationId],
    references: [organization.id],
  }),
  tourDiveSites: many(tourDiveSites),
  trips: many(trips),
}));

export const tourDiveSitesRelations = relations(tourDiveSites, ({ one }) => ({
  organization: one(organization, {
    fields: [tourDiveSites.organizationId],
    references: [organization.id],
  }),
  tour: one(tours, {
    fields: [tourDiveSites.tourId],
    references: [tours.id],
  }),
  diveSite: one(diveSites, {
    fields: [tourDiveSites.diveSiteId],
    references: [diveSites.id],
  }),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  organization: one(organization, {
    fields: [trips.organizationId],
    references: [organization.id],
  }),
  tour: one(tours, {
    fields: [trips.tourId],
    references: [tours.id],
  }),
  boat: one(boats, {
    fields: [trips.boatId],
    references: [boats.id],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  organization: one(organization, {
    fields: [bookings.organizationId],
    references: [organization.id],
  }),
  trip: one(trips, {
    fields: [bookings.tripId],
    references: [trips.id],
  }),
  customer: one(customers, {
    fields: [bookings.customerId],
    references: [customers.id],
  }),
  transactions: many(transactions),
}));

export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  organization: one(organization, {
    fields: [equipment.organizationId],
    references: [organization.id],
  }),
  rentals: many(rentals),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  organization: one(organization, {
    fields: [transactions.organizationId],
    references: [organization.id],
  }),
  booking: one(bookings, {
    fields: [transactions.bookingId],
    references: [bookings.id],
  }),
  customer: one(customers, {
    fields: [transactions.customerId],
    references: [customers.id],
  }),
}));

export const rentalsRelations = relations(rentals, ({ one }) => ({
  organization: one(organization, {
    fields: [rentals.organizationId],
    references: [organization.id],
  }),
  transaction: one(transactions, {
    fields: [rentals.transactionId],
    references: [transactions.id],
  }),
  customer: one(customers, {
    fields: [rentals.customerId],
    references: [customers.id],
  }),
  equipment: one(equipment, {
    fields: [rentals.equipmentId],
    references: [equipment.id],
  }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  organization: one(organization, {
    fields: [products.organizationId],
    references: [organization.id],
  }),
}));

export const discountCodesRelations = relations(discountCodes, ({ one }) => ({
  organization: one(organization, {
    fields: [discountCodes.organizationId],
    references: [organization.id],
  }),
}));

export const imagesRelations = relations(images, ({ one }) => ({
  organization: one(organization, {
    fields: [images.organizationId],
    references: [organization.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type CustomerCommunication = typeof customerCommunications.$inferSelect;
export type NewCustomerCommunication = typeof customerCommunications.$inferInsert;

export type Boat = typeof boats.$inferSelect;
export type NewBoat = typeof boats.$inferInsert;

export type DiveSite = typeof diveSites.$inferSelect;
export type NewDiveSite = typeof diveSites.$inferInsert;

export type Tour = typeof tours.$inferSelect;
export type NewTour = typeof tours.$inferInsert;

export type TourDiveSite = typeof tourDiveSites.$inferSelect;
export type NewTourDiveSite = typeof tourDiveSites.$inferInsert;

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export type Equipment = typeof equipment.$inferSelect;
export type NewEquipment = typeof equipment.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Rental = typeof rentals.$inferSelect;
export type NewRental = typeof rentals.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type DiscountCode = typeof discountCodes.$inferSelect;
export type NewDiscountCode = typeof discountCodes.$inferInsert;

export type Image = typeof images.$inferSelect;
export type NewImage = typeof images.$inferInsert;

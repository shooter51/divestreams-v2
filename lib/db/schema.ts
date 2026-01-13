import {
  pgTable,
  pgSchema,
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
// PUBLIC SCHEMA - Shared across all tenants
// ============================================================================

// Subscription plans available in the system
export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // starter, pro, enterprise
  displayName: text("display_name").notNull(),
  monthlyPriceId: text("monthly_price_id"), // Stripe price ID
  yearlyPriceId: text("yearly_price_id"), // Stripe price ID
  monthlyPrice: integer("monthly_price").notNull(), // in cents
  yearlyPrice: integer("yearly_price").notNull(), // in cents
  features: jsonb("features").notNull().$type<string[]>(),
  limits: jsonb("limits").notNull().$type<{
    users: number;
    customers: number;
    toursPerMonth: number;
    storageGb: number;
  }>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tenants (dive shops)
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
// TENANT SCHEMA TEMPLATE - Each tenant gets their own schema with these tables
// ============================================================================

// Helper to create tenant-specific schema
export function createTenantSchema(schemaName: string) {
  const schema = pgSchema(schemaName);

  // Users within the tenant
  const users = schema.table("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    name: text("name").notNull(),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    role: text("role").notNull().default("staff"), // owner, manager, staff
    permissions: jsonb("permissions").$type<string[]>(),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  });

  // Sessions for Better Auth
  const sessions = schema.table("sessions", {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  });

  // Accounts for Better Auth (OAuth providers)
  const accounts = schema.table("accounts", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  });

  // Customers (divers)
  const customers = schema.table("customers", {
    id: uuid("id").primaryKey().defaultRandom(),
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

    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>(),

    // Stats (denormalized for performance)
    totalDives: integer("total_dives").default(0),
    totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0"),
    lastDiveAt: timestamp("last_dive_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  }, (table) => [
    index("customers_email_idx").on(table.email),
    index("customers_name_idx").on(table.lastName, table.firstName),
  ]);

  // Boats
  const boats = schema.table("boats", {
    id: uuid("id").primaryKey().defaultRandom(),
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
  });

  // Dive sites
  const diveSites = schema.table("dive_sites", {
    id: uuid("id").primaryKey().defaultRandom(),
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
  });

  // Tours/Trips
  const tours = schema.table("tours", {
    id: uuid("id").primaryKey().defaultRandom(),
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
  });

  // Tour to dive site mapping
  const tourDiveSites = schema.table("tour_dive_sites", {
    id: uuid("id").primaryKey().defaultRandom(),
    tourId: uuid("tour_id").notNull().references(() => tours.id, { onDelete: "cascade" }),
    diveSiteId: uuid("dive_site_id").notNull().references(() => diveSites.id, { onDelete: "cascade" }),
    order: integer("order").default(0),
  });

  // Scheduled trips (instances of tours)
  const trips = schema.table("trips", {
    id: uuid("id").primaryKey().defaultRandom(),
    tourId: uuid("tour_id").notNull().references(() => tours.id),
    boatId: uuid("boat_id").references(() => boats.id),

    date: date("date").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time"),

    status: text("status").notNull().default("scheduled"), // scheduled, in_progress, completed, canceled

    // Override tour defaults if needed
    maxParticipants: integer("max_participants"),
    price: decimal("price", { precision: 10, scale: 2 }),

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
    index("trips_date_idx").on(table.date),
    index("trips_status_idx").on(table.status),
  ]);

  // Bookings
  const bookings = schema.table("bookings", {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingNumber: text("booking_number").notNull().unique(),

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
    index("bookings_trip_idx").on(table.tripId),
    index("bookings_customer_idx").on(table.customerId),
    index("bookings_status_idx").on(table.status),
    index("bookings_date_idx").on(table.createdAt),
  ]);

  // Equipment inventory
  const equipment = schema.table("equipment", {
    id: uuid("id").primaryKey().defaultRandom(),
    category: text("category").notNull(), // bcd, regulator, wetsuit, mask, fins, tank, etc.
    name: text("name").notNull(),
    brand: text("brand"),
    model: text("model"),
    serialNumber: text("serial_number"),
    size: text("size"),

    status: text("status").notNull().default("available"), // available, rented, maintenance, retired
    condition: text("condition").default("good"), // excellent, good, fair, poor

    // For rentals
    rentalPrice: decimal("rental_price", { precision: 10, scale: 2 }),
    isRentable: boolean("is_rentable").default(true),

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
    index("equipment_category_idx").on(table.category),
    index("equipment_status_idx").on(table.status),
  ]);

  // Transactions (for POS and payments)
  const transactions = schema.table("transactions", {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(), // sale, refund, deposit, payment

    bookingId: uuid("booking_id").references(() => bookings.id),
    customerId: uuid("customer_id").references(() => customers.id),
    userId: uuid("user_id").references(() => users.id), // staff who processed

    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),

    paymentMethod: text("payment_method").notNull(), // cash, card, stripe, bank_transfer
    stripePaymentId: text("stripe_payment_id"),

    // Line items for POS
    items: jsonb("items").$type<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[]>(),

    notes: text("notes"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  }, (table) => [
    index("transactions_booking_idx").on(table.bookingId),
    index("transactions_customer_idx").on(table.customerId),
    index("transactions_date_idx").on(table.createdAt),
  ]);

  // Equipment rentals tracking
  const rentals = schema.table("rentals", {
    id: uuid("id").primaryKey().defaultRandom(),
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
    index("rentals_customer_idx").on(table.customerId),
    index("rentals_equipment_idx").on(table.equipmentId),
    index("rentals_status_idx").on(table.status),
  ]);

  // Products for POS (retail items)
  const products = schema.table("products", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    sku: text("sku"),
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
    index("products_category_idx").on(table.category),
    index("products_sku_idx").on(table.sku),
  ]);

  // Discount codes for bookings
  const discountCodes = schema.table("discount_codes", {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
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
    index("discount_codes_code_idx").on(table.code),
    index("discount_codes_active_idx").on(table.isActive),
  ]);

  // Images (polymorphic - can belong to any entity)
  const images = schema.table("images", {
    id: uuid("id").primaryKey().defaultRandom(),
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
    index("images_entity_idx").on(table.entityType, table.entityId),
  ]);

  return {
    schema,
    users,
    sessions,
    accounts,
    customers,
    boats,
    diveSites,
    tours,
    tourDiveSites,
    trips,
    bookings,
    equipment,
    transactions,
    rentals,
    products,
    discountCodes,
    images,
  };
}

// Type exports for use throughout the application
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

// Tenant schema types (using ReturnType to get types from the factory)
export type TenantSchema = ReturnType<typeof createTenantSchema>;

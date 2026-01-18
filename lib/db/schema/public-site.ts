import {
  pgTable,
  text,
  uuid,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./auth";
import { customers } from "../schema";

// ============================================================================
// CUSTOMER CREDENTIALS (for public site login)
// ============================================================================

export const customerCredentials = pgTable(
  "customer_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    verificationToken: text("verification_token"),
    verificationTokenExpires: timestamp("verification_token_expires"),
    resetToken: text("reset_token"),
    resetTokenExpires: timestamp("reset_token_expires"),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("customer_creds_org_idx").on(table.organizationId),
    uniqueIndex("customer_creds_org_email_idx").on(table.organizationId, table.email),
    index("customer_creds_customer_idx").on(table.customerId),
  ]
);

// ============================================================================
// CUSTOMER SESSIONS (for public site auth)
// ============================================================================

export const customerSessions = pgTable(
  "customer_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("customer_sessions_org_idx").on(table.organizationId),
    index("customer_sessions_token_idx").on(table.token),
    index("customer_sessions_expires_idx").on(table.expiresAt),
  ]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const customerCredentialsRelations = relations(
  customerCredentials,
  ({ one }) => ({
    organization: one(organization, {
      fields: [customerCredentials.organizationId],
      references: [organization.id],
    }),
    customer: one(customers, {
      fields: [customerCredentials.customerId],
      references: [customers.id],
    }),
  })
);

export const customerSessionsRelations = relations(
  customerSessions,
  ({ one }) => ({
    organization: one(organization, {
      fields: [customerSessions.organizationId],
      references: [organization.id],
    }),
    customer: one(customers, {
      fields: [customerSessions.customerId],
      references: [customers.id],
    }),
  })
);

// ============================================================================
// CONTACT MESSAGES (for public site contact form)
// ============================================================================

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Contact information
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    subject: text("subject"),
    message: text("message").notNull(),

    // Tracking & spam prevention
    referrerPage: text("referrer_page"),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),

    // Status management
    status: text("status").notNull().default("new"), // new, read, replied, archived, spam
    repliedAt: timestamp("replied_at"),
    repliedBy: text("replied_by"), // user ID who replied

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("contact_messages_org_idx").on(table.organizationId),
    index("contact_messages_org_status_idx").on(table.organizationId, table.status),
    index("contact_messages_org_created_idx").on(table.organizationId, table.createdAt),
    index("contact_messages_email_idx").on(table.email),
  ]
);

// ============================================================================
// CONTACT MESSAGE RELATIONS
// ============================================================================

export const contactMessagesRelations = relations(
  contactMessages,
  ({ one }) => ({
    organization: one(organization, {
      fields: [contactMessages.organizationId],
      references: [organization.id],
    }),
  })
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CustomerCredentials = typeof customerCredentials.$inferSelect;
export type NewCustomerCredentials = typeof customerCredentials.$inferInsert;

export type CustomerSession = typeof customerSessions.$inferSelect;
export type NewCustomerSession = typeof customerSessions.$inferInsert;

export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewContactMessage = typeof contactMessages.$inferInsert;

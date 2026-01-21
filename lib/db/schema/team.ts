import {
  pgTable,
  text,
  uuid,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./auth";

// ============================================================================
// TEAM MEMBERS
// ============================================================================

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Basic Information
    name: text("name").notNull(),
    role: text("role").notNull(), // e.g., "Owner & Lead Instructor", "Operations Manager"
    bio: text("bio"),
    imageUrl: text("image_url"),

    // Contact Information
    email: text("email"),
    phone: text("phone"),

    // Professional Details
    certifications: jsonb("certifications").$type<string[]>().default([]),
    yearsExperience: integer("years_experience"),
    specialties: jsonb("specialties").$type<string[]>().default([]),

    // Display Settings
    displayOrder: integer("display_order").notNull().default(0),
    isPublic: boolean("is_public").notNull().default(true),
    status: text("status").notNull().default("active"), // active, inactive, archived

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("team_members_org_idx").on(table.organizationId),
    index("team_members_org_public_idx").on(table.organizationId, table.isPublic),
    index("team_members_org_status_idx").on(table.organizationId, table.status),
    index("team_members_display_order_idx").on(table.organizationId, table.displayOrder),
  ]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  organization: one(organization, {
    fields: [teamMembers.organizationId],
    references: [organization.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;

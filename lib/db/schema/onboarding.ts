/**
 * Onboarding Progress Schema
 *
 * Tracks user onboarding progress through the system setup wizard.
 * Stores completed tasks, dismissed state, and tour completion status.
 */

import {
  pgTable,
  text,
  boolean,
  timestamp,
  jsonb,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

// ============================================================================
// ONBOARDING PROGRESS TABLE
// ============================================================================

/**
 * Onboarding Progress - Tracks user progress through onboarding
 */
export const onboardingProgress = pgTable(
  "onboarding_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    completedTasks: jsonb("completed_tasks").$type<string[]>().default([]),
    dismissed: boolean("dismissed").default(false),
    dismissedAt: timestamp("dismissed_at"),
    currentSection: text("current_section"),
    tourCompleted: boolean("tour_completed").default(false),
    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("onboarding_progress_user_id_idx").on(table.userId),
  ]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const onboardingProgressRelations = relations(
  onboardingProgress,
  ({ one }) => ({
    user: one(user, {
      fields: [onboardingProgress.userId],
      references: [user.id],
    }),
  })
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type OnboardingProgress = typeof onboardingProgress.$inferSelect;
export type NewOnboardingProgress = typeof onboardingProgress.$inferInsert;

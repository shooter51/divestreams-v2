/**
 * Onboarding Server Functions
 *
 * Server-side functions for managing user onboarding progress.
 * Tracks completed tasks, tour state, and dismissal for the onboarding system.
 */

import { eq } from "drizzle-orm";
import { db } from "./index";
import { onboardingProgress, type OnboardingProgress } from "./schema/onboarding";

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get onboarding progress for a user
 */
export async function getOnboardingProgress(userId: string): Promise<OnboardingProgress | null> {
  const result = await db
    .select()
    .from(onboardingProgress)
    .where(eq(onboardingProgress.userId, userId))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Get or create onboarding progress for a user
 * Creates a new record with default values if none exists
 */
export async function getOrCreateOnboardingProgress(userId: string): Promise<OnboardingProgress> {
  const existing = await getOnboardingProgress(userId);
  if (existing) return existing;

  const [created] = await db
    .insert(onboardingProgress)
    .values({ userId })
    .returning();
  return created;
}

// ============================================================================
// Task Completion Functions
// ============================================================================

/**
 * Mark a task as complete for a user
 */
export async function markTaskComplete(userId: string, taskId: string): Promise<OnboardingProgress> {
  const progress = await getOrCreateOnboardingProgress(userId);
  const completedTasks = [...(progress.completedTasks || [])];

  if (!completedTasks.includes(taskId)) {
    completedTasks.push(taskId);
  }

  const [updated] = await db
    .update(onboardingProgress)
    .set({
      completedTasks,
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.userId, userId))
    .returning();
  return updated;
}

/**
 * Mark a task as incomplete for a user
 */
export async function markTaskIncomplete(userId: string, taskId: string): Promise<OnboardingProgress> {
  const progress = await getOrCreateOnboardingProgress(userId);
  const completedTasks = (progress.completedTasks || []).filter((t) => t !== taskId);

  const [updated] = await db
    .update(onboardingProgress)
    .set({
      completedTasks,
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.userId, userId))
    .returning();
  return updated;
}

// ============================================================================
// Dismissal Functions
// ============================================================================

/**
 * Dismiss the onboarding guide for a user
 */
export async function dismissOnboarding(userId: string): Promise<OnboardingProgress> {
  await getOrCreateOnboardingProgress(userId);

  const [updated] = await db
    .update(onboardingProgress)
    .set({
      dismissed: true,
      dismissedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.userId, userId))
    .returning();
  return updated;
}

/**
 * Un-dismiss the onboarding guide for a user
 */
export async function undismissOnboarding(userId: string): Promise<OnboardingProgress> {
  const [updated] = await db
    .update(onboardingProgress)
    .set({
      dismissed: false,
      dismissedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.userId, userId))
    .returning();
  return updated;
}

// ============================================================================
// Tour Functions
// ============================================================================

/**
 * Mark the tour as completed for a user
 */
export async function markTourCompleted(userId: string): Promise<OnboardingProgress> {
  await getOrCreateOnboardingProgress(userId);

  const [updated] = await db
    .update(onboardingProgress)
    .set({
      tourCompleted: true,
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.userId, userId))
    .returning();
  return updated;
}

/**
 * Update the current section for a user
 */
export async function updateCurrentSection(userId: string, section: string | null): Promise<OnboardingProgress> {
  await getOrCreateOnboardingProgress(userId);

  const [updated] = await db
    .update(onboardingProgress)
    .set({
      currentSection: section,
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.userId, userId))
    .returning();
  return updated;
}

// ============================================================================
// Reset Functions
// ============================================================================

/**
 * Reset onboarding progress for a user
 * Clears all completed tasks and dismissal state
 */
export async function resetOnboardingProgress(userId: string): Promise<OnboardingProgress> {
  const [updated] = await db
    .update(onboardingProgress)
    .set({
      completedTasks: [],
      dismissed: false,
      dismissedAt: null,
      currentSection: null,
      tourCompleted: false,
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.userId, userId))
    .returning();
  return updated;
}

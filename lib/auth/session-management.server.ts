/**
 * Session Management Helpers
 *
 * Helper functions for managing user sessions, including session invalidation
 * for security-critical operations like password changes.
 */

import { db } from "../db";
import { session } from "../db/schema/auth";
import { eq, sql } from "drizzle-orm";

/**
 * Invalidate all sessions for a specific user
 *
 * Used after security-critical operations like password changes to force
 * the user to log in again with their new credentials.
 *
 * @param userId - The user ID whose sessions should be invalidated
 * @returns Number of sessions invalidated
 */
export async function invalidateUserSessions(userId: string): Promise<number> {
  // Count sessions before deletion to return accurate count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(session)
    .where(eq(session.userId, userId));

  const sessionCount = countResult?.count ?? 0;

  // Delete all sessions for the user directly from database
  // This is more reliable than using auth.api.revokeSession which has type issues
  await db
    .delete(session)
    .where(eq(session.userId, userId));

  return sessionCount;
}

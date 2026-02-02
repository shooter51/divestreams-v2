/**
 * Session Management Helpers
 *
 * Helper functions for managing user sessions, including session invalidation
 * for security-critical operations like password changes.
 */

import { db } from "../db";
import { session } from "../db/schema/auth";
import { eq } from "drizzle-orm";

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
  // Delete all sessions for the user directly from database
  // This is more reliable than using auth.api.revokeSession which has type issues
  const result = await db
    .delete(session)
    .where(eq(session.userId, userId));

  // Return count of deleted sessions (rowCount from pg result)
  return result.rowCount ?? 0;
}

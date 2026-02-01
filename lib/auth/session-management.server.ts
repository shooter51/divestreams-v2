/**
 * Session Management Helpers
 *
 * Helper functions for managing user sessions, including session invalidation
 * for security-critical operations like password changes.
 */

import { db } from "../db";
import { session } from "../db/schema/auth";
import { eq } from "drizzle-orm";
import { auth } from "./index";

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
  // Query all sessions for the user
  const userSessions = await db
    .select()
    .from(session)
    .where(eq(session.userId, userId));

  if (userSessions.length === 0) {
    return 0;
  }

  // Revoke each session via Better Auth API
  // This ensures both database and in-memory cache are cleared
  let revokedCount = 0;
  for (const userSession of userSessions) {
    try {
      await auth.api.revokeSession({
        body: { token: userSession.token },
      });
      revokedCount++;
    } catch (error) {
      console.error(`Failed to revoke session ${userSession.id}:`, error);
      // Continue to next session even if one fails
    }
  }

  return revokedCount;
}

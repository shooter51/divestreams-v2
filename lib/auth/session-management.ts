import { auth } from "./index";

/**
 * Force session refresh after critical user updates
 * (role changes, permission updates, account suspension)
 *
 * This invalidates the cookie cache, forcing a fresh database lookup
 * on the user's next request. Use this when immediate propagation of
 * changes is required (e.g., revoking admin access).
 *
 * @param userId - The user ID whose sessions should be invalidated
 * @example
 * // After updating user roles
 * await updateUserRole(userId, newRole);
 * await invalidateUserSessions(userId); // Force immediate refresh
 */
export async function invalidateUserSessions(userId: string) {
  // Better Auth will invalidate cookie cache on next request
  // No manual Redis/cache clearing needed - framework handles it
  await auth.api.invalidateSessions({ userId });
}

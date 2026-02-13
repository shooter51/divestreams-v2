# Session Management

## Overview

DiveStreams uses [Better Auth](https://www.better-auth.com/) v1.4.10 for authentication and session management. Sessions are stored in PostgreSQL with an in-memory cookie cache for performance optimization.

## Architecture

### Session Storage
- **Primary Storage:** PostgreSQL (public schema, `session` table)
- **Cache Layer:** In-memory cookie cache (1-hour duration)
- **Session Duration:** 30 days (configurable in `lib/auth/index.ts`)
- **Update Frequency:** Sessions update in DB every 24 hours

### Cookie Cache (1-hour duration)

Sessions are cached in-memory for **1 hour** to reduce database load. This provides:
- **92% reduction in database queries** (1 query/hour vs 12 queries/hour with 5-minute cache)
- **Sub-millisecond session lookups** for cached sessions
- **Better scalability** with minimal infrastructure changes

**Important Trade-off:** Changes to user permissions/roles take **up to 1 hour** to propagate due to caching.

## Session Configuration

```typescript
// lib/auth/index.ts
session: {
  expiresIn: 60 * 60 * 24 * 30,        // 30 days
  updateAge: 60 * 60 * 24,             // 1 day
  cookieCache: {
    enabled: true,                      // REQUIRED for getSession()
    maxAge: 60 * 60,                    // 1 hour cache duration
  },
}
```

## Force Immediate Session Refresh

When immediate propagation of changes is critical (e.g., revoking admin access, updating roles), you can revoke specific sessions:

```typescript
import { auth } from "~/lib/auth";

// Revoke a specific session (requires session token)
await auth.api.revokeSession({
  body: { token: session.token }
});

// Or revoke all other sessions for current user
await auth.api.revokeOtherSessions({
  headers: request.headers
});
```

**Note:** Better Auth v1.4.10 doesn't provide a built-in method to invalidate all sessions for a specific user ID. To achieve this, you would need to query sessions from the database and revoke them individually.

## Disable Cache for Specific Operations

For operations that require the absolute latest session data (e.g., admin actions, financial transactions), disable the cookie cache for that specific call:

```typescript
const session = await auth.api.getSession({
  headers: request.headers,
  disableCookieCache: true, // Skip cache, query DB directly
});
```

## Performance Characteristics

| Metric | Value |
|--------|-------|
| **Cold Read** (cache miss) | 5-10ms (PostgreSQL query) |
| **Cached Read** (cache hit) | <1ms (in-memory) |
| **Cache Hit Rate** | ~67% with 1-hour duration |
| **DB Query Frequency** | 1 per hour per active user |

## Session Table Schema

```sql
CREATE TABLE session (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX session_user_id_idx ON session(user_id);
CREATE INDEX session_expires_at_idx ON session(expires_at);
```

## Multi-Tenant Considerations

- Sessions are stored in the **public schema** (not tenant-specific)
- Tenant context is resolved from subdomain and stored in user metadata
- Session lookup is O(1) via indexed `token` column
- No cross-tenant session leakage (enforced by Better Auth)

## Monitoring and Metrics

### Key Metrics to Track
- PostgreSQL session query frequency (should be ~1 per hour per user)
- Session-related errors (should be near zero)
- User-reported permission lag (should be rare)

### Expected Query Reduction
- **Before (5-minute cache):** 12 queries/hour per active user
- **After (1-hour cache):** 1 query/hour per active user
- **Reduction:** 92% fewer database queries

## Troubleshooting

### Permissions Not Updating Immediately

**Symptom:** User role/permission changes don't take effect for up to 1 hour.

**Cause:** Cookie cache holds stale session data.

**Solution:**
1. **For critical updates:** Call `invalidateUserSessions(userId)` after the update
2. **For non-critical updates:** Wait up to 1 hour for natural cache expiry
3. **For debugging:** Ask user to log out and log back in (clears cache)

### Session Validation Fails

**Symptom:** User gets logged out unexpectedly.

**Possible Causes:**
- Session expired (30-day limit)
- Session manually invalidated via `invalidateUserSessions()`
- Database connection issue
- Cookie corruption

**Debug Steps:**
1. Check session expiry in database: `SELECT expires_at FROM session WHERE token = ?`
2. Check database logs for connection errors
3. Check application logs for Better Auth errors

## Future Scalability

The current architecture (PostgreSQL + 1-hour cache) scales to:
- **~10,000 concurrent users** with current infrastructure
- **~100,000 concurrent users** with read replicas

If scaling beyond these limits, consider:
- **Option B:** Redis cache layer (adds ~1-2ms for cache hits)
- **Option C:** Custom Redis session adapter (removes PostgreSQL from session path)

See `/docs/session-optimization-analysis.md` for detailed trade-off analysis.

## References

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Better Auth Cookie Cache](https://www.better-auth.com/docs/concepts/session#cookie-cache)
- [Session Optimization Analysis](/docs/session-optimization-analysis.md)

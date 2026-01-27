# Session Persistence Fix - January 27, 2026

## Issue Summary

**Problem:** Users were being logged out on every request and forced to re-authenticate after container restarts/deployments.

**Root Cause:** The `BETTER_AUTH_SECRET` environment variable was missing from the app container configuration, even though it existed in the `.env` file. This caused Better Auth to fail storing sessions in the PostgreSQL database.

## Symptoms

1. Session table in PostgreSQL was empty (0 rows)
2. Users repeatedly saw login prompts
3. Application logs showed multiple login attempts for same user
4. Every deployment forced all users to re-login
5. Sessions did not survive container restarts

## Investigation

### Evidence from Logs
```
GET /auth/login.data?redirect=%2Ftenant%2Ftraining%2Fsessions 200 - - 11.488 ms
POST /auth/login?redirect=%2Ftenant%2Ftraining%2Fsessions 302 - - 183.393 ms
...
GET /auth/login.data?redirect=%2Ftenant%2Ftraining%2Fsessions%2Fnew 200 - - 9.778 ms
POST /auth/login?redirect=%2Ftenant%2Ftraining%2Fsessions%2Fnew 302 - - 199.124 ms
```

Users had to login multiple times in a single browsing session.

### Database Check
```sql
SELECT COUNT(*) FROM public.session;
-- Result: 0 rows
```

No sessions were being persisted despite proper schema.

### Environment Variable Check
```bash
docker exec divestreams-staging-app env | grep BETTER_AUTH_SECRET
# Result: (empty)
```

The secret was in `.env` but not passed to the container.

## Resolution

### Changes Made

1. **docker-compose.staging.yml** - Added to app service:
   ```yaml
   - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
   ```

2. **docker-compose.prod.yml** - Added to app service:
   ```yaml
   - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
   ```

3. **Production .env** - Added:
   ```bash
   BETTER_AUTH_SECRET=divestreams-prod-secret-key-2024
   ```

4. **GitHub Secrets** - Backed up to:
   - `STAGING_BETTER_AUTH_SECRET` (already existed)
   - `PRODUCTION_BETTER_AUTH_SECRET` (newly added)

### Deployment

**Staging:** Deployed on 2026-01-27 at 15:03 UTC
- Container recreated with new environment variable
- Verified `BETTER_AUTH_SECRET` present in container
- Application started successfully

**Production:** Configuration updated, deployment pending

## How Session Persistence Works

### Database Storage
Sessions are stored in the `public.session` table with:
- `id` - Unique session identifier
- `user_id` - Reference to authenticated user
- `token` - Signed session token
- `expires_at` - Session expiration (30 days from creation)
- `ip_address` - Client IP
- `user_agent` - Client browser info

### Session Configuration (lib/auth/index.ts)
```typescript
session: {
  expiresIn: 60 * 60 * 24 * 30, // 30 days
  updateAge: 60 * 60 * 24, // 1 day
}
```

### Persistence Mechanism
1. User logs in via Better Auth
2. Session created and signed with `BETTER_AUTH_SECRET`
3. Session stored in PostgreSQL (persistent volume)
4. Session token sent to client as cookie
5. Client includes cookie on subsequent requests
6. Better Auth validates token against database
7. **Sessions survive container restarts** because they're in PostgreSQL

### Why This Failed Before
Without `BETTER_AUTH_SECRET`:
- Better Auth couldn't properly sign session tokens
- Sessions were created in memory only (if at all)
- Container restart = all sessions lost
- Database writes may have failed silently

## Testing Session Persistence

### Test After Login
```sql
-- Should show active sessions
SELECT
  id,
  user_id,
  expires_at,
  created_at,
  EXTRACT(EPOCH FROM (expires_at - NOW())) / 86400 as days_until_expiry
FROM public.session
ORDER BY created_at DESC;
```

### Test After Container Restart
1. Login to application
2. Verify session in database
3. Restart container: `docker compose restart app`
4. Refresh browser
5. Should NOT be logged out
6. Session should still exist in database

## Prevention

### Environment Variable Checklist
All deployments must verify these environment variables are set:
- ✅ `AUTH_SECRET` - General auth operations
- ✅ `BETTER_AUTH_SECRET` - Session signing and persistence
- ✅ `DATABASE_URL` - Session storage location
- ✅ `REDIS_URL` - Cache and queue (optional for sessions)

### Monitoring
Watch for these indicators of session issues:
- Empty `session` table despite active users
- Repeated login attempts in application logs
- User complaints about being "logged out randomly"
- Session count doesn't grow with active users

## Related Files
- `lib/auth/index.ts` - Better Auth configuration
- `lib/db/schema/auth.ts` - Session schema definition
- `docker-compose.staging.yml` - Staging environment config
- `docker-compose.prod.yml` - Production environment config
- `docs/staging-environment-secrets.md` - Environment variable documentation

## Commit References
- Initial fix: `13d54bb` - Add BETTER_AUTH_SECRET to docker-compose files
- Documentation: This file

## Future Improvements

1. **Health Check:** Add endpoint that verifies session persistence
2. **Monitoring:** Alert when session table remains empty with active traffic
3. **CI/CD:** Add validation that all required env vars are present
4. **Redis Sessions:** Consider Redis for session storage (faster, still persistent)

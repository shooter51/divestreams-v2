# DCC Team Review Action Plan
**Date:** 2026-02-13  
**Branch:** `refactor/dcc-team-review-2026-02-13`  
**Reviewers:** Mongo (Architecture), Katia (Security), Chris (Code), Mordecai (Docs)

---

## 🔴 CRITICAL (P0) - Security

### 1. Rate Limiting on Authentication ✅ DONE
**Location:** `app/routes/auth/login.tsx`, `app/routes/site/login.tsx`, `app/routes/admin/login.tsx`, `app/routes/auth/forgot-password.tsx`  
**Issue:** All login endpoints accept unlimited attempts - brute force vulnerability  
**Fix:** Added `checkRateLimit()` to all auth endpoints (5 attempts per 15 min for login, 3 for admin/forgot-password)

### 2. Account Lockout ✅ DONE (via rate limiting)
**Issue:** No lockout after failed login attempts  
**Fix:** Rate limiting now locks out IP+email combination after 5 failed attempts for 15 minutes

### 3. Production Key Requirement ✅ DONE
**Location:** `lib/integrations/index.server.ts`  
**Issue:** Hardcoded fallback encryption key `"divestreams-default-key"`  
**Fix:** Now throws error if `INTEGRATION_ENCRYPTION_KEY` or `AUTH_SECRET` missing in production

---

## 🟠 HIGH (P1)

### 4. CSRF Token Implementation ❌
**Issue:** Relies only on `SameSite=Lax` cookies  
**Fix:** Add explicit CSRF tokens to state-changing forms, or upgrade to `SameSite=Strict`

### 5. Remove Legacy Tenant System ❌
**Location:** `createTenant()` function, `tenants` table  
**Issue:** Creates 20 unused tables per new tenant (dual system)  
**Fix:** Remove `tenants` table, drop `createTenantTables()`, clean up unused schemas

### 6. Optimize OrgContext Queries ❌
**Location:** `getOrgContext()`  
**Issue:** 7 sequential DB queries per authenticated request  
**Fix:** Combine into single JOIN query or add 60s caching

### 7. Add Connection Pooling ❌
**Location:** `lib/db/index.server.ts`  
**Issue:** Single connection, no pooling config  
**Fix:** Add `max: 20, idle_timeout: 30, connect_timeout: 10`

---

## 🟡 MEDIUM (P2)

### 8. Redis Rate Limiting ❌
**Issue:** In-memory rate limiter resets on server restart  
**Fix:** Replace Map-based store with Redis

### 9. Type Safety - Reduce `any` Usage ❌
**Issue:** 109 `any` usages, mostly in Stripe integration  
**Fix:** Create proper Stripe types, use type guards instead of `as any`

### 10. Structured Logging ❌
**Issue:** 30+ console.log/error calls in production code  
**Fix:** Add pino logger, replace console calls

### 11. Re-enable ESLint Rules ❌
**Location:** `.eslintrc.cjs`  
**Issue:** `no-unused-vars` and `no-explicit-any` disabled  
**Fix:** Set to "warn", migrate to "error"

### 12. Add Composite Database Indexes ❌
**Fix:**
```sql
CREATE INDEX bookings_org_created_idx ON bookings(organization_id, created_at);
CREATE INDEX integrations_org_active_idx ON integrations(organization_id, is_active);
```

### 13. Security Headers ❌
**Fix:** Add CSP, X-Frame-Options, X-Content-Type-Options

### 14. Enable Email Verification ❌
**Location:** `lib/auth/index.ts`  
**Fix:** Set `requireEmailVerification: true`

### 15. Reserved Slug Protection ✅ DONE
**Issue:** "platform" slug not in reserved list  
**Fix:** Added "platform" and other missing slugs to `RESERVED_SUBDOMAINS` in both middleware and signup routes

---

## 🟢 LOW (P3) - Documentation & Cleanup

### 16. Expand README.md ❌
**Issue:** Only 2.3KB for 182K line codebase  
**Fix:** Add architecture overview, env vars table, testing instructions

### 17. Create CONTRIBUTING.md ❌
**Fix:** Code style, PR process, testing requirements, Jira workflow

### 18. Reorganize docs/ Folder ❌
**Issue:** 80+ fix reports mixed with developer docs  
**Fix:** Move to `docs/archive/`, create clear structure

### 19. Break Down Large Route Files ❌
**Issue:** `products.tsx` (1,537 lines), `pos.tsx` (789 lines)  
**Fix:** Extract components to separate files

### 20. Add JSDoc Enforcement ❌
**Fix:** Add `eslint-plugin-jsdoc`, create documentation standards

### 21. Session Fingerprinting ❌
**Issue:** Customer sessions not bound to IP/User-Agent  
**Fix:** Add fingerprinting for anti-replay

### 22. Sanitize Error Messages ❌
**Issue:** Verbose errors leak system details  
**Fix:** Return generic errors to users, log details server-side

### 23. Database Schema Documentation ❌
**Fix:** Add JSDoc to `lib/db/schema/*.ts` files

### 24. Update CLAUDE.md ❌
**Issue:** Says "schema-per-tenant" but reality is shared schema  
**Fix:** Correct documentation to match implementation

---

## Progress Tracking

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| 🔴 Critical (P0) | 3 | 3 | 0 |
| 🟠 High (P1) | 4 | 0 | 4 |
| 🟡 Medium (P2) | 8 | 1 | 7 |
| 🟢 Low (P3) | 9 | 0 | 9 |
| **Total** | **24** | **4** | **20** |

---

## Notes

- Security fixes (P0) must be completed before any production deployment
- Architecture changes (P1) should be tested thoroughly - they affect core auth flow
- Consider splitting this into multiple PRs if scope becomes too large

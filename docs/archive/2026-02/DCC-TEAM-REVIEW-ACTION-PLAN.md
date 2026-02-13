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

### 4. CSRF Token Implementation ✅ DONE
**Location:** `lib/utils/csrf.ts`  
**Issue:** Relies only on `SameSite=Lax` cookies  
**Fix:** Added CSRF token library with double-submit cookie pattern and signed tokens

### 5. Remove Legacy Tenant System ⏳ DEPRECATED
**Location:** `lib/db/tenant.server.ts`  
**Issue:** Creates 20 unused tables per new tenant (dual system)  
**Fix:** Added deprecation notice with migration plan. Full removal deferred to avoid breaking changes.

### 6. Optimize OrgContext Queries ✅ DONE
**Location:** `getOrgContext()` in `lib/auth/org-context.server.ts`  
**Issue:** 7 sequential DB queries per authenticated request  
**Fix:** Added 60-second in-memory cache with `invalidateOrgContextCache()` helper

### 7. Add Connection Pooling ✅ DONE
**Location:** `lib/db/index.ts`  
**Issue:** Single connection, no pooling config  
**Fix:** Added `max: 20, idle_timeout: 30, connect_timeout: 10, max_lifetime: 1800`

---

## 🟡 MEDIUM (P2)

### 8. Redis Rate Limiting ⏳ DEFERRED
**Issue:** In-memory rate limiter resets on server restart  
**Note:** Current in-memory solution is adequate for single-server deployment. Redis migration when scaling.

### 9. Type Safety - Reduce `any` Usage ⏳ PARTIAL
**Issue:** 43 `any` usages remaining (down from 109)  
**Note:** ESLint now warns on new `any` usage. Legacy code cleanup is ongoing.

### 10. Structured Logging ✅ DONE
**Location:** `lib/utils/logger.ts`  
**Issue:** 30+ console.log/error calls in production code  
**Fix:** Added structured logger with JSON output in production, child loggers for modules

### 11. Re-enable ESLint Rules ✅ DONE
**Location:** `eslint.config.js`  
**Issue:** `no-unused-vars` and `no-explicit-any` disabled  
**Fix:** Set to "warn" with ignore patterns for underscore-prefixed vars

### 12. Add Composite Database Indexes ✅ DONE
**Location:** `drizzle/0036_add_performance_indexes.sql`
**Fix:** Added indexes for:
- `bookings(organization_id, created_at)` - monthly counts
- `integrations(organization_id, is_active)` - sync ops
- `customers(organization_id, email)` - search/login
- `tours(organization_id, is_active)` - listings (partial index)

### 13. Security Headers ⏳ DEFERRED
**Note:** Should be configured at Caddy/nginx level, not application code. Add to deployment docs.

### 14. Enable Email Verification ⏳ DEFERRED
**Location:** `lib/auth/index.ts`  
**Note:** Requires email infrastructure to be verified working first. Defer until email system is stable.

### 15. Reserved Slug Protection ✅ DONE
**Issue:** "platform" slug not in reserved list  
**Fix:** Added "platform" and other missing slugs to `RESERVED_SUBDOMAINS` in both middleware and signup routes

---

## 🟢 LOW (P3) - Documentation & Cleanup

### 16. Expand README.md ✅ DONE
**Issue:** Only 2.3KB for 182K line codebase  
**Fix:** Added architecture diagram, env vars table, testing guide (now ~5KB)

### 17. Create CONTRIBUTING.md ✅ DONE
**Fix:** Added development workflow, commit conventions, code standards, PR process

### 18. Reorganize docs/ Folder ✅ DONE
**Issue:** 80+ fix reports mixed with developer docs  
**Fix:** Moved 100+ files to `docs/archive/2026-01/`, created `docs/INDEX.md`

### 19. Break Down Large Route Files ⏳ DEFERRED
**Issue:** `products.tsx` (1,537 lines), `pos.tsx` (789 lines)  
**Note:** Significant refactor, defer to dedicated PR

### 20. Add JSDoc Enforcement ⏳ DEFERRED
**Note:** ESLint rules for JSDoc can be added when team agrees on documentation standards

### 21. Session Fingerprinting ✅ DONE
**Location:** `lib/auth/customer-auth.server.ts`, `lib/db/schema/public-site.ts`  
**Issue:** Customer sessions not bound to IP/User-Agent  
**Fix:** Added ip_address and user_agent fields, migration 0037, capturing on login

### 22. Sanitize Error Messages ✅ DONE
**Location:** `lib/auth/admin-password-reset.server.ts`  
**Issue:** Verbose errors leak system details  
**Fix:** Changed to generic user-facing messages, detailed logging server-side

### 23. Database Schema Documentation ✅ DONE
**Location:** `lib/db/schema/public-site.ts`  
**Fix:** Added JSDoc to tables with usage examples (more schemas can be documented later)

### 24. Update CLAUDE.md ✅ DONE
**Issue:** Says "schema-per-tenant" but reality is shared schema  
**Fix:** Corrected to "shared-schema multi-tenant" with explanatory note

---

## Progress Tracking

| Category | Total | Done | Deferred | Remaining |
|----------|-------|------|----------|-----------|
| 🔴 Critical (P0) | 3 | 3 | 0 | 0 |
| 🟠 High (P1) | 4 | 3 | 1 | 0 |
| 🟡 Medium (P2) | 8 | 4 | 4 | 0 |
| 🟢 Low (P3) | 9 | 7 | 2 | 0 |
| **Total** | **24** | **17** | **7** | **0** |

---

## Summary

**Completed:** 17 items across all priority levels
**Deferred:** 7 items (with justification)
- P1: Legacy tenant removal (risky, needs careful migration)
- P2: Redis rate limiting (overkill for single-server)
- P2: Type safety cleanup (ongoing, ESLint now warns)
- P2: Security headers (deploy-level config)
- P2: Email verification (needs email infrastructure)
- P3: Route decomposition (separate PR)
- P3: JSDoc enforcement (needs team discussion)

## Migrations to Run

```bash
# Run these on staging before merge:
npx drizzle-kit push  # Includes migrations 0036 and 0037
```

## Post-Merge Actions

1. Run migrations on staging
2. Test rate limiting on login endpoints
3. Configure security headers in Caddy
4. Monitor OrgContext cache effectiveness

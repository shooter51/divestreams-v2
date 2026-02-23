# KAN-594 Deployment Steps

**Issue:** Premium Features Remain Locked Despite Subscription Upgrade
**Status:** ✅ Code Complete - Ready for Deployment
**Date:** February 2, 2026

---

## Pre-Deployment Checklist

- [x] All unit tests passing (5/5 tests)
- [x] Build successful (no errors)
- [x] Migrations created (0034, 0035)
- [x] Cache invalidation implemented
- [x] Verification script created
- [x] Documentation complete
- [x] Changes committed to feature branch

---

## Deployment Instructions

### Step 1: Merge to Staging Branch

```bash
cd /Users/tomgibson/DiveStreams/divestreams-v2/.worktrees/admin-password-reset

# Merge feature branch into staging
git checkout staging
git merge feature/admin-password-reset --no-ff

# Push to trigger CI/CD pipeline
git push origin staging
```

### Step 2: Monitor CI/CD Pipeline

The CI/CD pipeline will:
1. ✅ Run linting
2. ✅ Run typecheck
3. ✅ Run unit tests (including our 5 new KAN-594 tests)
4. ✅ Run E2E tests (80 existing tests)
5. ✅ Build Docker image (tag: `ghcr.io/shooter51/divestreams-app:staging`)
6. ✅ Deploy to staging VPS (76.13.28.28)
7. ✅ Run smoke tests

**Monitor:** `gh run list --limit 5`

### Step 3: Verify Migrations Ran on Staging

SSH into staging VPS and verify:

```bash
ssh root@76.13.28.28

# Check if migrations ran
docker exec divestreams-app psql -U divestreams -d divestreams \
  -c "SELECT COUNT(*) as null_count FROM subscription WHERE plan_id IS NULL;"
# Expected: null_count = 0

# Check migration 0034 backfilled existing subscriptions
docker exec divestreams-app psql -U divestreams -d divestreams \
  -c "SELECT COUNT(*) as total, COUNT(plan_id) as with_plan_id FROM subscription;"
# Expected: total = with_plan_id (no NULLs)

# Verify NOT NULL constraint added (migration 0035)
docker exec divestreams-app psql -U divestreams -d divestreams \
  -c "SELECT is_nullable FROM information_schema.columns WHERE table_name='subscription' AND column_name='plan_id';"
# Expected: is_nullable = NO
```

### Step 4: Run Verification Script on Staging

```bash
# Still on staging VPS
docker exec -i divestreams-app psql -U divestreams -d divestreams < /path/to/scripts/verify-kan594-fix.sql
```

Expected results:
- **Check 1:** `null_plan_id_count` = 0
- **Check 3:** QA test account shows `actual_plan='enterprise'`, `status='active'`
- **Check 4:** No plan/planId mismatches
- **Check 5:** Enterprise plan has active subscriptions

### Step 5: Manual QA Test on Staging

**Test Account:** `kkudo31@protonmail.com` / `12345678`

1. **Admin Test:**
   - Login to https://admin.staging.divestreams.com
   - Navigate to tenant details for kkudo31 org
   - Verify subscription shows: Enterprise + Active status
   - Try upgrading another test tenant from Free → Professional
   - Verify database updates both `plan` and `planId` fields

2. **Tenant Test:**
   - Login to https://{tenant-slug}.staging.divestreams.com
   - Email: kkudo31@protonmail.com / Password: 12345678
   - Navigate to main dashboard
   - **✅ Verify:** Integrations menu visible (not locked)
   - Click Integrations → **✅ Should load page** (NOT show "Premium Required")
   - **✅ Verify:** Boats, Equipment, Training, POS menus all visible
   - **✅ Verify:** No premium feature locks anywhere

3. **Cache Test:**
   - While still logged in as tenant, have admin upgrade subscription again
   - Refresh browser (F5)
   - Changes should be visible immediately (no need to log out/in)

### Step 6: Production Deployment

If staging tests pass:

```bash
cd /Users/tomgibson/DiveStreams/divestreams-v2/.worktrees/admin-password-reset

# Merge staging into main
git checkout main
git merge staging --no-ff

# Push to trigger production deployment
git push origin main
```

CI/CD will:
1. Retag `ghcr.io/shooter51/divestreams-app:staging` → `:latest`
2. Deploy to production VPS (72.62.166.128)
3. Run smoke tests

### Step 7: Verify Production Deployment

```bash
ssh root@72.62.166.128

# Verify migrations ran
docker exec divestreams-app psql -U divestreams -d divestreams \
  -c "SELECT COUNT(*) FROM subscription WHERE plan_id IS NULL;"
# Expected: 0

# Run full verification script
docker exec -i divestreams-app psql -U divestreams -d divestreams < /path/to/scripts/verify-kan594-fix.sql
```

### Step 8: Final QA Acceptance Test

**Test on Production:** https://divestreams.com

1. Admin upgrades a test subscription
2. Verify tenant immediately sees premium features
3. Check database: both `plan` and `planId` updated
4. ✅ If passes → Close KAN-594 as **Done**
5. ❌ If fails → Check logs for `[KAN-594]` entries, run verification script

---

## Rollback Plan (If Issues Occur)

### Rollback Code:
```bash
git checkout staging  # or main
git revert HEAD
git push origin staging  # or main
```

### Rollback Migrations (If Necessary):
```sql
-- Remove NOT NULL constraint (migration 0035)
ALTER TABLE subscription ALTER COLUMN plan_id DROP NOT NULL;

-- Migration 0034 (backfill) is safe and doesn't need rollback
-- It only updates NULL values to valid planIds
```

### Clear Redis Cache:
```bash
docker exec divestreams-redis redis-cli FLUSHDB
```

---

## Post-Deployment Monitoring

### Check Application Logs:
```bash
docker logs -f divestreams-app | grep -i "KAN-594"
```

Expected log entries:
- `[KAN-594] Invalidated subscription cache for org {org-id}`

### Monitor Error Rates:
Check for increased 500 errors or subscription-related issues in production logs.

### Database Health Check:
```sql
-- Should always return 0 after deployment
SELECT COUNT(*) FROM subscription WHERE plan_id IS NULL;

-- All subscriptions should have valid plan relationships
SELECT COUNT(*) as orphaned
FROM subscription s
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE sp.id IS NULL;
-- Expected: orphaned = 0
```

---

## Success Criteria

### Functional ✅
- [ ] Admin can upgrade subscriptions via admin panel
- [ ] Both `plan` and `planId` fields update correctly
- [ ] Cache invalidated after subscription changes
- [ ] Tenants see premium features immediately
- [ ] No NULL planIds in database
- [ ] QA test account has Enterprise access

### Technical ✅
- [ ] Migration 0034 ran successfully (backfilled all subscriptions)
- [ ] Migration 0035 ran successfully (added NOT NULL constraint)
- [ ] All unit tests passing (5 KAN-594 tests + existing)
- [ ] Build successful with no errors
- [ ] Deployment to staging successful
- [ ] Deployment to production successful

### Verification ✅
- [ ] Verification script confirms no NULL planIds
- [ ] Manual testing confirms premium features accessible
- [ ] QA confirms issue resolved
- [ ] Database integrity checks pass

---

## Known Issues & Considerations

### Pre-Existing TypeScript Errors
The following TypeScript errors exist in the codebase **BEFORE** our changes:
- `app/routes/admin/plans.$id.tsx` - stripeResult undefined
- `lib/auth/session-management.server.ts` - rowCount property

**These are NOT related to KAN-594 and should be fixed separately.**

### Build Warnings
Vite warnings about dynamic imports are normal for this project and don't affect functionality.

---

## Support & Troubleshooting

### If "Premium Required" Still Shows:

1. **Check Database:**
   ```sql
   SELECT s.organization_id, s.plan, s.plan_id, sp.name, sp.monthly_price
   FROM subscription s
   LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
   WHERE s.organization_id = '{org-id}';
   ```
   - Verify `plan_id` is NOT NULL
   - Verify `sp.monthly_price > 0` for premium plans

2. **Check Cache:**
   ```bash
   docker exec divestreams-redis redis-cli KEYS "*{org-id}*"
   ```
   - If keys exist, cache wasn't cleared
   - Manually clear: `docker exec divestreams-redis redis-cli DEL {key}`

3. **Check Logs:**
   ```bash
   docker logs divestreams-app | grep "KAN-594"
   ```
   - Should see: "Invalidated subscription cache for org {org-id}"

4. **Force Cache Clear:**
   ```typescript
   // In tenant admin panel or via script
   await invalidateSubscriptionCache(organizationId);
   ```

---

## Contact & Resources

- **Issue:** KAN-594
- **Analysis Document:** `/docs/QA_REWORK_KAN-594_PREMIUM_FEATURES.md`
- **Implementation:** `/docs/KAN-594-FIX-IMPLEMENTATION.md`
- **This Document:** `/docs/KAN-594-DEPLOYMENT-STEPS.md`
- **Verification Script:** `/scripts/verify-kan594-fix.sql`
- **Unit Tests:** `/tests/unit/admin-subscription-upgrade.test.ts`
- **E2E Tests:** `/tests/e2e/admin-subscription-upgrade.spec.ts`

---

**Status:** ✅ Ready for Staging Deployment
**Next Action:** Merge to staging and run through deployment steps above

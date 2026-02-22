# KAN-594: Premium Features Remain Locked Despite Subscription Upgrade

**Status:** QA REJECTED (12th iteration)
**Reporter:** Antonius (QA Tester)
**Created:** January 25, 2026
**Last Updated:** February 1, 2026

---

## Original Problem

Admin upgrades tenant subscription from "Free Trial" → "Professional/Enterprise" via admin panel, but premium features (Boats, Equipment, Training, POS, Integrations) remain locked on tenant side.

**Impact:** Critical - Paying customers cannot access paid features.

---

## Current Problem (Feb 1, 2026)

**Still happening after 6 attempted fixes:**
```
Test case:
1. Create org with Free Trial
2. Admin upgrades to Enterprise
3. Tenant logs in
4. Result: Integrations feature still locked ❌
```

**QA Test Account:**
- Email: `kkudo31@protonmail.com`
- Password: `12345678`
- Expected Plan: Enterprise
- Actual Access: Free Trial features only

---

## Back-and-Forth History (12 Exchanges - Longest Issue)

| # | Date | Action | Root Cause Identified | Result |
|---|------|--------|----------------------|--------|
| 1 | Jan 25 | **QA:** Premium features locked after upgrade | - | Bug logged |
| 2 | Jan 26 | **QA:** Integration feature locked despite Enterprise plan | - | Detailed repro |
| 3 | Jan 26 | **DEV:** Plan updated during deployment causing locks | Deployment timing | ❌ Hypothesis |
| 4 | Jan 26 | **QA:** Still locked after admin manual upgrade | - | Failed |
| 5 | Jan 27 | **DEV:** Fixed - Subscription persistence working | Webhook planId | ✅ Claimed fixed |
| 6 | Jan 27 | **QA:** Integration still inaccessible | - | ❌ Failed |
| 7 | Jan 27 | **DEV:** Root cause - Only legacy `plan` string updated, not `planId` FK | DB schema issue | ✅ Claimed fixed |
| 8 | Jan 28 | **DEV:** Fixed isPremium logic to use planId relationship | Logic error | ✅ Claimed fixed |
| 9 | Jan 28 | **QA:** STILL happening with new test account | - | ❌ Failed |
| 10 | Jan 29 | **DEV:** Fixed new tenant signup planId initialization | Signup flow bug | ✅ Marked Done |
| 11 | Jan 29 | **DEV:** Moved to Dev Review | - | Premature close |
| 12 | Feb 1 | **QA:** Issue STILL occurring with same test case | - | ❌ **FAILED** |

**Total duration:** 7 days
**Developer time spent:** ~12 hours across 6 fix attempts
**QA testing cycles:** 6 rejections
**Success rate:** 0% (Issue persists)

---

## Root Cause Analysis

### The Fundamental Problem

**Three separate systems control feature access, and they're not synchronized:**

```
System 1: subscription.plan (legacy string) → "free", "professional", "enterprise"
System 2: subscription.planId (FK) → references subscription_plans.id
System 3: subscription_plans.features → JSON array of enabled features

Access check: isPremium() uses planId → planDetails.monthlyPrice > 0
BUT: Admin updates only touch subscription.plan, not subscription.planId
```

### Why Every Fix Failed

**Fix Attempt 1:** "Plans update during deployment"
- **Problem:** Speculative, no evidence
- **Result:** No change

**Fix Attempt 2:** "Webhook updates planId correctly"
- **Problem:** Only fixed Stripe webhooks, not admin manual updates
- **Result:** Admin updates still broken

**Fix Attempt 3:** "Update both plan and planId"
- **Problem:** Didn't update existing subscriptions, only new ones
- **Result:** Test account still had NULL planId

**Fix Attempt 4:** "Fix isPremium logic"
- **Problem:** Logic was correct, planId was still NULL
- **Result:** NULL planId means no premium access

**Fix Attempt 5:** "Fix new tenant signup"
- **Problem:** Only fixed signups, not admin upgrades
- **Result:** New accounts work, existing upgrades don't

**Fix Attempt 6:** (Not attempted yet)
- **Missing:** No migration to backfill NULL planIds
- **Missing:** Admin upgrade endpoint doesn't set planId
- **Missing:** No cache invalidation after subscription change

### The Real Root Cause (Discovered via analysis)

**1. Database State Inconsistency**
```sql
SELECT id, plan, "planId" FROM subscription WHERE organization_id = 'kkudo31';
-- Result: { plan: "enterprise", planId: NULL }
```

**2. Admin Update Incomplete**
```typescript
// app/routes/admin/tenants.$id.tsx (current code)
await db.update(subscription)
  .set({ plan: newPlan })  // ❌ Only updates legacy field
  .where(eq(subscription.organizationId, tenantId));
// Missing: planId update
```

**3. Feature Check Fails**
```typescript
// lib/auth/org-context.server.ts
function isPremium(org) {
  return org.subscription.planDetails?.monthlyPrice > 0;
  // planDetails comes from planId FK
  // If planId is NULL → planDetails is NULL → returns false
}
```

---

## Plan to Close Once and For All

### Phase 1: Data Migration (Fix Existing Data)

**Step 1: Create migration to backfill planIds**
```sql
-- drizzle/0034_backfill_subscription_plan_ids.sql
UPDATE subscription s
SET "planId" = (
  SELECT id FROM subscription_plans sp
  WHERE sp.name = s.plan
)
WHERE "planId" IS NULL AND s.plan IS NOT NULL;
```

**Step 2: Verify migration**
```sql
-- Should return 0 rows
SELECT COUNT(*) FROM subscription WHERE "planId" IS NULL AND plan IS NOT NULL;
```

### Phase 2: Fix Admin Update Endpoint

**Update admin tenant subscription change:**
```typescript
// app/routes/admin/tenants.$id.tsx
export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const newPlan = formData.get("plan") as string;

  // Get planId from subscription_plans table
  const planDetails = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.name, newPlan))
    .limit(1);

  if (!planDetails[0]) {
    throw new Error(`Plan ${newPlan} not found`);
  }

  // Update BOTH plan and planId
  await db.update(subscription)
    .set({
      plan: newPlan,          // Legacy field
      planId: planDetails[0].id,  // FK relationship (CRITICAL)
      updatedAt: new Date(),
    })
    .where(eq(subscription.organizationId, tenantId));

  // Clear session cache to force feature re-check
  await redis.del(`session:${tenantId}:subscription`);

  return json({ success: true });
}
```

### Phase 3: Add Cache Invalidation

**Problem:** Even after DB update, cached session still has old subscription data

**Solution:**
```typescript
// lib/auth/org-context.server.ts
export async function invalidateOrgCache(organizationId: string) {
  await redis.del(`session:${organizationId}:subscription`);
  await redis.del(`session:${organizationId}:plan`);
}

// Call after any subscription change:
await invalidateOrgCache(tenantId);
```

### Phase 4: Add Validation

**Prevent planId from becoming NULL again:**
```typescript
// lib/db/schema/subscription.ts
export const subscription = pgTable("subscription", {
  // ...
  planId: text("planId")
    .references(() => subscriptionPlans.id)
    .notNull()  // Add NOT NULL constraint
    .default("free-trial-id"),  // Default to free trial plan
});
```

### Phase 5: Testing Strategy

**Manual Test (Reproduce exact QA scenario):**
```
1. Create new org: test123@example.com / Free Trial
2. Verify: Only basic features accessible ✓
3. Admin: Upgrade to Enterprise via admin panel
4. **Check DB:** SELECT plan, planId FROM subscription WHERE org_id = 'test123'
   - Expected: plan = "enterprise", planId = "enterprise-plan-id"
5. Tenant: Log out and log back in (clear cache)
6. Verify: Integrations menu visible ✓
7. Verify: Can access Boats, Equipment, Training, POS ✓
```

**Automated Test:**
```typescript
test('admin subscription upgrade grants premium features', async () => {
  // 1. Create free trial org
  const org = await createTestOrg({ plan: 'free' });

  // 2. Verify locked
  expect(await hasAccess(org.id, 'integrations')).toBe(false);

  // 3. Admin upgrades
  await adminUpdateSubscription(org.id, 'enterprise');

  // 4. Verify planId updated
  const sub = await db.select().from(subscription)
    .where(eq(subscription.organizationId, org.id));
  expect(sub[0].planId).not.toBeNull();
  expect(sub[0].plan).toBe('enterprise');

  // 5. Verify feature access
  expect(await hasAccess(org.id, 'integrations')).toBe(true);
  expect(await hasAccess(org.id, 'boats')).toBe(true);
});
```

---

## Why This Will Work (Unlike Previous 6 Attempts)

| Previous Attempts | Why Failed | This Approach |
|------------------|------------|---------------|
| Fixed webhook only | Admin updates don't use webhooks | Fixes admin update endpoint |
| Fixed signup flow | Doesn't help existing orgs | Backfills existing data |
| Updated logic only | DB data still wrong | Fixes DB + code + cache |
| No verification | Assumed it worked | Specific test case + DB checks |
| Partial updates | Only touched one system | Updates all 3 systems together |
| No cache clear | Old data cached | Explicit cache invalidation |

---

## Acceptance Criteria for Closure

**Functional:**
1. ⏳ Admin can upgrade subscription via admin panel
2. ⏳ planId updates correctly in database
3. ⏳ Tenant sees premium features immediately (after cache clear)
4. ⏳ No NULL planIds in database after migration
5. ⏳ QA test account `kkudo31@protonmail.com` has Enterprise access

**Technical:**
6. ⏳ Migration script backfills all existing subscriptions
7. ⏳ Admin update endpoint sets both plan and planId
8. ⏳ Cache invalidated after subscription change
9. ⏳ Unit test verifies admin upgrade flow
10. ⏳ E2E test covers complete upgrade scenario

**Verification:**
11. ⏳ Run migration on staging
12. ⏳ Manually test with QA's exact repro steps
13. ⏳ Query DB to verify planId not NULL
14. ⏳ QA confirms integration feature accessible

---

## Estimated Time to Complete

- Migration script: **30 minutes**
- Admin endpoint fix: **1 hour**
- Cache invalidation: **30 minutes**
- Unit tests: **1 hour**
- E2E test: **1 hour**
- Manual QA verification: **30 minutes**
- DB verification queries: **15 minutes**

**Total:** ~5 hours

---

## Critical Success Factors

1. **Data migration FIRST** - Fix existing broken subscriptions
2. **Update all three systems** - plan, planId, cache
3. **Verify in DB** - Don't trust code, check actual data
4. **Test with QA's account** - Reproduce exact scenario
5. **Cache invalidation** - Force session refresh

**If this fails again:** The issue is architectural - need to remove dual-field system (plan + planId) and use only planId FK relationship.

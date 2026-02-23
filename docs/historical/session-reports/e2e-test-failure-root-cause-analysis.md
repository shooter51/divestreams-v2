# E2E Test Failure Root Cause Analysis
**Date:** 2026-01-30
**Test Run:** CI/CD #21500715417
**Result:** 379 passed, 43 failed (89.8% pass rate)

---

## Executive Summary

All 43 E2E test failures stem from **subscription plan feature gates**. The demo organization created in `tests/e2e/global-setup.ts` is assigned the **FREE plan** (line 104 in `lib/db/tenant.server.ts`), which lacks access to most features being tested.

**Impact:** 92% of failures (40/43) are caused by feature gates blocking access to:
- Point of Sale (requires PRO)
- Training Management (requires PRO)
- Public Website (requires STARTER)
- Equipment/Boats (requires STARTER)

**Remaining 3 failures:** Form selector strict mode violations (technical debt).

---

## Root Cause #1: POS Feature Gate (18 failures)

### Affected Tests
- **KAN-631:** POS New Sale Button (6 tests)
- **KAN-633:** POS Rentals and Trips Cart (7 tests)
- **KAN-634:** POS Split Payment (5 tests)

### Root Cause
**File:** `app/routes/tenant/pos.tsx:49`
```typescript
requireFeature(ctx.subscription?.planDetails?.features ?? {}, PLAN_FEATURES.HAS_POS);
```

**File:** `lib/plan-features.ts:147`
```typescript
free: {
  has_pos: false,  // ❌ FREE plan cannot access POS
  // ...
}
```

**File:** `lib/plan-features.ts:70-74`
```typescript
has_pos: {
  title: "Point of Sale",
  requiredPlan: "Pro",  // 🔒 Requires PRO plan
}
```

### What Happens
1. Test navigates to `/tenant/pos`
2. Loader executes `requireFeature()` check
3. Demo org subscription has `has_pos: false`
4. `requireFeature()` throws redirect to `/tenant?upgrade=has_pos`
5. POS UI never loads
6. Test fails: `"New Sale" button not visible`

### Evidence
All 18 tests fail at the same line:
```typescript
// tests/e2e/page-objects/pos.page.ts:27
await expect(this.page.getByRole("button", { name: /new sale/i })).toBeVisible();
```

**Error:** `element(s) not found` (10s timeout)

---

## Root Cause #2: Training Feature Gate (3 failures)

### Affected Tests
- **KAN-610:** New Enrollment Button Error (3 tests)

### Root Cause
**File:** `app/routes/tenant/training/*.tsx` (training routes have feature gates)

**File:** `lib/plan-features.ts:146`
```typescript
free: {
  has_training: false,  // ❌ FREE plan cannot access Training
}
```

**File:** `lib/plan-features.ts:65-69`
```typescript
has_training: {
  title: "Training Management",
  requiredPlan: "Pro",  // 🔒 Requires PRO plan
}
```

### What Happens
1. Test navigates to `/tenant/training`
2. Training routes check `requireFeature(HAS_TRAINING)`
3. Redirect to upgrade page
4. Test fails: `"New Enrollment" button not visible`

---

## Root Cause #3: Public Site Feature Gate (11+ failures)

### Affected Tests
- **KAN-638:** Course Booking Flow (5 tests)
- **KAN-652:** Customer Booking Cancellation (6 tests)
- **KAN-652:** Dev/Staging Smoke Tests (4 tests)

### Root Cause
**File:** `lib/plan-features.ts:148`
```typescript
free: {
  has_public_site: false,  // ❌ FREE plan has no public site
}
```

**File:** `lib/plan-features.ts:75-79`
```typescript
has_public_site: {
  title: "Public Website",
  requiredPlan: "Starter",  // 🔒 Requires STARTER plan
}
```

### What Happens
1. Test navigates to `/site/courses` or `/site/*`
2. Public site routes check `requireFeature(HAS_PUBLIC_SITE)`
3. Redirect or show disabled message
4. Tests fail: `no courses found`, `page title empty`

### Evidence
**KAN-638 Failure (line 38):**
```typescript
const firstCourseLink = page.locator('a[href*="/site/courses/"]').first();
await expect(firstCourseLink).toBeVisible();
// ❌ Error: element(s) not found
```

**KAN-652 Failure:**
```
Expected pattern: /DiveStreams|Demo|Dive/
Received string:  ""  // ❌ Empty title (page not loading)
```

---

## Root Cause #4: Gallery/Equipment Feature Gate (1 failure)

### Affected Test
- **KAN-630:** Album Image Upload (1 test)

### Root Cause
**File:** `lib/plan-features.ts:145`
```typescript
free: {
  has_equipment_boats: false,  // ❌ FREE plan has no equipment/boats
}
```

Gallery is part of the Equipment & Boats feature module.

### What Happens
1. Test navigates to `/tenant/gallery`
2. Gallery route checks `requireFeature(HAS_EQUIPMENT_BOATS)`
3. Redirect to `/tenant` (dashboard) or marketing page
4. Test sees: `"Run Your Dive Shop Effortlessly"` (marketing homepage)
5. Test expects: `"Gallery"` heading

### Evidence
```
Expected substring: "Gallery"
Received string:    "Run Your Dive Shop Effortlessly"  // ❌ Wrong page
```

---

## Root Cause #5: Form Selector Strict Mode Violations (3 failures)

### Affected Tests
- **Workflow:** Customer Management (1 test)
- **Workflow:** Tours Management (1 test)
- **Workflow:** Trips Scheduling (1 test)

### Root Cause
**Technical Debt:** Form selectors match multiple forms on the page.

### What Happens
Pages have both:
1. Main content form (the one tests want)
2. Sign-out form in header/sidebar: `<form method="post" action="/auth/logout">`

**Test Code:**
```typescript
// tests/e2e/workflow/customer-management.spec.ts:267
await page.locator("form").waitFor({ state: "visible", timeout: 10000 });
```

**Error:**
```
Error: strict mode violation: locator('form') resolved to 2 elements:
  1) <form method="post" action="/auth/logout">…</form>
  2) <form method="post" class="space-y-6">…</form>  // ← The one we want
```

### Solution
Use more specific selectors:
```typescript
// ✅ Better selector
await page.locator("form.space-y-6").waitFor({ state: "visible" });
// or
await page.locator("form").filter({ hasNot: page.locator('[action="/auth/logout"]') })
```

---

## Root Cause #6: Training Import Agency Dropdown (3 failures)

### Affected Tests
- **Training Import Wizard:** Steps 1-2, Progress Indicator (3 tests)

### Root Cause
1. **Feature Gate:** Training requires PRO plan (same as Root Cause #2)
2. **Test Assertion Issue:** Tests expect `bg-blue-600` but design uses `bg-brand`

### Evidence
```
Expected substring: "bg-blue-600"
Received string:    "...bg-brand text-white"  // ❌ Different class name
```

This is both a feature gate issue AND a stale test expectation.

---

## Feature Plan Matrix

| Feature | Free | Starter | Pro | Enterprise |
|---------|------|---------|-----|------------|
| **Tours & Bookings** | ✅ | ✅ | ✅ | ✅ |
| **Equipment & Boats** | ❌ | ✅ | ✅ | ✅ |
| **Training** | ❌ | ❌ | ✅ | ✅ |
| **Point of Sale** | ❌ | ❌ | ✅ | ✅ |
| **Public Website** | ❌ | ✅ | ✅ | ✅ |

**Demo Org:** FREE plan (line 104 in `lib/db/tenant.server.ts`)

---

## Solutions

### Option 1: Upgrade Demo Org to ENTERPRISE (Recommended)

**Pros:**
- ✅ Tests all features without changes
- ✅ Mirrors production usage (paying customers)
- ✅ No test modifications needed

**Implementation:**
```typescript
// tests/e2e/global-setup.ts (after createTenant)
// Get enterprise plan
const [enterprisePlan] = await db
  .select()
  .from(subscriptionPlans)
  .where(eq(subscriptionPlans.name, "enterprise"))
  .limit(1);

// Update subscription to enterprise
await db
  .update(subscription)
  .set({
    plan: "enterprise",
    planId: enterprisePlan.id,
    status: "active",  // Change from "trialing"
  })
  .where(eq(subscription.organizationId, demoOrg.id));
```

### Option 2: Create Multiple Test Organizations

Create separate orgs for each plan tier:
- `demo-free.localhost` - FREE plan tests
- `demo-starter.localhost` - STARTER plan tests
- `demo-pro.localhost` - PRO plan tests
- `demo-enterprise.localhost` - ENTERPRISE plan tests

**Pros:**
- ✅ Tests all plan tiers
- ✅ Validates upgrade flows

**Cons:**
- ❌ More complex setup
- ❌ Longer test execution time

### Option 3: Mock Feature Checks in E2E

Add environment variable to bypass feature gates in test mode:
```typescript
// lib/require-feature.server.ts
export function requireFeature(features, feature) {
  if (process.env.E2E_BYPASS_FEATURE_GATES === "true") {
    return; // Allow all features in E2E tests
  }
  if (!features[feature]) {
    throw redirect(`/tenant?upgrade=${feature}`);
  }
}
```

**Pros:**
- ✅ Simple implementation

**Cons:**
- ❌ Doesn't test actual feature gates
- ❌ Could hide real bugs
- ❌ Not representative of production

---

## Recommended Action Plan

1. **Immediate Fix (Option 1):** Update `tests/e2e/global-setup.ts` to assign ENTERPRISE plan
2. **Fix Strict Mode Violations:** Update form selectors in 3 workflow tests
3. **Fix Training Import Tests:** Update class name expectations (`bg-blue-600` → `bg-brand`)
4. **Document:** Add comment explaining why demo org uses ENTERPRISE plan

**Expected Result:**
- ✅ ~40 tests change from FAIL → PASS
- ✅ Pass rate: 89.8% → ~98%
- ✅ Only 3 strict mode violations remain (quick fix)

---

## Files to Modify

1. `tests/e2e/global-setup.ts` - Upgrade demo org to enterprise
2. `tests/e2e/workflow/customer-management.spec.ts:267` - Fix form selector
3. `tests/e2e/workflow/tours-management.spec.ts:261` - Fix form selector
4. `tests/e2e/workflow/trips-scheduling.spec.ts:264` - Fix form selector
5. `tests/e2e/workflow/regression-bugs.spec.ts:179` - Fix email field selector
6. `tests/e2e/workflow/training-import.spec.ts:436` - Update class expectation

---

## Conclusion

**No code regressions.** All failures are caused by intentional feature gates working as designed. The E2E test environment simply needs the demo organization upgraded to a plan that includes all features being tested.

**Routing fixes were successful.** The 404 errors from missing routes are resolved. Tests now progress past authentication and reach the feature gate redirects.

**Fix Complexity:** Low. A 10-line code change in global-setup.ts resolves 40/43 failures.

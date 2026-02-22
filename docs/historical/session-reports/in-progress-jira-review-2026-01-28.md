# Jira "In Progress" Issues - Comprehensive Review
**Date:** 2026-01-28
**Reviewer:** Claude Code
**Project:** KAN (DiveStreams)

## Executive Summary

Reviewed **13 issues** in "In Progress" status. **CRITICAL FINDING:** All 13 issues were marked "Fixed in staging" on 2026-01-27 09:23 AM, but QA (Antonius) reported **ALL fixes still failing** on 2026-01-27 evening.

**Root Cause:** Fixes may not have been properly deployed to staging, or there's a fundamental issue with the deployment process.

---

## Issues by Category

### 🔴 CRITICAL: Image Upload Failures (B2 Storage) - 2 Issues

#### KAN-608: Error 500 when upload picture on Boat details ⭐⭐⭐⭐
- **Status:** Still failing as of 2026-01-27 18:03
- **Claimed Fix:** "B2 storage configured, image uploads working"
- **QA Report:** Still shows Error 500 on boat image upload
- **Root Cause:** B2_APPLICATION_KEY_ID and B2_APPLICATION_KEY environment variables not properly injected into staging container
- **Recommended Fix:**
  1. Verify B2 credentials exist in staging `.env` file
  2. Check container has access to credentials (not just build-time secrets)
  3. Add B2 connection health check to app startup
  4. Log B2 upload attempts with detailed error messages

#### KAN-609: Error 500 when upload picture on Equipment detail ⭐⭐⭐⭐
- **Status:** Still failing as of 2026-01-27 18:12
- **Claimed Fix:** "B2 storage configured, image uploads working"
- **QA Report:** Still shows Error 500 on equipment image upload
- **Root Cause:** Same as KAN-608 - B2 integration not working
- **Recommended Fix:** Same as KAN-608

**ACTION REQUIRED:** Investigate B2 configuration in staging environment. The fix claims B2 is configured but uploads are still failing, suggesting environment variable injection issue.

---

### 🟡 HIGH PRIORITY: Validation & Business Logic - 5 Issues

#### KAN-624: Add enrollment on active Sessions showing error ⭐⭐⭐
- **Status:** Partially fixed - new validation error appeared
- **Original Issue:** Error when adding enrollment to active session
- **Current Issue:** "The amount paid should be greater than or equal to 1"
- **Progress:** Original error fixed, but uncovered new validation requirement
- **Recommended Fix:**
  1. Update enrollment form validation to enforce minimum payment of 1
  2. Add client-side validation with clear error message
  3. Consider if $0 enrollments should be allowed (e.g., scholarship students)

#### KAN-622: Create new discount code ⭐⭐⭐
- **Status:** Still failing as of 2026-01-27 18:36
- **Claimed Fix:** "Added discount validation (max 100%), inline error display"
- **QA Report:** Still needs validation improvements:
  - Discount value: min 1, max 100
  - Min Booking amount: min 1
- **Recommended Fix:**
  ```typescript
  // Add to discount form validation
  discountValue: z.number()
    .min(1, "Discount must be at least 1%")
    .max(100, "Discount cannot exceed 100%"),
  minBooking: z.number()
    .min(1, "Minimum booking must be at least $1")
  ```

#### KAN-617: Import product error message is far from user friendly ⭐⭐⭐
- **Status:** Still failing as of 2026-01-27 18:53
- **Claimed Fix:** "Improved import error messages with user-friendly text"
- **QA Report:** "still the same issues" - technical error messages still showing
- **Root Cause:** Error messages from CSV parser not being translated to user-friendly text
- **Recommended Fix:**
  1. Create error message mapper: technical error → user-friendly message
  2. Example: "Column 'price' missing" → "Your CSV file is missing the 'price' column. Please add it and try again."
  3. Add CSV template download link in error message
  4. Show sample CSV format when errors occur

#### KAN-610: Error 500 when access 'New Enrollment' on training page ⭐⭐⭐
- **Status:** Error changed from 500 to 400 as of 2026-01-27 18:21
- **Claimed Fix:** "Enrollment validation added, specific error messages implemented"
- **QA Report:** Still getting Error 400
- **Progress:** Server error (500) improved to validation error (400) - partial fix working
- **Recommended Fix:**
  1. Investigate what validation is failing (check server logs)
  2. Return specific validation error message to client
  3. Add pre-flight validation to prevent form submission with invalid data

#### KAN-611: Fix auto remove values issue ⭐⭐⭐
- **Status:** Still failing on login page as of 2026-01-27 18:23
- **Claimed Fix:** "Form data now preserved on validation errors"
- **QA Report:** "Still happening on login page"
- **Root Cause:** Fix may have been applied to other forms but not login form
- **Recommended Fix:**
  1. Check login form action - ensure it returns form data on error
  2. Verify `useActionData()` hook is being used in login component
  3. Apply same pattern as fixed forms:
  ```typescript
  export const action = async ({ request }) => {
    const formData = await request.formData();
    const email = formData.get("email");
    const password = formData.get("password");

    // Validation
    if (!email || !password) {
      return json({ errors: { ... }, email, password }, { status: 400 });
    }
    // ... rest of logic
  };
  ```

---

### 🟡 MEDIUM PRIORITY: UI/UX Issues - 3 Issues

#### KAN-612: Free Trial Homepage - Some texts and button are not visible ⭐⭐⭐
- **Status:** Still failing as of 2026-01-27 18:24
- **Claimed Fix:** "Enhanced free trial visibility on homepage with prominent CTAs"
- **QA Report:** Text still mixing with background, "See Features" button only visible on hover
- **Root Cause:** CSS text shadow / contrast issue - fix wasn't applied or is insufficient
- **Recommended Fix:**
  ```css
  .hero-text {
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
    /* OR add semi-transparent background */
    background: rgba(0, 0, 0, 0.5);
    padding: 1rem;
  }

  .cta-button {
    opacity: 1 !important; /* Remove hover-only visibility */
    background: var(--primary-color);
  }
  ```

#### KAN-613: No change password feature for Organization team member ⭐⭐⭐
- **Status:** Still failing as of 2026-01-27 18:27
- **Claimed Fix:** "Added change password feature for team members"
- **QA Report:** "still no change password feature" visible in UI
- **Root Cause:** Feature may be implemented but not visible in UI (routing/navigation issue)
- **Recommended Fix:**
  1. Verify `/tenant/team/change-password` route exists
  2. Add "Change Password" button to team member profile page
  3. Check if feature is behind a permission check that's failing
  4. Ensure team member users (not just org owners) can access it

#### KAN-614: Pictures are missing on the duplicated tour ⭐⭐⭐
- **Status:** Still failing as of 2026-01-27 18:29
- **Claimed Fix:** "Added unique constraint on tour name, double-submit prevention, duplicate detection"
- **QA Report:** "still the same issue"
- **Root Cause:** Fix addressed duplicate creation prevention, but NOT the image copying issue
- **Analysis:** The reported fix doesn't match the actual bug - this is about images not being copied during tour duplication, NOT about preventing duplicates
- **Recommended Fix:**
  1. In tour duplication logic, copy associated tour images:
  ```typescript
  // When duplicating a tour
  const originalTour = await getTour(sourceId);
  const newTour = await createTour({ ...originalTour, name: newName });

  // Copy images
  const tourImages = await getTourImages(sourceId);
  for (const image of tourImages) {
    await createTourImage({
      tourId: newTour.id,
      imageUrl: image.imageUrl, // Same B2 URL (images are immutable)
      displayOrder: image.displayOrder
    });
  }
  ```

---

### 🟢 FIXED: Properly Implemented - 1 Issue

#### KAN-601: Incorrect behavior when adding/removing text element under Amenities ✅
- **Status:** ACTUALLY FIXED with detailed implementation as of 2026-01-27 17:57
- **Fix Quality:** ⭐⭐⭐⭐⭐
- **Implementation:**
  - Replaced text input with chip-based UI
  - Selected amenities display as removable chips with × button
  - Common amenities list auto-hides selected items
  - One-click removal via × button
- **Files Changed:**
  - `app/routes/tenant/boats/new.tsx`
  - `app/routes/tenant/boats/$id/edit.tsx`
- **Commit:** fb2a8b9
- **Why This Worked:** Detailed root cause analysis, proper solution design, and complete implementation

---

### 🔴 CRITICAL: Subscription & Access Control - 2 Issues

#### KAN-594: Premium feature remain locked despite tenant subscription modified ⭐⭐⭐⭐
- **Status:** Still failing as of 2026-01-27 17:27
- **Claimed Fix:** "Subscription plan persistence now working, webhook updates planId correctly"
- **QA Report:** kkudo311@gmail.com with Enterprise plan still cannot access Integration features
- **Root Cause Analysis (from comments):**
  - When admin creates/updates subscription, only `plan` (string) was set, not `planId` (FK)
  - Fix added planId lookup and migration to backfill existing subscriptions
- **Current Issue:** Fix deployed but tenant context still not recognizing Enterprise features
- **Recommended Fix:**
  1. Verify migration ran successfully on staging database
  2. Check user session - may need to log out/log in to refresh tenant context
  3. Verify `isPremium` check is using `planId` not legacy `plan` field
  4. Add database query to confirm kkudo311's subscription:
  ```sql
  SELECT o.subdomain, s.plan, s.planId, sp.name, sp.features
  FROM public.tenants o
  JOIN public.subscriptions s ON s.organizationId = o.id
  LEFT JOIN public.subscription_plans sp ON sp.id = s.planId
  WHERE o.ownerEmail = 'kkudo311@gmail.com';
  ```

#### KAN-592: Tenant Free Trial not working ⭐⭐⭐⭐
- **Status:** Still failing as of 2026-01-27 19:23
- **Issues:**
  1. Email not being sent (welcome email) - CRITICAL for password reset
  2. "Account with this email already exists" even after deletion
- **Claimed Fix:** "SMTP configured, worker container has credentials, emails should send"
- **QA Report:** Still cannot reuse deleted account email (soft delete issue)
- **Recommended Fix:**
  1. **Email Issue:**
     - Verify SMTP credentials in worker container (not just app container)
     - Check BullMQ queue is processing email jobs
     - Add email sending to app container startup health check
     - Log email queue status: `redis-cli LLEN bull:email:waiting`
  2. **Soft Delete Issue:**
     - Change tenant deletion to actually delete record OR
     - Add `isDeleted` field and filter deleted tenants from "already exists" check:
     ```typescript
     const existingTenant = await db.query.tenants.findFirst({
       where: and(
         eq(tenants.ownerEmail, email),
         eq(tenants.isDeleted, false) // Only check non-deleted
       )
     });
     ```

---

## Additional Issues Mentioned

### KAN-618: Error 500 when adding a new product (DEV REVIEW status)
- **Status:** ✅ FIXED and verified
- **Fix Quality:** ⭐⭐⭐⭐
- **Root Cause:** Products table missing sale pricing columns in existing tenants
- **Fix:** Migration 0027 with table existence check (commit c7db6a7)
- **Follow-up:** DIVE-lju created but likely already addressed
- **Verification:** Migration runs on container startup, adds columns if missing
- **User Concern:** "Migration works for 99% of cases but missing table existence check"
- **Response:** Table existence check WAS added in commit c7db6a7 (lines 22-28 of migration)

### KAN-625: Fix 8 E2E tests failing (DEV REVIEW status)
- **Status:** ⚠️ PARTIALLY FIXED - Critical tech debt remains
- **Fix Quality:** ⭐⭐⭐⭐ (for the 8 tests), ⭐ (for overall problem)
- **Root Cause:** Tests using `waitForTimeout()` instead of condition-based waiting
- **Fix:** Replaced timeout with `waitForLoadState()` in 8 tests (commit 76351c1)
- **Critical Finding:** Only **8 out of 679 instances** fixed (1.2%)
- **Worse:** 8 NEW instances added in:
  - `pos.page.ts`
  - `training-import.spec.ts`
  - `stripe-integration.spec.ts`
- **No ESLint rule** to prevent future usage
- **Follow-up Issues Created:**
  - DIVE-ika (P1): Refactor 679 waitForTimeout instances
  - DIVE-02w (P1): Add ESLint rule to prevent waitForTimeout
  - DIVE-6c9 (P1): Duplicate of DIVE-ika
- **Recommended Action:**
  1. Add ESLint rule IMMEDIATELY to prevent new instances
  2. Create systematic remediation plan (e.g., 50 instances per week)
  3. Consider running eslint --fix with custom transform to automate some conversions

---

## ROOT CAUSE ANALYSIS: Why Are "Fixed" Issues Still Failing?

### Investigation Needed:

1. **Deployment Verification:**
   - Check if staging container was actually restarted after fixes
   - Verify staging branch HEAD matches latest deployment
   - Check CI/CD logs for deployment failures

2. **Environment Variables:**
   - B2 storage credentials may not be in container runtime environment
   - SMTP credentials may not be in worker container
   - Check `.env` file on staging VPS

3. **Database Migrations:**
   - Verify all migrations ran successfully
   - Check migration logs in worker container
   - Confirm planId backfill migration completed

4. **Caching Issues:**
   - Redis cache may be serving stale data
   - Browser cache may be showing old UI
   - CDN cache (Caddy) may need purge

5. **Session/Context Issues:**
   - Users may need to log out and back in to refresh tenant context
   - Session data may be stale after subscription updates

---

## Recommended Immediate Actions

### Priority 1 (Do Today):
1. **Verify staging deployment:** Check if container was actually restarted after fixes
2. **Check environment variables:** Verify B2 and SMTP credentials exist in staging container
3. **Run database verification script:** Confirm migrations ran and planId is set
4. **Add KAN-625 ESLint rule:** Prevent new waitForTimeout instances immediately

### Priority 2 (Do This Week):
5. **Fix B2 storage:** Inject credentials properly into container (KAN-608, KAN-609)
6. **Fix SMTP/email:** Ensure worker container can send emails (KAN-592)
7. **Fix subscription context:** Ensure planId changes refresh tenant access (KAN-594)
8. **Fix tour duplication:** Copy images when duplicating tours (KAN-614)

### Priority 3 (Schedule Next Sprint):
9. **Systematic validation fixes:** KAN-622, KAN-624, KAN-617, KAN-610, KAN-611
10. **UI/UX fixes:** KAN-612, KAN-613
11. **Tech debt remediation:** 679 waitForTimeout instances (KAN-625 follow-up)

---

## Success Metrics

**Before:**
- 13 issues "In Progress" with claimed fixes
- 0% verified working by QA
- 100% failure rate on re-test

**After (Target):**
- All critical bugs (B2, SMTP, subscription) resolved
- 100% verified working by QA before marking "Done"
- Root cause documentation for each fix
- Follow-up tech debt issues tracked in Beads

---

## Lessons Learned

1. **"Fixed in staging" doesn't mean "verified working"** - Need QA verification before closing
2. **Environment-specific issues** (B2, SMTP) require runtime environment verification
3. **Database migrations** need verification logs and rollback plans
4. **Partial fixes** (KAN-625: 8/679) create false sense of completion
5. **Root cause analysis** (like KAN-601) leads to better, lasting fixes

---

## Files for Review

Created follow-up issues in Beads:
- ✅ DIVE-ika: Refactor 679 waitForTimeout instances (already exists)
- ✅ DIVE-02w: Add ESLint rule (already exists)
- ✅ DIVE-lju: Products table check (likely already fixed in c7db6a7)

**Recommended:** Close DIVE-6c9 as duplicate of DIVE-ika.

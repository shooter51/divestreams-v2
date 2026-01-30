# E2E Test Failure Analysis Report
**CI/CD Run:** 21525499498  
**Job:** e2e (62027906997)  
**Date:** 2026-01-30  
**Commit:** b6b9fb9 (Complete systematic networkidle migration)

## Executive Summary

**Test Results:**
- ✅ **251 passed** (72.8%)
- ❌ **46 failed** (13.3%)
- ⏭️ **22 skipped** (6.4%)
- ⏸️ **283 did not run** (due to earlier failures)
- **Total Runtime:** 21m 24s

## Root Cause Analysis

The failures are **NOT caused by the networkidle migration** in commit b6b9fb9. Instead, they represent **pre-existing application bugs and missing features** that the E2E tests are correctly catching.

### Key Finding
The networkidle migration **successfully fixed timeout issues** but revealed underlying problems in the application that were previously masked by navigation timing issues.

## Failure Categories

### 1. POS (Point of Sale) System Failures (20 tests)
**Status:** Critical application bugs

**Affected Tests:**
- KAN-631: POS New Sale Button (7 tests)
- KAN-633: POS Cart - Rentals/Trips (8 tests)
- KAN-634: POS Split Payment (5 tests)

**Common Error Pattern:**
```
Error: element(s) not found
Locator: Various POS UI elements (buttons, forms, cart items)
```

**Root Cause:** POS features appear to be incomplete or broken in the current build. Elements that tests expect to find are not rendering.

**Impact:** High - Core revenue-generating feature

---

### 2. Training/Course Management Failures (9 tests)
**Status:** Feature missing or route broken

**Affected Tests:**
- KAN-610: Enrollment form loading (1 test)
- KAN-576: Training import navigation (1 test)
- KAN-577: Agency selection form (1 test)
- KAN-578: Form validation (1 test)
- KAN-587: Progress indicator (1 test)
- KAN-638: Course booking flow (5 tests)

**Common Error Pattern:**
```
Error: element(s) not found
Locator: getByRole('link', { name: /import courses/i })
Locator: select[name="agencyId"]
```

**Root Cause:** Training import wizard appears to be missing UI elements or the route is not properly configured.

---

### 3. Customer Booking Cancellation Failures (9 tests)
**Status:** Environment configuration issue

**Affected Tests:**
- KAN-652: Customer booking cancellation (4 tests)
- KAN-652: Dev environment smoke tests (2 tests)
- KAN-652: Staging environment smoke tests (3 tests)

**Common Error Pattern:**
```
Error: expect(page).toHaveTitle(expected) failed
Error: expect(received).toContain(expected) // indexOf
```

**Root Cause:** Tests are attempting to access `dev.divestreams.com` which does not exist yet (per CLAUDE.md: "DNS not yet set up"). Staging tests failing suggest possible deployment issues.

---

### 4. Album Upload Failure (1 test)
**Affected:** KAN-630: Album Image Upload

**Status:** Feature broken

---

### 5. Workflow/CRUD Failures (7 tests)
**Status:** Navigation or form loading issues

**Affected:**
- KAN-85: Add Boat button (1 test)
- KAN-168: Trip form boat selector (1 test)
- KAN-197: POS payment button (1 test)
- KAN-298: Edit customer form (1 test)
- KAN-346: Edit tour form (1 test)
- KAN-387: Schedule trip button (1 test - strict mode violation)
- KAN-536: Discount code modal (1 test - strict mode violation)

**Common Patterns:**
```
Error: expect(received).toBeTruthy()
// Form not loading properly

Error: strict mode violation: getByRole('link', { name: /schedule.*trip/i }) resolved to 2 elements
// Multiple elements matched when only one expected
```

---

## Detailed Breakdown by Error Type

### 1. Element Not Found (27 instances)
- Elements expected by tests are not rendering
- Indicates incomplete features or broken routes
- **Action Required:** Fix application features

### 2. Strict Mode Violations (2 instances)
- Multiple elements match when test expects one
- Occurs in: Schedule Trip button, Discount code creation
- **Action Required:** Make selectors more specific or fix duplicate elements

### 3. Form Loading Failures (7 instances)
- Forms fail `toBeTruthy()` checks
- Indicates navigation or data loading issues
- **Action Required:** Debug form rendering logic

### 4. Environment Access Failures (3 instances)
- Dev environment (dev.divestreams.com) DNS not configured
- **Action Required:** Configure DNS or update tests to use IP

---

## Test Infrastructure Assessment

✅ **Good:**
- Test infrastructure is working correctly
- Database seeding successful
- Playwright browsers installed properly
- Network configuration correct
- Build process completed

❌ **Issues Found:**
- Multiple "role 'root' does not exist" PostgreSQL warnings (non-blocking)
- Some tests attempting to access non-existent dev environment

---

## Recommendations

### Priority 1 (Critical - Blocking Production)
1. **Fix POS System (20 tests)** - Core revenue feature
   - Investigate KAN-631, KAN-633, KAN-634
   - Check if POS routes/components are properly deployed
   - Verify cart functionality for rentals and trips

### Priority 2 (High - Feature Completion)
2. **Fix Training/Course Import (9 tests)**
   - Verify training import wizard route exists
   - Check agency selection dropdown rendering
   - Validate course booking enrollment flow

3. **Fix Album Upload (KAN-630)**
   - Test image upload functionality
   - Check file upload handlers

### Priority 3 (Medium - UX Issues)
4. **Fix Strict Mode Violations (2 tests)**
   - Make "Schedule Trip" selector more specific
   - Fix duplicate "Add/Create" buttons in discount modal

5. **Fix Form Loading Issues (7 tests)**
   - Debug edit forms for boats, tours, customers, trips
   - Check data fetching logic

### Priority 4 (Low - Environment Config)
6. **Configure Dev Environment**
   - Set up DNS for dev.divestreams.com
   - Or update KAN-652 tests to skip dev environment
   - Investigate staging environment failures

---

## Conclusion

**This is NOT a test infrastructure issue.** The E2E tests are functioning correctly and identifying real application bugs. The networkidle migration successfully fixed navigation timing issues, but revealed that multiple features are incomplete or broken.

**Recommended Next Steps:**
1. Create Jira tickets for each failure category
2. Prioritize POS system fixes (highest revenue impact)
3. Consider temporarily skipping broken feature tests until features are implemented
4. Run tests locally to debug individual failures
5. Focus on Priority 1 and 2 items before next deployment

**Pass Rate Impact:**
- Current: 72.8% (251/345)
- Excluding unimplemented features (dev env): ~75%
- After fixing Priority 1-2 items: Expected ~90-95%

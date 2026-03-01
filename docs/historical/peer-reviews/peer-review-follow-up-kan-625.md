# Peer Review #1 Follow-Up - KAN-625 (E2E Tests Timing Out)

**Review Date:** 2026-01-28
**Original Review Date:** 2026-01-28
**Reviewer:** Peer Reviewer #1
**Issue:** KAN-625 - E2E Tests Timing Out
**Fix Commit:** 76351c1 (Jan 27, 2026)

---

## Changes Since Last Review

**NO NEW CHANGES DETECTED**

- **Last commit addressing KAN-625:** `76351c1` (Jan 27, 18:11:55)
- **Subsequent commits:** 9 commits since fix (none address timeout refactoring)
- **Follow-up tickets created:** ❌ NONE
- **Beads tracking:** No open issues for remaining 671 timeout instances
- **ESLint rule added:** ❌ NO
- **Helper function created:** ❌ NO

### Commit Activity Since Fix
```
4ac284a - fix: correct syntax error in tours-management test (missing paren)
7d38e33 - fix: disable broken Manage Rentals link (KAN-619)
f0bdb1b - fix: add sale pricing columns to existing products tables (KAN-618)
cc72aaa - fix: prevent negative stock values in bulk update (KAN-620)
6142063 - fix: correct booking link to use existing embed route (KAN-639)
```

**Analysis:** Team moved on to other priorities without addressing the systemic issue.

---

## Current Status

### waitForTimeout Instance Count

| File | Original Count | Current Count | Change |
|------|---------------|--------------|--------|
| `00-full-workflow.spec.ts` | 239 | 239 | ⚠️ NO CHANGE |
| `tours-management.spec.ts` | 72 | 72 | ⚠️ NO CHANGE |
| `regression-bugs.spec.ts` | 72 | 72 | ⚠️ NO CHANGE |
| `trips-scheduling.spec.ts` | 69 | 69 | ⚠️ NO CHANGE |
| `public-site.spec.ts` | 69 | 69 | ⚠️ NO CHANGE |
| `training-module.spec.ts` | 67 | 67 | ⚠️ NO CHANGE |
| `customer-management.spec.ts` | 60 | **52** | ✅ -8 (fixed in KAN-625) |
| `zz-embed-courses.spec.ts` | 26 | 26 | ⚠️ NO CHANGE |
| `pos.page.ts` | - | 8 | ⚠️ NEW |
| `training-import.spec.ts` | - | 2 | ⚠️ NEW |
| `stripe-integration.spec.ts` | - | 3 | ⚠️ NEW |
| **TOTAL** | **671** | **679** | 🔴 **+8 INSTANCES** |

**CRITICAL FINDING:** The timeout count **INCREASED by 8 instances** instead of decreasing.

---

## Verdict: ❌ NEEDS CHANGES

**Fix Quality:** ⭐⭐⭐⭐ (4/5) - Original fix still technically correct
**Completeness:** 🔴 **1.2%** → **1.2%** (8 out of 679 instances fixed, -8 progress)
**Follow-through:** 🔴 **0/5** - Zero recommendations implemented

### Critical Issues

#### 1. No Progress on Systemic Problem
- **Original finding:** 671 instances across 8 files
- **Current state:** 679 instances across 11 files (+8 instances)
- **Action taken:** None (no follow-up ticket created)

#### 2. New Anti-Pattern Usage
Three new files were added with `waitForTimeout`:
- `pos.page.ts` - 8 instances (page object file)
- `training-import.spec.ts` - 2 instances
- `stripe-integration.spec.ts` - 3 instances

**This violates the testing best practice established in KAN-625.**

#### 3. Zero Recommendations Implemented
From original review (lines 72-77):

| Recommendation | Status | Priority |
|----------------|--------|----------|
| 1. Verify CI passing (3+ runs) | ✅ DONE | ✅ |
| 2. Create follow-up ticket | ❌ NOT DONE | 🔴 REQUIRED |
| 3. Create helper function | ❌ NOT DONE | 🟡 RECOMMENDED |
| 4. Add ESLint rule | ❌ NOT DONE | 🟡 RECOMMENDED |
| 5. Document anti-pattern | ❌ NOT DONE | 🟢 OPTIONAL |

#### 4. CI Status Mixed
Recent CI runs show intermittent failures:
```
2026-01-28 - failure - CI/CD Pipeline
2026-01-28 - success - Tests
2026-01-28 - failure - CI/CD Pipeline
2026-01-28 - success - Tests
```

**Test workflow passes, but deploy workflow fails** (unrelated to KAN-625).

---

## Analysis

### What Went Wrong

1. **Fix was too narrow**: Only addressed 8 failing tests in CI
2. **Technical debt ignored**: 671 remaining instances treated as "working" code
3. **No prevention**: New code continues to use the anti-pattern
4. **No ownership**: Issue marked complete without systemic remediation

### Risk Assessment

**Current Risk Level:** 🔴 **HIGH**

**Projected Impact:**
- **Next 30 days:** 5-10 more CI timeouts (3-5% of remaining instances)
- **Next 90 days:** Test suite unreliable (10-15% failure rate)
- **6 months:** E2E tests abandoned or rewritten from scratch

**Evidence:**
- Anti-pattern still being used in new code (3 new files)
- No safeguards to prevent future usage
- Team velocity suggests 6+ months to manually refactor 679 instances

---

## Recommendations

### 🚨 IMMEDIATE ACTION REQUIRED (This Week)

#### 1. Create Follow-Up Ticket (Priority: P1)
```bash
bd create --title "[TECH DEBT] Refactor 679 waitForTimeout instances to condition-based waiting" \
  --type task \
  --priority P1 \
  --description "Systemic refactor of remaining timeout anti-patterns from KAN-625"
```

**Scope:**
- 679 instances across 11 files
- Estimated effort: 20-30 hours (4-6 days)
- Can be done incrementally (10-20 instances per day)

#### 2. Add ESLint Rule (Priority: P1)
Prevent new instances from being added:

```javascript
// .eslintrc.js
rules: {
  "no-restricted-syntax": [
    "error",
    {
      selector: "CallExpression[callee.property.name='waitForTimeout']",
      message: "Use condition-based waiting (waitFor) instead of arbitrary timeouts. See KAN-625."
    }
  ]
}
```

**Testing:**
```bash
npm run lint  # Should fail on existing 679 instances
```

**Implementation:**
- Add rule to `.eslintrc.js`
- Create `.eslintignore-timeout` exemption list for existing files
- Remove files from exemption as they're refactored

#### 3. Create Helper Function (Priority: P2)
Standardize the pattern from KAN-625:

```typescript
// tests/e2e/helpers/wait.ts
export async function waitForFormVisible(page: Page, timeout = 10000) {
  try {
    await page.locator("form").waitFor({ state: "visible", timeout });
    return true;
  } catch {
    console.log("Form not visible after ${timeout}ms, reloading...");
    await page.reload();
    await page.locator("form").waitFor({ state: "visible", timeout });
    return true;
  }
}
```

**Usage:**
```typescript
// Before (anti-pattern)
await page.waitForTimeout(1500);
const hasForm = await page.locator("form").isVisible().catch(() => false);

// After (condition-based)
await waitForFormVisible(page);
const hasForm = await page.locator("form").isVisible();
```

### 📋 SHORT-TERM (Next 2 Weeks)

#### 4. Incremental Refactoring Plan
Prioritize by file risk (failure probability × impact):

| Priority | File | Instances | Risk Level | Est. Hours |
|----------|------|-----------|------------|------------|
| 1 | `00-full-workflow.spec.ts` | 239 | 🔴 CRITICAL | 8-10 hours |
| 2 | `tours-management.spec.ts` | 72 | 🟠 HIGH | 2-3 hours |
| 3 | `regression-bugs.spec.ts` | 72 | 🟠 HIGH | 2-3 hours |
| 4 | `trips-scheduling.spec.ts` | 69 | 🟠 HIGH | 2-3 hours |
| 5 | `public-site.spec.ts` | 69 | 🟠 HIGH | 2-3 hours |
| 6 | `training-module.spec.ts` | 67 | 🟠 HIGH | 2-3 hours |
| 7 | `customer-management.spec.ts` | 52 | 🟡 MEDIUM | 1-2 hours |
| 8 | `zz-embed-courses.spec.ts` | 26 | 🟡 MEDIUM | 1 hour |
| 9 | `pos.page.ts` | 8 | 🟢 LOW | 0.5 hours |
| 10 | `training-import.spec.ts` | 2 | 🟢 LOW | 0.25 hours |
| 11 | `stripe-integration.spec.ts` | 3 | 🟢 LOW | 0.25 hours |

**Strategy:**
- Batch by file (easier to maintain context)
- Use helper function for common patterns
- Test after each file refactor
- Commit incrementally with `[KAN-XXX]` references

#### 5. Documentation (Priority: P3)
Add to test documentation:

**File:** `tests/e2e/README.md` (or create if missing)

```markdown
## Testing Best Practices

### ❌ ANTI-PATTERN: Arbitrary Timeouts
DO NOT use `waitForTimeout()` with hardcoded delays:
```typescript
await page.waitForTimeout(1500);  // ❌ WRONG
```

### ✅ CORRECT: Condition-Based Waiting
Wait for actual conditions using `waitFor()`:
```typescript
await page.locator("form").waitFor({ state: "visible", timeout: 10000 });  // ✅ CORRECT
```

See [KAN-625](https://divestreams.atlassian.net/browse/KAN-625) for context.
```

### 📊 LONG-TERM (Next Sprint)

#### 6. CI Monitoring Dashboard
Track timeout-related failures:
- Add metric: "Tests with waitForTimeout failures"
- Alert threshold: > 2 failures per week
- Review in weekly standup

#### 7. Refactoring Velocity Tracking
```bash
# Weekly check
grep -r "waitForTimeout" tests/e2e/ | wc -l
# Target: -50 instances per week (2 weeks to complete)
```

---

## Testing Requirements

### Before Approval

1. ✅ **ESLint rule added** and enforced on new code
2. ✅ **Follow-up ticket created** in Beads (visible to team)
3. ✅ **Helper function implemented** and documented
4. ✅ **At least 100 instances refactored** (15% progress toward 679 total)

### Acceptance Criteria

- CI pipeline passes 10 consecutive runs (currently intermittent)
- No new `waitForTimeout` instances added (enforced by ESLint)
- Timeout count reduced by 100 (from 679 → 579)
- Refactoring velocity established (target: 50/week)

---

## Conclusion

**Current Verdict:** ❌ **NEEDS CHANGES**

**Rationale:**
1. Original fix solved immediate CI failures (8 tests) ✅
2. Systemic issue (679 instances) remains unaddressed ❌
3. Anti-pattern continues to proliferate (3 new files) ❌
4. Zero prevention measures implemented ❌

**Path to Approval:**
- Implement recommendations #1-3 (ESLint rule, ticket, helper function)
- Refactor at least 100 instances (2 weeks of effort)
- Demonstrate no new instances added
- Re-review after 2-week sprint

**Original Peer Review Assessment:**
- ✅ "APPROVED WITH CONDITIONS" - Conditions NOT met
- 🔴 Systemic issue remains a critical blocker for test reliability
- 🔴 Technical debt growing instead of shrinking

---

**Reviewer Signature:** Peer Reviewer #1
**Date:** 2026-01-28
**Status:** NEEDS CHANGES - Re-review required after implementing recommendations

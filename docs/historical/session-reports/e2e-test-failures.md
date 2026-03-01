# E2E Test Failures Tracking

## Current Status (2026-01-19)

**Total E2E Tests**: 325 (across 6 workflow spec files)
**Passing**: 321
**Failing**: 4

## Failing Tests

### 1. Public Site Spec - Checkbox Timeout
**File**: `tests/e2e/workflow/public-site.spec.ts`
**Error**: `TimeoutError: locator.check: Timeout 5000ms exceeded`
**Element**: `input[name="enabled"]` checkbox
**Issue**: Checkbox interaction timing out - element exists but check() action fails
**Potential Cause**:
- Peer checkbox pattern (`.sr-only.peer`) may need special handling
- Element might be covered or not interactable
- May need to click label instead of hidden checkbox

### 2. Customer Management - Email Field Timeout
**File**: `tests/e2e/workflow/customer-management.spec.ts`
**Error**: `TimeoutError: locator.fill: Timeout 15000ms exceeded`
**Element**: `getByLabel(/email/i)`
**Issue**: Email field not found or not fillable within timeout
**Potential Cause**:
- Field might be dynamically loaded
- Label text might not match regex pattern
- Field might be disabled on load

### 3 & 4. Additional Public Site Timeouts
**Files**: Same as #1
**Similar Issues**: Navigation and checkbox interaction timeouts

## Root Causes Analysis

The common pattern across failures:
1. **UI element interaction timeouts** - not rendering/DOM issues
2. **Checkbox interactions** - peer/sr-only pattern might need special selectors
3. **Form field timing** - some fields may need explicit wait conditions

## Quick Test Command

Run only failing tests:
```bash
npm run test:e2e:failing
```

This runs approximately 40-50 tests (from 2 spec files) instead of all 325 tests, reducing test time from ~27 minutes to ~3-5 minutes.

## CI/CD Integration

Add `[e2e:failing]` to commit message to run only failing tests in CI:
```bash
git commit -m "Fix checkbox interaction [e2e:failing]"
```

## Debugging Strategy

1. **Run failing tests locally first**:
   ```bash
   npm run test:e2e:failing -- --debug
   ```

2. **Check element selectors**:
   - Use Playwright Inspector to verify selectors
   - Check if elements are hidden/covered
   - Verify timing of element appearance

3. **Increase specific timeouts** if needed:
   - Checkbox interactions: Consider using `click()` on label instead of `check()`
   - Form fields: Add explicit `waitFor()` before interaction

4. **Fix and verify**:
   - Fix one test at a time
   - Run full suite once all failing tests pass
   - Update this document when tests are fixed

## Next Steps

- [ ] Debug public-site checkbox interaction (priority: high)
- [ ] Debug customer-management email field (priority: high)
- [ ] Run full E2E suite after fixes
- [ ] Remove test:e2e:failing script if all tests pass
- [ ] Update CI/CD to remove [e2e:failing] check

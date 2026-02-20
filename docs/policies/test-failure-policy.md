# Test Failure Policy

## Overview
This policy defines how to handle test failures that are not in the critical deployment path, ensuring CI/CD pipeline progress while tracking defects for repair.

## Policy: Non-Critical Test Failures

### When Tests Fail Outside Critical Path

If tests fail that are **not blocking immediate deployment needs**, follow this workflow:

1. **Document the Failure**
   - Note the test name, failure details, and CI run URL
   - Include expected vs actual behavior
   - Note impact on pipeline

2. **Skip the Test Temporarily**
   - Mark test with `.skip()` in test file
   - Add comment explaining the issue:
     ```typescript
     // SKIP: Integration tests failing - database connection issues
     test.skip('should do something', async () => {
       // test code
     });
     ```

3. **Commit the Skip**
   - Commit message: `test: skip <test-name> pending defect repair`
   - This allows CI/CD pipeline to progress

4. **Fix the Defect**
   - Work on fix in separate branch
   - Follow standard defect repair workflow
   - Ensure fix passes locally

5. **Re-enable the Test**
   - Remove `.skip()` from test
   - Remove skip comment
   - Verify test passes in CI

## Critical Path Tests

Tests that **MUST NOT** be skipped (always block deployment):
- Security tests (auth, authorization, XSS, SQL injection)
- Data integrity tests (no data loss)
- Payment processing tests (Stripe integration)
- Core tenant isolation tests (multi-tenancy)

These tests should **always block** until fixed. Do not skip.

## Example Workflow

```bash
# 1. Test fails in CI - document the failure

# 2. Skip test locally
# Add to tests/integration/user-profile.test.ts:
# // SKIP: User profile update fails due to database connection issue
# test.skip('should update user profile', async () => { ... })

# 3. Commit and push
git add tests/integration/user-profile.test.ts
git commit -m "test: skip user profile update test pending defect repair"
git push

# 4. Fix the defect (separate work)
# ... fix code ...

# 5. Re-enable test
# Remove .skip() and SKIP comment
git commit -m "test: re-enable user profile test after defect fix"
```

## Benefits

- ✅ CI/CD pipeline continues to function
- ✅ Defects are tracked and not forgotten
- ✅ Clear traceability between skipped tests and issues
- ✅ Forces accountability (skipped tests have issue IDs)
- ✅ Easy to find all skipped tests: `git grep "SKIP:"`

## Guidelines

### When to Skip
- Test infrastructure issues (database setup, environment config)
- Flaky tests that pass locally but fail in CI
- Tests for edge cases that don't block core functionality
- Tests that fail due to external service issues

### When NOT to Skip
- Critical security tests
- Core functionality tests
- Data integrity tests
- Tests that protect against regressions in main features

### Review Skipped Tests
- Weekly review of all skipped tests
- Run: `git grep -n "test.skip" tests/`
- Prioritize fixing tests that have been skipped longest

## Automation Opportunities

Future enhancements:
- Script to generate report of all skipped tests
- GitHub Action that comments on PRs with list of skipped tests
- Dashboard showing skipped test trends over time

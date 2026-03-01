# Test Failure Policy

## Overview
This policy defines how to handle test failures that are not in the critical deployment path, ensuring CI/CD pipeline progress while tracking defects for repair.

## Policy: Non-Critical Test Failures

### When Tests Fail Outside Critical Path

If tests fail that are **not blocking immediate deployment needs**, follow this workflow:

1. **Create VK Issue**
   - Use `mcp__vibe_kanban__create_issue` with title format: `[DEFECT] <test-name> - <brief description>`
   - Include in description:
     - Issue description and symptoms
     - Failure details (CI run URL, job ID, failed step)
     - Expected vs actual behavior
     - Impact on pipeline
     - Link to skipped test file/line

2. **Skip the Test Temporarily**
   - Mark test with `.skip()` in test file
   - Add comment referencing VK issue ID:
     ```typescript
     // SKIP: VK Issue f45fc8e5-9d16-4ef8-aaf7-b3c87322fa8d
     // [DEFECT] Integration tests failing - database connection issues
     test.skip('should do something', async () => {
       // test code
     });
     ```

3. **Commit the Skip**
   - Commit message: `test: skip <test-name> pending defect repair (VK-<issue-id>)`
   - This allows CI/CD pipeline to progress

4. **Fix the Defect**
   - Work on fix in separate branch/workspace
   - Follow standard defect repair workflow (see CLAUDE.md)
   - Ensure fix passes locally

5. **Re-enable the Test**
   - Remove `.skip()` from test
   - Remove skip comment
   - Verify test passes in CI

6. **Update VK Issue**
   - Use `mcp__vibe_kanban__update_issue` to mark status as "Done"
   - Add summary of fix in description
   - Include commit SHA that fixed it

## Critical Path Tests

Tests that **MUST NOT** be skipped (always block deployment):
- Security tests (auth, authorization, XSS, SQL injection)
- Data integrity tests (no data loss)
- Payment processing tests (Stripe integration)
- Core tenant isolation tests (multi-tenancy)

These tests should **always block** until fixed. Create VK issues but do not skip.

## Example Workflow

```bash
# 1. Test fails in CI - create VK issue
mcp__vibe_kanban__create_issue(
  project_id: "500e93c8-662d-4f9e-8745-ac4c259ead3c",
  title: "[DEFECT] User profile update test fails",
  description: "CI run: https://... \nExpected: ... \nActual: ..."
)
# Returns: { issue_id: "abc123..." }

# 2. Skip test locally
# Add to tests/integration/user-profile.test.ts:
# // SKIP: VK Issue abc123
# test.skip('should update user profile', async () => { ... })

# 3. Commit and push
git add tests/integration/user-profile.test.ts
git commit -m "test: skip user profile update test pending defect repair (VK-abc123)"
git push

# 4. Fix the defect (separate work)
# ... fix code ...

# 5. Re-enable test
# Remove .skip() and SKIP comment
git commit -m "test: re-enable user profile test after defect fix (VK-abc123)"

# 6. Update VK issue
mcp__vibe_kanban__update_issue(
  issue_id: "abc123",
  status: "Done",
  description: "Fixed in commit sha256:def456..."
)
```

## Benefits

- ✅ CI/CD pipeline continues to function
- ✅ Defects are tracked and not forgotten
- ✅ Clear traceability between skipped tests and issues
- ✅ Forces accountability (skipped tests have issue IDs)
- ✅ Easy to find all skipped tests: `git grep "SKIP: VK Issue"`

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
- Check VK issues for progress
- Prioritize fixing tests that have been skipped longest

## Automation Opportunities

Future enhancements:
- Pre-commit hook that requires VK issue ID in skip comments
- Script to generate report of all skipped tests and their VK issues
- GitHub Action that comments on PRs with list of skipped tests
- Dashboard showing skipped test trends over time

# Test-to-Jira Mapping Documentation

This document tracks the mapping between Playwright E2E tests and Jira QAlity test case issues.

## Overview

The Jira integration automatically posts test results as comments to linked Jira issues. To link a test to a Jira issue, include the issue key in the test title using the format `[ISSUE-KEY]`.

## Mapping Format

### Test Tagging Syntax

```typescript
test('[JIRA-KEY] Test description', async ({ page }) => {
  // Test implementation
});
```

**Examples:**
- `test('[KAN-2] Admin can create tenant', ...)`
- `test('[DIVE-10] User can book a dive trip', ...)`
- `test('[KAN-11] [KAN-12] Multi-issue test', ...)` (links to multiple issues)

### Multiple Jira Keys

A single test can be linked to multiple Jira issues:

```typescript
test('[KAN-2] [KAN-10] Complex workflow test', async ({ page }) => {
  // This test result will be posted to both KAN-2 and KAN-10
});
```

## Current Test Coverage

### E2E Test Files Summary

| Test File | Test Count | Status | Notes |
|-----------|------------|--------|-------|
| `00-full-workflow.spec.ts` | 230 | ✅ Active | Complete workflow coverage |
| `customer-management.spec.ts` | 46 | ✅ Active | Customer CRUD and details |
| `tours-management.spec.ts` | 60 | ✅ Active | Tour management workflows |
| `trips-scheduling.spec.ts` | 60 | ✅ Active | Trip scheduling and booking |
| `training-module.spec.ts` | 47 | ✅ Active | Training courses management |
| `public-site.spec.ts` | 40 | ✅ Active | Public-facing site tests |
| `regression-bugs.spec.ts` | 25 | ✅ Active | Bug regression tests |
| `embed-courses.spec.ts` | 21 | ✅ Active | Embedded course widget |
| `training-import.spec.ts` | 13 | ✅ Active | Training catalog import |
| `stripe-integration.spec.ts` | 1 | ⏳ Skipped | Stripe payments (CI skipped) |
| **Total** | **543** | | |

## Current Jira-Tagged Tests

### Full Workflow Tests (`tests/e2e/workflow/00-full-workflow.spec.ts`)

| Test Title | Jira Key(s) | Status | Notes |
|------------|-------------|--------|-------|
| Create tenant via signup | [KAN-2] | ✅ Active | Pilot test - tenant creation |
| Tenant dashboard navigation exists | [KAN-10] | ✅ Active | Pilot test - tenant dashboard |
| Create new customer | [KAN-11] | ✅ Active | Pilot test - customer management |

### Regression Tests (`tests/e2e/workflow/regression-bugs.spec.ts`)

| Bug Description | Jira Key(s) | Status | Notes |
|-----------------|-------------|--------|-------|
| Customer deletion 500 error | DIVE-w1s | ✅ Fixed | Cascade deletes implemented |
| Booking deletion 500 error | DIVE-237 | ✅ Fixed | Cascade deletes implemented |
| Discount code modal not closing | DIVE-ein | ✅ Fixed | Modal behavior corrected |
| Discount code update not working | DIVE-ka3 | ✅ Fixed | Update logic fixed |
| Product deletion modal not closing | DIVE-d4m | ✅ Fixed | Modal behavior corrected |
| Boat deletion only deactivating | DIVE-u07 | ✅ Fixed | True deletion implemented |
| Dive site deletion only deactivating | DIVE-9f5 | ✅ Fixed | True deletion implemented |
| Tour deletion only deactivating | DIVE-98t | ✅ Fixed | True deletion implemented |
| Gallery 404 route missing | DIVE-6l9 | ✅ Fixed | Route added |

### Tests Pending Jira Tagging

| Test File | Test Count | Status |
|-----------|------------|--------|
| customer-management.spec.ts | 46 | ⏳ Pending Phase 4+ |
| tours-management.spec.ts | 60 | ⏳ Pending Phase 4+ |
| trips-scheduling.spec.ts | 60 | ⏳ Pending Phase 4+ |
| training-module.spec.ts | 47 | ⏳ Pending Phase 4+ |
| public-site.spec.ts | 40 | ⏳ Pending Phase 4+ |
| training-import.spec.ts | 13 | ⏳ Pending Phase 4+ |
| embed-courses.spec.ts | 21 | ⏳ Pending Phase 4+ |

## Jira Issue Structure

### QAlity Test Cases

Jira issues used for test mapping should be QAlity test cases with the following structure:

- **Issue Type:** Test (QAlity test case)
- **Project:** Your project key (e.g., KAN, DIVE)
- **Summary:** Brief description of the test scenario
- **Description:** Detailed test steps and acceptance criteria
- **Labels:** `e2e`, `playwright`, `automated`

### Example Issue

```
Issue: KAN-2
Type: Test
Summary: Platform admin can create tenant
Description:
  Test that platform admin can successfully create a new tenant
  through the admin interface.

  Steps:
  1. Login as platform admin
  2. Navigate to tenant creation
  3. Fill in tenant details
  4. Submit form
  5. Verify tenant created

  Expected: Tenant successfully created and accessible

Labels: e2e, playwright, automated, pilot
```

## Test Result Format

When tests run, the reporter posts comments in this format:

```
✅ E2E Test Result: PASSED

Test: [KAN-2] Platform admin can create tenant
File: tests/e2e/workflow/full-workflow.spec.ts
Duration: 12.45s

🔗 CI Run #123 • Branch: staging

Posted: 2024-01-19T10:30:00Z
```

For failed tests:

```
❌ E2E Test Result: FAILED

Test: [KAN-2] Platform admin can create tenant
File: tests/e2e/workflow/full-workflow.spec.ts
Duration: 8.23s

Error:
Timeout 30000ms exceeded waiting for element "#tenant-name"

Stack Trace:
at Page.waitForSelector (...)
...

🔗 CI Run #123 • Branch: staging

Posted: 2024-01-19T10:30:00Z
```

## Mapping Process

### Phase 1: Setup (Current)
- ✅ Configure Jira integration scripts
- ✅ Set up CI/CD pipeline
- ✅ Tag 3 pilot tests

### Phase 2: Pilot Testing
- 🔄 Test integration with KAN-2, KAN-10, KAN-11
- 🔄 Verify comments post correctly
- 🔄 Validate result formatting

### Phase 3: Incremental Rollout
- ⏳ Map 5 tests per week
- ⏳ Focus on critical workflows first
- ⏳ Create corresponding Jira issues

### Phase 4: Full Coverage
- ⏳ Map all 543 E2E tests (currently 3 tagged)
- ⏳ Establish test case library in Jira
- ⏳ Create test execution reports

## Naming Conventions

### Jira Project Keys
- `KAN` - Kanban project (current pilot)
- `DIVE` - DiveStreams main project (future)
- Use consistent project key across all test cases

### Test Titles
- Start with Jira key in brackets: `[KAN-2]`
- Use descriptive action-based titles
- Follow pattern: `[KEY] Actor can/should action object`
- Examples:
  - `[KAN-2] Admin can create tenant`
  - `[KAN-10] User can view dashboard`
  - `[KAN-11] Manager can assign equipment`

### Labels
- `e2e` - All E2E tests
- `playwright` - Playwright-specific tests
- `automated` - Automated test cases
- `pilot` - Pilot phase tests
- `critical` - High-priority workflows
- `regression` - Regression test suite

## Maintenance

### Adding New Mappings

1. Create Jira test case issue
2. Tag Playwright test with issue key
3. Update this document
4. Run tests to verify integration

### Updating Mappings

1. Update test title with new/additional Jira key
2. Update this document
3. Re-run tests to post to new issue

### Removing Mappings

1. Remove Jira key from test title
2. Update this document
3. Add comment to Jira issue explaining removal

## Best Practices

1. **One-to-One Mapping**: Prefer one test to one Jira issue
2. **Meaningful Keys**: Use descriptive Jira issue summaries
3. **Keep Updated**: Update this document with every mapping change
4. **Test Locally First**: Run `npm run test:e2e:jira` before pushing
5. **Verify Issues Exist**: Ensure Jira issues exist before tagging tests
6. **Consistent Format**: Always use `[KEY]` format, not `KEY:` or `KEY-`

## Troubleshooting

### Test Not Reporting to Jira

**Check:**
1. Jira key format is correct: `[KAN-2]` not `KAN-2` or `[KAN2]`
2. Issue exists in Jira (use test-jira-connection.ts)
3. Reporter script ran (check CI logs)
4. JSON report was generated (test-results/results.json)

### Comment Not Visible in Jira

**Check:**
1. User has permission to view/add comments
2. Issue is not resolved/closed (may hide comments)
3. Check Jira activity log for the issue

### Duplicate Comments

**Check:**
1. Test ran multiple times (retries)
2. CI workflow triggered multiple times
3. Manual + CI runs both posted

## References

- [Jira REST API Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Playwright JSON Reporter](https://playwright.dev/docs/test-reporters#json-reporter)
- [GitHub Actions Context](https://docs.github.com/en/actions/learn-github-actions/contexts)

## Change Log

| Date | Author | Change | Jira Issue |
|------|--------|--------|------------|
| 2024-01-19 | Initial Setup | Created mapping document | - |
| 2024-01-19 | Initial Setup | Tagged pilot tests KAN-2, KAN-10, KAN-11 | - |
| 2026-01-24 | System | Updated test counts (543 total), added regression test mappings | - |
| 2026-01-24 | System | Route prefix changed from /app/ to /tenant/ | - |

---

**Last Updated:** 2026-01-24
**Maintainer:** DiveStreams Development Team
**Status:** Phase 2 - Pilot Testing Active

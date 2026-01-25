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



### Mappings Added 2026-01-25

#### 00-full-workflow.spec.ts

| Test ID | Jira Key | Description |
|---------|----------|-------------|
| 1.1 | KAN-49 | API health check passes... |
| 1.2 | KAN-50 | Home page loads... |
| 1.3 | KAN-51 | Marketing features section exists... |
| 1.4 | KAN-52 | Marketing pricing section exists... |
| 1.5 | KAN-53 | Marketing pages accessible... |



### Mappings Added 2026-01-25

#### 00-full-workflow.spec.ts

| Test ID | Jira Key | Description |
|---------|----------|-------------|
| 2.1 | KAN-54 | Signup page loads... |
| 2.2 | KAN-55 | Signup form has required fields... |
| 2.4 | KAN-56 | Signup validates subdomain format... |
| 2.5 | KAN-57 | Signup validates email format... |
| 3.1 | KAN-58 | Access new tenant subdomain... |
| 3.2 | KAN-59 | Tenant has login page... |
| 3.3 | KAN-60 | Tenant signup page loads... |
| 3.4 | KAN-61 | Create tenant user via signup... |
| 3.5 | KAN-62 | Login with tenant user... |
| 3.6 | KAN-63 | Login validates required email... |
| 3.7 | KAN-64 | Login validates required password... |
| 3.8 | KAN-65 | Login shows error for wrong credentials... |
| 3.9 | KAN-66 | Seed demo data for training tests... |
| 5.1 | KAN-67 | Admin login page loads... |
| 5.2 | KAN-68 | Admin login form works... |
| 5.3 | KAN-69 | Admin dashboard requires auth... |
| 5.4 | KAN-70 | Admin plans page requires auth... |
| 5.5 | KAN-71 | Admin tenant detail page requires auth... |
| 5.6 | KAN-72 | Admin tenants/new requires auth... |
| 5.7 | KAN-73 | Admin root requires auth... |
| 5.8 | KAN-74 | Admin shows error for wrong password... |
| 4.2 | KAN-75 | Customers page route exists... |
| 4.3 | KAN-76 | Trips page route exists... |
| 4.4 | KAN-77 | Bookings page route exists... |
| 4.5 | KAN-78 | Equipment page route exists... |
| 4.6 | KAN-79 | Boats page route exists... |
| 4.7 | KAN-80 | Tours page route exists... |
| 4.8 | KAN-81 | Dive sites page route exists... |
| 4.9 | KAN-82 | POS page route exists... |
| 4.10 | KAN-83 | Reports page route exists... |
| 6.1 | KAN-84 | Navigate to boats list page... |
| 6.2 | KAN-85 | Boats page has Add Boat button... |
| 6.3 | KAN-86 | Navigate to new boat form... |
| 6.4 | KAN-87 | New boat form has name field... |
| 6.5 | KAN-88 | New boat form has type field... |
| 6.6 | KAN-89 | New boat form has capacity field... |
| 6.7 | KAN-90 | New boat form has registration field... |
| 6.8 | KAN-91 | Create new boat... |
| 6.9 | KAN-92 | Boats list shows created boat... |
| 6.10 | KAN-93 | Boats page has search functionality... |
| 6.11 | KAN-94 | Boats page has stats cards... |
| 6.12 | KAN-95 | Navigate to boat detail page... |
| 6.13 | KAN-96 | Navigate to boat edit page... |
| 6.14 | KAN-97 | Boat edit has save button... |
| 6.15 | KAN-98 | Boats handles invalid ID gracefully... |
| 7.1 | KAN-99 | Navigate to tours list page... |
| 7.2 | KAN-100 | Tours page has Create Tour button... |
| 7.3 | KAN-101 | Navigate to new tour form... |
| 7.4 | KAN-102 | New tour form has name field... |
| 7.5 | KAN-103 | New tour form has price field... |
| 7.6 | KAN-104 | New tour form has duration field... |
| 7.7 | KAN-105 | New tour form has max participants field... |
| 7.8 | KAN-106 | Create new tour... |
| 7.9 | KAN-107 | Tours list shows created tour... |
| 7.10 | KAN-108 | Tours page has search functionality... |
| 7.11 | KAN-109 | Tours page has type filter... |
| 7.12 | KAN-110 | Navigate to tour detail page... |
| 7.13 | KAN-111 | Navigate to tour edit page... |
| 7.14 | KAN-112 | Tour edit save button exists... |
| 7.15 | KAN-113 | Tours handles invalid ID gracefully... |
| 8.1 | KAN-114 | Navigate to dive sites list page... |
| 8.2 | KAN-115 | Dive sites page has Add button... |
| 8.3 | KAN-116 | Navigate to new dive site form... |
| 8.4 | KAN-117 | New dive site form has name field... |
| 8.5 | KAN-118 | New dive site form has depth field... |
| 8.6 | KAN-119 | Create new dive site... |
| 8.7 | KAN-120 | Dive sites list shows sites... |
| 8.8 | KAN-121 | Navigate to dive site detail page... |
| 8.9 | KAN-122 | Navigate to dive site edit page... |
| 8.10 | KAN-123 | Dive sites handles invalid ID gracefully... |
| 9.1 | KAN-124 | Navigate to customers list page... |
| 9.2 | KAN-125 | Customers page has Add Customer button... |
| 9.3 | KAN-126 | Navigate to new customer form... |
| 9.4 | KAN-127 | New customer form has first name field... |
| 9.5 | KAN-128 | New customer form has last name field... |
| 9.6 | KAN-129 | New customer form has email field... |
| 9.7 | KAN-130 | New customer form has phone field... |
| 9.9 | KAN-131 | Customers list shows customers... |
| 9.10 | KAN-132 | Customers page has search functionality... |
| 9.11 | KAN-133 | Customers page has table headers... |
| 9.12 | KAN-134 | Navigate to customer detail page... |
| 9.13 | KAN-135 | Navigate to customer edit page... |
| 9.14 | KAN-136 | Customer detail shows customer info... |
| 9.15 | KAN-137 | Customers handles invalid ID gracefully... |
| 10.1 | KAN-138 | Navigate to equipment list page... |
| 10.2 | KAN-139 | Equipment page has Add button... |
| 10.3 | KAN-140 | Navigate to new equipment form... |
| 10.4 | KAN-141 | New equipment form has name field... |
| 10.5 | KAN-142 | New equipment form has category field... |
| 10.6 | KAN-143 | New equipment form has size field... |
| 10.7 | KAN-144 | New equipment form has price field... |
| 10.8 | KAN-145 | Create new equipment... |
| 10.9 | KAN-146 | Equipment list shows items... |
| 10.10 | KAN-147 | Equipment page has category filter... |
| 10.11 | KAN-148 | Equipment page has search... |
| 10.12 | KAN-149 | Navigate to equipment detail page... |
| 10.13 | KAN-150 | Navigate to equipment edit page... |
| 10.14 | KAN-151 | Equipment rentals tab exists... |
| 10.15 | KAN-152 | Equipment handles invalid ID gracefully... |
| 13.1 | KAN-153 | Navigate to discounts page... |
| 13.2 | KAN-154 | Discounts page has heading... |
| 13.3 | KAN-155 | Open new discount modal form... |
| 13.4 | KAN-156 | New discount modal has code field... |
| 13.5 | KAN-157 | New discount modal has discount value field... |
| 13.6 | KAN-158 | Create new discount via modal... |
| 13.7 | KAN-159 | Discounts list shows discount codes... |
| 13.8 | KAN-160 | View discount details via table row... |
| 13.9 | KAN-161 | Edit discount via Edit button... |
| 13.10 | KAN-162 | Discounts page handles being the only route... |
| 11.1 | KAN-163 | Navigate to trips list page... |
| 11.2 | KAN-164 | Trips page has Schedule Trip button... |
| 11.3 | KAN-165 | Navigate to new trip form... |
| 11.4 | KAN-166 | New trip form has date field... |
| 11.5 | KAN-167 | New trip form has tour selector... |
| 11.6 | KAN-168 | New trip form has boat selector... |
| 11.7 | KAN-169 | Create new trip... |
| 11.8 | KAN-170 | Trips list shows trips... |
| 11.9 | KAN-171 | Trips page has date filter... |
| 11.10 | KAN-172 | Trips page has status filter... |
| 11.11 | KAN-173 | Navigate to trip detail page... |
| 11.12 | KAN-174 | Navigate to trip edit page... |
| 11.13 | KAN-175 | Trip detail has manifest section... |
| 11.14 | KAN-176 | Trip edit has save button... |
| 11.15 | KAN-177 | Trips handles invalid ID gracefully... |
| 12.1 | KAN-178 | Navigate to bookings list page... |
| 12.2 | KAN-179 | Bookings page has New Booking button... |
| 12.3 | KAN-180 | Navigate to new booking form... |
| 12.4 | KAN-181 | New booking form has trip selector... |
| 12.5 | KAN-182 | New booking form has customer selector... |
| 12.6 | KAN-183 | New booking form has participants field... |
| 12.7 | KAN-184 | Create new booking... |
| 12.8 | KAN-185 | Bookings list shows bookings... |
| 12.9 | KAN-186 | Bookings page has search... |
| 12.10 | KAN-187 | Bookings page has status filter... |
| 12.11 | KAN-188 | Navigate to booking detail page... |
| 12.12 | KAN-189 | Navigate to booking edit page... |
| 12.13 | KAN-190 | Booking detail shows payment info... |
| 12.14 | KAN-191 | Booking edit has save button... |
| 12.15 | KAN-192 | Bookings handles invalid ID gracefully... |
| 14.1 | KAN-193 | Navigate to POS page... |
| 14.2 | KAN-194 | POS page has product/service list... |
| 14.3 | KAN-195 | POS page has cart section... |
| 14.4 | KAN-196 | POS page has customer selector... |
| 14.5 | KAN-197 | POS page has payment button... |
| 14.6 | KAN-198 | POS category tabs exist... |
| 14.7 | KAN-199 | POS search functionality... |
| 14.8 | KAN-200 | POS handles empty cart... |
| 14.9 | KAN-201 | POS discount code field... |
| 14.10 | KAN-202 | POS subtotal display... |
| 15.1 | KAN-203 | Navigate to reports page... |
| 15.2 | KAN-204 | Reports page has date range selector... |
| 15.3 | KAN-205 | Reports page has revenue section... |
| 15.4 | KAN-206 | Reports page has bookings stats... |
| 15.5 | KAN-207 | Reports page has export button... |
| 15.6 | KAN-208 | Reports page has customer stats... |
| 15.7 | KAN-209 | Reports page has charts... |
| 15.8 | KAN-210 | Reports handles empty data... |
| 15.9 | KAN-211 | Reports page has trip stats... |
| 15.10 | KAN-212 | Reports quick date presets... |
| 16.1 | KAN-213 | Navigate to settings page... |
| 16.2 | KAN-214 | Settings has shop name field... |
| 16.3 | KAN-215 | Settings has email field... |
| 16.4 | KAN-216 | Settings has phone field... |
| 16.5 | KAN-217 | Settings has currency selector... |
| 16.6 | KAN-218 | Settings has timezone selector... |
| 16.7 | KAN-219 | Settings has save button... |
| 16.8 | KAN-220 | Settings has address field... |
| 16.9 | KAN-221 | Settings has website field... |
| 16.10 | KAN-222 | Settings has logo upload... |
| 16.11 | KAN-223 | Settings has description field... |
| 16.12 | KAN-224 | Settings navigation tabs exist... |
| 16.13 | KAN-225 | Settings profile section... |
| 16.14 | KAN-226 | Settings booking options... |
| 16.15 | KAN-227 | Settings payment configuration... |
| 17.1 | KAN-228 | Navigate to calendar page... |
| 17.2 | KAN-229 | Calendar has month navigation... |
| 17.3 | KAN-230 | Calendar has today button... |
| 17.4 | KAN-231 | Calendar has view toggles... |
| 17.5 | KAN-232 | Calendar shows trips... |
| 17.6 | KAN-233 | Calendar date cells are clickable... |
| 17.7 | KAN-234 | Calendar shows current month name... |
| 17.8 | KAN-235 | Calendar handles empty state... |
| 18.1 | KAN-236 | Embed widget page loads... |
| 18.2 | KAN-237 | Embed widget shows tour selection... |
| 18.3 | KAN-238 | Embed widget shows tour duration... |
| 18.4 | KAN-239 | Embed widget shows tour availability... |
| 18.5 | KAN-240 | Embed widget has book/view button... |
| 18.6 | KAN-241 | Embed widget displays pricing... |
| 18.7 | KAN-242 | Embed widget shows tour type... |
| 18.8 | KAN-243 | Embed widget handles missing tenant... |
| 19.1 | KAN-244 | Admin login with correct password... |
| 19.2 | KAN-245 | Admin dashboard loads after login... |
| 19.3 | KAN-246 | Admin organizations list loads... |
| 19.4 | KAN-247 | Admin plans list loads... |
| 19.5 | KAN-248 | Admin can view tenant details... |
| 19.6 | KAN-249 | Admin dashboard has search... |
| 19.7 | KAN-250 | Admin dashboard has status filter... |
| 19.8 | KAN-251 | Admin plans page has create button... |
| 19.9 | KAN-252 | Admin can navigate to new plan form... |
| 19.10 | KAN-253 | Admin plan detail page loads... |
| 19.11 | KAN-254 | Admin dashboard has stats cards... |
| 19.12 | KAN-255 | Admin dashboard has recent activity... |
| 19.13 | KAN-256 | Admin navigation has logout... |
| 19.14 | KAN-257 | Admin organizations table shows data... |
| 19.15 | KAN-258 | Admin handles invalid routes... |
| 20.1 | KAN-259 | Dashboard loads after login... |
| 20.2 | KAN-260 | Dashboard has stats cards... |
| 20.3 | KAN-261 | Dashboard shows upcoming trips... |
| 20.4 | KAN-262 | Dashboard shows recent bookings... |
| 20.5 | KAN-263 | Dashboard has navigation sidebar... |
| 20.6 | KAN-264 | Dashboard sidebar has dashboard link... |
| 20.7 | KAN-265 | Dashboard sidebar has customers link... |
| 20.8 | KAN-266 | Dashboard sidebar has trips link... |
| 20.9 | KAN-267 | Dashboard sidebar has bookings link... |
| 20.10 | KAN-268 | Dashboard sidebar has settings link... |
| 20.11 | KAN-269 | Dashboard has user profile menu... |
| 20.12 | KAN-270 | Dashboard has logout option... |
| 20.13 | KAN-271 | Dashboard shows revenue stats... |
| 20.14 | KAN-272 | Dashboard shows customer count... |
| 20.15 | KAN-273 | Dashboard quick actions exist... |
| 20.16 | KAN-274 | Dashboard handles empty state gracefully... |
| 20.17 | KAN-275 | Dashboard is responsive... |
| 20.18 | KAN-276 | Dashboard charts load... |

#### customer-management.spec.ts

| Test ID | Jira Key | Description |
|---------|----------|-------------|
| A.1 | KAN-277 | Customers list page loads after login... |
| A.2 | KAN-278 | Customers list shows table layout... |
| A.3 | KAN-279 | Customers list has Add button... |
| A.4 | KAN-280 | Customers list displays customer names... |
| A.5 | KAN-281 | Customers list shows contact info... |
| A.6 | KAN-282 | Customers list has search field... |
| A.7 | KAN-283 | Customers list has action buttons... |
| A.8 | KAN-284 | Can navigate from dashboard to customers... |
| A.9 | KAN-285 | Customers list shows certification levels... |
| A.10 | KAN-286 | Customers list has pagination or scroll... |
| B.1 | KAN-287 | Navigate to new customer page... |
| B.2 | KAN-288 | New customer form loads... |
| B.3 | KAN-289 | New customer form has first name field... |
| B.4 | KAN-290 | New customer form has last name field... |
| B.5 | KAN-291 | New customer form has email field... |
| B.6 | KAN-292 | New customer form has phone field... |
| B.7 | KAN-293 | New customer form has emergency contact section... |
| B.8 | KAN-294 | New customer form has certification fields... |
| B.9 | KAN-295 | Create a new customer... |
| B.10 | KAN-296 | Created customer appears in list... |
| C.1 | KAN-297 | Navigate to customer edit page... |
| C.2 | KAN-298 | Edit customer form loads with existing data... |
| C.3 | KAN-299 | Edit form name fields have current values... |
| C.4 | KAN-300 | Can modify customer first name... |
| C.5 | KAN-301 | Can modify customer phone... |
| C.6 | KAN-302 | Edit form has save button... |
| C.7 | KAN-303 | Save customer changes... |
| C.8 | KAN-304 | Edit form has cancel option... |
| D.1 | KAN-305 | Navigate to customer detail page... |
| D.2 | KAN-306 | Detail page shows customer name... |
| D.3 | KAN-307 | Detail page shows contact information... |
| D.4 | KAN-308 | Detail page shows certification info... |
| D.5 | KAN-309 | Detail page shows emergency contact... |
| D.6 | KAN-310 | Detail page has edit button... |
| D.7 | KAN-311 | Detail page shows booking history... |
| D.8 | KAN-312 | Detail page shows customer notes section... |
| D.9 | KAN-313 | Detail page has back to list link... |
| D.10 | KAN-314 | Invalid customer ID shows error... |
| E.1 | KAN-315 | Customer detail shows total trips... |
| E.2 | KAN-316 | Customer detail shows upcoming bookings... |
| E.3 | KAN-317 | Customer detail shows past bookings... |
| E.4 | KAN-318 | Can add note to customer... |
| E.5 | KAN-319 | Customer list can be filtered by certification... |
| E.6 | KAN-320 | Can search customers by name... |
| E.7 | KAN-321 | Can search customers by email... |
| E.8 | KAN-322 | Customer detail has delete option... |

#### tours-management.spec.ts

| Test ID | Jira Key | Description |
|---------|----------|-------------|
| A.1 | KAN-323 | Tours list page loads after login... |
| A.2 | KAN-324 | Tours list shows table or grid layout... |
| A.3 | KAN-325 | Tours list has Add/Create button... |
| A.4 | KAN-326 | Tours list displays tour names... |
| A.5 | KAN-327 | Tours list shows pricing information... |
| A.6 | KAN-328 | Tours list shows tour type/category... |
| A.7 | KAN-329 | Tours list has action buttons... |
| A.8 | KAN-330 | Can navigate from dashboard to tours... |
| A.9 | KAN-331 | Tours list URL is correct... |
| A.10 | KAN-332 | Tours list responds to direct navigation... |
| B.1 | KAN-333 | Navigate to new tour page... |
| B.2 | KAN-334 | New tour form loads... |
| B.3 | KAN-335 | New tour form has name field... |
| B.4 | KAN-336 | New tour form has type selection... |
| B.5 | KAN-337 | New tour form has price field... |
| B.6 | KAN-338 | New tour form has duration field... |
| B.7 | KAN-339 | New tour form has max participants field... |
| B.8 | KAN-340 | New tour form has description field... |
| B.9 | KAN-341 | New tour form has requirements field... |
| B.10 | KAN-342 | Create a new tour... |
| B.11 | KAN-343 | Created tour appears in list... |
| B.12 | KAN-344 | New tour form has submit button... |
| C.1 | KAN-345 | Navigate to tour edit page... |
| C.2 | KAN-346 | Edit tour form loads with existing data... |
| C.3 | KAN-347 | Edit form name field has current value... |
| C.4 | KAN-348 | Can modify tour name... |
| C.5 | KAN-349 | Can modify tour price... |
| C.6 | KAN-350 | Can modify max participants... |
| C.7 | KAN-351 | Edit form has save button... |
| C.8 | KAN-352 | Save tour changes... |
| C.9 | KAN-353 | Updated values appear in list... |
| C.10 | KAN-354 | Edit form has cancel option... |
| D.1 | KAN-355 | Navigate to tour detail page... |
| D.2 | KAN-356 | Detail page shows tour name... |
| D.3 | KAN-357 | Detail page shows pricing info... |
| D.4 | KAN-358 | Detail page shows duration... |
| D.5 | KAN-359 | Detail page shows max participants... |
| D.6 | KAN-360 | Detail page shows description... |
| D.7 | KAN-361 | Detail page has edit button... |
| D.8 | KAN-362 | Detail page has back to list link... |
| D.9 | KAN-363 | Detail page shows related trips section... |
| D.10 | KAN-364 | Invalid tour ID shows error... |
| E.1 | KAN-365 | Tour has active/inactive status... |
| E.2 | KAN-366 | Can toggle tour status... |
| E.3 | KAN-367 | Tour detail has delete button... |
| E.4 | KAN-368 | Delete shows confirmation dialog... |
| E.5 | KAN-369 | Can cancel delete operation... |
| E.6 | KAN-370 | Tour list has quick actions... |
| E.7 | KAN-371 | Tour has duplicate option... |
| E.8 | KAN-372 | Duplicate creates copy... |
| E.9 | KAN-373 | Archived tours are hidden by default... |
| E.10 | KAN-374 | Can view archived tours... |
| F.1 | KAN-375 | Tours list has search field... |
| F.2 | KAN-376 | Can search tours by name... |
| F.3 | KAN-377 | Tours list has type filter... |
| F.4 | KAN-378 | Can filter by tour type... |
| F.5 | KAN-379 | Tours list has price range filter... |
| F.6 | KAN-380 | Can sort tours... |
| F.7 | KAN-381 | Empty search shows no results... |
| F.8 | KAN-382 | Can clear filters... |

#### trips-scheduling.spec.ts

| Test ID | Jira Key | Description |
|---------|----------|-------------|
| A.1 | KAN-383 | Trips page loads after login... |
| A.2 | KAN-384 | Trips page has calendar view option... |
| A.3 | KAN-385 | Trips page has list view option... |
| A.4 | KAN-386 | Can toggle between calendar and list views... |
| A.5 | KAN-387 | Trips page has Add/Schedule button... |
| A.6 | KAN-388 | Calendar shows current month... |
| A.7 | KAN-389 | Can navigate to next month... |
| A.8 | KAN-390 | Can navigate to previous month... |
| A.9 | KAN-391 | Trips page shows upcoming trips... |
| A.10 | KAN-392 | Can filter trips by status... |
| B.1 | KAN-393 | Navigate to new trip page... |
| B.2 | KAN-394 | New trip form loads... |
| B.3 | KAN-395 | New trip form has tour selection... |
| B.4 | KAN-396 | New trip form has date field... |
| B.5 | KAN-397 | New trip form has time field... |
| B.6 | KAN-398 | New trip form has capacity field... |
| B.7 | KAN-399 | New trip form has price field... |
| B.8 | KAN-400 | New trip form has boat selection... |
| B.9 | KAN-401 | New trip form has notes field... |
| B.10 | KAN-402 | Create a new trip... |
| B.11 | KAN-403 | Created trip appears in list... |
| B.12 | KAN-404 | New trip form has submit button... |
| C.1 | KAN-405 | Navigate to trip edit page... |
| C.2 | KAN-406 | Edit trip form loads with existing data... |
| C.3 | KAN-407 | Edit form date field has current value... |
| C.4 | KAN-408 | Can modify trip date... |
| C.5 | KAN-409 | Can modify trip time... |
| C.6 | KAN-410 | Can modify capacity... |
| C.7 | KAN-411 | Edit form has save button... |
| C.8 | KAN-412 | Save trip changes... |
| C.9 | KAN-413 | Updated values appear in detail view... |
| C.10 | KAN-414 | Edit form has cancel option... |
| D.1 | KAN-415 | Navigate to trip detail page... |
| D.2 | KAN-416 | Detail page shows trip date and time... |
| D.3 | KAN-417 | Detail page shows capacity info... |
| D.4 | KAN-418 | Detail page shows available spots... |
| D.5 | KAN-419 | Detail page shows pricing... |
| D.6 | KAN-420 | Detail page shows linked tour info... |
| D.7 | KAN-421 | Detail page has edit button... |
| D.8 | KAN-422 | Detail page shows bookings list... |
| D.9 | KAN-423 | Detail page has back to list link... |
| D.10 | KAN-424 | Invalid trip ID shows error... |
| E.1 | KAN-425 | Trip has status indicator... |
| E.2 | KAN-426 | Can change trip status... |
| E.3 | KAN-427 | Trip detail has cancel button... |
| E.4 | KAN-428 | Can mark trip as completed... |
| E.5 | KAN-429 | Completed trips show in history... |
| E.6 | KAN-430 | Can filter by trip status... |
| E.7 | KAN-431 | Trip detail has delete option... |
| E.8 | KAN-432 | Delete shows confirmation... |
| E.9 | KAN-433 | Trip list shows status badges... |
| E.10 | KAN-434 | Can export trip data... |
| F.1 | KAN-435 | Trip shows capacity utilization... |
| F.2 | KAN-436 | Trip shows when fully booked... |
| F.3 | KAN-437 | Can view participant list... |
| F.4 | KAN-438 | Can add booking from trip detail... |
| F.5 | KAN-439 | Trip prevents overbooking... |
| F.6 | KAN-440 | Trip shows waitlist option when full... |
| F.7 | KAN-441 | Can view booking details from trip... |
| F.8 | KAN-442 | Trip capacity updates dynamically... |

#### training-module.spec.ts

| Test ID | Jira Key | Description |
|---------|----------|-------------|
| A.1 | KAN-443 | Training dashboard loads after login... |
| A.2 | KAN-444 | Navigation link to courses works... |
| A.3 | KAN-445 | Navigation link to sessions works... |
| A.4 | KAN-446 | Navigation link to enrollments works... |
| A.5 | KAN-447 | Dashboard shows empty state or stats when no cours... |
| B.1 | KAN-448 | Navigate to courses list page... |
| B.2 | KAN-449 | Courses page has Add/Create Course button... |
| B.3 | KAN-450 | Navigate to new course form... |
| B.4 | KAN-451 | New course form has name field... |
| B.5 | KAN-452 | New course form has agency dropdown... |
| B.6 | KAN-453 | New course form has price field... |
| B.7 | KAN-454 | Create new course... |
| B.8 | KAN-455 | Courses list shows created course... |
| B.9 | KAN-456 | Navigate to course detail page... |
| B.10 | KAN-457 | Navigate to course edit page and verify save butto... |
| C.1 | KAN-458 | Navigate to sessions list page... |
| C.2 | KAN-459 | Sessions page shows calendar or list view... |
| C.3 | KAN-460 | Can access session creation from course detail... |
| C.4 | KAN-461 | Create a session for the course... |
| C.5 | KAN-462 | Session appears in sessions list... |
| C.6 | KAN-463 | View session detail page... |
| C.7 | KAN-464 | Session detail shows linked course info... |
| C.8 | KAN-465 | Session handles invalid ID gracefully... |
| D.1 | KAN-466 | Navigate to enrollments list page... |
| D.2 | KAN-467 | Enrollments page shows list or empty state... |
| D.3 | KAN-468 | Can initiate enrollment from course detail... |
| D.4 | KAN-469 | Create enrollment for course... |
| D.5 | KAN-470 | Enrollment appears in enrollments list... |
| D.6 | KAN-471 | View enrollment detail page... |
| D.7 | KAN-472 | Enrollment detail shows progress and status... |
| D.8 | KAN-473 | Enrollment handles invalid ID gracefully... |
| E.1 | KAN-474 | Navigate to agencies settings page... |
| E.2 | KAN-475 | Agencies page shows list or add option... |
| E.3 | KAN-476 | Can add a new agency... |
| E.4 | KAN-477 | Navigate to levels settings page... |
| E.5 | KAN-478 | Levels page shows list or add option... |
| E.6 | KAN-479 | Can add a new level... |
| F.1 | KAN-480 | Course form has isPublic toggle... |
| F.2 | KAN-481 | Course form has schedule type option... |
| F.3 | KAN-482 | Course detail shows enrollment count... |
| F.4 | KAN-483 | Course detail shows sessions list... |
| F.5 | KAN-484 | Course handles invalid ID gracefully... |
| G.1 | KAN-485 | Session detail has skill checkoff section... |
| G.2 | KAN-486 | Enrollment detail shows skills progress... |
| G.3 | KAN-487 | Enrollment detail has certification section... |
| G.4 | KAN-488 | Enrollment detail shows exam status... |
| G.5 | KAN-489 | Can update enrollment status... |

#### public-site.spec.ts

| Test ID | Jira Key | Description |
|---------|----------|-------------|
| A.1 | KAN-490 | Public site homepage loads... |
| A.2 | KAN-491 | Public site about page loads... |
| A.3 | KAN-492 | Public site contact page loads... |
| A.4 | KAN-493 | Public site trips page loads... |
| A.5 | KAN-494 | Public site courses page loads... |
| A.6 | KAN-495 | Trip detail page route works... |
| A.7 | KAN-496 | Course detail page route works... |
| A.8 | KAN-497 | Navigation between public pages works... |
| B.1 | KAN-498 | Registration page loads... |
| B.2 | KAN-499 | Registration form has required fields... |
| B.3 | KAN-500 | Register a new customer account... |
| B.4 | KAN-501 | Login page loads... |
| B.5 | KAN-502 | Login form has sign in button... |
| B.6 | KAN-503 | Login with registered credentials... |
| B.7 | KAN-504 | Invalid login shows error... |
| B.8 | KAN-505 | Login validates required email... |
| B.9 | KAN-506 | Login validates required password... |
| B.10 | KAN-507 | Registration form has password requirements... |
| C.1 | KAN-508 | Account dashboard requires authentication... |
| C.2 | KAN-509 | Account dashboard loads after login... |
| C.3 | KAN-510 | Account dashboard shows bookings section... |
| C.4 | KAN-511 | Bookings page loads... |
| C.6 | KAN-512 | Profile page has editable fields... |
| C.7 | KAN-513 | Profile page has save button... |
| C.8 | KAN-514 | Logout works... |
| D.1 | KAN-515 | Booking route for trip exists... |
| D.2 | KAN-516 | Booking route for course exists... |
| D.3 | KAN-517 | Booking page requires authentication... |
| D.4 | KAN-518 | Booking flow starts from trip detail... |
| D.5 | KAN-519 | Booking page shows trip details... |
| D.6 | KAN-520 | Booking page has participant selection... |
| D.7 | KAN-521 | Confirm booking route exists... |
| D.8 | KAN-522 | Booking shows price calculation... |
| E.1 | KAN-523 | Public site settings requires staff auth... |
| E.2 | KAN-524 | Navigate to public site settings... |
| E.6 | KAN-525 | Content settings page loads... |
| E.7 | KAN-526 | Appearance settings page loads... |
| E.8 | KAN-527 | Appearance settings has color options... |
| E.9 | KAN-528 | Settings have save button... |
| E.10 | KAN-529 | Can navigate between settings tabs... |

#### regression-bugs.spec.ts

| Test ID | Jira Key | Description |
|---------|----------|-------------|
| A.1 | KAN-530 | Create test customer for deletion testing... |
| A.2 | KAN-531 | Create test booking for deletion testing... |
| A.3 | KAN-532 | Customer deletion succeeds without 500 error... |
| A.4 | KAN-533 | Booking deletion succeeds without 500 error... |
| A.5 | KAN-534 | Cascade delete removes related records... |
| B.1 | KAN-535 | Navigate to discount codes page... |
| B.2 | KAN-536 | Create discount code - modal closes after success... |
| B.3 | KAN-537 | Update discount code - modal closes after success... |
| B.4 | KAN-538 | Delete discount code - modal closes after success... |
| C.1 | KAN-539 | Create test product... |
| C.2 | KAN-540 | Delete product - modal closes after success... |
| D.1 | KAN-541 | Create and delete boat - actually deletes... |
| D.2 | KAN-542 | Create and delete dive site - actually deletes... |
| D.3 | KAN-543 | Create and delete tour - actually deletes... |
| E.1 | KAN-544 | Gallery list page loads... |
| E.2 | KAN-545 | Gallery list shows content or empty state... |
| E.3 | KAN-546 | Gallery new page loads... |
| E.4 | KAN-547 | Gallery detail route works... |
| F.1 | KAN-548 | Public site appearance page loads... |
| F.2 | KAN-549 | Theme selection updates visually... |
| F.3 | KAN-550 | Color picker updates preview live... |
| F.4 | KAN-551 | Font selection updates visually... |
| F.5 | KAN-552 | Preview button links to correct URL... |
| F.6 | KAN-553 | General settings page does not crash on navigation... |
| F.7 | KAN-554 | Page toggles work after save... |

#### embed-courses.spec.ts

| Test ID | Jira Key | Description |
|---------|----------|-------------|
| A.1 | KAN-555 | Course listing page loads... |
| A.2 | KAN-556 | Course listing shows course cards or empty state... |
| A.3 | KAN-557 | Course cards show agency and level badges... |
| A.4 | KAN-558 | Course cards link to detail pages... |
| B.1 | KAN-559 | Course detail page loads... |
| B.2 | KAN-560 | Course detail shows agency and level info... |
| B.3 | KAN-561 | Course detail shows course stats (days, students, ... |
| B.4 | KAN-562 | Course detail lists available training sessions... |
| B.5 | KAN-563 | Sessions show enroll buttons with available spots... |
| C.1 | KAN-564 | Enrollment form requires session ID... |
| C.2 | KAN-565 | Enrollment form loads with valid session ID... |
| C.3 | KAN-566 | Enrollment form has required fields... |
| C.4 | KAN-567 | Enrollment form has optional fields... |
| C.5 | KAN-568 | Enrollment form shows session details in sidebar... |
| C.6 | KAN-569 | Enrollment form validates required fields... |
| C.7 | KAN-570 | Enrollment form validates email format... |
| C.8 | KAN-571 | Enrollment form submits successfully... |
| D.1 | KAN-572 | Confirmation page loads with enrollment ID... |
| D.2 | KAN-573 | Confirmation page shows success message... |
| D.3 | KAN-574 | Confirmation page shows enrollment details... |
| D.4 | KAN-575 | Confirmation page has action buttons... |

#### training-import.spec.ts

| Test ID | Jira Key | Description |
|---------|----------|-------------|
| A.1 | KAN-576 | Navigate to training import from dashboard... |
| B.1 | KAN-577 | Step 1: Select agency displays correctly... |
| B.2 | KAN-578 | Step 1: Cannot submit without selecting agency... |
| C.1 | KAN-579 | Step 2: Select courses after choosing agency... |
| C.2 | KAN-580 | Step 2: Select All and Select None buttons work... |
| C.3 | KAN-581 | Step 2: Individual course selection toggles correc... |
| C.4 | KAN-582 | Step 2: Cannot proceed without selecting courses... |
| C.5 | KAN-583 | Step 2: Course cards display all information... |
| D.1 | KAN-584 | Step 3: Preview displays after selecting courses... |
| D.2 | KAN-585 | Step 3: Import button is enabled when courses sele... |
| D.3 | KAN-586 | Step 3: What will happen section displays correctl... |
| E.1 | KAN-587 | Progress indicator shows current step... |
| E.2 | KAN-588 | Back button navigation works... |

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

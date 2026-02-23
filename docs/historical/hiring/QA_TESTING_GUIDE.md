# DiveStreams QA Testing Guide
## Manual Testing Procedures

Welcome to the DiveStreams QA team! This guide provides everything you need to perform manual testing of the DiveStreams platform.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Environment Setup](#2-environment-setup)
3. [Jira Workflow](#3-jira-workflow)
4. [Test Execution Process](#4-test-execution-process)
5. [Bug Reporting](#5-bug-reporting)
6. [Testing Guidelines by Module](#6-testing-guidelines-by-module)
7. [Browser & Device Testing](#7-browser--device-testing)
8. [Daily Workflow](#8-daily-workflow)
9. [Communication](#9-communication)
10. [FAQ](#10-faq)

---

## 1. Getting Started

### First Day Checklist

- [ ] Receive staging environment credentials
- [ ] Receive Jira access invitation
- [ ] Join Slack channel (or preferred communication tool)
- [ ] Read the [Users Guide](../USERS_GUIDE.md)
- [ ] Log into staging environment and explore the app
- [ ] Review your assigned test cases in Jira
- [ ] Set up your testing environment (browsers, screen recording)

### Key Resources

| Resource | Location |
|----------|----------|
| Staging App | https://demo.staging.divestreams.com |
| Jira Project | https://divestreams.atlassian.net/browse/KAN |
| Users Guide | `docs/USERS_GUIDE.md` |
| Test-Jira Mapping | `docs/test-jira-mapping.md` |

---

## 2. Environment Setup

### Staging Environment

**URL:** `https://demo.staging.divestreams.com`

The staging environment is a complete copy of the production system with test data. You can create, modify, and delete data freely - it resets periodically.

### Test Accounts

You will receive credentials for:

| Account Type | Purpose |
|--------------|---------|
| Admin Account | Full access to all features |
| Staff Account | Limited permissions testing |
| Customer Account | Public booking flow testing |

### Browser Setup

Install and test on:
- Google Chrome (latest) - **Primary browser**
- Mozilla Firefox (latest)
- Safari (latest, if on Mac)
- Microsoft Edge (latest)

**Recommended Chrome Extensions:**
- Window Resizer (for viewport testing)
- Full Page Screen Capture (for bug reports)
- JSON Viewer (for API responses)

### Viewport Sizes to Test

| Device | Width | Height |
|--------|-------|--------|
| Desktop Large | 1920px | 1080px |
| Desktop | 1440px | 900px |
| Tablet Landscape | 1024px | 768px |
| Tablet Portrait | 768px | 1024px |
| Mobile | 375px | 812px |

---

## 3. Jira Workflow

### Project Structure

- **Project Key:** KAN
- **Test Cases:** KAN-49 through KAN-588 (540 test cases)
- **Issue Type:** Task (each represents one test case)

### Test Case Format

Each Jira issue contains:

```
Title: [KAN-XXX] Test ID - Test Description
Description:
  - Test file reference
  - Steps to execute
  - Expected result
  - Preconditions (if any)
Labels: test-case, [module-name]
```

### Issue Status Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   To Do     │────▶│ In Progress │────▶│    Done     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Blocked   │
                    └─────────────┘
```

| Status | When to Use |
|--------|-------------|
| **To Do** | Test not yet started |
| **In Progress** | Currently executing the test |
| **Done** | Test passed successfully |
| **Blocked** | Cannot test due to bug or dependency |

### Recording Results

For each test case, add a **comment** with:

```markdown
**Test Result:** PASS / FAIL
**Date:** YYYY-MM-DD
**Browser:** Chrome 120
**Viewport:** 1440x900

**Steps Performed:**
1. Navigated to /tenant/customers
2. Clicked "Add Customer" button
3. Filled in required fields
4. Clicked "Save"

**Actual Result:** Customer created successfully
**Notes:** (any observations)
```

For **FAIL** results, also:
1. Create a new bug issue (see Section 5)
2. Link the bug to the test case
3. Set test case status to "Blocked"

---

## 4. Test Execution Process

### Daily Testing Flow

```
1. Open Jira → Filter by "To Do" status
2. Select a test case → Move to "In Progress"
3. Read the test case description
4. Execute the test in staging environment
5. Document the result as a comment
6. Update status (Done/Blocked)
7. Repeat
```

### Test Case Naming Convention

Test IDs follow this pattern: `[Section].[Number]`

| Prefix | Module |
|--------|--------|
| 1.x - 3.x | Initial Setup & Admin |
| 4.x - 9.x | Tenant Dashboard & Core Features |
| 10.x - 15.x | Customer Management |
| 16.x - 20.x | Bookings |
| A.x, B.x, C.x | Regression Tests |

### Execution Priority

Execute tests in this order:

1. **Critical Path (Week 1)**
   - Full Workflow tests (KAN-49 to KAN-279) - Tests the entire user journey
   - Regression tests (KAN-530 to KAN-554) - Known bug areas

2. **Core Features (Week 1-2)**
   - Tours Management (KAN-280 to KAN-339)
   - Trips Scheduling (KAN-340 to KAN-399)
   - Training Module (KAN-447 to KAN-493)

3. **Supporting Features (Week 2)**
   - Customer Management (KAN-400 to KAN-446)
   - Public Site (KAN-494 to KAN-529)
   - Embedded Courses (KAN-555 to KAN-575)
   - Training Import (KAN-576 to KAN-588)

---

## 5. Bug Reporting

### When to Create a Bug

Create a bug report when:
- Expected result doesn't match actual result
- Application crashes or shows error
- UI is broken or unusable
- Data is not saved correctly
- Performance is unacceptably slow (>5 seconds)

### Bug Report Template

Create a new Jira issue with type "Bug":

```markdown
**Summary:** [Module] Brief description of the issue

**Environment:**
- URL: https://demo.staging.divestreams.com
- Browser: Chrome 120.0.6099.109
- OS: macOS 14.2
- Viewport: 1440x900

**Steps to Reproduce:**
1. Log in as admin user
2. Navigate to /tenant/customers
3. Click "Add Customer"
4. Enter email "test@example.com"
5. Click "Save"

**Expected Result:**
Customer should be created and appear in the list

**Actual Result:**
Error message "Failed to create customer" appears
Console shows 500 Internal Server Error

**Severity:** Critical / Major / Minor / Trivial

**Screenshots/Video:**
[Attach screenshots or screen recording]

**Console Errors:**
```
[Paste any browser console errors]
```

**Related Test Case:** KAN-XXX
```

### Severity Definitions

| Severity | Definition | Example |
|----------|------------|---------|
| **Critical** | App unusable, data loss, security issue | Cannot log in, payment fails |
| **Major** | Feature broken, no workaround | Cannot create bookings |
| **Minor** | Feature broken, workaround exists | Filter doesn't work but search does |
| **Trivial** | Cosmetic, typo, minor UI issue | Button misaligned |

### Bug Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Open     │────▶│  In Review  │────▶│   Fixed     │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Reopened   │◀────│  Verified   │
                    └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Closed    │
                                        └─────────────┘
```

When a bug is marked "Fixed":
1. Re-test the scenario
2. If fixed → Move to "Verified" → "Closed"
3. If not fixed → Move to "Reopened" with comment

---

## 6. Testing Guidelines by Module

### Dashboard (Tests 4.x)

**What to verify:**
- KPIs display correct numbers
- Recent bookings list is accurate
- Quick action buttons work
- Page loads within 3 seconds

**Test data needed:** Existing bookings, customers

---

### Customer Management (Tests 9.x - 15.x)

**What to verify:**
- Create, read, update, delete customers
- Search and filter functionality
- Customer profile displays all info
- Certification tracking works
- Email validation

**Edge cases to test:**
- Duplicate email addresses
- Special characters in names
- Empty required fields
- Very long text inputs

---

### Bookings (Tests 16.x - 20.x)

**What to verify:**
- Create booking flow
- Booking status changes (Pending → Confirmed → Completed)
- Email notifications sent
- Calendar integration
- Cancellation flow

**Edge cases to test:**
- Booking for past dates
- Overbooking (exceeding capacity)
- Booking without customer
- Payment edge cases

---

### Tours & Trips (Tests in tours-management, trips-scheduling)

**What to verify:**
- Create tour templates
- Schedule trips from tours
- Capacity management
- Pricing calculations
- Date/time handling

**Edge cases to test:**
- Overlapping trips
- Zero capacity
- Invalid date ranges

---

### Training Module (Tests in training-module)

**What to verify:**
- Course catalog display
- Session scheduling
- Student enrollment
- Progress tracking
- Certificate generation

**Agencies to test:** PADI, SSI, NAUI

---

### Public Site (Tests in public-site)

**What to verify:**
- Public pages load without auth
- Booking widget works
- Contact form submission
- SEO elements present
- Mobile responsiveness

---

### POS (Premium Feature)

**Note:** This feature requires a premium subscription. Verify the feature is locked for free plans and accessible for premium.

---

## 7. Browser & Device Testing

### Cross-Browser Test Matrix

| Test Area | Chrome | Firefox | Safari | Edge |
|-----------|--------|---------|--------|------|
| Login/Auth | ✓ | ✓ | ✓ | ✓ |
| Dashboard | ✓ | ✓ | ○ | ○ |
| Forms | ✓ | ✓ | ✓ | ○ |
| Bookings | ✓ | ✓ | ○ | ○ |
| Reports | ✓ | ○ | ○ | ○ |

✓ = Full testing required
○ = Smoke testing only

### Responsive Testing Checklist

For each major page, verify at mobile viewport (375px):

- [ ] Navigation menu collapses to hamburger
- [ ] Tables scroll horizontally or stack
- [ ] Forms are usable (inputs not cut off)
- [ ] Buttons are tap-friendly (min 44px)
- [ ] Text is readable without zooming
- [ ] Images scale appropriately

---

## 8. Daily Workflow

### Morning (Start of Day)

1. Check Slack for any announcements
2. Review any bugs marked "Fixed" - verify them
3. Check for new deployments to staging
4. Plan which test cases to execute today

### During Testing

1. Keep Jira updated in real-time
2. Take screenshots as you go
3. Note any observations or concerns
4. Ask questions in Slack if blocked

### End of Day

Post a brief status update:

```
**QA Status Update - [Date]**

Tests Executed: XX
Passed: XX
Failed: XX
Blocked: XX

Bugs Found Today: X
- KAN-XXX: Brief description
- KAN-XXX: Brief description

Blockers: None / [Description]

Tomorrow's Focus: [Module/Area]
```

---

## 9. Communication

### Slack Channels

| Channel | Purpose |
|---------|---------|
| #qa-testing | Daily updates, questions, discussions |
| #bugs | Bug discussions and triage |
| #deployments | Staging deployment notifications |

### Response Times

- Questions: Within 4 hours during business days
- Critical bugs: Immediate notification
- Status updates: Daily

### Escalation

If you're blocked for more than 4 hours:
1. Post in Slack with details
2. Tag the project lead
3. Document the blocker in Jira

---

## 10. FAQ

**Q: What if a test case description is unclear?**
A: Add a comment on the Jira issue asking for clarification and tag the project lead.

**Q: Can I modify test data in staging?**
A: Yes, staging is for testing. Create, modify, and delete freely.

**Q: What if I find a bug not related to a test case?**
A: Great catch! Create a bug report and label it "exploratory-testing".

**Q: How often is staging updated?**
A: Typically daily. Check #deployments for notifications.

**Q: What if the same bug affects multiple test cases?**
A: Create one bug report and link it to all affected test cases.

**Q: Should I test with slow network conditions?**
A: Yes, occasionally test with Chrome DevTools throttling set to "Slow 3G".

**Q: What timezone should I use for dates?**
A: Use the timezone configured in the test account (typically UTC or your local time).

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│                 QA QUICK REFERENCE                      │
├─────────────────────────────────────────────────────────┤
│ Staging URL:    https://demo.staging.divestreams.com    │
│ Jira Project:   KAN                                     │
│ Test Cases:     KAN-49 to KAN-588                       │
├─────────────────────────────────────────────────────────┤
│ PASS → Status: Done + Comment with result               │
│ FAIL → Status: Blocked + Create Bug + Link to test      │
├─────────────────────────────────────────────────────────┤
│ Bug Severity:   Critical > Major > Minor > Trivial      │
├─────────────────────────────────────────────────────────┤
│ Daily Update:   Post in #qa-testing at end of day       │
└─────────────────────────────────────────────────────────┘
```

---

**Last Updated:** January 2026
**Version:** 1.0
**Maintainer:** DiveStreams Development Team

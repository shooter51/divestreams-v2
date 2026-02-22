# QA Contractor Onboarding Checklist
## What You Need to Provide

Use this checklist to prepare everything the QA contractor needs before they start.

---

## 1. Jira Access

### Setup Steps

1. Go to https://divestreams.atlassian.net/jira/people
2. Click "Invite people"
3. Enter the contractor's email
4. Assign role: **Basic User** (can view, comment, transition issues)
5. Grant access to project: **KAN**

### Permissions Needed

| Permission | Required |
|------------|----------|
| Browse Projects | ✓ |
| Create Issues (for bugs) | ✓ |
| Edit Issues | ✓ |
| Transition Issues | ✓ |
| Add Comments | ✓ |
| Manage Sprints | ✗ |
| Administer Project | ✗ |

**Your Jira URL:** `https://divestreams.atlassian.net`
**Project Key:** `KAN`
**Test Cases:** `KAN-49` through `KAN-588`

---

## 2. Staging Environment Credentials

### Create Test Accounts

Create these accounts on staging for the contractor:

#### Admin Account (Full Access)
```
URL: https://demo.staging.divestreams.com
Email: qa-admin@divestreams.com (or contractor's email)
Password: [Generate secure password]
Role: Admin
```

#### Staff Account (Limited Access)
```
URL: https://demo.staging.divestreams.com
Email: qa-staff@divestreams.com
Password: [Generate secure password]
Role: Staff
```

#### Customer Account (Public Booking)
```
URL: https://demo.staging.divestreams.com/book
Email: qa-customer@example.com
Password: [Generate secure password]
```

### How to Create Accounts

**For Admin/Staff accounts:**
1. Log into staging as admin
2. Go to Settings → Team Management
3. Click "Invite Team Member"
4. Enter email and select role
5. Send invitation

**For Customer account:**
1. Go to public booking page
2. Create a test booking
3. Use the customer portal credentials

---

## 3. Communication Setup

### Option A: Slack (Recommended)

1. Create a Slack channel: `#qa-testing`
2. Invite the contractor as a guest
3. Also add them to `#bugs` if it exists

**Slack Workspace:** [Your workspace URL]

### Option B: Email

If not using Slack, establish:
- Primary contact email
- Expected response time (e.g., within 4 hours)
- Daily status update schedule

### Option C: Other Tools

- Microsoft Teams
- Discord
- Basecamp
- Asana

---

## 4. Documentation Access

### Files to Share

Share these files with the contractor (via Google Drive, Dropbox, or direct):

| Document | Location | Purpose |
|----------|----------|---------|
| Users Guide | `docs/USERS_GUIDE.md` | Learn the application |
| QA Testing Guide | `docs/hiring/QA_TESTING_GUIDE.md` | Testing procedures |
| Test-Jira Mapping | `docs/test-jira-mapping.md` | Test case reference |

### Option: Give Read Access to Repo

If you want them to see test files directly:

1. Add as GitHub collaborator (read-only)
2. Repo: `https://github.com/shooter51/divestreams-v2`
3. They can view: `tests/e2e/workflow/*.spec.ts`

**Note:** This is optional. The Jira issues contain all necessary test information.

---

## 5. Credentials Summary Template

Copy and fill in this template to send to your contractor:

```
═══════════════════════════════════════════════════════════
         DIVESTREAMS QA TESTING - ACCESS CREDENTIALS
═══════════════════════════════════════════════════════════

STAGING ENVIRONMENT
───────────────────
URL: https://demo.staging.divestreams.com

Admin Account:
  Email: ______________________
  Password: ______________________

Staff Account:
  Email: ______________________
  Password: ______________________


JIRA ACCESS
───────────────────
URL: https://divestreams.atlassian.net
Project: KAN
Test Cases: KAN-49 through KAN-588 (540 total)

You will receive an email invitation to join Jira.


COMMUNICATION
───────────────────
Slack Workspace: ______________________
Channel: #qa-testing

Primary Contact: ______________________
Email: ______________________


DOCUMENTATION
───────────────────
Testing Guide: [Link to QA_TESTING_GUIDE.md]
Users Guide: [Link to USERS_GUIDE.md]


TIMELINE
───────────────────
Start Date: ______________________
Expected Completion: ______________________
Daily Standup Time: ______________________ (optional)


PAYMENT
───────────────────
Hourly Rate: $______
Invoice Frequency: Weekly / Bi-weekly / On completion
Payment Method: ______________________

═══════════════════════════════════════════════════════════
```

---

## 6. Pre-Start Checklist

Complete these items before the contractor starts:

### Jira
- [ ] Contractor invited to Jira
- [ ] Contractor accepted invitation
- [ ] Contractor can view KAN project
- [ ] Contractor can create issues (test with a dummy issue)

### Staging Environment
- [ ] Admin account created and tested
- [ ] Staff account created and tested
- [ ] Staging environment is stable
- [ ] Test data is populated (customers, bookings, etc.)

### Communication
- [ ] Slack channel created OR email thread established
- [ ] Contractor added to communication channel
- [ ] Introduced contractor to team (if applicable)

### Documentation
- [ ] Shared Users Guide
- [ ] Shared QA Testing Guide
- [ ] Shared this onboarding checklist

### Administrative
- [ ] Contract/agreement signed
- [ ] Payment terms agreed
- [ ] Start date confirmed
- [ ] NDA signed (if required)

---

## 7. First Day Call Agenda (Optional)

Consider a 30-minute kickoff call:

1. **Introductions** (5 min)
2. **Project Overview** (5 min)
   - What DiveStreams does
   - Current state of the project
   - Goals for QA testing
3. **Environment Walkthrough** (10 min)
   - Log into staging together
   - Quick tour of main features
   - Show where test data is
4. **Jira Walkthrough** (5 min)
   - Show test cases
   - Explain workflow
   - Show how to report bugs
5. **Questions & Next Steps** (5 min)

---

## 8. Ongoing Support

### Weekly Check-ins

Schedule a brief weekly sync:
- Review progress
- Discuss blockers
- Prioritize remaining work
- Answer questions

### Bug Triage

Decide who triages bugs:
- [ ] You review all bugs before dev team
- [ ] Contractor assigns severity, dev team reviews
- [ ] Auto-assign to dev team

### Deployment Notifications

Ensure contractor knows when staging is updated:
- [ ] Add to #deployments channel
- [ ] Email notification
- [ ] They check manually each morning

---

## 9. Security Reminders

Share these guidelines with the contractor:

1. **Do not share credentials** with anyone
2. **Do not test on production** - staging only
3. **Do not export customer data** (even test data)
4. **Report any security issues** immediately as Critical bugs
5. **Use secure password storage** (1Password, Bitwarden, etc.)

---

## Quick Actions Summary

| Action | Where | Notes |
|--------|-------|-------|
| Invite to Jira | divestreams.atlassian.net | Basic user role |
| Create staging accounts | demo.staging.divestreams.com | Admin + Staff |
| Add to Slack | Your workspace | Guest access to #qa-testing |
| Share docs | Google Drive / Email | Testing guide + Users guide |
| Schedule kickoff | Calendar | 30 min video call |

---

**Ready to onboard!** Once all items are checked, send the credentials template to your contractor and schedule the kickoff call.

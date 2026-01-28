# Infrastructure Configuration Fixes

**Date:** 2026-01-28
**Related Issues:** DIVE-403 (B2), DIVE-844 (SMTP), DIVE-yzh (subscription planId)
**Status:** Code fixes committed, infrastructure config requires manual updates

---

## Overview

Three P0 infrastructure issues were identified during Jira review and peer review. One requires code changes (COMPLETED), two require GitHub secret/VPS configuration updates (REQUIRES ACTION).

---

## 1. B2 Storage Configuration (DIVE-403, KAN-608, KAN-609)

### Problem
Image uploads fail on staging VPS with 503 error: "Image storage is not configured"

### Root Cause
GitHub secret `B2_ENDPOINT` is missing the `https://` protocol scheme, causing S3Client initialization to fail.

**Current value:**
```
B2_ENDPOINT=s3.us-west-000.backblazeb2.com
```

**Required value:**
```
B2_ENDPOINT=https://s3.us-west-000.backblazeb2.com
```

### Fix Required

#### Step 1: Update GitHub Secret

```bash
gh secret set B2_ENDPOINT \
  --body "https://s3.us-west-000.backblazeb2.com" \
  --repo shooter51/divestreams-v2
```

**Verify:**
```bash
gh secret list --repo shooter51/divestreams-v2 | grep B2_
```

#### Step 2: Trigger Deployment

```bash
# From project root
git commit --allow-empty -m "chore: trigger staging deployment after B2_ENDPOINT fix"
git push origin staging
```

The CI/CD workflow will:
1. Update `/docker/divestreams-staging/.env` with corrected B2_ENDPOINT
2. Restart containers
3. Verify B2 storage configuration (automatic check in workflow)

#### Step 3: Verify Fix

**SSH into staging VPS:**
```bash
ssh root@76.13.28.28

# Check endpoint has https://
cd /docker/divestreams-staging
grep B2_ENDPOINT .env
# Should show: B2_ENDPOINT=https://s3.us-west-000.backblazeb2.com

# Check app logs for successful S3 connection
docker compose logs app | grep -i 'B2\|S3' | tail -20
# Should NOT show: "B2 storage not configured"
```

**Test image upload:**
1. Navigate to https://staging.divestreams.com
2. Upload image to boat details page
3. Upload image to equipment details page
4. Images should upload successfully without 503 error

#### Step 4: Update Jira

- KAN-608 → "Done" (boat images upload)
- KAN-609 → "Done" (equipment images upload)
- DIVE-403 → Close in Beads (`bd close DIVE-403`)

---

## 2. SMTP Worker Credentials (DIVE-844, KAN-592)

### Problem
Emails are not sent from staging/production. Worker logs show: "SMTP not fully configured - missing required credentials"

### Root Cause
VPS `.env` files are missing SMTP provider credentials (SMTP_HOST, SMTP_USER, SMTP_PASS). Docker Compose passes empty strings to worker container, so emails are logged instead of sent.

### Fix Required

#### Step 1: Choose SMTP Provider

**Options:**
- **SendGrid** (recommended for production)
- **Gmail SMTP** (good for testing)
- **AWS SES**
- **Mailgun**

#### Step 2: Add Credentials to VPS .env Files

**Staging VPS (1271895):**
```bash
ssh root@76.13.28.28
cd /docker/divestreams-staging
nano .env
```

**Production VPS (1239852):**
```bash
ssh root@72.62.166.128
cd /docker/divestreams-v2
nano .env
```

**Add these lines:**
```bash
# SMTP Configuration
SMTP_HOST=smtp.sendgrid.net          # or smtp.gmail.com, etc.
SMTP_PORT=587                         # 587 for TLS, 465 for SSL
SMTP_USER=apikey                      # Provider username
SMTP_PASS=SG.xxxxxxxxxxxxx           # Provider API key/password
SMTP_FROM=noreply@divestreams.com    # Sender email
SMTP_FROM_NAME=DiveStreams           # Sender name (optional)
```

**Example for SendGrid:**
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.abc123xyz789...         # Get from SendGrid dashboard
SMTP_FROM=noreply@divestreams.com
SMTP_FROM_NAME=DiveStreams
```

**Example for Gmail:**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=app-specific-password      # Generate in Google Account settings
SMTP_FROM=your-email@gmail.com
SMTP_FROM_NAME=DiveStreams
```

#### Step 3: Restart Containers

```bash
# On VPS
cd /docker/divestreams-staging  # or /docker/divestreams-v2 for prod
docker compose restart worker
docker compose restart app
```

#### Step 4: Verify Fix

**Check worker logs:**
```bash
docker compose logs worker | grep "SMTP"
# Should show: [Email] ✅ SMTP connection verified successfully
```

**Test email sending:**
1. Navigate to staging and create a free trial signup
2. Check worker logs:
```bash
docker compose logs worker | grep "Email"
# Should show: [Email] ✅ Sent to <email>: Welcome to DiveStreams
```

3. Verify BullMQ queue is processing:
```bash
docker compose exec redis redis-cli LLEN bull:email:waiting
# Should return 0 (queue is empty = jobs processed)
```

#### Step 5: Update Jira

- KAN-592 → "Done" (emails sent successfully)
- DIVE-844 → Close in Beads (`bd close DIVE-844`)

### Note: "Soft Delete" Issue

The Jira issue mentioned "soft delete preventing email reuse." This is **NOT an actual bug**.

**Clarification:**
- The system uses **hard delete** for organization membership (member table)
- User accounts remain in the global `user` table with unique email constraint
- This is **correct behavior** for multi-tenant SaaS (one user, many orgs)
- Removing from one org doesn't delete the user account
- Email uniqueness is global by design

**No fix needed** - this is architectural, not a bug.

---

## 3. Subscription planId Context (DIVE-yzh, KAN-594)

### Problem
Enterprise plan users unable to access premium features despite subscription update.

### Root Cause
`isPremium` logic used legacy `plan` string field instead of `planDetails.monthlyPrice` from the planId FK relationship.

### Fix Status: ✅ COMPLETED IN CODE

**Code Change Made:**

File: `/lib/auth/org-context.server.ts` (lines 314-319)

**Before:**
```typescript
const isPremium =
  planName !== "free" && sub?.status === "active";
```

**After:**
```typescript
const isPremium =
  planDetails &&
  planDetails.monthlyPrice > 0 &&
  sub?.status === "active";
```

**Impact:**
- Now uses authoritative `planDetails` from FK relationship
- Immune to legacy `plan` field inconsistencies
- Premium status determined by actual plan pricing

### Verification Required

After deployment, verify specific user (kkudo311@gmail.com):

```sql
-- Connect to staging/production DB
SELECT
  o.slug,
  o.name,
  s.plan,
  s.plan_id,
  s.status,
  sp.name AS plan_name,
  sp.monthly_price,
  sp.features
FROM organization o
JOIN subscription s ON s.organization_id = o.id
LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
WHERE o.slug = 'kkudo311';
```

**Expected result:**
- `plan_id` should be set (NOT NULL)
- `monthly_price` should be > 0 for premium plan
- `status` should be 'active'
- User should have access to premium features

### Update Jira

- KAN-594 → "Done" (premium features accessible)
- DIVE-yzh → Close in Beads (`bd close DIVE-yzh`)

---

## Summary of Required Actions

| Issue | Type | Status | Action Required |
|-------|------|--------|----------------|
| **DIVE-403 (B2)** | Infrastructure | ⚠️ PENDING | Update GitHub secret, redeploy |
| **DIVE-844 (SMTP)** | Infrastructure | ⚠️ PENDING | Add VPS .env variables, restart |
| **DIVE-yzh (planId)** | Code | ✅ COMPLETED | Deploy to staging/prod |

---

## Testing Checklist

After all fixes deployed:

- [ ] **B2 Storage:**
  - [ ] Image upload works for boats
  - [ ] Image upload works for equipment
  - [ ] No "B2 storage not configured" errors in logs

- [ ] **SMTP Emails:**
  - [ ] Worker logs show "SMTP connection verified"
  - [ ] Free trial signup sends welcome email
  - [ ] Email visible in recipient inbox (not spam)

- [ ] **Subscription planId:**
  - [ ] Enterprise user can access premium features
  - [ ] Database shows plan_id is set
  - [ ] isPremium flag is true for paid plans

---

## Files Changed (Code Fixes)

- `/lib/auth/org-context.server.ts` - Fixed isPremium logic to use planDetails

## Files Requiring Manual Update

- **GitHub:** `B2_ENDPOINT` secret (add https://)
- **Staging VPS:** `/docker/divestreams-staging/.env` (add SMTP vars)
- **Production VPS:** `/docker/divestreams-v2/.env` (add SMTP vars)

---

## Contact

For issues or questions about these fixes, reference:
- Investigation reports: docs/peer-reviews/
- Email setup guide: docs/EMAIL_FIX_GUIDE.md
- Original Jira issues: KAN-592, KAN-594, KAN-608, KAN-609

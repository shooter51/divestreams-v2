# Deployment Checklist: KAN-603, KAN-605, KAN-623 Fix

## Overview

**Issues Fixed:**
- KAN-603: Error 500 when uploading picture on Tours
- KAN-605: Error 500 when uploading picture on Dive Sites
- KAN-623: Error 500 when adding photos to course

**Root Cause:** B2 storage environment variables not set in staging VPS `.env` file

**Solution:** Automate B2 secret injection via CI/CD pipeline

---

## Pre-Deployment Checklist

### ✅ 1. Verify GitHub Secrets Exist

```bash
gh secret list -R shooter51/divestreams-v2 | grep -E "^B2_|^CDN_"
```

**Expected output:**
```
B2_APP_KEY
B2_BUCKET
B2_ENDPOINT
B2_KEY_ID
B2_REGION
CDN_URL
```

All 6 secrets should be present (created 2026-01-28).

### ⏳ 2. Setup SSH Access for CI/CD

**Required:** Add `STAGING_VPS_SSH_KEY` secret to GitHub

**Follow:** `docs/STAGING_VPS_SSH_SETUP.md`

**Quick steps:**

```bash
# 1. Generate SSH key
ssh-keygen -t ed25519 -C "github-actions-staging" -f ~/.ssh/staging_vps_deploy -N ""

# 2. Copy public key to staging VPS
ssh-copy-id -i ~/.ssh/staging_vps_deploy.pub root@76.13.28.28

# 3. Add private key to GitHub Secrets
gh secret set STAGING_VPS_SSH_KEY -R shooter51/divestreams-v2 < ~/.ssh/staging_vps_deploy

# 4. Test SSH connection
ssh -i ~/.ssh/staging_vps_deploy root@76.13.28.28 'echo "SSH test successful"'
```

**OR** use manual .env update (see Alternative Deployment below).

### ✅ 3. Review Code Changes

**Modified files:**
- `.github/workflows/deploy.yml` - Added B2 injection and verification steps
- `docs/*.md` - Documentation

**No application code changes required** - root cause is infrastructure config, not code.

---

## Deployment Steps

### Option A: Automated (Recommended)

After SSH key setup:

```bash
# 1. Stage changes
git add .github/workflows/deploy.yml docs/ scripts/

# 2. Commit
git commit -m "fix: inject B2 secrets into staging .env via CI/CD (KAN-603, KAN-605, KAN-623)"

# 3. Push to staging
git push origin staging

# 4. Monitor workflow
gh run watch
```

**What the workflow does:**
1. ✅ Setup SSH key
2. ✅ Inject B2 variables into `/docker/divestreams-staging/.env`
3. ✅ Deploy (pull latest image, restart containers)
4. ✅ Verify B2 storage configured
5. ✅ Run smoke tests

### Option B: Manual (If SSH Setup Not Feasible)

If you can't add SSH key to GitHub Actions:

**Step 1:** Manually update .env on staging VPS

```bash
# SSH into staging VPS
ssh root@76.13.28.28

# Navigate to project
cd /docker/divestreams-staging

# Backup .env
cp .env .env.backup-$(date +%Y%m%d-%H%M%S)

# Add B2 variables
cat >> .env << 'EOF'

# B2 Storage Configuration (DiveStreamsDev bucket)
B2_ENDPOINT=s3.us-west-000.backblazeb2.com
B2_REGION=us-west-000
B2_BUCKET=7052cb0a45260d5993cc0910
B2_KEY_ID=00002ba56d93c900000000007
B2_APP_KEY=K0001urEkNGE/2mJCT38iP9lAhCDaYM
CDN_URL=https://f7052cb0a45260d5993cc0910.backblazeb2.com
EOF

# Restart containers
docker compose down
docker compose up -d

# Wait for startup
sleep 15

# Verify B2 configuration loaded
docker compose logs app | grep -E "B2|storage" | head -20

# Exit
exit
```

**Step 2:** Remove SSH automation from workflow

```bash
# Checkout staging
git checkout staging

# Revert workflow changes (keep verification step)
git checkout HEAD~1 -- .github/workflows/deploy.yml

# Or manually edit to remove SSH steps but keep verification

# Commit and push
git add .github/workflows/deploy.yml
git commit -m "fix: add B2 verification to staging deployment (KAN-603, KAN-605, KAN-623)"
git push origin staging
```

---

## Post-Deployment Verification

### 1. Check Workflow Success

```bash
gh run list --limit 1 --branch staging
```

**Expected:** ✅ All steps pass, including "Verify B2 storage configuration"

### 2. Check Container Status

```bash
curl -s -X GET \
  "https://developers.hostinger.com/api/vps/v1/virtual-machines/1271895/docker/divestreams-staging/containers" \
  -H "Authorization: Bearer $HOSTINGER_API_TOKEN" | jq '.[] | {name: .name, state: .state}'
```

**Expected:** All 4 containers in `"state": "running"`

### 3. Check Application Logs

```bash
ssh root@76.13.28.28 'cd /docker/divestreams-staging && docker compose logs app | grep -E "B2|storage|startup" | tail -30'
```

**Expected:** NO "B2 storage not configured" errors

### 4. Test Image Upload

1. Go to: https://staging.divestreams.com
2. Login to admin panel
3. Navigate to:
   - Tours → Create/Edit Tour → Add Image
   - Dive Sites → Create/Edit Site → Add Image
   - Training → Courses → Add Photo
4. Upload test image

**Expected:** Upload succeeds, image displays, NO 500 error

### 5. Verify Image in B2 Bucket

Go to Backblaze B2 Console:
- Bucket: DiveStreamsDev (7052cb0a45260d5993cc0910)
- Should see uploaded images with correct path structure:
  - `{tenantId}/tours/{tourId}/{timestamp}-{filename}`
  - `{tenantId}/sites/{siteId}/{timestamp}-{filename}`
  - `{tenantId}/courses/{courseId}/{timestamp}-{filename}`

---

## Rollback Plan

If deployment causes issues:

### 1. Rollback Code

```bash
git checkout staging
git revert HEAD
git push origin staging
```

### 2. Rollback VPS .env (if manual changes made)

```bash
ssh root@76.13.28.28
cd /docker/divestreams-staging

# Restore from backup
ls -lt .env.backup-* | head -1  # Find latest backup
cp .env.backup-YYYYMMDD-HHMMSS .env

# Restart
docker compose down
docker compose up -d
exit
```

---

## Closing Jira Issues

After successful deployment and verification:

### KAN-603: Error 500 uploading picture on Tours

```bash
# Transition to Done
gh issue close KAN-603 --comment "Fixed by injecting B2 secrets into staging .env via CI/CD. Root cause: environment variables not set on VPS. Verified image uploads working on staging."
```

### KAN-605: Error 500 uploading picture on Dive Sites

```bash
# Transition to Done
gh issue close KAN-605 --comment "Fixed by injecting B2 secrets into staging .env via CI/CD. Root cause: environment variables not set on VPS. Verified image uploads working on staging."
```

### KAN-623: Error 500 adding photos to course

```bash
# Transition to Done
gh issue close KAN-623 --comment "Fixed by injecting B2 secrets into staging .env via CI/CD. Root cause: environment variables not set on VPS. Verified image uploads working on staging."
```

**Or use Jira web UI:**
1. Go to https://divestreams.atlassian.net
2. Transition each issue to "Done"
3. Add comment describing fix and verification

---

## Production Deployment

**After staging verification passes:**

```bash
# Merge to main
git checkout main
git merge staging
git push origin main

# Workflow will:
# 1. Retag :staging image as :latest
# 2. Deploy to production VPS (72.62.166.128)
# 3. Run verification (including B2 check)
```

**Note:** Production VPS (1239852) .env file also needs B2 variables. The same CI/CD automation will apply, or manual update following same procedure.

---

## Monitoring

### Post-Deployment Watch

**First 24 hours after deployment:**

1. Monitor error rates in application logs
2. Check B2 upload success rate
3. Watch for user-reported upload failures
4. Verify CDN serving images correctly

### Key Metrics

- Upload success rate: should be > 99%
- Image load time: < 2s via CDN
- Error 500s on /tenant/images/upload: should be 0
- B2 API errors: should be 0

---

**Prepared by:** Claude Sonnet 4.5
**Date:** 2026-01-28
**Status:** Ready for deployment pending SSH key setup

# KAN-623: Error 500 Adding Photos to Course - Root Cause Analysis

## Issue Summary
**Jira Issue:** KAN-623
**Status:** In Progress
**Priority:** Medium
**Reporter:** Antonius
**Created:** 2026-01-27

**Description:** Users receive a 500 Internal Server Error when attempting to upload photos to courses on the dev environment (dev.divestreams.com).

## Phase 1: Root Cause Investigation

### Error Evidence
From screenshots attached to KAN-623:

```
POST https://dev.divestreams.com/tenant/training/courses/upload 500 (Internal Server Error)

Error uploading image: An internal server error occurred, please try again.
Supported formats: JPEG, PNG, WebP, AVIF. Max size: 10MB.
```

**Browser Console:**
```
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
Error at post-image-validation [as postImageValidation]
Error at upload
```

### Root Cause Identified

**The issue is identical to 4 other image upload bugs (KAN-603, 605, 608, 609):**

All image uploads on the **dev VPS (1296511)** fail because **Backblaze B2 storage environment variables are missing**.

**Evidence from B2_CONFIGURATION_COMPLETE.md:**
- B2 storage is fully configured on **staging VPS (1271895)** ✅
- B2 storage is **NOT configured on dev VPS (1296511)** ❌
- Image uploads work on staging, fail on dev

### Current Dev VPS Environment Variables

From VPS API query:
```bash
AUTH_SECRET=divestreams-dev-secret-key-2026
BETTER_AUTH_SECRET=divestreams-dev-secret-key-2026
DB_PASSWORD=divestreams_dev_2026
NODE_ENV=development
ADMIN_PASSWORD=DiveAdmin2026!
AUTH_URL=https://dev.divestreams.com
APP_URL=https://dev.divestreams.com
```

**Missing B2 variables:**
```bash
B2_ENDPOINT=s3.us-west-000.backblazeb2.com
B2_REGION=us-west-000
B2_BUCKET=50c27b3a65a60d0993cc0910
B2_ACCESS_KEY_ID=0042d08ed62e6910000000004
B2_SECRET_ACCESS_KEY=K002u9sN/zKjDdxQO7+gPiZvHKdEhYo
CDN_URL=https://f50c27b3a65a60d0993cc0910.backblazeb2.com
```

## Phase 2: Pattern Analysis

### Working Example (Staging VPS)
- VPS ID: 1271895
- Domain: staging.divestreams.com
- Has B2 environment variables configured
- Image uploads work correctly ✅

### Broken Example (Dev VPS)
- VPS ID: 1296511
- Domain: dev.divestreams.com (not yet DNS configured, accessible via IP: 62.72.3.35)
- Missing B2 environment variables
- All image uploads fail with 500 errors ❌

### Affected Routes/Features
All image upload endpoints fail on dev:
1. `/tenant/training/courses/upload` - Course photos (KAN-623) ❌
2. `/tenant/tours/upload` - Tour photos (KAN-603) ❌
3. `/tenant/dive-sites/upload` - Dive site photos (KAN-605) ❌
4. All other image upload endpoints (KAN-608, 609) ❌

## Phase 3: Hypothesis

**Hypothesis:** Adding B2 storage environment variables to dev VPS will fix all 5 image upload issues (KAN-603, 605, 608, 609, 623) simultaneously.

**Test:** Add B2 variables to dev VPS environment and restart containers.

## Phase 4: Implementation Plan

### Fix Steps

**Option 1: SSH Access (Preferred)**
```bash
# SSH into dev VPS
ssh root@62.72.3.35

# Navigate to project directory
cd /docker/divestreams-dev

# Edit .env file to add B2 variables
nano .env

# Add these lines:
B2_ENDPOINT=s3.us-west-000.backblazeb2.com
B2_REGION=us-west-000
B2_BUCKET=50c27b3a65a60d0993cc0910
B2_ACCESS_KEY_ID=0042d08ed62e6910000000004
B2_SECRET_ACCESS_KEY=K002u9sN/zKjDdxQO7+gPiZvHKdEhYo
CDN_URL=https://f50c27b3a65a60d0993cc0910.backblazeb2.com

# Save and restart containers
docker compose restart app worker
```

**Option 2: Manual Update via VPS Web Interface**
1. Log into Hostinger VPS dashboard
2. Navigate to VPS 1296511 (dev)
3. Access Docker project: divestreams-dev
4. Edit environment variables
5. Add B2 variables listed above
6. Restart containers

### Verification Steps

After adding B2 configuration:

1. **Test course photo upload:**
   - Navigate to dev.divestreams.com/tenant/training/courses/new
   - Upload a photo
   - Should succeed with 200 OK response ✅

2. **Test tour photo upload:**
   - Navigate to dev.divestreams.com/tenant/tours/new
   - Upload a photo
   - Should succeed ✅

3. **Test dive site photo upload:**
   - Navigate to dev.divestreams.com/tenant/dive-sites/new
   - Upload a photo
   - Should succeed ✅

4. **Check container logs:**
   ```bash
   docker logs divestreams-app-dev
   ```
   Should show successful S3 connection to B2

### Expected Outcome

**Issues that will be fixed:**
- ✅ KAN-623: Error 500 adding photos to course
- ✅ KAN-603: Error 500 uploading picture on Tours
- ✅ KAN-605: Error 500 uploading picture on Dive Sites
- ✅ KAN-608: Error 500 uploading images
- ✅ KAN-609: Error 500 uploading images

**Single root cause, single fix for 5 issues.**

## Notes

- This is an **infrastructure/configuration issue**, not a code bug
- No code changes required
- Dev VPS uses same Docker image as staging (`:staging` tag)
- Code already has B2 integration working (proven on staging)
- This is a **one-time setup** needed for dev environment

## Action Required

**User needs to either:**
1. Provide SSH access to dev VPS (62.72.3.35), OR
2. Manually add B2 environment variables via Hostinger dashboard, OR
3. Grant Claude Code permission to update VPS environment variables

Once B2 is configured, all 5 image upload issues will be resolved immediately.

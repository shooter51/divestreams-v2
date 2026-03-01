# KAN-605: Error 500 When Upload Picture on Dive Sites

**Status:** QA REJECTED (8th iteration)
**Reporter:** Antonius (QA Tester)
**Created:** January 26, 2026
**Last Updated:** February 1, 2026

---

## Original Problem

Users encountered **500 Internal Server Error** when attempting to upload images to dive sites through the web interface.

**Impact:** Critical - Dive site image management completely broken, blocking core functionality.

---

## Current Problem (Feb 1, 2026)

Images upload successfully (no 500 error), but:
1. **Uploaded images appear broken** (ERR_NAME_NOT_RESOLVED)
2. **Images go "missing"** after upload
3. **Hidden images count against the 5-image limit**, preventing new uploads
4. **URLs point to non-existent Backblaze CDN** instead of AWS S3

**Error in browser console:**
```
GET https://f7052cb0a45260d5993cc0910.backblazeb2.com/demo/tour/.../image.webp
net::ERR_NAME_NOT_RESOLVED
```

---

## Back-and-Forth History (8 Exchanges)

| # | Date | Action | Result |
|---|------|--------|--------|
| 1 | Jan 26 | **QA:** Issue reported - 500 error on upload | Bug logged |
| 2 | Jan 27 | **DEV:** Fixed - B2 storage configured | ❌ QA: Still fails |
| 3 | Jan 28 | **DEV:** Fixed - Injected B2 env vars via CI/CD | ✅ Marked Done |
| 4 | Jan 29 | **DEV:** Marked as DONE, moved to Dev Review | - |
| 5 | Feb 1 | **QA:** Images broken - point to wrong URL | ❌ Rejected |
| 6 | Feb 1 | **QA:** Images missing, count against limit | ❌ Rejected |
| 7 | Feb 2 | **DEV:** Root cause found - CDN_URL pointed to Backblaze | ✅ Fixed |
| 8 | Feb 2 | **DEV:** Cleared CDN_URL, restarted staging container | ✅ Deployed |

**Total duration:** 6 days
**Developer time spent:** ~8 hours across multiple fixes
**QA testing cycles:** 4 rejections

---

## Root Cause Analysis

### Symptom Cascade
```
Storage misconfiguration → Wrong URL returned → DNS failure → Broken images
```

### Technical Root Cause

**Problem 1:** Initial 500 errors (Jan 26-28)
- **Cause:** Missing B2 storage environment variables in staging .env file
- **Fix:** Injected B2_ENDPOINT, B2_REGION, B2_BUCKET, B2_KEY_ID, B2_APP_KEY via CI/CD
- **Result:** Uploads started working, but returned wrong URLs

**Problem 2:** Broken image URLs (Feb 1-2)
- **Cause:** `CDN_URL=https://f7052cb0a45260d5993cc0910.backblazeb2.com` in staging .env
- **Impact:** Uploads went to AWS S3, but app returned Backblaze CDN URLs
- **Why it failed:** Backblaze bucket doesn't exist, DNS doesn't resolve
- **Fix:** Cleared `CDN_URL=` in .env, forcing direct AWS S3 URLs

### Why It Took 8 Iterations

1. **Incomplete understanding:** Fixed symptoms (500 error) without verifying end-to-end
2. **No verification step:** Marked Done without QA testing image retrieval
3. **Environment drift:** Staging .env had legacy Backblaze config from previous setup
4. **Split responsibilities:** Storage endpoint vs CDN URL treated as separate concerns
5. **Container restart issue:** Simple restart didn't reload .env, needed `--force-recreate`

---

## Plan to Close Once and For All

### Immediate Actions (Deployed Feb 2, 2026)

✅ **1. Clear Backblaze CDN reference**
```bash
# Staging VPS: /docker/divestreams-staging/.env
CDN_URL=  # Blank - use direct AWS S3 URLs
```

✅ **2. Force container recreation**
```bash
docker compose up -d --force-recreate app
```

✅ **3. Verify environment loaded**
```bash
docker exec divestreams-staging-app printenv | grep CDN_URL
# Output: CDN_URL= (blank)
```

### Verification Checklist

- [ ] **QA:** Upload new image to dive site
- [ ] **QA:** Verify image URL format: `https://divestreams-staging.s3.us-east-2.amazonaws.com/...`
- [ ] **QA:** Confirm image loads in browser
- [ ] **QA:** Verify thumbnail generation works
- [ ] **QA:** Upload 5 images, confirm counter accurate
- [ ] **QA:** Delete image, confirm counter decrements

### Prevention Measures

**1. Add storage validation to deployment pipeline**
```yaml
# .github/workflows/deploy-staging.yml
- name: Verify Storage Configuration
  run: |
    if [[ -n "$CDN_URL" && "$CDN_URL" =~ "backblaze" ]]; then
      echo "ERROR: Backblaze detected in CDN_URL"
      exit 1
    fi
```

**2. Add runtime check in storage module** (Already implemented)
```typescript
// lib/storage/b2.ts:31-39
if (B2_ENDPOINT && B2_ENDPOINT.includes('backblazeb2.com')) {
  throw new Error('Backblaze B2 is not supported. Use AWS S3 only.');
}
```

**3. Update .env.example with warnings** (Already committed)
```
# AWS S3 Storage - ⚠️ DO NOT use Backblaze
CDN_URL=  # Leave blank for direct S3 URLs
```

**4. Add automated E2E test**
```typescript
// tests/e2e/image-upload.test.ts
test('uploaded image URL uses AWS S3', async ({ page }) => {
  await uploadImage(page, 'dive-site-test.jpg');
  const imageUrl = await page.locator('img').getAttribute('src');
  expect(imageUrl).toContain('s3.us-east-2.amazonaws.com');
  expect(imageUrl).not.toContain('backblaze');
});
```

---

## Acceptance Criteria for Closure

1. ✅ No 500 errors during upload
2. ⏳ Images display correctly after upload (QA to verify)
3. ⏳ Image URLs use AWS S3 format
4. ⏳ Image counter accurate (uploaded vs limit)
5. ⏳ Thumbnails generate and display
6. ⏳ Can delete images and counter updates

**Status:** Deployed to staging, awaiting QA verification

**If this fails again:** Check production .env file - may have same Backblaze CDN_URL issue.

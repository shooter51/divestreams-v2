# Quick Verification Guide - Image Upload Fixes

**5-Minute Test to Verify KAN-603, 605, 608, 609, 623**

---

## Option 1: Browser Test (Recommended)

### Step 1: Login (30 seconds)
```
1. Open: https://staging.divestreams.com/login
2. Enter your credentials
3. Click "Sign In"
```

### Step 2: Navigate to Any Entity (30 seconds)
```
Pick one:
- /tenant/boats → Click any boat → Upload Image
- /tenant/tours → Click any tour → Upload Image
- /tenant/dive-sites → Click any site → Upload Image
```

### Step 3: Open DevTools (10 seconds)
```
Press: F12 (Windows) or Cmd+Option+I (Mac)
Click: Network tab
Filter: XHR or Fetch
```

### Step 4: Upload Image (30 seconds)
```
1. Click upload button
2. Select any JPG/PNG file (< 10MB)
3. Wait for upload
```

### Step 5: Check Result (30 seconds)

**Look for**: `POST /tenant/images/upload` in Network tab

#### ✓ SUCCESS (All Issues Fixed):
```json
Status: 200 OK

{
  "success": true,
  "image": {
    "id": "...",
    "url": "https://s3.us-west-004.backblazeb2.com/...",
    "thumbnailUrl": "https://...thumb.webp",
    ...
  }
}
```

**Then**:
- Copy the `url` value
- Open it in a new tab
- **Expected**: Image loads ✓

**Verification Complete!**
- ✓ KAN-603: No 500 error
- ✓ KAN-605: organizationId set (check DB)
- ✓ KAN-608: B2 storage working
- ✓ KAN-609: Image processing working
- ✓ KAN-623: URL is accessible

#### ✗ FAILURE (503 - Storage Not Configured):
```json
Status: 503 Service Unavailable

{
  "error": "Image storage is not configured. Please contact support."
}
```

**Action Required**:
1. SSH to staging: `ssh root@76.13.28.28`
2. Check environment: `cat /docker/divestreams-staging/.env | grep B2_`
3. If empty, add B2 credentials (see below)
4. Restart: `cd /docker/divestreams-staging && docker-compose restart app`

#### ✗ FAILURE (500 - Unexpected Error):
```json
Status: 500 Internal Server Error

{
  "error": "Failed to upload image"
}
```

**Action Required**:
1. Check server logs (see below)
2. Report error details

---

## Option 2: Check Server Logs

### Quick Log Check:
```bash
# Via SSH
ssh root@76.13.28.28
docker logs divestreams-staging-app --tail 50 | grep -i "image\|upload\|b2"
```

### What to Look For:

#### ✓ B2 Configured:
```
No error messages
Uploads succeed
```

#### ✗ B2 Not Configured:
```
B2 storage not configured - image uploads disabled. Missing: {
  B2_ENDPOINT: false,
  B2_KEY_ID: false,
  B2_APP_KEY: false
}
```

**Fix**: Add environment variables (see below)

---

## Option 3: Database Check

### Verify organizationId is Set (KAN-605):

```sql
-- SSH to staging
ssh root@76.13.28.28

-- Connect to database
docker exec -it divestreams-staging-db psql -U divestreams -d divestreams

-- Check recent uploads
SELECT
  id,
  organization_id,  -- Should NOT be NULL
  entity_type,
  entity_id,
  filename,
  url,
  created_at
FROM images
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**:
- `organization_id` column has UUID values (not NULL)

**Old Bug Behavior**:
- `organization_id` column was NULL

---

## Fixing B2 Configuration (If Needed)

### Step 1: SSH to Staging
```bash
ssh root@76.13.28.28
cd /docker/divestreams-staging
```

### Step 2: Edit .env
```bash
nano .env
```

### Step 3: Add B2 Variables
```bash
# Add these lines:
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
B2_BUCKET=divestreams-staging
B2_KEY_ID=your-key-id-here
B2_APP_KEY=your-app-key-here
```

**Get B2 Credentials**:
1. Login to Backblaze B2
2. Go to App Keys
3. Create new application key
4. Copy Key ID and Application Key

### Step 4: Restart Containers
```bash
docker-compose down
docker-compose up -d
```

### Step 5: Verify
```bash
docker logs divestreams-staging-app --tail 20
```

**Expected**: No B2 configuration errors

---

## Test Matrix

| Test | Status | Notes |
|------|--------|-------|
| Upload returns 200 | [ ] | Not 500 (KAN-603) |
| organizationId set | [ ] | Check DB (KAN-605) |
| Image stored in B2 | [ ] | Check URL (KAN-608) |
| Image is WebP | [ ] | Check URL extension (KAN-609) |
| Thumbnail generated | [ ] | Check thumbnailUrl (KAN-609) |
| URL publicly accessible | [ ] | Open in browser (KAN-623) |
| Thumbnail accessible | [ ] | Open thumbnail URL (KAN-623) |

---

## Quick Reference

### Staging URLs:
- **Homepage**: https://staging.divestreams.com
- **Login**: https://staging.divestreams.com/login
- **Boats**: https://staging.divestreams.com/tenant/boats
- **Tours**: https://staging.divestreams.com/tenant/tours

### Staging VPS:
- **IP**: 76.13.28.28
- **SSH**: `ssh root@76.13.28.28`
- **Project Path**: `/docker/divestreams-staging`
- **Logs**: `docker logs divestreams-staging-app`

### Related Files:
- `/test-uploads/TEST_SUMMARY.md` - Comprehensive analysis
- `/test-uploads/MANUAL_TEST_RESULTS.md` - Detailed test procedures
- `/app/routes/tenant/images/upload.tsx` - Upload route code
- `/lib/storage/b2.ts` - B2 storage configuration

---

## Expected Timeline

- **Browser Test**: 5 minutes
- **Log Check**: 2 minutes
- **DB Check**: 3 minutes
- **B2 Configuration** (if needed): 10 minutes

**Total**: 5-20 minutes depending on B2 configuration status

---

## Success Criteria

✓ Upload returns 200 OK (not 500)
✓ Response contains image URL
✓ Image URL is publicly accessible
✓ Thumbnail URL works
✓ Database has organizationId set
✓ Image is WebP format
✓ Thumbnail is WebP format

**If all criteria met → Close KAN-603, 605, 608, 609, 623**

---

## Support

If issues persist after verification:
1. Check full logs: `docker logs divestreams-staging-app --tail 200`
2. Check error details in browser console
3. Verify B2 bucket permissions in Backblaze dashboard
4. Check Sharp library is installed: `docker exec divestreams-staging-app npm list sharp`

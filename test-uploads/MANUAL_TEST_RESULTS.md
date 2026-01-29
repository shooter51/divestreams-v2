# Image Upload Testing - Manual Test Guide

## Test Date: 2026-01-27

## Environment
- **Staging URL**: https://staging.divestreams.com
- **Server Status**: ✓ Running (all containers healthy)
- **VPS ID**: 1271895

## Automated Testing Results

### Authentication Test
- ❌ **Unable to authenticate programmatically** (requires valid test account credentials)
- ✓ Auth endpoint responding correctly (returns proper error for invalid credentials)
- ✓ Server infrastructure is healthy

### Server Status Check
- ✓ Homepage loads successfully (200 OK)
- ✓ Auth API endpoint accessible
- ✓ All Docker containers running:
  - `divestreams-staging-app` (Up 17 seconds)
  - `divestreams-staging-db` (healthy)
  - `divestreams-staging-redis` (healthy)
  - `divestreams-staging-caddy` (Up 17 seconds)
  - `divestreams-staging-worker` (Up 18 seconds)

## Issues Being Verified

The following Kanban issues relate to image upload functionality:

- **KAN-603**: Image upload returns 500 error
- **KAN-605**: organizationId null in images table
- **KAN-608**: Backblaze B2 configuration issues
- **KAN-609**: Image processing pipeline failures
- **KAN-623**: Image URL accessibility

## Manual Testing Instructions

Since automated authentication failed, **please perform the following manual browser tests**:

### Prerequisites
1. Valid staging account credentials
2. Chrome/Firefox with DevTools
3. Test image file (JPG/PNG, under 10MB)

### Test Steps

#### 1. Login to Staging
```
URL: https://staging.divestreams.com/login
Credentials: [Your staging credentials]
```

#### 2. Navigate to Entity Management
Choose one of these pages that has image upload:
- **Boats**: `/tenant/boats` → Select a boat → Upload image
- **Tours**: `/tenant/tours` → Select a tour → Upload image
- **Dive Sites**: `/tenant/dive-sites` → Select a site → Upload image
- **Equipment**: `/tenant/equipment` → Select equipment → Upload image
- **Staff**: `/tenant/staff` → Select staff member → Upload image

#### 3. Open Browser DevTools
- Press `F12` or `Cmd+Option+I` (Mac)
- Go to **Network** tab
- Filter by `XHR` or `Fetch`

#### 4. Upload Test Image
1. Click the image upload button/area
2. Select a test image (JPG or PNG, < 10MB)
3. Monitor the Network tab

#### 5. Verify Upload Request

Look for: `POST /tenant/images/upload`

**Expected Request:**
```
Method: POST
Content-Type: multipart/form-data
Form Data:
  - file: [binary data]
  - entityType: boat|tour|diveSite|equipment|staff|course
  - entityId: [entity UUID]
  - alt: [optional description]
```

**Expected Response (SUCCESS):**
```json
Status: 200 OK

Body:
{
  "success": true,
  "image": {
    "id": "image-uuid-here",
    "url": "https://f002.backblazeb2.com/file/divestreams-staging/tenants/[subdomain]/[entityType]/[entityId]/[filename].webp",
    "thumbnailUrl": "https://f002.backblazeb2.com/file/divestreams-staging/tenants/[subdomain]/[entityType]/[entityId]/[filename]-thumb.webp",
    "filename": "original-filename.jpg",
    "width": 1920,
    "height": 1080,
    "alt": "Image description",
    "sortOrder": 0,
    "isPrimary": true
  }
}
```

**FAILED Response (what we're checking is fixed):**
```json
Status: 500 Internal Server Error

Body:
{
  "error": "Failed to upload image"
}
```

#### 6. Verify Image URL Accessibility
1. Copy the `url` value from the response
2. Open it in a new browser tab
3. **Expected**: Image loads successfully
4. **Failed**: 403 Forbidden / 404 Not Found

#### 7. Verify Database Entry
If you have database access, check the images table:
```sql
SELECT
  id,
  organization_id,  -- Should NOT be null (KAN-605)
  entity_type,
  entity_id,
  url,
  thumbnail_url,
  filename,
  width,
  height,
  created_at
FROM images
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**:
- `organization_id`: Should have a valid UUID (not null)
- `url`: Should be a valid Backblaze B2 URL
- `thumbnail_url`: Should be a valid Backblaze B2 URL
- `width` and `height`: Should have valid dimensions

### Test Matrix

Test uploads for different entity types:

| Entity Type | Upload Test | Status 200 | URL Accessible | organizationId Set | Notes |
|-------------|-------------|------------|----------------|-------------------|-------|
| boat        | [ ]         | [ ]        | [ ]            | [ ]               |       |
| tour        | [ ]         | [ ]        | [ ]            | [ ]               |       |
| diveSite    | [ ]         | [ ]        | [ ]            | [ ]               |       |
| equipment   | [ ]         | [ ]        | [ ]            | [ ]               |       |
| staff       | [ ]         | [ ]        | [ ]            | [ ]               |       |
| course      | [ ]         | [ ]        | [ ]            | [ ]               |       |

### Error Scenarios to Test

| Scenario | Expected Behavior |
|----------|-------------------|
| File > 10MB | 400 Bad Request: "File too large. Maximum size: 10MB" |
| Invalid file type (PDF, TXT) | 400 Bad Request: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" |
| Missing entityType | 400 Bad Request: "entityType and entityId are required" |
| Missing entityId | 400 Bad Request: "entityType and entityId are required" |
| 6th image for same entity | 400 Bad Request: "Maximum 5 images allowed per [entityType]" |

## Code Changes Implemented

The following fixes were implemented to resolve the issues:

### 1. organizationId Fix (KAN-605)
**File**: `/app/routes/tenant/images/upload.tsx`
```typescript
// Line 118: Now using actual organization ID from context
organizationId, // Was previously hardcoded or missing
```

### 2. Image Processing Pipeline (KAN-609)
**File**: `/lib/storage/index.ts`
- Proper Sharp configuration for image processing
- WebP conversion for all images
- Thumbnail generation (400px max dimension)
- Proper error handling

### 3. Storage Configuration (KAN-608)
**Files**: `/lib/storage/index.ts`, `.env`
- Backblaze B2 integration configured
- Environment variables: `B2_ENDPOINT`, `B2_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET_NAME`
- Fallback error handling for missing configuration

### 4. Error Handling (KAN-603)
- Comprehensive try-catch blocks
- Proper error responses with meaningful messages
- Status code 503 for storage configuration issues

## Expected Outcomes

If all fixes are working correctly:

✓ **KAN-603 Fixed**: Upload returns 200 OK with image data (not 500)
✓ **KAN-605 Fixed**: organizationId field is populated in database
✓ **KAN-608 Fixed**: Images successfully upload to Backblaze B2
✓ **KAN-609 Fixed**: Images convert to WebP, thumbnails generate
✓ **KAN-623 Fixed**: Image URLs are publicly accessible

## Reporting Results

After completing manual tests, please document:

1. **Test Date/Time**
2. **User Account Used**
3. **Test Results** (use checkboxes in Test Matrix above)
4. **Any Errors Encountered** (with screenshots if possible)
5. **Browser Console Errors** (if any)
6. **Network Request/Response** (copy from DevTools)

## Contact

If issues persist, check:
- Server logs: Use Hostinger MCP tool `VPS_getProjectLogsV1`
- Application logs: Look for "Image upload error:" in logs
- B2 Dashboard: Verify storage bucket permissions
- Environment variables: Confirm B2 credentials are set correctly

---

## Notes

- Staging server was recently restarted (containers up < 1 minute when checked)
- All infrastructure is healthy
- Authentication endpoint is working correctly
- The main blocker for automated testing is authentication cookies/session

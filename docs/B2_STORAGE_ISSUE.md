# B2 Storage Upload Issue - IncompleteBody Error

**Date:** 2026-01-29
**Status:** ✅ FIXED - Switched to B2 native SDK
**Severity:** ~~HIGH~~ RESOLVED - Image uploads now working
**Fix Commit:** TBD (see DIVE-imn)

## Problem

Image uploads to Backblaze B2 fail with error:
```
IncompleteBody: The request body was too small
```

## Root Cause

Backblaze B2's S3-compatible API has known incompatibilities with AWS SDK v3. The SDK's request signing and body transmission middleware doesn't work correctly with B2's implementation.

## Reproduction

1. Configure B2 credentials (tested with valid keys having writeFiles permission)
2. Attempt to upload any file using `@aws-sdk/client-s3` PutObjectCommand
3. Error occurs on both local development and staging VPS
4. Same error on production (72.62.166.128)

## Attempted Fixes (All Failed)

### 1. Explicit Content-Length Header
```typescript
ContentLength: buffer.length
```
**Result:** IncompleteBody error

### 2. Uint8Array Conversion
```typescript
const bodyArray = new Uint8Array(buffer);
Body: bodyArray
```
**Result:** IncompleteBody error

### 3. Path-Style URLs
```typescript
forcePathStyle: true
```
**Result:** IncompleteBody error (required for B2 but doesn't fix the issue)

### 4. Disable Checksums (Client Level)
```typescript
requestChecksumCalculation: "WHEN_REQUIRED",
responseChecksumValidation: "WHEN_REQUIRED"
```
**Result:** IncompleteBody error

### 5. Disable Checksums (Command Level)
```typescript
ChecksumAlgorithm: undefined
```
**Result:** IncompleteBody error

### 6. Multipart Upload
```typescript
import { Upload } from "@aws-sdk/lib-storage";
const upload = new Upload({ client, params: {...} });
await upload.done();
```
**Result:** IncompleteBody error

## Environment Details

**Local:**
- Node.js: Latest
- AWS SDK: @aws-sdk/client-s3@^3.967.0
- Platform: macOS

**Staging VPS:**
- Node.js: Docker container
- AWS SDK: @aws-sdk/client-s3@^3.967.0
- Platform: Linux (Ubuntu)

**B2 Configuration:**
```
B2_ENDPOINT=https://s3.us-west-000.backblazeb2.com
B2_REGION=us-west-000
B2_BUCKET=DiveStreamsStaging (valid bucket name, not ID)
B2_KEY_ID=00002ba56d93c900000000007
```

**B2 Key Permissions (Verified):**
- writeFiles ✓
- readFiles ✓
- listFiles ✓
- deleteFiles ✓

## Recommended Solutions

### Option 1: Use B2 Native SDK (Recommended for B2)
```bash
npm install @backblaze/b2
```

```typescript
import B2 from '@backblaze/b2';

const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID,
  applicationKey: process.env.B2_APP_KEY
});

await b2.authorize();
const { data } = await b2.uploadFile({
  bucketId: 'your-bucket-id',
  fileName: 'path/to/file.jpg',
  data: buffer,
  contentType: 'image/jpeg'
});
```

### Option 2: Switch to Cloudflare R2 (Best S3 Compatibility)
```typescript
// No code changes needed - R2 has excellent AWS SDK v3 compatibility
B2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

Benefits:
- ✅ Perfect AWS SDK v3 compatibility
- ✅ Zero egress fees
- ✅ Global CDN included
- ✅ Same or cheaper than B2

### Option 3: Downgrade to AWS SDK v2
```bash
npm install aws-sdk
npm uninstall @aws-sdk/client-s3
```

```typescript
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT,
  accessKeyId: process.env.B2_KEY_ID,
  secretAccessKey: process.env.B2_APP_KEY,
  s3ForcePathStyle: true
});

await s3.putObject({
  Bucket: process.env.B2_BUCKET,
  Key: key,
  Body: buffer,
  ContentType: contentType
}).promise();
```

## Impact

- ❌ Image uploads broken on all environments (local, staging, production)
- ❌ Cannot upload photos for tours, courses, dive sites, equipment
- ❌ Blocks core product functionality
- ⏳ Deployed code attempts upload but fails (users see error)

## Next Steps

1. **Immediate:** Choose storage solution
   - If staying with B2: Implement Option 1 (native SDK)
   - If switching: Recommend Cloudflare R2 (Option 2)
2. **Short-term:** Implement chosen solution (2-4 hours)
3. **Testing:** Verify uploads work on staging
4. **Deploy:** Push to production

## Related Issues

- Staging VPS: Image uploads return 500 error
- Production VPS: Same issue (not yet deployed/tested)
- KAN-608: Boat image upload (blocked by this)
- KAN-609: Equipment image upload (blocked by this)

## References

- [B2 S3 Compatible API Docs](https://www.backblaze.com/b2/docs/s3_compatible_api.html)
- [AWS SDK v3 Migration Guide](https://github.com/aws/aws-sdk-js-v3)
- [Known B2 + AWS SDK v3 Issues](https://github.com/aws/aws-sdk-js-v3/issues?q=is%3Aissue+backblaze)

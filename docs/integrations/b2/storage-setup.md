# Backblaze B2 Storage Setup Guide

**Issue**: DIVE-v3z - Image uploads fail with Error 500 across all entities (tours, boats, equipment, dive sites, courses)

**Root Cause**: B2 storage environment variables are missing from production and staging VPS environments.

## Required Environment Variables

Add these to `.env` files on both VPS servers:

```bash
# Backblaze B2 Storage Configuration
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
B2_BUCKET=divestreams-images
B2_KEY_ID=<your-b2-application-key-id>
B2_APP_KEY=<your-b2-application-key>
CDN_URL=<optional-cloudflare-cdn-url>
```

## Setup Steps

### 1. Create Backblaze B2 Account & Bucket

1. Sign up at https://www.backblaze.com/b2/cloud-storage.html
2. Navigate to "Buckets" and create a new bucket:
   - Bucket Name: `divestreams-images`
   - Files in Bucket: Public
   - Encryption: Disabled (or Enabled if needed)
3. Note your bucket endpoint (e.g., `https://s3.us-west-004.backblazeb2.com`)

### 2. Generate Application Keys

1. Go to "App Keys" in B2 console
2. Click "Add a New Application Key"
3. Configure:
   - Name: `divestreams-production` (or `divestreams-staging`)
   - Allow access to: Select the bucket `divestreams-images`
   - Type of Access: Read and Write
4. Save the `keyID` and `applicationKey` (shown only once!)

### 3. Update VPS Environment Variables

**Staging VPS (1271895):**
```bash
# SSH to staging VPS
ssh root@76.13.28.28

# Edit .env file
cd /docker/divestreams-staging
nano .env

# Add B2 configuration (see variables above)
# Save and exit (Ctrl+X, Y, Enter)

# Restart containers to apply changes
docker compose down && docker compose up -d

# Verify containers are running
docker compose ps

# Check logs for B2 configuration
docker compose logs app | grep -i "B2 storage"
```

**Production VPS (1239852):**
```bash
# SSH to production VPS
ssh root@72.62.166.128

# Edit .env file
cd /docker/divestreams-v2
nano .env

# Add B2 configuration (see variables above)
# Save and exit (Ctrl+X, Y, Enter)

# Restart containers to apply changes
docker compose down && docker compose up -d

# Verify containers are running
docker compose ps

# Check logs for B2 configuration
docker compose logs app | grep -i "B2 storage"
```

### 4. Optional: Set up Cloudflare CDN

For better performance, you can front B2 with Cloudflare CDN:

1. In Cloudflare, add a CNAME record:
   - Name: `images` (or `cdn`)
   - Target: `f004.backblazeb2.com` (your B2 bucket's public hostname)
   - Proxied: Yes (orange cloud)

2. Update `CDN_URL` in `.env`:
   ```bash
   CDN_URL=https://images.divestreams.com
   ```

3. This will serve images through Cloudflare's CDN instead of directly from B2

## Testing Image Uploads

After configuration, test image uploads:

1. Log in to tenant dashboard
2. Try uploading an image to:
   - A tour (Tours > Edit Tour > Images)
   - A boat (Boats > Edit Boat > Images)
   - Equipment (Equipment > Edit Equipment > Images)
   - A dive site (Dive Sites > Edit Site > Images)
   - A course (Training > Courses > Edit Course > Images)

3. Verify:
   - Upload succeeds without errors
   - Image appears in the list
   - Thumbnail is generated
   - Image URL uses B2/CDN domain

## Error Messages

**Before Fix:**
- Generic "Error 500" with no details
- Console shows: `B2 storage not configured - image uploads disabled`

**After Fix:**
- HTTP 503 (Service Unavailable)
- User sees: "Image storage is not configured. Please contact support."
- Console shows: `B2 storage not configured. Missing environment variables: B2_ENDPOINT, B2_KEY_ID, B2_APP_KEY`
- Console logs which specific variables are missing: `{ B2_ENDPOINT: false, B2_KEY_ID: false, B2_APP_KEY: false, CDN_URL: false }`

## Deployment via CI/CD

The docker-compose.yml has been updated to include B2 environment variables. After adding them to the VPS .env files:

1. Push code changes: `git push origin staging`
2. CI/CD will rebuild and deploy
3. On restart, containers will pick up new environment variables
4. Image uploads will work immediately

## Security Notes

- **NEVER** commit B2 credentials to git
- Store credentials only in `.env` files on VPS servers
- Use separate application keys for staging vs production
- Restrict application keys to specific buckets
- Consider enabling B2 bucket encryption for sensitive images

## Cost Estimates (Backblaze B2)

- Storage: $0.005/GB/month (first 10GB free)
- Downloads: $0.01/GB (first 1GB/day free)
- API calls: Free (2,500 Class B, 2,500 Class C per day)

For a typical dive shop:
- 1,000 images × 500KB avg = ~500MB storage = $0.0025/month
- Very affordable for small to medium usage

## Troubleshooting

**Issue**: Images still fail to upload after adding env vars

1. Restart containers: `docker compose restart app worker`
2. Check logs: `docker compose logs app | tail -50`
3. Verify env vars are loaded: `docker compose exec app env | grep B2_`

**Issue**: Images upload but URLs are broken

1. Check bucket is public in B2 settings
2. Verify B2_ENDPOINT matches your bucket's region
3. Test direct B2 URL in browser

**Issue**: CDN URLs not working

1. Verify Cloudflare CNAME is set correctly
2. Check Cloudflare proxy is enabled (orange cloud)
3. Wait 5-10 minutes for DNS propagation

## Related Issues

- DIVE-v3z (Main issue)
- KAN-603: Tour image upload
- KAN-605: Boat image upload
- KAN-608: Equipment image upload
- KAN-609: Dive site image upload
- KAN-623: Course image upload

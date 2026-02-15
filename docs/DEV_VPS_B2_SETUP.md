# Dev VPS B2 Storage Configuration

## Overview

This document provides the configuration needed to enable B2 storage on the dev VPS (1296511 - 62.72.3.35).

## GitHub Secrets

The following secrets have been added to the `shooter51/divestreams-v2` repository:

✅ All secrets created on 2026-01-28:
- `B2_ENDPOINT` = s3.us-west-000.backblazeb2.com
- `B2_REGION` = us-west-000
- `B2_BUCKET` = 7052cb0a45260d5993cc0910
- `B2_KEY_ID` = 00002ba56d93c900000000007
- `B2_APP_KEY` = K0001urEkNGE/2mJCT38iP9lAhCDaYM
- `CDN_URL` = https://f7052cb0a45260d5993cc0910.backblazeb2.com

## Manual VPS Configuration

### Step 1: SSH into Dev VPS

```bash
ssh root@62.72.3.35
```

### Step 2: Navigate to Project Directory

```bash
cd /docker/divestreams-dev
```

### Step 3: Backup Current .env File

```bash
cp .env .env.backup-$(date +%Y%m%d-%H%M%S)
```

### Step 4: Add B2 Environment Variables

Edit the `.env` file and add these lines (or update if they exist):

```bash
# B2 Storage Configuration (DiveStreamsDev bucket)
B2_ENDPOINT=s3.us-west-000.backblazeb2.com
B2_REGION=us-west-000
B2_BUCKET=7052cb0a45260d5993cc0910
B2_KEY_ID=00002ba56d93c900000000007
B2_APP_KEY=K0001urEkNGE/2mJCT38iP9lAhCDaYM
CDN_URL=https://f7052cb0a45260d5993cc0910.backblazeb2.com
```

**Quick command to add all variables:**

```bash
# Add or update each variable
grep -q "B2_ENDPOINT" .env && sed -i 's|B2_ENDPOINT=.*|B2_ENDPOINT=s3.us-west-000.backblazeb2.com|' .env || echo 'B2_ENDPOINT=s3.us-west-000.backblazeb2.com' >> .env

grep -q "B2_REGION" .env && sed -i 's|B2_REGION=.*|B2_REGION=us-west-000|' .env || echo 'B2_REGION=us-west-000' >> .env

grep -q "B2_BUCKET" .env && sed -i 's|B2_BUCKET=.*|B2_BUCKET=7052cb0a45260d5993cc0910|' .env || echo 'B2_BUCKET=7052cb0a45260d5993cc0910' >> .env

grep -q "B2_KEY_ID" .env && sed -i 's|B2_KEY_ID=.*|B2_KEY_ID=00002ba56d93c900000000007|' .env || echo 'B2_KEY_ID=00002ba56d93c900000000007' >> .env

grep -q "B2_APP_KEY" .env && sed -i 's|B2_APP_KEY=.*|B2_APP_KEY=K0001urEkNGE/2mJCT38iP9lAhCDaYM|' .env || echo 'B2_APP_KEY=K0001urEkNGE/2mJCT38iP9lAhCDaYM' >> .env

grep -q "CDN_URL" .env && sed -i 's|CDN_URL=.*|CDN_URL=https://f7052cb0a45260d5993cc0910.backblazeb2.com|' .env || echo 'CDN_URL=https://f7052cb0a45260d5993cc0910.backblazeb2.com' >> .env
```

### Step 5: Verify Configuration

```bash
# Check that all variables are set correctly
grep -E "(B2_|CDN_)" .env
```

Expected output:
```
B2_ENDPOINT=s3.us-west-000.backblazeb2.com
B2_REGION=us-west-000
B2_BUCKET=7052cb0a45260d5993cc0910
B2_KEY_ID=00002ba56d93c900000000007
B2_APP_KEY=K0001urEkNGE/2mJCT38iP9lAhCDaYM
CDN_URL=https://f7052cb0a45260d5993cc0910.backblazeb2.com
```

### Step 6: Restart Containers

```bash
# Recreate containers with new environment variables
docker compose down
docker compose up -d
```

### Step 7: Verify Containers Started

```bash
docker compose ps
```

All containers should show status: `Up`

### Step 8: Test Image Upload

```bash
# Check application logs for B2 connection
docker compose logs app | grep -i "b2\|storage\|upload"
```

## Issues This Fixes

After completing this configuration, the following issues will be resolved on dev VPS:

- ✅ **KAN-603:** Error 500 when uploading picture on Tours
- ✅ **KAN-605:** Error 500 when uploading picture on Dive Sites
- ✅ **KAN-608:** (If exists) Any other image upload errors on dev

## Bucket Details

**Bucket:** DiveStreamsDev
- **Bucket ID:** 7052cb0a45260d5993cc0910
- **Region:** us-west-000
- **Endpoint:** s3.us-west-000.backblazeb2.com
- **CDN URL:** https://f7052cb0a45260d5993cc0910.backblazeb2.com

## Security Notes

- ✅ Credentials stored in GitHub Secrets (encrypted)
- ✅ `.env` file is in `.gitignore` (not committed to repo)
- ⚠️ VPS `.env` file should have restricted permissions: `chmod 600 .env`

## Troubleshooting

### Issue: Containers won't start after restart

```bash
# Check logs for errors
docker compose logs

# Check specific container
docker compose logs app
```

### Issue: Image uploads still failing

```bash
# Verify environment variables are loaded
docker compose exec app env | grep B2

# Check application is using correct bucket
docker compose logs app | tail -50
```

### Issue: Permission denied errors

```bash
# Check B2 credentials are correct
# Test with B2 CLI (if installed)
b2 authorize-account <B2_KEY_ID> <B2_APP_KEY>
b2 list-buckets
```

## CI/CD Integration

The GitHub Actions workflow already uses these secrets. When deploying to dev:

```yaml
# .github/workflows/deploy-dev.yml
env:
  B2_ENDPOINT: ${{ secrets.B2_ENDPOINT }}
  B2_REGION: ${{ secrets.B2_REGION }}
  B2_BUCKET: ${{ secrets.B2_BUCKET }}
  B2_KEY_ID: ${{ secrets.B2_KEY_ID }}
  B2_APP_KEY: ${{ secrets.B2_APP_KEY }}
  CDN_URL: ${{ secrets.CDN_URL }}
```

These are automatically injected into the `.env` file during deployment.

---

**Status:** ✅ GitHub Secrets configured
**Next Step:** Manual VPS configuration required (SSH access)
**Documentation Date:** 2026-01-28

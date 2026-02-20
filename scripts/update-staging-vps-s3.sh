#!/bin/bash
#
# Update Staging VPS S3 Storage Configuration
#
# This script updates the staging VPS (76.13.28.28) with S3 storage credentials
# from GitHub Secrets. Run this script as part of CI/CD or manually with proper auth.
#
# Usage: ./scripts/update-staging-vps-s3.sh
#
# Required GitHub Secrets:
#   - S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, CDN_URL
#   - STAGING_VPS_SSH_KEY (SSH private key for root@76.13.28.28)

set -e

STAGING_VPS="root@76.13.28.28"
PROJECT_DIR="/docker/divestreams-staging"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Updating Staging VPS S3 Storage Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "VPS: $STAGING_VPS"
echo "Project: $PROJECT_DIR"
echo ""

# Check required environment variables are set
if [ -z "$S3_ENDPOINT" ] || [ -z "$S3_ACCESS_KEY_ID" ] || [ -z "$S3_SECRET_ACCESS_KEY" ]; then
    echo "ERROR: Missing required environment variables"
    echo ""
    echo "Required variables:"
    echo "  S3_ENDPOINT=${S3_ENDPOINT:-(not set)}"
    echo "  S3_REGION=${S3_REGION:-(not set)}"
    echo "  S3_BUCKET=${S3_BUCKET:-(not set)}"
    echo "  S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID:+(set)}${S3_ACCESS_KEY_ID:-(not set)}"
    echo "  S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY:+(set)}${S3_SECRET_ACCESS_KEY:-(not set)}"
    echo "  CDN_URL=${CDN_URL:-(not set)}"
    echo ""
    echo "These should be provided via GitHub Secrets in CI/CD"
    echo "or exported in your shell for manual runs."
    exit 1
fi

echo "S3 environment variables verified"
echo ""

# Update VPS .env file via SSH
echo "Updating .env file on staging VPS..."
ssh "$STAGING_VPS" bash <<ENVSSH
cd $PROJECT_DIR

# Backup current .env
echo "Creating backup..."
cp .env .env.backup-\$(date +%Y%m%d-%H%M%S)

# Update or add S3 configuration
echo "Updating S3 variables..."
grep -q "^S3_ENDPOINT=" .env && sed -i "s|^S3_ENDPOINT=.*|S3_ENDPOINT=$S3_ENDPOINT|" .env || echo "S3_ENDPOINT=$S3_ENDPOINT" >> .env
grep -q "^S3_REGION=" .env && sed -i "s|^S3_REGION=.*|S3_REGION=$S3_REGION|" .env || echo "S3_REGION=$S3_REGION" >> .env
grep -q "^S3_BUCKET=" .env && sed -i "s|^S3_BUCKET=.*|S3_BUCKET=$S3_BUCKET|" .env || echo "S3_BUCKET=$S3_BUCKET" >> .env
grep -q "^S3_ACCESS_KEY_ID=" .env && sed -i "s|^S3_ACCESS_KEY_ID=.*|S3_ACCESS_KEY_ID=$S3_ACCESS_KEY_ID|" .env || echo "S3_ACCESS_KEY_ID=$S3_ACCESS_KEY_ID" >> .env
grep -q "^S3_SECRET_ACCESS_KEY=" .env && sed -i "s|^S3_SECRET_ACCESS_KEY=.*|S3_SECRET_ACCESS_KEY=$S3_SECRET_ACCESS_KEY|" .env || echo "S3_SECRET_ACCESS_KEY=$S3_SECRET_ACCESS_KEY" >> .env
grep -q "^CDN_URL=" .env && sed -i "s|^CDN_URL=.*|CDN_URL=$CDN_URL|" .env || echo "CDN_URL=$CDN_URL" >> .env

echo ""
echo "Updated S3 Configuration:"
grep -E "^(S3_|CDN_)" .env
ENVSSH

echo "Environment variables updated"
echo ""

# Restart containers to pick up new environment
echo "Restarting Docker containers..."
ssh "$STAGING_VPS" bash <<DOCKERSSH
cd $PROJECT_DIR

echo "Stopping containers..."
docker compose down

echo "Starting containers with new configuration..."
docker compose up -d

echo "Waiting for containers to start..."
sleep 15

echo ""
echo "Container Status:"
docker compose ps
DOCKERSSH

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Staging VPS S3 Configuration Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Test image upload on staging (https://staging.divestreams.com)"
echo "  2. Verify images appear in DiveStreamsDev bucket"
echo "  3. Check application logs for S3 connection errors"
echo ""
echo "Issues resolved:"
echo "  - KAN-603: Error 500 uploading picture on Tours"
echo "  - KAN-605: Error 500 uploading picture on Dive Sites"
echo ""

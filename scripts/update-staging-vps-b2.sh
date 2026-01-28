#!/bin/bash
#
# Update Staging VPS B2 Storage Configuration
#
# This script updates the staging VPS (76.13.28.28) with B2 storage credentials
# from GitHub Secrets. Run this script as part of CI/CD or manually with proper auth.
#
# Usage: ./scripts/update-staging-vps-b2.sh
#
# Required GitHub Secrets:
#   - B2_ENDPOINT, B2_REGION, B2_BUCKET, B2_KEY_ID, B2_APP_KEY, CDN_URL
#   - STAGING_VPS_SSH_KEY (SSH private key for root@76.13.28.28)

set -e

STAGING_VPS="root@76.13.28.28"
PROJECT_DIR="/docker/divestreams-staging"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Updating Staging VPS B2 Storage Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "VPS: $STAGING_VPS"
echo "Project: $PROJECT_DIR"
echo ""

# Check required environment variables are set
if [ -z "$B2_ENDPOINT" ] || [ -z "$B2_KEY_ID" ] || [ -z "$B2_APP_KEY" ]; then
    echo "❌ ERROR: Missing required environment variables"
    echo ""
    echo "Required variables:"
    echo "  B2_ENDPOINT=${B2_ENDPOINT:-(not set)}"
    echo "  B2_REGION=${B2_REGION:-(not set)}"
    echo "  B2_BUCKET=${B2_BUCKET:-(not set)}"
    echo "  B2_KEY_ID=${B2_KEY_ID:+(set)}${B2_KEY_ID:-(not set)}"
    echo "  B2_APP_KEY=${B2_APP_KEY:+(set)}${B2_APP_KEY:-(not set)}"
    echo "  CDN_URL=${CDN_URL:-(not set)}"
    echo ""
    echo "These should be provided via GitHub Secrets in CI/CD"
    echo "or exported in your shell for manual runs."
    exit 1
fi

echo "✅ B2 environment variables verified"
echo ""

# Update VPS .env file via SSH
echo "📝 Updating .env file on staging VPS..."
ssh "$STAGING_VPS" bash <<ENVSSH
cd $PROJECT_DIR

# Backup current .env
echo "Creating backup..."
cp .env .env.backup-\$(date +%Y%m%d-%H%M%S)

# Update or add B2 configuration
echo "Updating B2 variables..."
grep -q "^B2_ENDPOINT=" .env && sed -i "s|^B2_ENDPOINT=.*|B2_ENDPOINT=$B2_ENDPOINT|" .env || echo "B2_ENDPOINT=$B2_ENDPOINT" >> .env
grep -q "^B2_REGION=" .env && sed -i "s|^B2_REGION=.*|B2_REGION=$B2_REGION|" .env || echo "B2_REGION=$B2_REGION" >> .env
grep -q "^B2_BUCKET=" .env && sed -i "s|^B2_BUCKET=.*|B2_BUCKET=$B2_BUCKET|" .env || echo "B2_BUCKET=$B2_BUCKET" >> .env
grep -q "^B2_KEY_ID=" .env && sed -i "s|^B2_KEY_ID=.*|B2_KEY_ID=$B2_KEY_ID|" .env || echo "B2_KEY_ID=$B2_KEY_ID" >> .env
grep -q "^B2_APP_KEY=" .env && sed -i "s|^B2_APP_KEY=.*|B2_APP_KEY=$B2_APP_KEY|" .env || echo "B2_APP_KEY=$B2_APP_KEY" >> .env
grep -q "^CDN_URL=" .env && sed -i "s|^CDN_URL=.*|CDN_URL=$CDN_URL|" .env || echo "CDN_URL=$CDN_URL" >> .env

echo ""
echo "Updated B2 Configuration:"
grep -E "^(B2_|CDN_)" .env
ENVSSH

echo "✅ Environment variables updated"
echo ""

# Restart containers to pick up new environment
echo "🔄 Restarting Docker containers..."
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
echo "✅ Staging VPS B2 Configuration Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Test image upload on staging (https://staging.divestreams.com)"
echo "  2. Verify images appear in DiveStreamsDev bucket"
echo "  3. Check application logs for B2 connection errors"
echo ""
echo "Issues resolved:"
echo "  - KAN-603: Error 500 uploading picture on Tours"
echo "  - KAN-605: Error 500 uploading picture on Dive Sites"
echo ""

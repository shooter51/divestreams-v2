#!/bin/bash
#
# Update Dev VPS B2 Storage Configuration
#
# This script updates the dev VPS (62.72.3.35) with B2 storage credentials.
# Run this script from your local machine with SSH access to the VPS.
#
# Usage: ./scripts/update-dev-vps-b2.sh

set -e

DEV_VPS="root@62.72.3.35"
PROJECT_DIR="/docker/divestreams-dev"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Updating Dev VPS B2 Storage Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "VPS: $DEV_VPS"
echo "Project: $PROJECT_DIR"
echo ""

# Check SSH connectivity
echo "📡 Testing SSH connection..."
if ! ssh -o ConnectTimeout=10 "$DEV_VPS" "echo 'SSH connection successful'"; then
    echo "❌ ERROR: Cannot connect to VPS via SSH"
    echo ""
    echo "Please ensure:"
    echo "  1. You have SSH key access to the VPS"
    echo "  2. The VPS is online and accessible"
    echo "  3. Your IP is not blocked by the firewall"
    echo ""
    echo "Alternative: Run commands manually (see docs/DEV_VPS_B2_SETUP.md)"
    exit 1
fi

echo "✅ SSH connection successful"
echo ""

# Update VPS environment variables
echo "📝 Updating .env file on VPS..."
ssh "$DEV_VPS" bash << 'ENVSSH'
cd /docker/divestreams-dev

# Backup current .env
echo "Creating backup..."
cp .env .env.backup-$(date +%Y%m%d-%H%M%S)

# Update or add B2 configuration
echo "Updating B2 variables..."
grep -q "B2_ENDPOINT" .env && sed -i 's|B2_ENDPOINT=.*|B2_ENDPOINT=s3.us-west-000.backblazeb2.com|' .env || echo 'B2_ENDPOINT=s3.us-west-000.backblazeb2.com' >> .env
grep -q "B2_REGION" .env && sed -i 's|B2_REGION=.*|B2_REGION=us-west-000|' .env || echo 'B2_REGION=us-west-000' >> .env
grep -q "B2_BUCKET" .env && sed -i 's|B2_BUCKET=.*|B2_BUCKET=7052cb0a45260d5993cc0910|' .env || echo 'B2_BUCKET=7052cb0a45260d5993cc0910' >> .env
grep -q "B2_KEY_ID" .env && sed -i 's|B2_KEY_ID=.*|B2_KEY_ID=00002ba56d93c900000000007|' .env || echo 'B2_KEY_ID=00002ba56d93c900000000007' >> .env
grep -q "B2_APP_KEY" .env && sed -i 's|B2_APP_KEY=.*|B2_APP_KEY=K0001urEkNGE/2mJCT38iP9lAhCDaYM|' .env || echo 'B2_APP_KEY=K0001urEkNGE/2mJCT38iP9lAhCDaYM' >> .env
grep -q "CDN_URL" .env && sed -i 's|CDN_URL=.*|CDN_URL=https://f7052cb0a45260d5993cc0910.backblazeb2.com|' .env || echo 'CDN_URL=https://f7052cb0a45260d5993cc0910.backblazeb2.com' >> .env

echo ""
echo "Updated B2 Configuration:"
grep -E "(B2_|CDN_)" .env
ENVSSH

echo "✅ Environment variables updated"
echo ""

# Restart containers
echo "🔄 Restarting Docker containers..."
ssh "$DEV_VPS" bash << 'DOCKERSSH'
cd /docker/divestreams-dev

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
echo "✅ Dev VPS B2 Configuration Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Test image upload on dev environment (http://62.72.3.35)"
echo "  2. Verify images appear in DiveStreamsDev bucket"
echo "  3. Check application logs: ssh $DEV_VPS 'cd $PROJECT_DIR && docker compose logs app'"
echo ""
echo "Issues resolved:"
echo "  - KAN-603: Error 500 uploading picture on Tours"
echo "  - KAN-605: Error 500 uploading picture on Dive Sites"
echo ""

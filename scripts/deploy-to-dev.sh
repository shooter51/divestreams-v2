#!/bin/bash
# Deploy feature branch to dev VPS
# Usage: ./deploy-to-dev.sh

set -e

echo "🚀 Deploying feature/KAN-652-customer-booking-cancellation to dev VPS..."

# VPS details
VPS_ID="1296511"
PROJECT_NAME="divestreams-dev"
IMAGE_TAG="staging"  # Dev uses staging tag

# Check if HOSTINGER_API_TOKEN is set
if [ -z "$HOSTINGER_API_TOKEN" ]; then
  echo "❌ Error: HOSTINGER_API_TOKEN environment variable not set"
  echo "Please set it: export HOSTINGER_API_TOKEN=your_token"
  exit 1
fi

echo "📦 Step 1: Trigger GitHub Actions to build Docker image..."
echo "   Go to: https://github.com/shooter51/divestreams-v2/actions/workflows/manual-deploy.yml"
echo "   Click 'Run workflow' and select 'staging' to build the :staging tag"
echo ""
read -p "Press Enter when the build is complete..."

echo ""
echo "🔄 Step 2: Pulling latest image on dev VPS..."
curl -X POST \
  "https://developers.hostinger.com/api/vps/v1/virtual-machines/$VPS_ID/docker/$PROJECT_NAME/update" \
  -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
  -H "Content-Type: application/json" \
  --fail-with-body

echo ""
echo "⏳ Waiting 45 seconds for deployment to stabilize..."
sleep 45

echo ""
echo "✅ Checking container status..."
RESPONSE=$(curl -s -X GET \
  "https://developers.hostinger.com/api/vps/v1/virtual-machines/$VPS_ID/docker/$PROJECT_NAME/containers" \
  -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
  -H "Content-Type: application/json")

echo "$RESPONSE" | jq .

RUNNING_COUNT=$(echo "$RESPONSE" | jq '[.[] | select(.state == "running")] | length')
echo ""
echo "Running containers: $RUNNING_COUNT / 5"

if [ "$RUNNING_COUNT" -lt 4 ]; then
  echo "⚠️  Warning: Expected at least 4 containers running, found $RUNNING_COUNT"
  echo "Check logs with: curl -X GET \"https://developers.hostinger.com/api/vps/v1/virtual-machines/$VPS_ID/docker/$PROJECT_NAME/logs\" -H \"Authorization: Bearer \$HOSTINGER_API_TOKEN\""
  exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo "🌐 Dev site: http://62.72.3.35 (or http://dev.divestreams.com once DNS is configured)"
echo ""
echo "📋 To check logs:"
echo "   curl -X GET \"https://developers.hostinger.com/api/vps/v1/virtual-machines/$VPS_ID/docker/$PROJECT_NAME/logs\" -H \"Authorization: Bearer \$HOSTINGER_API_TOKEN\" | jq ."

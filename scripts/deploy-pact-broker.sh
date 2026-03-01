#!/usr/bin/env bash

#
# Deploy Pact Broker to Dev VPS
#
# This script uploads files and deploys the Pact Broker to the Dev VPS
#
# Usage:
#   ./scripts/deploy-pact-broker.sh
#

set -e

# Configuration
VPS_IP="62.72.3.35"
VPS_USER="root"
DEPLOY_DIR="/opt/pact-broker"

echo "🚀 Deploying Pact Broker to Dev VPS ($VPS_IP)..."

# Step 1: Create deployment directory
echo "📁 Creating deployment directory..."
ssh $VPS_USER@$VPS_IP "mkdir -p $DEPLOY_DIR"

# Step 2: Upload files
echo "📤 Uploading files..."
scp docker-compose.pact-broker.yml $VPS_USER@$VPS_IP:$DEPLOY_DIR/
scp .env.pact-broker.example $VPS_USER@$VPS_IP:$DEPLOY_DIR/.env

# Step 3: Generate secure password
echo "🔐 Generating secure password..."
SECURE_PASSWORD=$(openssl rand -base64 32)

# Step 4: Configure environment
echo "⚙️  Configuring environment..."
ssh $VPS_USER@$VPS_IP << EOF
cd $DEPLOY_DIR

# Update .env with secure password
sed -i "s/change_me_to_secure_password/$SECURE_PASSWORD/" .env

# Show configuration
echo "Configuration:"
cat .env
EOF

# Step 5: Deploy containers
echo "🐳 Deploying containers..."
ssh $VPS_USER@$VPS_IP << 'EOF'
cd /opt/pact-broker

# Pull images
docker compose -f docker-compose.pact-broker.yml pull

# Start services
docker compose -f docker-compose.pact-broker.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check status
docker compose -f docker-compose.pact-broker.yml ps

echo ""
echo "📊 Container logs:"
docker compose -f docker-compose.pact-broker.yml logs --tail=20
EOF

# Step 6: Test deployment
echo "🧪 Testing deployment..."
sleep 5

ssh $VPS_USER@$VPS_IP "curl -f http://localhost:9292/diagnostic/status/heartbeat" && \
  echo "✅ Pact Broker is healthy!" || \
  echo "❌ Pact Broker health check failed"

# Step 7: Instructions for Caddy
echo ""
echo "✨ Pact Broker deployed successfully!"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Configure system Caddy on the VPS:"
echo "   ssh $VPS_USER@$VPS_IP"
echo "   nano /etc/caddy/Caddyfile  # (or wherever Caddy config is)"
echo ""
echo "   Add this block:"
echo ""
echo "   pact.dev.divestreams.com {"
echo "       reverse_proxy localhost:9292"
echo "       encode gzip"
echo "   }"
echo ""
echo "   Then reload Caddy:"
echo "   systemctl reload caddy  # OR: docker exec caddy caddy reload"
echo ""
echo "2. Configure DNS:"
echo "   Add A record: pact.dev.divestreams.com -> $VPS_IP"
echo ""
echo "3. Add GitHub secret:"
echo "   PACT_BROKER_BASE_URL=https://pact.dev.divestreams.com"
echo ""
echo "4. Test publishing:"
echo "   export PACT_BROKER_BASE_URL=https://pact.dev.divestreams.com"
echo "   npm run pact:consumer"
echo "   npm run pact:publish"
echo ""
echo "📖 Full instructions: PACT_BROKER_DEPLOYMENT.md"
echo ""

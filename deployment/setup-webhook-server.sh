#!/bin/bash
# Setup Vibe Kanban Webhook Handler on a server
#
# This script installs and configures the webhook handler as a systemd service

set -e

echo "🚀 Setting up Vibe Kanban Webhook Handler"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (use sudo)"
  exit 1
fi

# Configuration
INSTALL_DIR="/opt/divestreams-automation"
SERVICE_FILE="/etc/systemd/system/vibe-webhook.service"
USER="deployer"

# Create installation directory
echo "📁 Creating installation directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# Copy webhook handler script
echo "📋 Copying webhook handler..."
cp scripts/vibe-webhook-handler.mjs "$INSTALL_DIR/"
cp scripts/vibe-auto-workspace.ts "$INSTALL_DIR/"
cp scripts/install-hooks.sh "$INSTALL_DIR/"
cp scripts/post-commit-push.sh "$INSTALL_DIR/"
cp package.json "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/scripts/"*.{mjs,sh,ts}

# Create .env file if it doesn't exist
if [ ! -f "$INSTALL_DIR/.env" ]; then
  echo "📝 Creating .env file..."
  cat > "$INSTALL_DIR/.env" <<EOF
# Vibe Kanban Webhook Configuration
PORT=3000
WEBHOOK_SECRET=change-me-to-a-secure-secret
VK_API_URL=https://api.vibe-kanban.com/v1
VK_API_TOKEN=your-api-token-here

# Git configuration
GIT_REPO_PATH=/path/to/divestreams-v2
EOF
  echo "⚠️  Please edit $INSTALL_DIR/.env with your actual configuration"
fi

# Install dependencies
echo "📦 Installing dependencies..."
cd "$INSTALL_DIR"
npm install --production

# Create systemd service
echo "🔧 Installing systemd service..."
cp deployment/vibe-webhook.service "$SERVICE_FILE"

# Set permissions
echo "🔐 Setting permissions..."
chown -R "$USER:$USER" "$INSTALL_DIR"

# Enable and start service
echo "✅ Enabling and starting service..."
systemctl daemon-reload
systemctl enable vibe-webhook
systemctl start vibe-webhook

# Check status
echo ""
echo "📊 Service status:"
systemctl status vibe-webhook --no-pager

echo ""
echo "✅ Vibe Kanban Webhook Handler installed successfully!"
echo ""
echo "📝 Next steps:"
echo "  1. Edit $INSTALL_DIR/.env with your configuration"
echo "  2. Restart the service: sudo systemctl restart vibe-webhook"
echo "  3. Configure Vibe Kanban webhook URL: http://your-server:3000/webhook/vibe-kanban"
echo "  4. View logs: sudo journalctl -u vibe-webhook -f"
echo ""
echo "🔐 Don't forget to set a secure WEBHOOK_SECRET!"

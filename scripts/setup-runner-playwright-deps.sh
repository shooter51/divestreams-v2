#!/bin/bash
#
# One-time setup script for GitHub Actions self-hosted runner
# Installs Playwright system dependencies so tests can run without sudo
#
# Run this on the staging VPS as root:
#   ssh root@100.109.71.112  # Test VPS via Tailscale
#   curl -sSL https://raw.githubusercontent.com/shooter51/divestreams-v2/staging/scripts/setup-runner-playwright-deps.sh | bash
#
# Or manually from the repo:
#   git pull origin staging
#   sudo bash scripts/setup-runner-playwright-deps.sh

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎭 Playwright System Dependencies Setup for GitHub Runner"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ This script must be run as root"
  echo "   Run: sudo bash $0"
  exit 1
fi

echo "📦 Installing Playwright Chromium system dependencies..."
echo ""

# Install dependencies using Playwright's official installer
# This installs packages like: libatk-1.0.so.0, libcups2, libasound2, etc.
npx playwright install-deps chromium

echo ""
echo "✅ Playwright system dependencies installed successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 What was installed:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "System packages for running Chromium headless:"
echo "  • libatk-1.0.so.0 (Accessibility Toolkit)"
echo "  • libcups2 (Printing support)"
echo "  • libasound2 (Audio)"
echo "  • libxcomposite1, libxdamage1 (X11 compositing)"
echo "  • libxrandr2 (Screen resolution)"
echo "  • libgbm1 (Graphics buffer management)"
echo "  • libpango-1.0-0 (Text rendering)"
echo "  • And other required libraries..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Verify installation worked:"
echo "   su - github-runner -c 'npx playwright install chromium && npx playwright test --version'"
echo ""
echo "2. Test E2E suite:"
echo "   su - github-runner -c 'cd /path/to/divestreams-v2 && npm run test:e2e'"
echo ""
echo "3. Push to staging to trigger CI/CD:"
echo "   git push origin staging"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

#!/bin/bash
# Setup script for E2E tests - adds e2etest.localhost to /etc/hosts
# Required because Chrome cannot resolve *.localhost subdomains without explicit hosts entry

set -e

HOSTS_FILE="/etc/hosts"
ENTRY_IPV4="127.0.0.1 e2etest.localhost"
ENTRY_IPV6="::1 e2etest.localhost"

echo "E2E Test Environment Setup"
echo "=========================="
echo ""

# Check and add IPv4 entry
if grep -q "127.0.0.1.*e2etest.localhost" "$HOSTS_FILE"; then
  echo "✓ IPv4 entry already exists in /etc/hosts"
else
  echo "Adding IPv4 entry to /etc/hosts..."
  echo "$ENTRY_IPV4" | sudo tee -a "$HOSTS_FILE" > /dev/null
  echo "✓ IPv4 entry added"
fi

# Check and add IPv6 entry
if grep -q "::1.*e2etest.localhost" "$HOSTS_FILE"; then
  echo "✓ IPv6 entry already exists in /etc/hosts"
else
  echo "Adding IPv6 entry to /etc/hosts..."
  echo "$ENTRY_IPV6" | sudo tee -a "$HOSTS_FILE" > /dev/null
  echo "✓ IPv6 entry added"
fi

# Always flush DNS cache (even if entries exist)
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo ""
  echo "Flushing DNS cache (required for Chrome)..."
  sudo dscacheutil -flushcache
  sudo killall -HUP mDNSResponder
  echo "✓ DNS cache flushed"
fi

echo ""
echo "✓ E2E test environment setup complete!"
echo ""
echo "Verify with: grep e2etest /etc/hosts"
echo "Then run: npm run test:e2e:failing"

/**
 * Subdomain-aware test fixture
 *
 * Re-exports Playwright test utilities.
 *
 * NOTE: Chrome cannot resolve *.localhost subdomains (net::ERR_ABORTED)
 * without an /etc/hosts entry. Before running E2E tests:
 *
 * 1. Run: ./scripts/setup-e2e-hosts.sh
 * 2. OR manually add to /etc/hosts: 127.0.0.1 e2etest.localhost
 *
 * For CI/CD, the GitHub Actions workflow automatically adds the hosts entry.
 */

export { test, expect } from "@playwright/test";

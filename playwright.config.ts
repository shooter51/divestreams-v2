import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

// Load .env file before config is evaluated
dotenv.config();

const collectCoverage = process.env.E2E_COVERAGE === "true";
const baseURL = process.env.BASE_URL || "http://localhost:5173";
// Detect remote tests: any URL that's not localhost (supports both http:// and https://)
// or when explicitly disabled via SKIP_WEB_SERVER (for prod-build smoke tests)
const isRemoteTest = !baseURL.includes("localhost") || process.env.SKIP_WEB_SERVER === "true";

export default defineConfig({
  testDir: "./tests/e2e",
  // Skip dev-specific tests in CI (they use remote dev URLs not available in CI)
  testIgnore: process.env.CI ? ["**/*-dev*.spec.ts"] : [],
  fullyParallel: false, // Sequential for coverage collection
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker for coverage
  reporter: [
    ["html", { open: "never" }],
    ["list"],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  // Global setup/teardown for coverage and environment
  // Skip global setup when testing against remote staging (data already exists)
  globalSetup: isRemoteTest
    ? undefined
    : collectCoverage
      ? "./tests/e2e/coverage/global-setup.ts"
      : "./tests/e2e/global-setup.ts",
  globalTeardown: collectCoverage ? "./tests/e2e/coverage/global-teardown.ts" : undefined,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Uncomment for cross-browser testing
    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },
    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },
  ],
  // Only start local webServer when testing against localhost
  // For remote tests (smoke tests against staging), skip webServer
  // IMPORTANT: CI/CD relies on this webServer config to auto-start dev server
  // See .github/workflows/deploy.yml - no separate build step needed for E2E tests
  webServer: isRemoteTest
    ? undefined
    : {
        command: collectCoverage ? "npm run dev:coverage" : "npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          // Ensure critical vars are passed to dev server
          DATABASE_URL: process.env.DATABASE_URL || "",
          REDIS_URL: process.env.REDIS_URL || "",
          AUTH_SECRET: process.env.AUTH_SECRET || "test-secret",
          ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "DiveAdmin2026",
          // URL utilities need these to allow localhost in CI
          APP_URL: process.env.APP_URL || "http://localhost:5173",
          CI: process.env.CI || "true",
          GITHUB_ACTIONS: process.env.GITHUB_ACTIONS || "",
          // Extra indicator for Playwright
          PLAYWRIGHT_TEST_BASE_URL: "http://localhost:5173",
          // Coverage instrumentation
          E2E_COVERAGE: process.env.E2E_COVERAGE || "",
        },
      },
  // Output directory for test artifacts
  outputDir: "test-results/",
});

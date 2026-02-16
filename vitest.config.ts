import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.test if it exists (for integration tests)
// Copy .env.test.example to .env.test and customize for your environment
if (process.env.VITEST_INTEGRATION) {
  config({ path: resolve(process.cwd(), ".env.test") });
}

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    conditions: ["node"],
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**/*", "node_modules/**/*"],
    setupFiles: ["./tests/setup/test-utils.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage/unit",
      // Focus on lib/ for unit test coverage (app/ routes covered by E2E tests)
      include: ["lib/**/*.ts", "lib/**/*.tsx"],
      exclude: [
        "**/*.d.ts",
        "**/types.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/node_modules/**",
        ".react-router/**",
        // Exclude stubs
        "lib/stubs/**",
        // Exclude routes from unit coverage (covered by integration tests)
        "app/routes/**",
        // Exclude integration-heavy code better suited for integration tests
        "lib/integrations/**",
        "lib/jobs/**",
        "lib/storage/**",
        "lib/middleware/**",
        "lib/stripe/**",
        "lib/cache/**",
        "lib/training/**",
      ],
      thresholds: {
        lines: 60,
        functions: 54,
        branches: 60,
        statements: 60,
      },
    },
    testTimeout: 60000,  // Increased for CI environment
    hookTimeout: 60000,
    pool: "forks",
  },
});

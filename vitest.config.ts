import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
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
      // Include both app/ and lib/ for full coverage
      include: ["app/**/*.ts", "app/**/*.tsx", "lib/**/*.ts", "lib/**/*.tsx"],
      exclude: [
        "**/*.d.ts",
        "**/types.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/node_modules/**",
        ".react-router/**",
        // Exclude integration/external service code (better tested via integration tests)
        "lib/integrations/**",
        "lib/stripe/**",
        "lib/email/**",
        // Exclude stubs
        "lib/stubs/**",
      ],
      // No thresholds - we'll track improvement over time
    },
    testTimeout: 60000,  // Increased for CI environment
    hookTimeout: 60000,
    pool: "forks",
  },
});

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
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      // Focus coverage on business logic in lib/, routes are tested via E2E
      include: ["lib/**/*.ts", "lib/**/*.tsx"],
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
      ],
      thresholds: {
        // Current baseline - incrementally increase as coverage improves
        // Current: ~27% statements, ~11% branches, ~14% functions, ~28% lines
        statements: 25,
        branches: 10,
        functions: 12,
        lines: 25,
      },
    },
    testTimeout: 60000,  // Increased for CI environment
    hookTimeout: 60000,
    pool: "forks",
  },
});

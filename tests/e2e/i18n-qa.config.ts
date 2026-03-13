import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "i18n-qa.spec.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 30000,
  expect: { timeout: 10000 },
  use: {
    baseURL: "https://demo.test.divestreams.com",
    trace: "off",
    screenshot: "only-on-failure",
    actionTimeout: 15000,
    navigationTimeout: 30000,
    ...devices["Desktop Chrome"],
  },
});

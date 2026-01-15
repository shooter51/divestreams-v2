import { test as base, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const coverageDir = path.join(process.cwd(), ".nyc_output");

// Extend the base test with coverage collection
export const test = base.extend<{ coveragePage: Page }>({
  coveragePage: async ({ page }, use, testInfo) => {
    // Use the page normally
    await use(page);

    // Only collect coverage if enabled
    if (process.env.E2E_COVERAGE !== "true") {
      return;
    }

    // After the test, collect coverage from the browser
    try {
      const coverage = await page.evaluate(() => {
        // @ts-ignore - Istanbul injects this global
        return window.__coverage__;
      });

      if (coverage) {
        // Ensure coverage directory exists
        if (!fs.existsSync(coverageDir)) {
          fs.mkdirSync(coverageDir, { recursive: true });
        }

        // Write coverage data with unique filename
        const hash = crypto.randomBytes(8).toString("hex");
        const filename = `coverage-${testInfo.workerIndex}-${hash}.json`;
        const filepath = path.join(coverageDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(coverage));
        console.log(`Coverage collected: ${filename}`);
      }
    } catch (error) {
      // Coverage collection is best-effort
      console.log("Could not collect coverage:", (error as Error).message);
    }
  },
});

export { expect } from "@playwright/test";

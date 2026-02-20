import { FullConfig, chromium } from "@playwright/test";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const coverageDir = path.join(process.cwd(), ".nyc_output");

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function globalTeardown(_config: FullConfig) {
  console.log("E2E Coverage Global Teardown starting...");

  // Try to collect coverage from a final page load
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Navigate to the app to collect any accumulated coverage
    const baseURL = process.env.BASE_URL || "http://localhost:5173";
    await page.goto(baseURL, { timeout: 10000 }).catch(() => {});

    // Collect coverage data
    const coverage = await page.evaluate(() => {
      // @ts-expect-error -- Istanbul injects this global
      return (window as { __coverage__?: Record<string, unknown> }).__coverage__;
    }).catch(() => null);

    if (coverage) {
      if (!fs.existsSync(coverageDir)) {
        fs.mkdirSync(coverageDir, { recursive: true });
      }

      const filename = `coverage-e2e-final.json`;
      const filepath = path.join(coverageDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(coverage));
      console.log(`Coverage collected: ${filename}`);
    } else {
      console.log("No window.__coverage__ found - app may not be instrumented");
    }

    await browser.close();
  } catch (error) {
    console.log("Could not collect final coverage:", (error as Error).message);
  }

  // Check if we have coverage data
  const files = fs.existsSync(coverageDir) ? fs.readdirSync(coverageDir).filter(f => f.endsWith('.json')) : [];

  if (files.length === 0) {
    console.log("No E2E coverage data collected");
    return;
  }

  console.log(`Found ${files.length} coverage file(s)`);

  // Generate coverage report using nyc
  try {
    execSync("npx nyc report --reporter=json --reporter=text --reporter=html --report-dir=coverage/e2e", {
      stdio: "inherit",
      cwd: process.cwd(),
    });
    console.log("E2E coverage report generated in coverage/e2e/");
  } catch (error) {
    console.error("Failed to generate coverage report:", error);
  }
}

export default globalTeardown;

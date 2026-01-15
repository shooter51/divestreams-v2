import { FullConfig } from "@playwright/test";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const coverageDir = path.join(process.cwd(), ".nyc_output");

async function globalTeardown(config: FullConfig) {
  // Check if we have coverage data
  const files = fs.existsSync(coverageDir) ? fs.readdirSync(coverageDir) : [];

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

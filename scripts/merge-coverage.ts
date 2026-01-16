/**
 * Merge coverage reports from unit tests (Vitest) and E2E tests (Playwright)
 * into a combined coverage report.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const coverageDir = path.join(process.cwd(), "coverage");
const unitCoverageDir = path.join(coverageDir, "unit");
const e2eCoverageDir = path.join(coverageDir, "e2e");
const combinedDir = path.join(coverageDir, "combined");
const nycOutputDir = path.join(process.cwd(), ".nyc_output");

async function mergeCoverage() {
  console.log("=== Merging Coverage Reports ===\n");

  // Ensure combined directory exists
  if (!fs.existsSync(combinedDir)) {
    fs.mkdirSync(combinedDir, { recursive: true });
  }

  // Clear and recreate .nyc_output for merging
  if (fs.existsSync(nycOutputDir)) {
    fs.rmSync(nycOutputDir, { recursive: true });
  }
  fs.mkdirSync(nycOutputDir, { recursive: true });

  let coverageCount = 0;

  // Copy unit test coverage
  const unitCoverageFile = path.join(unitCoverageDir, "coverage-final.json");
  if (fs.existsSync(unitCoverageFile)) {
    const dest = path.join(nycOutputDir, "unit-coverage.json");
    fs.copyFileSync(unitCoverageFile, dest);
    console.log("✓ Unit test coverage copied");
    coverageCount++;
  } else {
    console.log("✗ No unit test coverage found at", unitCoverageFile);
  }

  // Copy E2E test coverage
  const e2eCoverageFile = path.join(e2eCoverageDir, "coverage-final.json");
  if (fs.existsSync(e2eCoverageFile)) {
    const dest = path.join(nycOutputDir, "e2e-coverage.json");
    fs.copyFileSync(e2eCoverageFile, dest);
    console.log("✓ E2E test coverage copied");
    coverageCount++;
  } else {
    console.log("✗ No E2E test coverage found at", e2eCoverageFile);
  }

  // Also check for raw .nyc_output files from E2E (collected during tests)
  const rawNycFiles = fs.readdirSync(nycOutputDir).filter((f) => f.startsWith("coverage-"));
  if (rawNycFiles.length > 0) {
    console.log(`✓ Found ${rawNycFiles.length} raw coverage file(s) from E2E tests`);
    coverageCount += rawNycFiles.length;
  }

  if (coverageCount === 0) {
    console.log("\n✗ No coverage data found to merge");
    process.exit(1);
  }

  // Generate merged report
  console.log("\nGenerating combined coverage report...\n");

  try {
    execSync(
      "npx nyc report --reporter=text --reporter=text-summary --reporter=html --reporter=json --report-dir=coverage/combined",
      {
        stdio: "inherit",
        cwd: process.cwd(),
      }
    );

    console.log("\n=== Coverage Report Generated ===");
    console.log("HTML report: coverage/combined/index.html");
    console.log("JSON report: coverage/combined/coverage-final.json");

    // Read and display summary
    const summaryFile = path.join(combinedDir, "coverage-summary.json");
    if (fs.existsSync(summaryFile)) {
      const summary = JSON.parse(fs.readFileSync(summaryFile, "utf-8"));
      const total = summary.total;

      console.log("\n=== Coverage Summary ===");
      console.log(`Statements: ${total.statements.pct.toFixed(2)}%`);
      console.log(`Branches:   ${total.branches.pct.toFixed(2)}%`);
      console.log(`Functions:  ${total.functions.pct.toFixed(2)}%`);
      console.log(`Lines:      ${total.lines.pct.toFixed(2)}%`);
    }
  } catch (error) {
    console.error("Failed to generate coverage report:", error);
    process.exit(1);
  }
}

mergeCoverage().catch(console.error);

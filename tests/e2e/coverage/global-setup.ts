import { FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const coverageDir = path.join(process.cwd(), ".nyc_output");

async function globalSetup(config: FullConfig) {
  // Clean up previous coverage data
  if (fs.existsSync(coverageDir)) {
    fs.rmSync(coverageDir, { recursive: true });
  }
  fs.mkdirSync(coverageDir, { recursive: true });

  console.log("Coverage collection initialized");
}

export default globalSetup;

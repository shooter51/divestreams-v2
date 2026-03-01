import { FullConfig } from "@playwright/test";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

const coverageDir = path.join(process.cwd(), ".nyc_output");

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function globalSetup(_config: FullConfig) {
  // Load .env file
  const envPath = path.join(process.cwd(), ".env");
  dotenv.config({ path: envPath });
  console.log("Environment variables loaded from .env");

  // Clean up previous coverage data
  if (fs.existsSync(coverageDir)) {
    fs.rmSync(coverageDir, { recursive: true });
  }
  fs.mkdirSync(coverageDir, { recursive: true });

  console.log("Coverage collection initialized");
}

export default globalSetup;

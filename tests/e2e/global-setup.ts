import { FullConfig } from "@playwright/test";
import * as dotenv from "dotenv";
import * as path from "path";

async function globalSetup(config: FullConfig) {
  // Load .env file
  const envPath = path.join(process.cwd(), ".env");
  dotenv.config({ path: envPath });

  console.log("Environment variables loaded from .env");
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? "SET" : "NOT SET"}`);
  console.log(`REDIS_URL: ${process.env.REDIS_URL ? "SET" : "NOT SET"}`);
}

export default globalSetup;

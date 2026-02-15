#!/usr/bin/env node

/**
 * Publish Pact contracts to Pact Broker
 *
 * Usage: npm run pact:publish
 *
 * Environment variables:
 * - PACT_BROKER_BASE_URL: URL of the Pact Broker (e.g., https://your-org.pactflow.io)
 * - PACT_BROKER_TOKEN: Authentication token for the Pact Broker
 * - GITHUB_SHA: Git commit SHA (defaults to "dev" in local)
 * - GITHUB_REF_NAME: Git branch name (defaults to "local" in local)
 */

import { Publisher } from "@pact-foundation/pact-node";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get version information
const gitSha = process.env.GITHUB_SHA || execSync("git rev-parse HEAD").toString().trim();
const gitBranch = process.env.GITHUB_REF_NAME || execSync("git rev-parse --abbrev-ref HEAD").toString().trim();

// Pact Broker configuration
const pactBrokerUrl = process.env.PACT_BROKER_BASE_URL;
const pactBrokerToken = process.env.PACT_BROKER_TOKEN;

if (!pactBrokerUrl) {
  console.error("❌ PACT_BROKER_BASE_URL environment variable is not set");
  console.log("   Set it to your Pact Broker URL (e.g., https://your-org.pactflow.io)");
  process.exit(1);
}

if (!pactBrokerToken) {
  console.error("❌ PACT_BROKER_TOKEN environment variable is not set");
  console.log("   Set it to your Pact Broker authentication token");
  process.exit(1);
}

console.log("📦 Publishing Pact contracts to Pact Broker...");
console.log(`   Version: ${gitSha.substring(0, 7)}`);
console.log(`   Branch: ${gitBranch}`);
console.log(`   Broker: ${pactBrokerUrl}`);

const opts = {
  pactFilesOrDirs: [path.resolve(__dirname, "../pacts/contracts")],
  pactBroker: pactBrokerUrl,
  pactBrokerToken: pactBrokerToken,
  consumerVersion: gitSha,
  branch: gitBranch,
  tags: [gitBranch, gitBranch === "main" ? "production" : "development"],
};

try {
  await new Publisher(opts).publishPacts();
  console.log("✅ Pact contracts published successfully!");
} catch (error) {
  console.error("❌ Failed to publish Pact contracts:", error);
  process.exit(1);
}

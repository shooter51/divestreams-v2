#!/usr/bin/env node

/**
 * Check if it's safe to deploy DiveStreamsAPI based on contract verification status
 *
 * Usage:
 *   npm run pact:can-deploy                        # Check current version
 *   npm run pact:can-deploy:dev                    # Check for dev environment
 *   npm run pact:can-deploy:test                   # Check for test environment
 *   npm run pact:can-deploy:production             # Check for production environment
 *
 * Environment variables:
 * - PACT_BROKER_BASE_URL: URL of the Pact Broker (e.g., http://62.72.3.35:9292)
 * - PACT_BROKER_TOKEN: Authentication token for the Pact Broker (optional)
 * - GITHUB_SHA: Git commit SHA (defaults to current HEAD)
 * - GITHUB_REF_NAME: Git branch name (defaults to current branch)
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const envArg = args.find((arg) => arg.startsWith("--environment="));
const environment = envArg
  ? envArg.split("=")[1]
  : args.includes("--environment") && args[args.indexOf("--environment") + 1]
    ? args[args.indexOf("--environment") + 1]
    : null;

// Get version information
const gitSha =
  process.env.GITHUB_SHA ||
  execSync("git rev-parse HEAD").toString().trim();
const gitBranch =
  process.env.GITHUB_REF_NAME ||
  execSync("git rev-parse --abbrev-ref HEAD").toString().trim();

// Pact Broker configuration
const pactBrokerUrl = process.env.PACT_BROKER_BASE_URL;
const pactBrokerToken = process.env.PACT_BROKER_TOKEN;

if (!pactBrokerUrl) {
  console.error("❌ PACT_BROKER_BASE_URL environment variable is not set");
  console.log("   Set it to your Pact Broker URL (e.g., http://62.72.3.35:9292)");
  console.log("");
  console.log("   For local/CI development without a broker:");
  console.log("   You can skip can-i-deploy checks by setting SKIP_PACT_CAN_DEPLOY=true");
  process.exit(0); // Exit gracefully if broker isn't configured
}

// Determine target environment
let targetEnvironment = environment;
if (!targetEnvironment) {
  // Auto-detect based on branch
  if (gitBranch === "main") {
    targetEnvironment = "production";
  } else if (gitBranch === "staging") {
    targetEnvironment = "test";
  } else if (gitBranch === "develop") {
    targetEnvironment = "dev";
  } else {
    targetEnvironment = "dev"; // Default to dev for feature branches
  }
}

console.log("🔍 Checking deployment safety...");
console.log(`   Pacticipant: DiveStreamsAPI`);
console.log(`   Version: ${gitSha.substring(0, 7)}`);
console.log(`   Target Environment: ${targetEnvironment}`);
console.log(`   Broker: ${pactBrokerUrl}`);
console.log("");

// Build the can-i-deploy command
const canIDeployCmd = [
  "npx",
  "pact-broker",
  "can-i-deploy",
  "--pacticipant",
  "DiveStreamsAPI",
  "--version",
  gitSha,
  "--to-environment",
  targetEnvironment,
  "--broker-base-url",
  pactBrokerUrl,
];

// Add authentication if token is provided
if (pactBrokerToken) {
  canIDeployCmd.push("--broker-token", pactBrokerToken);
}

// Add retry logic flag
canIDeployCmd.push("--retry-while-unknown", "0");

try {
  const result = execSync(canIDeployCmd.join(" "), {
    encoding: "utf-8",
    stdio: "inherit",
  });

  console.log("");
  console.log("✅ Safe to deploy! All contract verifications passed.");
  console.log("");
  process.exit(0);
} catch (error) {
  console.log("");
  console.error("❌ NOT SAFE TO DEPLOY!");
  console.error("");
  console.error("   One or more contract verifications have not passed.");
  console.error("   This means consumers are expecting contracts that this");
  console.error("   version of the provider has not verified.");
  console.error("");
  console.error("   Options:");
  console.error("   1. Run provider verification tests: npm run pact:provider");
  console.error("   2. Check verification status in Pact Broker");
  console.error("   3. Wait for CI/CD pipeline to verify contracts");
  console.error("");

  // Check if we should fail the build or just warn
  if (targetEnvironment === "production") {
    console.error("   🛑 BLOCKING PRODUCTION DEPLOYMENT");
    process.exit(1);
  } else {
    console.error(`   ⚠️  WARNING: Deploying to ${targetEnvironment} anyway (non-production)`);
    process.exit(0);
  }
}

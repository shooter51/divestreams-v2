#!/usr/bin/env node

/**
 * Publish Pact contracts to Pact Broker using direct HTTP API
 *
 * Usage: npm run pact:publish
 *
 * Environment variables:
 * - PACT_BROKER_BASE_URL: URL of the Pact Broker (e.g., http://62.72.3.35:9292)
 * - PACT_BROKER_TOKEN: Authentication token for the Pact Broker (optional for self-hosted)
 * - GITHUB_SHA: Git commit SHA (defaults to current HEAD)
 * - GITHUB_REF_NAME: Git branch name (defaults to current branch)
 * - PACT_ENVIRONMENT: Target environment (dev, test, production)
 * - RECORD_DEPLOYMENT: Set to 'true' to record deployment to environment
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import https from "https";
import http from "http";

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
  console.log("   Set it to your Pact Broker URL (e.g., http://62.72.3.35:9292)");
  process.exit(1);
}

console.log("📦 Publishing Pact contracts to Pact Broker...");
console.log(`   Version: ${gitSha.substring(0, 7)}`);
console.log(`   Branch: ${gitBranch}`);
console.log(`   Broker: ${pactBrokerUrl}`);

if (!pactBrokerToken) {
  console.log("   Auth: None (self-hosted broker)");
}

// Check if contracts directory exists and has files
const contractsDir = path.resolve(__dirname, "../pacts/contracts");
if (!fs.existsSync(contractsDir)) {
  console.error("❌ Contracts directory not found:", contractsDir);
  console.log("   Run consumer tests first: npm run pact:consumer");
  process.exit(1);
}

const contractFiles = fs.readdirSync(contractsDir).filter(f => f.endsWith('.json'));
if (contractFiles.length === 0) {
  console.error("❌ No contract files found in:", contractsDir);
  console.log("   Run consumer tests first: npm run pact:consumer");
  process.exit(1);
}

console.log(`   Found ${contractFiles.length} contract(s):`);
contractFiles.forEach(f => console.log(`     - ${f}`));

/**
 * Make HTTP request to Pact Broker API
 */
function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const httpModule = parsedUrl.protocol === 'https:' ? https : http;

    const requestOptions = {
      ...options,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/hal+json',
        ...(pactBrokerToken && { 'Authorization': `Bearer ${pactBrokerToken}` }),
        ...options.headers,
      }
    };

    const req = httpModule.request(requestOptions, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, data: responseData });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

/**
 * Publish a single contract to the broker
 */
async function publishContract(contractPath) {
  const contractContent = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
  const consumer = contractContent.consumer.name;
  const provider = contractContent.provider.name;

  const tags = [gitBranch];
  if (gitBranch === "main") {
    tags.push("production");
  } else {
    tags.push("development");
  }

  console.log(`\n   Publishing ${consumer} → ${provider}...`);

  // Use the contracts/publish endpoint for bulk publishing
  const publishPayload = {
    pacticipantName: consumer,
    pacticipantVersionNumber: gitSha,
    tags: tags,
    branch: gitBranch,
    contracts: [{
      consumerName: consumer,
      providerName: provider,
      specification: "pact",
      contentType: "application/json",
      content: Buffer.from(JSON.stringify(contractContent)).toString('base64')
    }]
  };

  try {
    await makeRequest(
      `${pactBrokerUrl}/contracts/publish`,
      { method: 'POST' },
      JSON.stringify(publishPayload)
    );
    console.log(`   ✓ Published successfully`);
    return true;
  } catch (error) {
    console.error(`   ✗ Failed to publish: ${error.message}`);
    return false;
  }
}

// Publish all contracts
console.log("\n🚀 Publishing contracts...");
let successCount = 0;
let failCount = 0;

for (const file of contractFiles) {
  const contractPath = path.join(contractsDir, file);
  const success = await publishContract(contractPath);
  if (success) {
    successCount++;
  } else {
    failCount++;
  }
}

console.log(`\n📊 Results:`);
console.log(`   Success: ${successCount}`);
console.log(`   Failed: ${failCount}`);

if (failCount > 0) {
  console.error("\n❌ Some contracts failed to publish");
  process.exit(1);
}

console.log("\n✅ All contracts published successfully!");

// Record deployment to environment if requested
const recordDeployment = process.env.RECORD_DEPLOYMENT === "true";
const environment = process.env.PACT_ENVIRONMENT;

if (recordDeployment && environment) {
  console.log("");
  console.log(`📍 Recording deployment to ${environment} environment...`);

  const recordCmd = [
    "npx",
    "pact-broker",
    "record-deployment",
    "--pacticipant",
    "DiveStreamsAPI",
    "--version",
    gitSha,
    "--environment",
    environment,
    "--broker-base-url",
    pactBrokerUrl,
  ];

  if (pactBrokerToken) {
    recordCmd.push("--broker-token", pactBrokerToken);
  }

  try {
    execSync(recordCmd.join(" "), { encoding: "utf-8", stdio: "inherit" });
    console.log(`✅ Deployment to ${environment} recorded successfully!`);
  } catch (recordError) {
    console.warn(`⚠️  Failed to record deployment: ${recordError.message}`);
    console.warn("   This is non-critical - contracts were published successfully");
  }
}

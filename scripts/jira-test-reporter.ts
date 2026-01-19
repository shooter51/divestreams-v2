#!/usr/bin/env tsx
/**
 * Jira QAlity Test Reporter
 *
 * Reads Playwright JSON results and posts test outcomes to linked Jira issues as comments.
 *
 * Usage:
 *   tsx scripts/jira-test-reporter.ts [options]
 *
 * Options:
 *   --results-file <path>  Path to Playwright JSON results (default: test-results/results.json)
 *   --dry-run              Print what would be posted without actually posting
 *   --verbose              Enable verbose logging
 *
 * Environment Variables (required):
 *   JIRA_HOST              Jira instance URL (e.g., https://your-domain.atlassian.net)
 *   JIRA_USER_EMAIL        Your Jira account email
 *   JIRA_API_TOKEN         Your Jira API token
 *
 * Environment Variables (optional):
 *   JIRA_PROJECT_KEY       Default project key (e.g., KAN)
 *   GITHUB_RUN_NUMBER      GitHub Actions run number
 *   GITHUB_RUN_ID          GitHub Actions run ID
 *   GITHUB_REPOSITORY      GitHub repository (e.g., owner/repo)
 *   GITHUB_REF_NAME        GitHub branch name
 *   GITHUB_SHA             GitHub commit SHA
 */

import * as fs from "fs";
import * as path from "path";
import axios, { AxiosInstance } from "axios";
import "dotenv/config";

// ============================================================================
// Types
// ============================================================================

interface PlaywrightTestResult {
  title: string;
  status: "passed" | "failed" | "timedOut" | "skipped";
  duration: number;
  error?: {
    message?: string;
    stack?: string;
  };
  attachments?: Array<{
    name: string;
    path?: string;
    contentType: string;
  }>;
}

interface PlaywrightSuite {
  title: string;
  file: string;
  tests: PlaywrightTestResult[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightJsonReport {
  suites: PlaywrightSuite[];
}

interface JiraConfig {
  host: string;
  userEmail: string;
  apiToken: string;
  projectKey?: string;
}

interface TestMapping {
  testTitle: string;
  jiraKey: string;
  file: string;
}

interface ReporterOptions {
  resultsFile: string;
  dryRun: boolean;
  verbose: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

function getJiraConfig(): JiraConfig {
  const host = process.env.JIRA_HOST;
  const userEmail = process.env.JIRA_USER_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!host || !userEmail || !apiToken) {
    console.error("❌ Missing required environment variables:");
    if (!host) console.error("   - JIRA_HOST");
    if (!userEmail) console.error("   - JIRA_USER_EMAIL");
    if (!apiToken) console.error("   - JIRA_API_TOKEN");
    console.error("\nPlease set these variables in your .env file or environment.");
    process.exit(1);
  }

  return {
    host: host.replace(/\/$/, ""), // Remove trailing slash
    userEmail,
    apiToken,
    projectKey: process.env.JIRA_PROJECT_KEY,
  };
}

function parseArgs(): ReporterOptions {
  const args = process.argv.slice(2);
  const options: ReporterOptions = {
    resultsFile: "test-results/results.json",
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--results-file":
        options.resultsFile = args[++i];
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--verbose":
        options.verbose = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        printHelp();
        process.exit(1);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Jira QAlity Test Reporter

Usage:
  tsx scripts/jira-test-reporter.ts [options]

Options:
  --results-file <path>  Path to Playwright JSON results (default: test-results/results.json)
  --dry-run              Print what would be posted without actually posting
  --verbose              Enable verbose logging
  --help, -h             Show this help message

Environment Variables (required):
  JIRA_HOST              Jira instance URL (e.g., https://your-domain.atlassian.net)
  JIRA_USER_EMAIL        Your Jira account email
  JIRA_API_TOKEN         Your Jira API token

Environment Variables (optional):
  JIRA_PROJECT_KEY       Default project key (e.g., KAN)
  GITHUB_RUN_NUMBER      GitHub Actions run number
  GITHUB_RUN_ID          GitHub Actions run ID
  GITHUB_REPOSITORY      GitHub repository
  GITHUB_REF_NAME        GitHub branch name
  GITHUB_SHA             GitHub commit SHA
`);
}

// ============================================================================
// Jira API Client
// ============================================================================

class JiraClient {
  private client: AxiosInstance;
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: `${config.host}/rest/api/3`,
      auth: {
        username: config.userEmail,
        password: config.apiToken,
      },
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }

  /**
   * Post a comment to a Jira issue
   */
  async postComment(issueKey: string, comment: string): Promise<void> {
    try {
      await this.client.post(`/issue/${issueKey}/comment`, {
        body: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: comment,
                },
              ],
            },
          ],
        },
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Failed to post comment to ${issueKey}: ${error.response?.status} ${error.response?.statusText}`
        );
      }
      throw error;
    }
  }

  /**
   * Get issue details to verify it exists
   */
  async getIssue(issueKey: string): Promise<boolean> {
    try {
      await this.client.get(`/issue/${issueKey}`, {
        params: { fields: "summary" },
      });
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }
}

// ============================================================================
// Test Result Processing
// ============================================================================

/**
 * Extract Jira issue keys from test titles
 * Supports formats: [KAN-123], [DIVE-456], etc.
 */
function extractJiraKeys(testTitle: string): string[] {
  const pattern = /\[([A-Z]+-\d+)\]/g;
  const matches: string[] = [];
  let match;

  while ((match = pattern.exec(testTitle)) !== null) {
    matches.push(match[1]);
  }

  return matches;
}

/**
 * Recursively collect all tests from Playwright suite structure
 */
function collectTests(
  suite: PlaywrightSuite,
  tests: Array<{ test: PlaywrightTestResult; file: string }> = []
): Array<{ test: PlaywrightTestResult; file: string }> {
  // Add tests from current suite
  for (const test of suite.tests || []) {
    tests.push({ test, file: suite.file });
  }

  // Recurse into child suites
  for (const childSuite of suite.suites || []) {
    collectTests(childSuite, tests);
  }

  return tests;
}

/**
 * Build test mappings from Playwright results
 */
function buildTestMappings(report: PlaywrightJsonReport): TestMapping[] {
  const mappings: TestMapping[] = [];
  const allTests: Array<{ test: PlaywrightTestResult; file: string }> = [];

  // Collect all tests from all suites
  for (const suite of report.suites) {
    collectTests(suite, allTests);
  }

  // Extract Jira keys and create mappings
  for (const { test, file } of allTests) {
    const jiraKeys = extractJiraKeys(test.title);
    for (const jiraKey of jiraKeys) {
      mappings.push({
        testTitle: test.title,
        jiraKey,
        file,
      });
    }
  }

  return mappings;
}

/**
 * Find test result by title
 */
function findTestResult(
  report: PlaywrightJsonReport,
  testTitle: string
): PlaywrightTestResult | null {
  const allTests: Array<{ test: PlaywrightTestResult; file: string }> = [];

  for (const suite of report.suites) {
    collectTests(suite, allTests);
  }

  const found = allTests.find((t) => t.test.title === testTitle);
  return found?.test || null;
}

/**
 * Format test result as Jira comment
 */
function formatTestComment(
  test: PlaywrightTestResult,
  mapping: TestMapping
): string {
  const statusEmoji = {
    passed: "✅",
    failed: "❌",
    timedOut: "⏱️",
    skipped: "⏭️",
  };

  const emoji = statusEmoji[test.status] || "❓";
  const durationSec = (test.duration / 1000).toFixed(2);

  // Build GitHub context if available
  const githubContext = buildGithubContext();
  const contextHeader = githubContext
    ? `🔗 [CI Run #${githubContext.runNumber}](${githubContext.runUrl}) • Branch: \`${githubContext.branch}\`\n`
    : "";

  let comment = `${contextHeader}`;
  comment += `${emoji} **E2E Test Result: ${test.status.toUpperCase()}**\n\n`;
  comment += `**Test:** ${test.title}\n`;
  comment += `**File:** \`${mapping.file}\`\n`;
  comment += `**Duration:** ${durationSec}s\n`;

  if (test.status === "failed" || test.status === "timedOut") {
    comment += `\n**Error:**\n\`\`\`\n${test.error?.message || "Unknown error"}\n\`\`\`\n`;

    if (test.error?.stack) {
      comment += `\n**Stack Trace:**\n\`\`\`\n${test.error.stack.slice(0, 1000)}\n\`\`\`\n`;
    }
  }

  // Add timestamp
  const timestamp = new Date().toISOString();
  comment += `\n_Posted: ${timestamp}_`;

  return comment;
}

/**
 * Build GitHub Actions context for comment
 */
function buildGithubContext():
  | {
      runNumber: string;
      runId: string;
      runUrl: string;
      branch: string;
      sha: string;
    }
  | null {
  const runNumber = process.env.GITHUB_RUN_NUMBER;
  const runId = process.env.GITHUB_RUN_ID;
  const repository = process.env.GITHUB_REPOSITORY;
  const branch = process.env.GITHUB_REF_NAME || "unknown";
  const sha = process.env.GITHUB_SHA || "unknown";

  if (!runNumber || !runId || !repository) {
    return null;
  }

  return {
    runNumber,
    runId,
    runUrl: `https://github.com/${repository}/actions/runs/${runId}`,
    branch,
    sha: sha.slice(0, 7),
  };
}

// ============================================================================
// Main Reporter Logic
// ============================================================================

async function reportToJira(
  jiraClient: JiraClient,
  report: PlaywrightJsonReport,
  options: ReporterOptions
): Promise<void> {
  const mappings = buildTestMappings(report);

  if (mappings.length === 0) {
    console.log("ℹ️  No tests with Jira issue tags found.");
    return;
  }

  console.log(`\n📊 Found ${mappings.length} test(s) with Jira tags\n`);

  // Group by Jira key
  const byJiraKey = new Map<string, TestMapping[]>();
  for (const mapping of mappings) {
    const existing = byJiraKey.get(mapping.jiraKey) || [];
    existing.push(mapping);
    byJiraKey.set(mapping.jiraKey, existing);
  }

  let successCount = 0;
  let errorCount = 0;

  // Process each Jira issue
  for (const [jiraKey, testMappings] of byJiraKey) {
    console.log(`\n🎫 Processing ${jiraKey}...`);

    // Verify issue exists (unless in dry-run mode)
    if (!options.dryRun) {
      const exists = await jiraClient.getIssue(jiraKey);
      if (!exists) {
        console.error(`   ❌ Issue ${jiraKey} not found - skipping`);
        errorCount++;
        continue;
      }
    }

    // Post comment for each test
    for (const mapping of testMappings) {
      const test = findTestResult(report, mapping.testTitle);
      if (!test) {
        console.error(`   ⚠️  Test result not found: ${mapping.testTitle}`);
        continue;
      }

      const comment = formatTestComment(test, mapping);

      if (options.verbose) {
        console.log(`\n   📝 Comment for ${mapping.testTitle}:\n`);
        console.log(comment);
        console.log();
      }

      if (options.dryRun) {
        console.log(`   🔍 [DRY RUN] Would post comment for: ${test.title}`);
      } else {
        try {
          await jiraClient.postComment(jiraKey, comment);
          console.log(`   ✅ Posted result for: ${test.title}`);
          successCount++;
        } catch (error) {
          console.error(`   ❌ Failed to post: ${error}`);
          errorCount++;
        }
      }
    }
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📈 Summary:`);
  console.log(`   ✅ Successfully posted: ${successCount}`);
  if (errorCount > 0) {
    console.log(`   ❌ Errors: ${errorCount}`);
  }
  if (options.dryRun) {
    console.log(`   🔍 Mode: DRY RUN (no actual posts made)`);
  }
  console.log(`${"=".repeat(60)}\n`);
}

// ============================================================================
// Entry Point
// ============================================================================

async function main(): Promise<void> {
  console.log("\n🚀 Jira QAlity Test Reporter\n");

  const options = parseArgs();

  // Check if results file exists
  if (!fs.existsSync(options.resultsFile)) {
    console.error(`❌ Results file not found: ${options.resultsFile}`);
    console.error(
      "\nMake sure Playwright is configured with JSON reporter:"
    );
    console.error('  reporter: [["json", { outputFile: "test-results/results.json" }]]');
    process.exit(1);
  }

  // Load Jira config
  const jiraConfig = getJiraConfig();
  console.log(`📡 Jira Host: ${jiraConfig.host}`);
  console.log(`👤 User: ${jiraConfig.userEmail}\n`);

  // Load test results
  console.log(`📂 Loading results from: ${options.resultsFile}`);
  const resultsContent = fs.readFileSync(options.resultsFile, "utf-8");
  const report: PlaywrightJsonReport = JSON.parse(resultsContent);

  // Create Jira client and report
  const jiraClient = new JiraClient(jiraConfig);
  await reportToJira(jiraClient, report, options);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
}

export { reportToJira, JiraClient, extractJiraKeys, buildTestMappings };

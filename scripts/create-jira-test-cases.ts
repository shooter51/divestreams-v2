#!/usr/bin/env npx tsx
/**
 * Create Jira Test Cases for E2E Tests
 *
 * This script:
 * 1. Parses all E2E test files to extract test names
 * 2. Creates Jira issues for each untagged test via REST API
 * 3. Updates test files with new Jira tags [KAN-XXX]
 * 4. Updates docs/test-jira-mapping.md with mappings
 *
 * Usage:
 *   npx tsx scripts/create-jira-test-cases.ts
 *
 * Required environment variables:
 *   JIRA_HOST - e.g., tgibson-fam.atlassian.net
 *   JIRA_EMAIL - Your Atlassian email
 *   JIRA_API_TOKEN - Your Atlassian API token
 *   JIRA_PROJECT_KEY - e.g., KAN
 *
 * Options:
 *   --dry-run     Parse and show tests without creating Jira issues
 *   --file=<path> Process only a specific file
 *   --limit=<n>   Limit number of issues to create (for testing)
 */

import * as fs from "fs";
import * as path from "path";

// Configuration
const JIRA_HOST = process.env.JIRA_HOST || "tgibson-fam.atlassian.net";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY || "KAN";

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SPECIFIC_FILE = args.find((a) => a.startsWith("--file="))?.split("=")[1];
const LIMIT = parseInt(
  args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "0"
);

// Test file paths (relative to project root)
const TEST_FILES = [
  "tests/e2e/workflow/00-full-workflow.spec.ts",
  "tests/e2e/workflow/customer-management.spec.ts",
  "tests/e2e/workflow/tours-management.spec.ts",
  "tests/e2e/workflow/trips-scheduling.spec.ts",
  "tests/e2e/workflow/training-module.spec.ts",
  "tests/e2e/workflow/public-site.spec.ts",
  "tests/e2e/workflow/regression-bugs.spec.ts",
  "tests/e2e/workflow/embed-courses.spec.ts",
  "tests/e2e/workflow/training-import.spec.ts",
];

// Rate limiting
const RATE_LIMIT_DELAY_MS = 200; // 200ms between requests to avoid rate limiting
const BATCH_SIZE = 50; // Process in batches with longer delays

interface TestInfo {
  file: string;
  line: number;
  originalTitle: string;
  testId: string; // e.g., "1.1", "A.1", "B.2"
  description: string;
  tags: string[]; // @smoke, @critical, etc.
  existingJiraKeys: string[]; // Already tagged keys like [KAN-2]
  block?: string; // Block name if in a describe block
}

interface JiraIssue {
  key: string;
  id: string;
  self: string;
}

interface CreatedMapping {
  testId: string;
  jiraKey: string;
  file: string;
  line: number;
  description: string;
}

/**
 * Parse a test file and extract all test definitions
 */
function parseTestFile(filePath: string): TestInfo[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const tests: TestInfo[] = [];

  // Track current describe block
  let currentBlock = "";

  // Regex to match test definitions
  // Matches: test("title", ...) or test('title', ...)
  // Also handles test.skip, test.only
  const testRegex =
    /^\s*test(?:\.skip|\.only)?\s*\(\s*["'`](.+?)["'`]\s*,/;

  // Regex to match describe blocks
  const describeRegex =
    /test\.describe(?:\.serial)?\s*\(\s*["'`](.+?)["'`]\s*,/;

  // Regex to extract existing Jira keys from test title
  const jiraKeyRegex = /\[([A-Z]+-\d+)\]/g;

  // Regex to extract test ID (e.g., "1.1", "A.1")
  const testIdRegex = /^(\d+\.\d+|[A-Z]\.\d+)\s+/;

  // Regex to extract tags (e.g., @smoke, @critical)
  const tagRegex = /@(\w+)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for describe block
    const describeMatch = line.match(describeRegex);
    if (describeMatch) {
      currentBlock = describeMatch[1];
      continue;
    }

    // Check for test definition
    const testMatch = line.match(testRegex);
    if (testMatch) {
      const originalTitle = testMatch[1];

      // Extract existing Jira keys
      const existingJiraKeys: string[] = [];
      let keyMatch;
      while ((keyMatch = jiraKeyRegex.exec(originalTitle)) !== null) {
        existingJiraKeys.push(keyMatch[1]);
      }
      jiraKeyRegex.lastIndex = 0; // Reset regex

      // Remove Jira keys from title to get clean description
      let cleanTitle = originalTitle.replace(/\[[A-Z]+-\d+\]\s*/g, "").trim();

      // Extract test ID
      const idMatch = cleanTitle.match(testIdRegex);
      const testId = idMatch ? idMatch[1] : "";
      if (testId) {
        cleanTitle = cleanTitle.replace(testIdRegex, "").trim();
      }

      // Extract tags
      const tags: string[] = [];
      let tagMatch;
      while ((tagMatch = tagRegex.exec(cleanTitle)) !== null) {
        tags.push(tagMatch[1]);
      }
      tagRegex.lastIndex = 0;

      // Remove tags from description
      const description = cleanTitle.replace(/@\w+/g, "").trim();

      tests.push({
        file: filePath,
        line: i + 1,
        originalTitle,
        testId,
        description,
        tags,
        existingJiraKeys,
        block: currentBlock,
      });
    }
  }

  return tests;
}

/**
 * Create a Jira issue via REST API
 */
async function createJiraIssue(
  testInfo: TestInfo,
  fileBasename: string
): Promise<JiraIssue | null> {
  if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
    console.error("Error: JIRA_EMAIL and JIRA_API_TOKEN must be set");
    process.exit(1);
  }

  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString(
    "base64"
  );

  // Build summary - include test ID and description
  const summary = testInfo.testId
    ? `[E2E] ${testInfo.testId} ${testInfo.description}`
    : `[E2E] ${testInfo.description}`;

  // Build description with full context
  const descriptionLines = [
    `*E2E Test Case*`,
    ``,
    `*Test ID:* ${testInfo.testId || "N/A"}`,
    `*File:* ${fileBasename}`,
    `*Block:* ${testInfo.block || "N/A"}`,
    ``,
    `*Description:*`,
    testInfo.description,
    ``,
    `*Tags:* ${testInfo.tags.length > 0 ? testInfo.tags.map((t) => `@${t}`).join(", ") : "None"}`,
    ``,
    `----`,
    `_Auto-generated from Playwright E2E test suite_`,
  ];

  const body = {
    fields: {
      project: {
        key: JIRA_PROJECT_KEY,
      },
      summary: summary.substring(0, 255), // Jira summary has max length
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: descriptionLines.map((line) => ({
              type: "text",
              text: line + "\n",
            })),
          },
        ],
      },
      issuetype: {
        name: "Task",
      },
      labels: ["e2e", "playwright", "automated"],
    },
  };

  try {
    const response = await fetch(
      `https://${JIRA_HOST}/rest/api/3/issue`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to create issue: ${response.status}`);
      console.error(errorText);
      return null;
    }

    const result = (await response.json()) as JiraIssue;
    return result;
  } catch (error) {
    console.error(`Error creating Jira issue: ${error}`);
    return null;
  }
}

/**
 * Update test file to add Jira key to test title
 */
function updateTestFile(
  filePath: string,
  updates: { line: number; originalTitle: string; newTitle: string }[]
): void {
  let content = fs.readFileSync(filePath, "utf-8");

  // Sort by line number descending to avoid offset issues
  const sortedUpdates = [...updates].sort((a, b) => b.line - a.line);

  for (const update of sortedUpdates) {
    // Escape special regex characters in original title
    const escapedOriginal = update.originalTitle.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    // Replace the exact test title
    const regex = new RegExp(
      `(test(?:\\.skip|\\.only)?\\s*\\(\\s*["'\`])${escapedOriginal}(["'\`])`,
      "g"
    );
    content = content.replace(regex, `$1${update.newTitle}$2`);
  }

  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Jira Test Case Creator");
  console.log("=".repeat(60));
  console.log();

  if (DRY_RUN) {
    console.log("MODE: DRY RUN (no Jira issues will be created)");
    console.log();
  }

  // Validate credentials if not dry run
  if (!DRY_RUN && (!JIRA_EMAIL || !JIRA_API_TOKEN)) {
    console.error("Error: JIRA_EMAIL and JIRA_API_TOKEN environment variables must be set");
    console.error("Example:");
    console.error("  export JIRA_EMAIL=your-email@example.com");
    console.error("  export JIRA_API_TOKEN=your-api-token");
    process.exit(1);
  }

  console.log(`Jira Host: ${JIRA_HOST}`);
  console.log(`Project Key: ${JIRA_PROJECT_KEY}`);
  console.log();

  // Determine which files to process
  const filesToProcess = SPECIFIC_FILE
    ? [SPECIFIC_FILE]
    : TEST_FILES;

  // Parse all test files
  console.log("Parsing test files...");
  console.log("-".repeat(40));

  const allTests: TestInfo[] = [];
  const testsByFile: Map<string, TestInfo[]> = new Map();

  for (const relPath of filesToProcess) {
    const fullPath = path.resolve(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) {
      console.log(`  [SKIP] ${relPath} - file not found`);
      continue;
    }

    const tests = parseTestFile(fullPath);
    console.log(`  [OK] ${relPath} - ${tests.length} tests`);
    allTests.push(...tests);
    testsByFile.set(fullPath, tests);
  }

  console.log();
  console.log(`Total tests found: ${allTests.length}`);

  // Filter to only untagged tests
  const untaggedTests = allTests.filter((t) => t.existingJiraKeys.length === 0);
  const taggedTests = allTests.filter((t) => t.existingJiraKeys.length > 0);

  console.log(`Already tagged: ${taggedTests.length}`);
  console.log(`Untagged (to create): ${untaggedTests.length}`);
  console.log();

  // Show already tagged tests
  if (taggedTests.length > 0) {
    console.log("Already tagged tests:");
    console.log("-".repeat(40));
    for (const t of taggedTests) {
      console.log(`  ${t.existingJiraKeys.join(", ")} - ${t.testId} ${t.description.substring(0, 50)}...`);
    }
    console.log();
  }

  // Apply limit if specified
  const testsToProcess = LIMIT > 0 ? untaggedTests.slice(0, LIMIT) : untaggedTests;
  if (LIMIT > 0) {
    console.log(`Processing limited to first ${LIMIT} tests`);
    console.log();
  }

  if (testsToProcess.length === 0) {
    console.log("No untagged tests to process. Exiting.");
    return;
  }

  if (DRY_RUN) {
    console.log("Tests that would be created:");
    console.log("-".repeat(40));
    for (const t of testsToProcess) {
      const fileBasename = path.basename(t.file);
      console.log(`  ${fileBasename}:${t.line} - ${t.testId} ${t.description.substring(0, 50)}...`);
    }
    console.log();
    console.log("Dry run complete. No Jira issues created.");
    return;
  }

  // Create Jira issues
  console.log("Creating Jira issues...");
  console.log("-".repeat(40));

  const createdMappings: CreatedMapping[] = [];
  const updatesByFile: Map<string, { line: number; originalTitle: string; newTitle: string }[]> = new Map();

  let processed = 0;
  let created = 0;
  let failed = 0;

  for (const test of testsToProcess) {
    processed++;
    const fileBasename = path.basename(test.file);

    // Rate limiting
    if (processed > 1) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }

    // Extra delay every batch
    if (processed % BATCH_SIZE === 0) {
      console.log(`  [PAUSE] Batch ${processed / BATCH_SIZE} complete, waiting...`);
      await sleep(2000);
    }

    process.stdout.write(`  [${processed}/${testsToProcess.length}] Creating: ${test.testId || test.description.substring(0, 30)}... `);

    const issue = await createJiraIssue(test, fileBasename);

    if (issue) {
      console.log(`${issue.key}`);
      created++;

      // Build new title with Jira key
      const newTitle = test.testId
        ? `[${issue.key}] ${test.testId} ${test.description}${test.tags.length > 0 ? " " + test.tags.map((t) => `@${t}`).join(" ") : ""}`
        : `[${issue.key}] ${test.description}${test.tags.length > 0 ? " " + test.tags.map((t) => `@${t}`).join(" ") : ""}`;

      // Queue file update
      if (!updatesByFile.has(test.file)) {
        updatesByFile.set(test.file, []);
      }
      updatesByFile.get(test.file)!.push({
        line: test.line,
        originalTitle: test.originalTitle,
        newTitle,
      });

      // Track mapping
      createdMappings.push({
        testId: test.testId,
        jiraKey: issue.key,
        file: fileBasename,
        line: test.line,
        description: test.description,
      });
    } else {
      console.log("FAILED");
      failed++;
    }
  }

  console.log();
  console.log(`Created: ${created}, Failed: ${failed}`);
  console.log();

  // Update test files
  if (updatesByFile.size > 0) {
    console.log("Updating test files...");
    console.log("-".repeat(40));

    for (const [filePath, updates] of updatesByFile) {
      const fileBasename = path.basename(filePath);
      console.log(`  Updating ${fileBasename} (${updates.length} tests)...`);
      updateTestFile(filePath, updates);
    }
    console.log();
  }

  // Update mapping document
  if (createdMappings.length > 0) {
    console.log("Updating mapping document...");
    console.log("-".repeat(40));

    const mappingPath = path.resolve(process.cwd(), "docs/test-jira-mapping.md");

    // Group by file
    const mappingsByFile: Map<string, CreatedMapping[]> = new Map();
    for (const m of createdMappings) {
      if (!mappingsByFile.has(m.file)) {
        mappingsByFile.set(m.file, []);
      }
      mappingsByFile.get(m.file)!.push(m);
    }

    // Generate markdown additions
    const now = new Date().toISOString().split("T")[0];
    let newMappings = `\n\n### Mappings Added ${now}\n\n`;

    for (const [file, mappings] of mappingsByFile) {
      newMappings += `#### ${file}\n\n`;
      newMappings += `| Test ID | Jira Key | Description |\n`;
      newMappings += `|---------|----------|-------------|\n`;
      for (const m of mappings) {
        newMappings += `| ${m.testId} | ${m.jiraKey} | ${m.description.substring(0, 50)}... |\n`;
      }
      newMappings += `\n`;
    }

    // Append to mapping file
    if (fs.existsSync(mappingPath)) {
      let mappingContent = fs.readFileSync(mappingPath, "utf-8");

      // Find change log section and insert before it
      const changeLogIndex = mappingContent.indexOf("## Change Log");
      if (changeLogIndex !== -1) {
        mappingContent =
          mappingContent.slice(0, changeLogIndex) +
          newMappings +
          mappingContent.slice(changeLogIndex);
      } else {
        mappingContent += newMappings;
      }

      // Update test counts in the summary table
      const totalTagged = taggedTests.length + createdMappings.length;
      const percentComplete = ((totalTagged / allTests.length) * 100).toFixed(1);
      console.log(`  Updated mapping coverage: ${totalTagged}/${allTests.length} (${percentComplete}%)`);

      fs.writeFileSync(mappingPath, mappingContent, "utf-8");
    }

    console.log();
  }

  // Summary
  console.log("=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total tests: ${allTests.length}`);
  console.log(`Already tagged: ${taggedTests.length}`);
  console.log(`Newly created: ${created}`);
  console.log(`Failed: ${failed}`);
  console.log(`Files updated: ${updatesByFile.size}`);
  console.log();
  console.log("Done!");
}

// Run
main().catch(console.error);

#!/usr/bin/env tsx
/**
 * Test Jira API Connection
 *
 * Verifies that your Jira credentials are correct and the API is accessible.
 *
 * Usage:
 *   tsx scripts/test-jira-connection.ts
 *
 * Environment Variables (required):
 *   JIRA_HOST              Jira instance URL (e.g., https://your-domain.atlassian.net)
 *   JIRA_USER_EMAIL        Your Jira account email
 *   JIRA_API_TOKEN         Your Jira API token
 *
 * Environment Variables (optional):
 *   JIRA_TEST_ISSUE_KEY    A known issue key to test with (e.g., KAN-1)
 */

import axios from "axios";
import "dotenv/config";

interface JiraConfig {
  host: string;
  userEmail: string;
  apiToken: string;
  testIssueKey?: string;
}

function getJiraConfig(): JiraConfig {
  const host = process.env.JIRA_HOST;
  const userEmail = process.env.JIRA_USER_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const testIssueKey = process.env.JIRA_TEST_ISSUE_KEY;

  if (!host || !userEmail || !apiToken) {
    console.error("❌ Missing required environment variables:");
    if (!host) console.error("   - JIRA_HOST");
    if (!userEmail) console.error("   - JIRA_USER_EMAIL");
    if (!apiToken) console.error("   - JIRA_API_TOKEN");
    console.error("\nPlease set these variables in your .env file or environment.");
    process.exit(1);
  }

  return {
    host: host.replace(/\/$/, ""),
    userEmail,
    apiToken,
    testIssueKey,
  };
}

async function testConnection(): Promise<void> {
  console.log("\n🧪 Testing Jira API Connection\n");
  console.log("=".repeat(60));

  const config = getJiraConfig();
  console.log(`\n📡 Jira Host: ${config.host}`);
  console.log(`👤 User Email: ${config.userEmail}`);
  console.log(`🔑 API Token: ${"*".repeat(config.apiToken.length)}\n`);

  const client = axios.create({
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

  let allTestsPassed = true;

  // Test 1: Get current user
  console.log("Test 1: Authenticate and get current user");
  try {
    const response = await client.get("/myself");
    console.log(`   ✅ Success! Logged in as: ${response.data.displayName}`);
    console.log(`   📧 Email: ${response.data.emailAddress}`);
    console.log(`   🆔 Account ID: ${response.data.accountId}\n`);
  } catch (error) {
    console.error("   ❌ Failed to authenticate");
    if (axios.isAxiosError(error)) {
      console.error(`   Status: ${error.response?.status}`);
      console.error(`   Message: ${error.response?.statusText}`);
      if (error.response?.status === 401) {
        console.error("\n   💡 Tip: Check your JIRA_API_TOKEN is correct");
      }
    }
    console.log();
    allTestsPassed = false;
  }

  // Test 2: Get server info
  console.log("Test 2: Get Jira server info");
  try {
    const response = await client.get("/serverInfo");
    console.log(`   ✅ Success!`);
    console.log(`   🏢 Server Title: ${response.data.serverTitle || "N/A"}`);
    console.log(`   📦 Version: ${response.data.version}`);
    console.log(`   🔨 Build: ${response.data.buildNumber}\n`);
  } catch (error) {
    console.error("   ❌ Failed to get server info");
    if (axios.isAxiosError(error)) {
      console.error(`   Status: ${error.response?.status}`);
      console.error(`   Message: ${error.response?.statusText}`);
    }
    console.log();
    allTestsPassed = false;
  }

  // Test 3: Search for projects
  console.log("Test 3: List accessible projects");
  try {
    const response = await client.get("/project/search", {
      params: { maxResults: 5 },
    });
    const projects = response.data.values || [];
    console.log(`   ✅ Success! Found ${projects.length} project(s):`);
    for (const project of projects) {
      console.log(`   📁 ${project.key}: ${project.name}`);
    }
    console.log();
  } catch (error) {
    console.error("   ❌ Failed to list projects");
    if (axios.isAxiosError(error)) {
      console.error(`   Status: ${error.response?.status}`);
      console.error(`   Message: ${error.response?.statusText}`);
    }
    console.log();
    allTestsPassed = false;
  }

  // Test 4: Get specific issue (if test key provided)
  if (config.testIssueKey) {
    console.log(`Test 4: Get issue ${config.testIssueKey}`);
    try {
      const response = await client.get(`/issue/${config.testIssueKey}`, {
        params: { fields: "summary,status,assignee" },
      });
      const issue = response.data;
      console.log(`   ✅ Success!`);
      console.log(`   📋 Summary: ${issue.fields.summary}`);
      console.log(`   📊 Status: ${issue.fields.status.name}`);
      if (issue.fields.assignee) {
        console.log(`   👤 Assignee: ${issue.fields.assignee.displayName}`);
      }
      console.log();
    } catch (error) {
      console.error(`   ❌ Failed to get issue ${config.testIssueKey}`);
      if (axios.isAxiosError(error)) {
        console.error(`   Status: ${error.response?.status}`);
        console.error(`   Message: ${error.response?.statusText}`);
        if (error.response?.status === 404) {
          console.error(`   💡 Tip: Issue ${config.testIssueKey} may not exist`);
        }
      }
      console.log();
      allTestsPassed = false;
    }
  } else {
    console.log("Test 4: Skipped (no JIRA_TEST_ISSUE_KEY provided)");
    console.log("   💡 Set JIRA_TEST_ISSUE_KEY=KAN-1 to test issue retrieval\n");
  }

  // Test 5: Test comment posting (dry-run)
  if (config.testIssueKey) {
    console.log(`Test 5: Test comment posting (dry-run) to ${config.testIssueKey}`);
    const testComment = {
      body: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "🧪 This is a test comment from the Jira connection tester. You can delete this.",
              },
            ],
          },
        ],
      },
    };

    console.log("   📝 Comment payload prepared (not posting in dry-run mode)");
    console.log(`   💡 To actually post, modify the script to remove dry-run check\n`);
  }

  // Summary
  console.log("=".repeat(60));
  if (allTestsPassed) {
    console.log("✅ All tests passed! Your Jira connection is working.\n");
    console.log("Next steps:");
    console.log("  1. Tag some Playwright tests with Jira keys: [KAN-1]");
    console.log("  2. Run tests: npm run test:e2e:jira");
    console.log("  3. Run reporter: tsx scripts/jira-test-reporter.ts\n");
  } else {
    console.log("❌ Some tests failed. Please check your configuration.\n");
    console.log("Troubleshooting:");
    console.log("  1. Verify JIRA_HOST is correct (include https://)");
    console.log("  2. Check JIRA_USER_EMAIL matches your Jira account");
    console.log("  3. Regenerate JIRA_API_TOKEN if needed");
    console.log("  4. Ensure you have access to the Jira instance\n");
    process.exit(1);
  }
}

// Run
testConnection().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});

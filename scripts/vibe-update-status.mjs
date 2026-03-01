#!/usr/bin/env node
/**
 * Update Vibe Kanban issue status from CI/CD pipeline
 *
 * This script is called by GitHub Actions to update issue status
 * based on deployment events.
 *
 * Usage:
 *   node scripts/vibe-update-status.mjs --short-id=844e-defect --status="In Development"
 *   node scripts/vibe-update-status.mjs --short-id=844e-defect --status="Done" --comment="Deployed to production"
 *
 * Environment Variables Required:
 *   VK_API_URL - Vibe Kanban API URL
 *   VK_API_TOKEN - Authentication token
 */

import { readFileSync } from 'fs';
import { join } from 'path';

function log(emoji, message) {
  console.log(`${emoji} ${message}`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      parsed[key] = value;
    }
  }

  return parsed;
}

function loadIssueMapping(shortId) {
  const mappingFile = join(process.cwd(), '.vibe-issue-mapping.json');

  try {
    const content = readFileSync(mappingFile, 'utf-8');
    const mapping = JSON.parse(content);

    if (mapping[shortId]) {
      return mapping[shortId];
    }

    log('⚠️', `No mapping found for short ID: ${shortId}`);
    return null;
  } catch (error) {
    log('⚠️', 'Could not load issue mapping file');
    return null;
  }
}

async function updateIssueStatus(issueId, status, comment) {
  const apiUrl = process.env.VK_API_URL;
  const apiToken = process.env.VK_API_TOKEN;

  if (!apiUrl || !apiToken) {
    log('⚠️', 'VK_API_URL and VK_API_TOKEN environment variables required');
    log('💡', 'Set these in GitHub repository secrets');
    log('📝', `Would update issue ${issueId} to "${status}"`);
    if (comment) {
      log('📝', `Comment: ${comment}`);
    }
    return;
  }

  log('🔄', `Updating issue ${issueId} to "${status}"`);

  try {
    const response = await fetch(`${apiUrl}/issues/${issueId}/status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status,
        comment
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    log('✅', 'Issue status updated successfully');
  } catch (error) {
    log('❌', `Failed to update issue: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  const args = parseArgs();

  if (!args['short-id'] || !args['status']) {
    console.error('❌ Usage: node vibe-update-status.mjs --short-id=<id> --status=<status> [--comment=<comment>]');
    console.error('   Example: node vibe-update-status.mjs --short-id=844e-defect --status="In Development"');
    process.exit(1);
  }

  const shortId = args['short-id'];
  const status = args['status'];
  const comment = args['comment'] || '';

  log('🚀', 'Vibe Kanban Status Update');
  log('📋', `Short ID: ${shortId}`);
  log('📊', `New Status: ${status}`);

  // Load issue mapping
  const mapping = loadIssueMapping(shortId);

  if (!mapping) {
    log('❌', 'Could not resolve issue ID from short ID');
    log('💡', 'Make sure .vibe-issue-mapping.json exists in the repository');
    process.exit(1);
  }

  log('✅', `Resolved to issue: ${mapping.full_issue_id}`);

  // Update status
  await updateIssueStatus(mapping.full_issue_id, status, comment);
}

main().catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});

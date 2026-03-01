#!/usr/bin/env tsx
/**
 * Save Vibe Kanban workspace context to a file
 *
 * This script should be run by Claude within a Vibe Kanban workspace
 * to save the context information for use by other automation scripts.
 *
 * Usage: tsx scripts/vibe-save-context.ts
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('📝 Saving Vibe Kanban workspace context...');

  // This would be called by Claude using MCP tools:
  // const context = await mcp__vibe_kanban__get_context();
  // const issue = await mcp__vibe_kanban__get_issue({ issue_id: context.issue_id });

  // For now, create a template that Claude can fill in
  const contextTemplate = {
    organization_id: process.env.VK_ORG_ID || '',
    project_id: process.env.VK_PROJECT_ID || '',
    issue_id: process.env.VK_ISSUE_ID || '',
    issue_title: process.env.VK_ISSUE_TITLE || '',
    issue_status: process.env.VK_ISSUE_STATUS || 'In Progress',
    issue_description: process.env.VK_ISSUE_DESC || '',
    workspace_id: process.env.VK_WORKSPACE_ID || '',
    workspace_branch: process.env.VK_BRANCH || '',
    saved_at: new Date().toISOString()
  };

  const contextFile = join(process.cwd(), '.vibe-context.json');
  writeFileSync(contextFile, JSON.stringify(contextTemplate, null, 2));

  console.log('✅ Context saved to .vibe-context.json');
  console.log('📍 Issue:', contextTemplate.issue_id);
  console.log('📍 Workspace:', contextTemplate.workspace_id);
  console.log('📍 Branch:', contextTemplate.workspace_branch);

  // Also create the mapping file for CI/CD to use
  const mappingFile = join(process.cwd(), '.vibe-issue-mapping.json');
  const shortId = contextTemplate.issue_id.split('-').slice(0, 2).join('-');
  const mapping = {
    [shortId]: {
      full_issue_id: contextTemplate.issue_id,
      workspace_id: contextTemplate.workspace_id,
      project_id: contextTemplate.project_id
    }
  };
  writeFileSync(mappingFile, JSON.stringify(mapping, null, 2));
  console.log('✅ Issue mapping saved for CI/CD pipeline');
}

main().catch(error => {
  console.error('❌ Failed to save context:', error.message);
  process.exit(1);
});

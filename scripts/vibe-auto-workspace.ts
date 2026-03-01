#!/usr/bin/env tsx
/**
 * Vibe Kanban Workspace Automation
 *
 * This script automates the complete workflow from dragging a task to "In Progress"
 * through deployment to staging.
 *
 * Usage:
 *   npm run vibe:auto -- --issue-id=<id>
 *   npm run vibe:auto -- --issue-id=844e-defect-integrati
 *
 * What it does:
 * 1. Gets issue details from Vibe Kanban
 * 2. Creates a feature branch (vk/<issue-id>-<slug>)
 * 3. Links workspace to issue
 * 4. Updates issue status to "In Progress"
 * 5. Installs git hooks for auto-push
 * 6. Opens workspace ready for development
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface VibeIssue {
  id: string;
  title: string;
  status: string;
  description?: string;
  project_id?: string;
}

interface WorkspaceInfo {
  workspace_id: string;
  branch_name: string;
  issue_id: string;
}

const WORKSPACE_TRACKING_FILE = '.vibe-workspace.json';

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`);
}

function exec(command: string, silent = false): string {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit'
    });
    return result.toString().trim();
  } catch (error: any) {
    if (!silent) {
      console.error(`❌ Command failed: ${command}`);
      console.error(error.message);
    }
    throw error;
  }
}

function getIssueFromVibe(issueId: string): VibeIssue | null {
  log('🔍', `Fetching issue details for: ${issueId}`);

  // Note: This script runs locally, not in MCP context
  // It expects to be run from within an active Vibe Kanban workspace
  // The workspace context file should contain the issue details

  const contextFile = '.vibe-context.json';
  if (existsSync(contextFile)) {
    try {
      const context = JSON.parse(readFileSync(contextFile, 'utf-8'));
      if (context.issue_id && context.issue_id.startsWith(issueId)) {
        log('✅', `Found issue from workspace context`);
        return {
          id: context.issue_id,
          title: context.issue_title || 'Issue from Vibe Kanban',
          status: context.issue_status || 'Todo',
          description: context.issue_description,
          project_id: context.project_id
        };
      }
    } catch (error) {
      log('⚠️', 'Failed to read workspace context file');
    }
  }

  log('⚠️', 'No workspace context found - using basic info');
  log('💡', 'This script works best when run from an active Vibe Kanban workspace');

  return {
    id: issueId,
    title: 'Issue from Vibe Kanban',
    status: 'In Progress',
    description: 'Automated workspace setup',
    project_id: 'unknown'
  };
}

function createFeatureBranch(issueId: string, title: string): string {
  // Create branch name slug from title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);

  const branchName = `vk/${issueId}-${slug}`;

  log('🌿', `Creating feature branch: ${branchName}`);

  try {
    // Check if branch already exists
    exec(`git rev-parse --verify ${branchName}`, true);
    log('ℹ️', `Branch ${branchName} already exists, checking out`);
    exec(`git checkout ${branchName}`);
  } catch {
    // Branch doesn't exist, create it
    exec(`git checkout -b ${branchName}`);
    log('✅', `Branch created: ${branchName}`);
  }

  return branchName;
}

function linkWorkspaceToIssue(issueId: string, branchName: string): string {
  log('🔗', `Workspace linking handled by Vibe Kanban`);

  // Note: Workspace linking is handled by Vibe Kanban when the workspace is created
  // This script runs within an active workspace, so linking is already done
  // We just need to ensure the branch name matches the expected pattern

  const contextFile = '.vibe-context.json';
  if (existsSync(contextFile)) {
    try {
      const context = JSON.parse(readFileSync(contextFile, 'utf-8'));
      log('✅', `Using existing workspace: ${context.workspace_id}`);
      return context.workspace_id;
    } catch (error) {
      log('⚠️', 'Failed to read workspace context');
    }
  }

  const workspaceId = `local-${Date.now()}`;
  log('⚠️', `No Vibe workspace context found, using local ID: ${workspaceId}`);

  return workspaceId;
}

function updateIssueStatus(issueId: string, status: string, comment?: string) {
  log('📝', `Issue status updates handled by CI/CD pipeline`);

  // Note: Issue status updates are handled automatically by the CI/CD pipeline
  // See .github/workflows/vibe-sync.yml for the automation
  //
  // Status transitions:
  // - "In Progress" → when workspace is created
  // - "In Development" → when pushed to develop branch
  // - "In Review" → when PR is created to staging
  // - "QA Testing" → when merged to staging
  // - "Done" → when deployed to production

  log('✅', `Status will be updated to "${status}" by CI/CD automation`);
}

function installGitHooks() {
  log('🪝', 'Installing git hooks for automation');

  try {
    exec('npm run hooks:install');
    log('✅', 'Git hooks installed successfully');
  } catch (error) {
    log('⚠️', 'Failed to install hooks - will need manual setup');
  }
}

function saveWorkspaceTracking(info: WorkspaceInfo) {
  const trackingPath = join(process.cwd(), WORKSPACE_TRACKING_FILE);
  writeFileSync(trackingPath, JSON.stringify(info, null, 2));
  log('💾', `Workspace info saved to ${WORKSPACE_TRACKING_FILE}`);
}

function loadWorkspaceTracking(): WorkspaceInfo | null {
  const trackingPath = join(process.cwd(), WORKSPACE_TRACKING_FILE);

  if (!existsSync(trackingPath)) {
    return null;
  }

  try {
    const content = readFileSync(trackingPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const issueIdArg = args.find(arg => arg.startsWith('--issue-id='));

  if (!issueIdArg) {
    console.error('❌ Usage: npm run vibe:auto -- --issue-id=<id>');
    console.error('   Example: npm run vibe:auto -- --issue-id=844e-defect-integrati');
    process.exit(1);
  }

  const issueId = issueIdArg.split('=')[1];

  log('🚀', 'Starting Vibe Kanban workspace automation');
  log('📋', `Issue ID: ${issueId}`);

  // Step 1: Get issue details
  const issue = getIssueFromVibe(issueId);

  if (!issue) {
    log('❌', `Issue ${issueId} not found`);
    process.exit(1);
  }

  log('✅', `Issue found: ${issue.title}`);

  // Step 2: Create feature branch
  const branchName = createFeatureBranch(issueId, issue.title);

  // Step 3: Link workspace
  const workspaceId = linkWorkspaceToIssue(issueId, branchName);

  // Step 4: Update issue status
  updateIssueStatus(
    issueId,
    'In Progress',
    `Workspace created: ${workspaceId}\nBranch: ${branchName}`
  );

  // Step 5: Install git hooks
  installGitHooks();

  // Step 6: Save workspace tracking
  saveWorkspaceTracking({
    workspace_id: workspaceId,
    branch_name: branchName,
    issue_id: issueId
  });

  log('✅', 'Workspace automation complete!');
  log('📝', 'Next steps:');
  log('  ', '1. Make your code changes');
  log('  ', '2. Commit (git commit) - will auto-push to trigger CI/CD');
  log('  ', '3. Create PR to staging when ready for QA');
  log('  ', '4. Vibe Kanban will auto-update as you progress through environments');
}

main().catch(error => {
  console.error('❌ Automation failed:', error.message);
  process.exit(1);
});

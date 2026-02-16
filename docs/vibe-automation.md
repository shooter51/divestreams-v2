# Vibe Kanban Full Automation

## Overview

Complete end-to-end automation from dragging a task to "In Progress" through deployment to production.

**ZERO manual operations required** - just drag and drop in Vibe Kanban!

## Two Automation Modes

### Mode 1: Webhook Automation (Recommended - ZERO commands)
Just drag a task to "In Progress" in Vibe Kanban and everything happens automatically via webhook.

**Setup once:** Deploy webhook handler server
**Daily use:** Drag task → Everything automated!

📖 **[Full Webhook Setup Guide](./vibe-webhook-automation.md)**

### Mode 2: CLI Automation (One command per task)
Run one command when starting a task, then everything else is automated.

**Daily use:** `npm run vibe:auto -- --issue-id=<id>` → Everything automated!

This document covers Mode 2. For Mode 1, see [vibe-webhook-automation.md](./vibe-webhook-automation.md).

## Automated Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Drag Task to "In Progress" in Vibe Kanban                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Run: npm run vibe:auto -- --issue-id=<id>                   │
│    ✅ Creates feature branch (vk/<issue-id>-<slug>)             │
│    ✅ Links workspace to issue                                  │
│    ✅ Updates Vibe status to "In Progress"                      │
│    ✅ Installs git hooks (auto-push on commit)                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Write Code + Commit                                          │
│    ✅ git commit -m "fix: ..."                                  │
│    ✅ POST-COMMIT HOOK: Auto-push to origin                     │
│    ✅ GitHub Actions CI/CD triggered                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Push to develop → Auto-Deploy to Dev VPS                    │
│    ✅ Lint, typecheck, unit tests                              │
│    ✅ Build Docker image (:dev tag)                            │
│    ✅ Deploy to Dev VPS (62.72.3.35)                           │
│    ✅ Vibe status → "In Development"                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Create PR to staging (manual or via gh CLI)                 │
│    ✅ Full test suite (unit + integration + E2E)               │
│    ✅ Vibe status → "In Review"                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Merge to staging → Auto-Deploy to Test VPS                  │
│    ✅ Build Docker image (:test tag)                           │
│    ✅ Deploy to Test VPS (76.13.28.28)                         │
│    ✅ Smoke tests run                                          │
│    ✅ Vibe status → "QA Testing"                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. QA Approval → PR to main                                     │
│    ✅ Pact can-i-deploy check                                  │
│    ✅ Merge → Retag :test → :latest                            │
│    ✅ Deploy to Production (72.62.166.128)                     │
│    ✅ Vibe status → "Done"                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Setup (One-Time)

### 1. Install Git Hooks

```bash
npm run hooks:install
```

This installs:
- **pre-commit**: Validates tests exist and pass
- **post-commit**: Auto-pushes to remote (triggers CI/CD)

### 2. Verify Setup

```bash
ls -la .git/hooks/
# Should show:
# pre-commit -> ../../scripts/pre-commit-coverage.sh
# post-commit -> ../../scripts/post-commit-push.sh
```

## Daily Usage

### Starting a New Task

```bash
# Drag task to "In Progress" in Vibe Kanban
# Then run:
npm run vibe:auto -- --issue-id=844e-defect-integrati
```

This creates:
- Feature branch: `vk/844e-defect-integrati-<slug>`
- Workspace link
- Vibe status update
- Git hooks installed

### Making Changes

```bash
# 1. Write code
# 2. Commit (auto-push happens via post-commit hook)
git add .
git commit -m "fix: resolve security vulnerabilities"

# ✅ Post-commit hook automatically runs:
# - git push origin vk/844e-defect-integrati-...
# - GitHub Actions CI/CD triggered
# - Auto-deploys to Dev VPS if tests pass
```

**No manual `git push` needed!**

### Creating PR to Staging

```bash
# Option 1: GitHub CLI (recommended)
gh pr create --base staging --title "Fix: Security vulnerabilities" --body "Fixes issue #844e"

# Option 2: GitHub UI
# Navigate to repo → Pull Requests → New PR

# ✅ Vibe Kanban auto-updates to "In Review"
```

### Merging to Staging

```bash
# Approve PR in GitHub UI (or use gh pr merge)
gh pr merge --auto --squash

# ✅ Auto-deploys to Test VPS
# ✅ Vibe status → "QA Testing"
# ✅ Notification sent to QA team
```

### Deploying to Production

```bash
# After QA approval, create PR to main
gh pr create --base main --title "Release: v2.1.0" --body "Tested on staging"

# Merge to main
gh pr merge --auto --squash

# ✅ Auto-deploys to Production
# ✅ Vibe status → "Done"
```

## Automation Components

### 1. Git Hooks

**Location:** `.git/hooks/`

- **pre-commit** (`scripts/pre-commit-coverage.sh`)
  - Validates modified files have tests
  - Runs unit/integration/pact tests
  - Blocks commit if tests fail
  - Enforces coverage thresholds

- **post-commit** (`scripts/post-commit-push.sh`)
  - Auto-pushes to remote branch
  - Skips protected branches (main, develop, staging)
  - Triggers GitHub Actions CI/CD
  - **This is what makes automation seamless!**

### 2. GitHub Actions

**Location:** `.github/workflows/`

- **deploy.yml** - Main CI/CD pipeline
  - Tests, builds, deploys to VPS
  - Environment-specific Docker tags

- **vibe-sync.yml** - Vibe Kanban integration
  - Updates issue status on deployment
  - Adds deployment comments
  - Links PRs to issues
  - Tracks progress through environments

### 3. NPM Scripts

```bash
npm run vibe:auto       # Create workspace, branch, link issue
npm run vibe:check      # Check test coverage for issue
npm run vibe:track      # Track issue progress
npm run hooks:install   # Install git hooks (one-time)
```

## Vibe Kanban Status Flow

| Trigger | Vibe Status | Environment |
|---------|-------------|-------------|
| `npm run vibe:auto` | **In Progress** | Local |
| Push to `develop` | **In Development** | Dev VPS |
| PR created to `staging` | **In Review** | - |
| Merge to `staging` | **QA Testing** | Test VPS |
| Merge to `main` | **Done** | Production |

## Troubleshooting

### Post-Commit Hook Not Running

```bash
# Check if hook is installed
ls -la .git/hooks/post-commit

# Should be a symlink to ../../scripts/post-commit-push.sh
# If not, reinstall:
npm run hooks:install
```

### Hook Shows "Permission Denied"

```bash
chmod +x .git/hooks/post-commit
chmod +x scripts/post-commit-push.sh
```

### Want to Commit Without Auto-Push

```bash
# Temporarily disable hook
mv .git/hooks/post-commit .git/hooks/post-commit.disabled

# Make commits
git commit -m "WIP: testing"

# Re-enable hook
mv .git/hooks/post-commit.disabled .git/hooks/post-commit

# Manual push when ready
git push origin <branch>
```

### Skip Pre-Commit Validation (Emergency Only)

```bash
git commit --no-verify -m "Emergency fix"
```

**Warning:** This bypasses test validation and coverage checks. Use only in emergencies.

## Configuration

### Disable Auto-Push for Specific Branches

Edit `scripts/post-commit-push.sh`:

```bash
# Add your branch to the skip list
if [[ "$BRANCH" == "main" || "$BRANCH" == "develop" || "$BRANCH" == "staging" || "$BRANCH" == "experimental" ]]; then
  echo "⚠️  Skipping auto-push on protected branch: $BRANCH"
  exit 0
fi
```

### Customize Vibe Status Mappings

Edit `.github/workflows/vibe-sync.yml`:

```yaml
- name: Update Vibe Kanban - Custom Status
  env:
    VK_ISSUE_ID: ${{ steps.extract-issue.outputs.issue_id }}
  run: |
    # Call Vibe Kanban API with custom status
```

## API Integration

### GitHub Secrets Required

Add these to your GitHub repository secrets (Settings → Secrets and variables → Actions):

- `VK_API_URL` - Vibe Kanban API endpoint (e.g., `https://api.vibe-kanban.com/v1`)
- `VK_API_TOKEN` - Authentication token for API access

### How It Works

1. **Workspace Context Files**
   - `.vibe-context.json` - Full workspace context (created by Claude in workspace)
   - `.vibe-issue-mapping.json` - Maps short IDs to full UUIDs (for CI/CD)

2. **Status Update Script**
   - `scripts/vibe-update-status.mjs` - Node.js script that calls Vibe Kanban API
   - Called by GitHub Actions workflow with short issue ID
   - Resolves full UUID from mapping file
   - Makes API call to update status

3. **CI/CD Workflow Integration**
   - `.github/workflows/vibe-sync.yml` - Triggered on push/PR events
   - Extracts issue ID from branch name (`vk/844e-defect` → `844e-defect`)
   - Calls status update script with appropriate status
   - Updates Vibe Kanban automatically on deployment

### Setting Up API Access

If `VK_API_URL` and `VK_API_TOKEN` are not set, the workflow will log what it *would* do but won't make actual API calls. This allows the automation to work in "dry-run" mode.

To enable real API integration:

```bash
# Add GitHub secrets via CLI
gh secret set VK_API_URL --body "https://api.vibe-kanban.com/v1"
gh secret set VK_API_TOKEN --body "your-token-here"

# Or via GitHub UI:
# Repo → Settings → Secrets and variables → Actions → New repository secret
```

## Benefits

✅ **Zero manual git push** - happens automatically on commit
✅ **Immediate CI/CD feedback** - tests run on every commit
✅ **Vibe Kanban stays in sync** - status updates on deployment
✅ **Full audit trail** - every deployment tracked
✅ **Fast iteration** - commit → test → deploy in minutes
✅ **QA visibility** - automatic notifications on staging deployments
✅ **Safe deployments** - test gates at every stage

## Files Overview

| File | Purpose |
|------|---------|
| `scripts/post-commit-push.sh` | Git hook - auto-push after commit |
| `scripts/install-hooks.sh` | Installs git hooks (handles worktrees) |
| `scripts/vibe-auto-workspace.ts` | Workspace setup automation |
| `scripts/vibe-save-context.ts` | Save Vibe context to files (run by Claude) |
| `scripts/vibe-update-status.mjs` | Update issue status via API (run by CI/CD) |
| `.github/workflows/vibe-sync.yml` | GitHub Actions workflow for status sync |
| `.vibe-context.json` | Workspace context (created by Claude) |
| `.vibe-issue-mapping.json` | Short ID → Full UUID mapping (for CI/CD) |

## Next Steps

1. ✅ Install hooks: `npm run hooks:install`
2. ✅ Try it: `npm run vibe:auto -- --issue-id=<your-issue>`
3. ✅ Make a commit and watch it auto-push
4. ✅ Verify CI/CD runs: `gh run list`
5. 🔧 Add GitHub secrets for real API integration (optional - works in dry-run mode without them)

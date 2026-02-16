# Git Branch Cleanup Guide

## Overview

DiveStreams maintains a clean git repository by automatically removing stale branches. This prevents branch bloat and makes it easier to navigate the repository.

## Automated Cleanup (GitHub Action)

### Schedule
- **Frequency**: Weekly on Sundays at 2 AM UTC
- **Action**: `.github/workflows/cleanup-stale-branches.yml`

### What It Does
1. Identifies branches with no commits in the last 30 days
2. Checks if branches are merged into `main`
3. Deletes merged stale branches automatically
4. Reports unmerged stale branches for manual review
5. Uploads a cleanup report as an artifact

### Manual Trigger
You can manually trigger the cleanup action:

1. Go to GitHub Actions → "Cleanup Stale Branches"
2. Click "Run workflow"
3. Options:
   - **Dry run**: Preview only (default: true)
   - **Stale days**: Custom threshold (default: 30)

## Local Cleanup Script

### Usage

**Preview (Dry Run) - See what would be deleted:**
```bash
./scripts/cleanup-branches.sh
```

**Preview with custom threshold:**
```bash
./scripts/cleanup-branches.sh --days 14
```

**Actually delete branches:**
```bash
./scripts/cleanup-branches.sh --live
```

**Delete with custom threshold:**
```bash
./scripts/cleanup-branches.sh --live --days 60
```

### What Gets Cleaned

#### 1. Merged & Stale (Automatically Deleted)
- ✅ **Safe to delete**
- Merged into `main`
- No commits in last 30 days
- Deleted from both remote and local

#### 2. Local-Only Branches (Automatically Deleted)
- ✅ **Safe to delete**
- Remote branch was already deleted
- Local branch still exists
- Cleaned up to sync with remote

#### 3. Unmerged & Stale (Manual Review)
- ⚠️ **Requires decision**
- Not merged into `main`
- No commits in last 30 days
- Reported but not deleted (could contain work in progress)

### Protected Branches

These branches are **never** deleted:
- `main`
- `develop`
- `staging`
- `HEAD`

## Examples

### Example 1: Weekly Maintenance
```bash
# Run every Monday morning to clean up branches from last week
./scripts/cleanup-branches.sh --live
```

### Example 2: Before Major Release
```bash
# Clean up very old branches (60+ days)
./scripts/cleanup-branches.sh --live --days 60
```

### Example 3: Check for Stale Branches
```bash
# Preview without deleting
./scripts/cleanup-branches.sh
```

Sample output:
```
🧹 Stale Branch Cleanup
Mode: DRY RUN (preview only)
Stale threshold: 30 days

📡 Fetching latest branch info...

📋 Analyzing branches...

🟢 MERGED & STALE: vk/old-feature (45 days old)
🟡 STALE (not merged): feature/experimental (35 days old)
🔵 LOCAL ONLY: vk/deleted-remote (remote branch deleted)

📊 Summary:
  Merged & stale: 1 branches
  Stale (not merged): 1 branches
  Local only (remote deleted): 1 branches

🗑️  Processing merged stale branches...
  [DRY RUN] Would delete remote: vk/old-feature (45 days old)
  [DRY RUN] Would delete local: vk/old-feature

🗑️  Processing local-only branches...
  [DRY RUN] Would delete local: vk/deleted-remote (remote already deleted)

⚠️  Unmerged stale branches (manual review recommended):
  - feature/experimental (35 days old)
    Last commit: abc1234 - WIP: experimental feature

To delete these manually:
  git push origin --delete <branch-name>
  git branch -D <branch-name>

✅ Dry run complete! Run with --live to actually delete branches.
```

## Manual Deletion

For branches that require manual review:

```bash
# Check if work is valuable
git log origin/<branch-name>
git diff main...origin/<branch-name>

# If safe to delete
git push origin --delete <branch-name>
git branch -D <branch-name>

# If contains valuable work, merge first
git checkout <branch-name>
git rebase main
git checkout main
git merge <branch-name>
git push
```

## Integration with Vibe Kanban

When Vibe Kanban creates workspaces:
1. Creates feature branch (`vk/xxxx-...`)
2. AI agent works on branch
3. PR merged to `develop` or `staging`
4. Branch becomes stale after 30 days
5. Automated cleanup removes it

**Best Practice**: Close Vibe Kanban issues when work is complete so branches get merged promptly.

## Troubleshooting

### "Failed to delete branch"
- Branch may be protected
- Check GitHub branch protection rules
- May need admin permissions

### "Not merged but contains important work"
- Review the branch: `git log origin/<branch-name>`
- If valuable, create PR to merge
- If not, delete manually with `--live`

### "Local branch exists but remote doesn't"
- This is normal after PRs are merged
- Script will clean these up automatically
- Run `./scripts/cleanup-branches.sh --live`

## Best Practices

1. **Merge promptly**: Don't let branches sit unmerged for weeks
2. **Close PRs**: Merged PRs should be closed to trigger branch deletion
3. **Review weekly**: Check the automated cleanup reports
4. **Run locally**: Before major releases, run cleanup manually
5. **Document work**: Use good commit messages so stale branch review is easier

## Related

- **Branch Strategy**: See main CLAUDE.md
- **PR Workflow**: See `docs/guides/pull-request-workflow.md`
- **CI/CD Pipeline**: See deployment section in CLAUDE.md

# Branch Cleanup - Quick Reference

## Quick Commands

```bash
# Preview cleanup (dry run)
npm run git:cleanup

# Actually delete branches
npm run git:cleanup:live

# Custom threshold (14 days)
./scripts/cleanup-branches.sh --days 14

# Custom threshold + delete
./scripts/cleanup-branches.sh --live --days 60
```

## What Gets Cleaned

| Type | Action | Safe? |
|------|--------|-------|
| **Merged & 30+ days old** | Auto-deleted | ✅ Yes |
| **Local-only (remote deleted)** | Auto-deleted | ✅ Yes |
| **Unmerged & 30+ days old** | Reported only | ⚠️ Review needed |

## Protected Branches

Never deleted: `main`, `develop`, `staging`

## Automated Schedule

- **When**: Every Sunday at 2 AM UTC
- **Where**: GitHub Actions → "Cleanup Stale Branches"
- **Manual trigger**: Actions tab → Run workflow

## Example Output

```
🧹 Stale Branch Cleanup
Mode: DRY RUN (preview only)
Stale threshold: 30 days

📋 Analyzing branches...

🟢 MERGED & STALE: vk/old-feature (45 days old)
🔵 LOCAL ONLY: vk/deleted-remote (remote branch deleted)

📊 Summary:
  Merged & stale: 1 branches
  Local only: 1 branches

✅ Dry run complete! Run with --live to actually delete.
```

## Manual Deletion

```bash
# Review branch first
git log origin/<branch-name>

# Delete remote and local
git push origin --delete <branch-name>
git branch -D <branch-name>
```

## Full Documentation

See `docs/guides/branch-cleanup.md` for complete details.

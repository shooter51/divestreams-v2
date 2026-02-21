#!/bin/bash
# Cleanup stale git branches (local script version)
# Usage: ./scripts/cleanup-branches.sh [--live] [--days N]

set -e

# Default settings
DRY_RUN=true
STALE_DAYS=30
PROTECTED_BRANCHES="main|develop|test|HEAD"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --live)
      DRY_RUN=false
      shift
      ;;
    --days)
      STALE_DAYS="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [--live] [--days N]"
      echo ""
      echo "Options:"
      echo "  --live      Actually delete branches (default: dry run)"
      echo "  --days N    Days since last commit to consider stale (default: 30)"
      echo ""
      echo "Protected branches: main, develop, test"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo "🧹 Stale Branch Cleanup"
echo "Mode: $([ "$DRY_RUN" = true ] && echo "DRY RUN (preview only)" || echo "LIVE (will delete)")"
echo "Stale threshold: ${STALE_DAYS} days"
echo ""

# Ensure we have latest remote info
echo "📡 Fetching latest branch info..."
git fetch --all --prune
echo ""

# Calculate cutoff date
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  CUTOFF_DATE=$(date -v-${STALE_DAYS}d +%s)
else
  # Linux
  CUTOFF_DATE=$(date -d "${STALE_DAYS} days ago" +%s)
fi

# Arrays to store results
declare -a MERGED_BRANCHES
declare -a STALE_BRANCHES
declare -a LOCAL_ONLY_BRANCHES

echo "📋 Analyzing branches..."
echo ""

# Analyze remote branches
for branch in $(git branch -r --format='%(refname:short)' | grep -vE "($PROTECTED_BRANCHES)"); do
  # Skip if not origin
  if [[ ! "$branch" =~ ^origin/ ]]; then
    continue
  fi

  # Extract branch name without origin/
  branch_name="${branch#origin/}"

  # Get last commit date (Unix timestamp)
  last_commit=$(git log -1 --format=%ct "$branch")
  days_old=$(( ($(date +%s) - last_commit) / 86400 ))

  # Check if merged into main
  if git branch -r --merged origin/main | grep -q "^[[:space:]]*$branch$"; then
    is_merged="yes"
  else
    is_merged="no"
  fi

  if [ $days_old -ge $STALE_DAYS ]; then
    if [ "$is_merged" = "yes" ]; then
      MERGED_BRANCHES+=("$branch_name:$days_old")
      echo "🟢 MERGED & STALE: $branch_name (${days_old} days old)"
    else
      STALE_BRANCHES+=("$branch_name:$days_old")
      echo "🟡 STALE (not merged): $branch_name (${days_old} days old)"
    fi
  fi
done

# Check for local branches that don't exist remotely
echo ""
echo "🔍 Checking local branches..."
for branch in $(git branch --format='%(refname:short)' | grep -vE "^($PROTECTED_BRANCHES)$"); do
  if ! git ls-remote --exit-code --heads origin "$branch" > /dev/null 2>&1; then
    LOCAL_ONLY_BRANCHES+=("$branch")
    echo "🔵 LOCAL ONLY: $branch (remote branch deleted)"
  fi
done

echo ""
echo "📊 Summary:"
echo "  Merged & stale: ${#MERGED_BRANCHES[@]} branches"
echo "  Stale (not merged): ${#STALE_BRANCHES[@]} branches"
echo "  Local only (remote deleted): ${#LOCAL_ONLY_BRANCHES[@]} branches"
echo ""

# Delete merged branches (safe to delete)
if [ ${#MERGED_BRANCHES[@]} -gt 0 ]; then
  echo "🗑️  Processing merged stale branches..."
  for entry in "${MERGED_BRANCHES[@]}"; do
    branch_name="${entry%%:*}"
    days_old="${entry##*:}"

    if [ "$DRY_RUN" = true ]; then
      echo "  [DRY RUN] Would delete remote: $branch_name (${days_old} days old)"
    else
      echo "  Deleting remote: $branch_name (${days_old} days old)"
      git push origin --delete "$branch_name" 2>&1 | sed 's/^/    /' || echo "    ⚠️  Failed to delete $branch_name"
    fi

    # Also delete local branch if it exists
    if git show-ref --verify --quiet "refs/heads/$branch_name"; then
      if [ "$DRY_RUN" = true ]; then
        echo "  [DRY RUN] Would delete local: $branch_name"
      else
        echo "  Deleting local: $branch_name"
        git branch -D "$branch_name" 2>&1 | sed 's/^/    /' || echo "    ⚠️  Failed to delete local $branch_name"
      fi
    fi
  done
fi

# Delete local-only branches (already deleted remotely)
if [ ${#LOCAL_ONLY_BRANCHES[@]} -gt 0 ]; then
  echo ""
  echo "🗑️  Processing local-only branches..."
  for branch_name in "${LOCAL_ONLY_BRANCHES[@]}"; do
    if [ "$DRY_RUN" = true ]; then
      echo "  [DRY RUN] Would delete local: $branch_name (remote already deleted)"
    else
      echo "  Deleting local: $branch_name (remote already deleted)"
      git branch -D "$branch_name" 2>&1 | sed 's/^/    /' || echo "    ⚠️  Failed to delete local $branch_name"
    fi
  done
fi

# Report on unmerged stale branches (manual review needed)
if [ ${#STALE_BRANCHES[@]} -gt 0 ]; then
  echo ""
  echo "⚠️  Unmerged stale branches (manual review recommended):"
  for entry in "${STALE_BRANCHES[@]}"; do
    branch_name="${entry%%:*}"
    days_old="${entry##*:}"
    last_commit=$(git log -1 --format='%h - %s' "origin/$branch_name" 2>/dev/null || echo "unable to get commit info")
    echo "  - $branch_name (${days_old} days old)"
    echo "    Last commit: $last_commit"
  done
  echo ""
  echo "To delete these manually:"
  echo "  git push origin --delete <branch-name>"
  echo "  git branch -D <branch-name>"
fi

echo ""
if [ "$DRY_RUN" = true ]; then
  echo "✅ Dry run complete! Run with --live to actually delete branches."
else
  echo "✅ Cleanup complete!"
fi

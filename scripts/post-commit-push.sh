#!/bin/bash
# Git post-commit hook - automatically push commits to remote
# This ensures CI/CD pipeline runs immediately after commit

set -e

# Get current branch name
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Skip if on detached HEAD
if [ "$BRANCH" = "HEAD" ]; then
  exit 0
fi

# Skip protected branches (these should only be updated via PR merges)
if [[ "$BRANCH" == "main" || "$BRANCH" == "develop" || "$BRANCH" == "test" ]]; then
  echo "⚠️  Skipping auto-push on protected branch: $BRANCH"
  echo "Protected branches should only be updated via PR merges"
  exit 0
fi

# Check if remote branch exists
if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  # Remote branch exists - push
  echo "🚀 Auto-pushing commit to origin/$BRANCH..."
  git push origin "$BRANCH"
  echo "✅ Pushed successfully - CI/CD pipeline triggered"
else
  # Remote branch doesn't exist - push with upstream
  echo "🚀 Auto-pushing new branch to origin/$BRANCH..."
  git push -u origin "$BRANCH"
  echo "✅ Branch created and pushed - CI/CD pipeline triggered"
fi

exit 0

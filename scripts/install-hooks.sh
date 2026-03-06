#!/bin/bash
# Install git hooks - handles both regular repos and worktrees

set -e

# Skip in non-git environments (e.g., Docker build)
if [ ! -d .git ] && [ ! -f .git ]; then
  echo "Not a git repository, skipping hook installation."
  exit 0
fi

# Find the actual hooks directory
if [ -f .git ]; then
  # This is a worktree, read the gitdir
  GITDIR=$(cat .git | sed 's/gitdir: //')
  # For worktrees, hooks are in the main repo's .git/hooks
  MAIN_GIT=$(echo "$GITDIR" | sed 's|/worktrees/.*||')
  HOOKS_DIR="$MAIN_GIT/hooks"
else
  # Regular repo
  HOOKS_DIR=".git/hooks"
fi

echo "📍 Git hooks directory: $HOOKS_DIR"

# Get absolute path to scripts directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create symlinks
echo "🔗 Installing pre-commit hook..."
ln -sf "$SCRIPT_DIR/pre-commit-coverage.sh" "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit"

echo "🔗 Installing post-commit hook..."
ln -sf "$SCRIPT_DIR/post-commit-push.sh" "$HOOKS_DIR/post-commit"
chmod +x "$HOOKS_DIR/post-commit"

echo "✅ Git hooks installed successfully!"
echo "   - pre-commit: Test validation and coverage"
echo "   - post-commit: Auto-push to remote (triggers CI/CD)"

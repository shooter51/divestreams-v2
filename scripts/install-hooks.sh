#!/usr/bin/env bash
set -e

# Script to install git hooks that works with both regular git repos and worktrees

# Get the actual git directory (handles worktrees)
GIT_DIR=$(git rev-parse --git-common-dir)

# Get the absolute path to the project root
PROJECT_ROOT=$(git rev-parse --show-toplevel)

# Hooks to install
HOOKS=(
  "pre-commit:scripts/pre-commit-coverage.sh"
)

echo "Installing git hooks..."
echo "Git directory: $GIT_DIR"
echo "Project root: $PROJECT_ROOT"

# Create hooks directory if it doesn't exist
mkdir -p "$GIT_DIR/hooks"

# Install each hook
for hook_spec in "${HOOKS[@]}"; do
  IFS=':' read -r hook_name script_path <<< "$hook_spec"

  hook_file="$GIT_DIR/hooks/$hook_name"
  script_file="$PROJECT_ROOT/$script_path"

  # Remove existing hook if it's a broken symlink or wrong target
  if [ -L "$hook_file" ]; then
    current_target=$(readlink "$hook_file")
    if [ ! -f "$current_target" ] || [ "$current_target" != "$script_file" ]; then
      echo "Removing old/broken symlink: $hook_file -> $current_target"
      rm -f "$hook_file"
    fi
  elif [ -f "$hook_file" ]; then
    echo "Warning: $hook_file exists and is not a symlink. Backing up to ${hook_file}.bak"
    mv "$hook_file" "${hook_file}.bak"
  fi

  # Create symlink
  echo "Installing $hook_name hook -> $script_path"
  ln -sf "$script_file" "$hook_file"
  chmod +x "$script_file"
  chmod +x "$hook_file"
done

echo "✓ Git hooks installed successfully"

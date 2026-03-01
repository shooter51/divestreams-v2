#!/bin/bash
###############################################################################
# Coverage Setup Verification Script
#
# Verifies that all code coverage enforcement components are installed
# and configured correctly.
#
# Usage: ./scripts/verify-coverage-setup.sh
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Code Coverage Setup Verification${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Check files exist
echo "📁 Checking required files..."

check_file() {
  local file=$1
  local critical=${2:-true}

  if [ -f "$file" ]; then
    echo -e "  ${GREEN}✓${NC} $file"
  else
    if [ "$critical" = true ]; then
      echo -e "  ${RED}✗${NC} $file (MISSING)"
      ERRORS=$((ERRORS + 1))
    else
      echo -e "  ${YELLOW}⚠${NC} $file (optional, missing)"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
}

# Core files
check_file ".coverage-config.json"
check_file "schemas/coverage-config.schema.json"
check_file "scripts/coverage-enforcer.ts"
check_file "scripts/generate-test-scaffold.ts"
check_file "scripts/vibe-test-tracker.ts"
check_file "scripts/pre-commit-coverage.sh"

# Documentation
check_file "TESTING.md"
check_file "COVERAGE-QUICK-START.md"
check_file "COVERAGE-SETUP-SUMMARY.md"

# Test directories
echo ""
echo "📂 Checking test directories..."

check_dir() {
  local dir=$1
  if [ -d "$dir" ]; then
    echo -e "  ${GREEN}✓${NC} $dir"
  else
    echo -e "  ${YELLOW}⚠${NC} $dir (will be created when needed)"
    WARNINGS=$((WARNINGS + 1))
  fi
}

check_dir "tests/unit"
check_dir "tests/integration"
check_dir "tests/e2e"
check_dir "tests/pact"

# Check NPM scripts
echo ""
echo "🔧 Checking NPM scripts..."

check_script() {
  local script=$1
  if grep -q "\"$script\":" package.json; then
    echo -e "  ${GREEN}✓${NC} npm run $script"
  else
    echo -e "  ${RED}✗${NC} npm run $script (MISSING)"
    ERRORS=$((ERRORS + 1))
  fi
}

check_script "coverage:enforce"
check_script "coverage:enforce:unit"
check_script "test:scaffold"
check_script "vibe:check"
check_script "vibe:track"
check_script "hooks:install"

# Check pre-commit hook
echo ""
echo "🪝 Checking pre-commit hook..."

if [ -L ".git/hooks/pre-commit" ]; then
  echo -e "  ${GREEN}✓${NC} Pre-commit hook installed (symlink)"
elif [ -f ".git/hooks/pre-commit" ]; then
  echo -e "  ${YELLOW}⚠${NC} Pre-commit hook exists but not a symlink"
  echo "    Run: npm run hooks:install"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "  ${YELLOW}⚠${NC} Pre-commit hook not installed (optional)"
  echo "    Install with: npm run hooks:install"
  WARNINGS=$((WARNINGS + 1))
fi

# Check configuration
echo ""
echo "⚙️  Checking configuration..."

if [ -f ".coverage-config.json" ]; then
  # Validate JSON
  if node -e "JSON.parse(require('fs').readFileSync('.coverage-config.json', 'utf8'))" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} .coverage-config.json is valid JSON"

    # Check enforcement enabled
    ENFORCEMENT_ENABLED=$(node -e "console.log(JSON.parse(require('fs').readFileSync('.coverage-config.json', 'utf8')).enforcement.enabled)")
    if [ "$ENFORCEMENT_ENABLED" = "true" ]; then
      echo -e "  ${GREEN}✓${NC} Coverage enforcement is enabled"
    else
      echo -e "  ${YELLOW}⚠${NC} Coverage enforcement is disabled"
      WARNINGS=$((WARNINGS + 1))
    fi

  else
    echo -e "  ${RED}✗${NC} .coverage-config.json is invalid JSON"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check GitHub Actions workflow
echo ""
echo "🔄 Checking GitHub Actions workflow..."

if [ -f ".github/workflows/deploy.yml" ]; then
  echo -e "  ${GREEN}✓${NC} .github/workflows/deploy.yml exists"

  # Check for coverage enforcement in workflow
  if grep -q "coverage-enforcer" .github/workflows/deploy.yml; then
    echo -e "  ${GREEN}✓${NC} Coverage enforcement integrated in CI/CD"
  else
    echo -e "  ${YELLOW}⚠${NC} Coverage enforcement not found in CI/CD workflow"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "  ${RED}✗${NC} .github/workflows/deploy.yml missing"
  ERRORS=$((ERRORS + 1))
fi

# Test the scripts
echo ""
echo "🧪 Testing scripts..."

# Test coverage enforcer
if node -e "require('./scripts/coverage-enforcer.ts')" 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} coverage-enforcer.ts compiles"
else
  if npx tsx scripts/coverage-enforcer.ts --help 2>&1 | grep -q "Enforcing\|Error"; then
    echo -e "  ${GREEN}✓${NC} coverage-enforcer.ts runs"
  else
    echo -e "  ${YELLOW}⚠${NC} coverage-enforcer.ts may have runtime issues"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# Test scaffolding generator
if npx tsx scripts/generate-test-scaffold.ts 2>&1 | grep -q "Error: Must specify"; then
  echo -e "  ${GREEN}✓${NC} generate-test-scaffold.ts runs"
else
  echo -e "  ${YELLOW}⚠${NC} generate-test-scaffold.ts may have issues"
  WARNINGS=$((WARNINGS + 1))
fi

# Test vibe tracker
if npx tsx scripts/vibe-test-tracker.ts 2>&1 | grep -q "Error: Must specify"; then
  echo -e "  ${GREEN}✓${NC} vibe-test-tracker.ts runs"
else
  echo -e "  ${YELLOW}⚠${NC} vibe-test-tracker.ts may have issues"
  WARNINGS=$((WARNINGS + 1))
fi

# Summary
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo "Summary:"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  echo ""
  echo "Code coverage enforcement is fully set up and ready to use."
  echo ""
  echo "Next steps:"
  echo "  1. Install pre-commit hook: npm run hooks:install"
  echo "  2. Read quick start guide: COVERAGE-QUICK-START.md"
  echo "  3. Try generating a test: npm run test:scaffold -- --file=<path>"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠ Setup complete with warnings (${WARNINGS})${NC}"
  echo ""
  echo "The system is functional but some optional components are missing."
  echo "Review the warnings above and install missing components if needed."
  exit 0
else
  echo -e "${RED}✗ Setup incomplete (${ERRORS} errors, ${WARNINGS} warnings)${NC}"
  echo ""
  echo "Please fix the errors above before using the coverage enforcement system."
  exit 1
fi

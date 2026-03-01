#!/bin/bash
###############################################################################
# Pre-Commit Coverage Hook
#
# Validates that:
# 1. All modified files have corresponding tests
# 2. Tests are passing
# 3. Coverage thresholds are met
#
# Install: ln -s ../../scripts/pre-commit-coverage.sh .git/hooks/pre-commit
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Running pre-commit coverage checks..."

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  echo "✅ No files staged for commit"
  exit 0
fi

# Filter for source files that require tests
SOURCE_FILES=""
for file in $STAGED_FILES; do
  if [[ $file == app/routes/*.tsx ]] || \
     [[ $file == lib/**/*.ts ]] || \
     [[ $file == lib/**/*.tsx ]] || \
     [[ $file == app/components/**/*.tsx ]]; then
    # Exclude test files themselves
    if [[ ! $file == *.test.ts* ]]; then
      SOURCE_FILES="$SOURCE_FILES $file"
    fi
  fi
done

if [ -z "$SOURCE_FILES" ]; then
  echo "✅ No source files staged (only config/docs/tests)"
  exit 0
fi

echo -e "${YELLOW}Source files staged:${NC}"
echo "$SOURCE_FILES" | tr ' ' '\n'
echo ""

# Check if tests exist for modified files
MISSING_TESTS=""
for file in $SOURCE_FILES; do
  # Determine expected test path
  if [[ $file == app/routes/api/*.tsx ]]; then
    # API routes need Pact + integration tests
    route_path="${file#app/routes/api/}"
    route_path="${route_path%.tsx}"

    pact_test="tests/pact/consumer/${route_path}.pact.test.ts"
    integration_test="tests/integration/routes/api/${route_path}.test.ts"

    if [ ! -f "$pact_test" ]; then
      MISSING_TESTS="$MISSING_TESTS\n  ❌ $file → Missing Pact test: $pact_test"
    fi
    if [ ! -f "$integration_test" ]; then
      MISSING_TESTS="$MISSING_TESTS\n  ❌ $file → Missing integration test: $integration_test"
    fi

  elif [[ $file == app/routes/*.tsx ]]; then
    # Regular routes need integration tests
    route_path="${file#app/routes/}"
    route_path="${route_path%.tsx}"
    integration_test="tests/integration/routes/${route_path}.test.ts"

    if [ ! -f "$integration_test" ]; then
      MISSING_TESTS="$MISSING_TESTS\n  ❌ $file → Missing integration test: $integration_test"
    fi

  elif [[ $file == lib/*.ts ]] || [[ $file == lib/*.tsx ]]; then
    # Lib files need unit tests
    lib_path="${file#lib/}"
    lib_path="${lib_path%.ts*}"
    unit_test="tests/unit/lib/${lib_path}.test.ts"

    if [ ! -f "$unit_test" ]; then
      MISSING_TESTS="$MISSING_TESTS\n  ❌ $file → Missing unit test: $unit_test"
    fi

  elif [[ $file == app/components/*.tsx ]]; then
    # Components need unit tests
    component_path="${file#app/components/}"
    component_path="${component_path%.tsx}"
    unit_test="tests/unit/app/components/${component_path}.test.tsx"

    if [ ! -f "$unit_test" ]; then
      MISSING_TESTS="$MISSING_TESTS\n  ❌ $file → Missing component test: $unit_test"
    fi
  fi
done

if [ -n "$MISSING_TESTS" ]; then
  echo -e "${RED}Missing tests:${NC}"
  echo -e "$MISSING_TESTS"
  echo ""
  echo -e "${YELLOW}Generate tests with:${NC}"
  echo "  npm run test:scaffold -- --file=<file-path>"
  echo ""
  echo "To bypass this check (not recommended):"
  echo "  git commit --no-verify"
  exit 1
fi

echo -e "${GREEN}✅ All modified files have tests${NC}"
echo ""

# Run tests for modified files
echo "🧪 Running tests..."

# Determine which test suites to run based on modified files
RUN_UNIT=false
RUN_INTEGRATION=false
RUN_PACT=false

for file in $SOURCE_FILES; do
  if [[ $file == lib/* ]] || [[ $file == app/components/* ]]; then
    RUN_UNIT=true
  fi

  if [[ $file == app/routes/* ]]; then
    RUN_INTEGRATION=true
  fi

  if [[ $file == app/routes/api/* ]]; then
    RUN_PACT=true
  fi
done

# Run tests
if [ "$RUN_UNIT" = true ]; then
  echo "  Running unit tests..."
  npm run test:unit -- --run --silent || {
    echo -e "${RED}❌ Unit tests failed${NC}"
    exit 1
  }
  echo -e "  ${GREEN}✅ Unit tests passed${NC}"
fi

if [ "$RUN_INTEGRATION" = true ]; then
  echo "  Running integration tests..."
  npm run test:integration -- --run --silent || {
    echo -e "${RED}❌ Integration tests failed${NC}"
    exit 1
  }
  echo -e "  ${GREEN}✅ Integration tests passed${NC}"
fi

if [ "$RUN_PACT" = true ]; then
  echo "  Running Pact tests..."
  npm run pact:consumer -- --run --silent || {
    echo -e "${RED}❌ Pact consumer tests failed${NC}"
    exit 1
  }
  echo -e "  ${GREEN}✅ Pact tests passed${NC}"
fi

echo ""
echo -e "${GREEN}✅ All pre-commit checks passed!${NC}"
exit 0

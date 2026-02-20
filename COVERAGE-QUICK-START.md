# Code Coverage - Quick Start Guide

## 🚀 TL;DR

**Every feature needs 4 types of tests:**
1. Unit tests (70% coverage)
2. Integration tests (75% coverage)
3. E2E tests (60% coverage)
4. Pact tests (100%, for APIs only)

**No feature is done without tests.**

## Quick Commands

```bash
# 1. Generate test scaffolding
npm run test:scaffold -- --file=app/routes/tenant/boats.tsx

# 2. Run tests with coverage
npm run test:coverage

# 3. Check coverage enforcement
npm run coverage:enforce

# 4. Install pre-commit hook
npm run hooks:install
```

## New Feature Workflow

### 1. Start Feature
```bash
git checkout -b feature/feature-name
```

### 2. Write Code
```bash
# Example: Add new route
# File: app/routes/tenant/boats/new.tsx
```

### 3. Generate Tests
```bash
npm run test:scaffold -- --file=app/routes/tenant/boats/new.tsx
```

This creates:
- ✅ Integration test: `tests/integration/routes/tenant/boats/new.test.ts`
- ✅ Template with TODO comments

### 4. Implement Tests
Edit generated test files and replace TODOs with actual test logic.

### 5. Run Tests
```bash
npm test                    # All tests
npm run test:coverage       # With coverage report
```

### 6. Check Coverage
```bash
npm run coverage:enforce    # Must pass!
```

### 7. Commit
```bash
git add .
git commit -m "feat: add boat creation"
# Pre-commit hook runs automatically
```

### 8. Create PR
```bash
git push origin feature/feature-name
gh pr create
# CI checks coverage automatically
```

## Test Types by File Location

| File Location | Required Tests | Example |
|---------------|----------------|---------|
| `app/routes/api/*.tsx` | Pact + Integration | API contracts + route logic |
| `app/routes/*.tsx` | Integration + E2E | Route logic + workflow |
| `lib/*.ts` | Unit | Pure functions |
| `app/components/*.tsx` | Unit | Component behavior |

## Common Scenarios

### Scenario 1: Adding a New Route

```bash
# 1. Create route file
touch app/routes/tenant/bookings/new.tsx

# 2. Generate tests
npm run test:scaffold -- --file=app/routes/tenant/bookings/new.tsx

# 3. Implement tests
# Edit: tests/integration/routes/tenant/bookings/new.test.ts

# 4. Run tests
npm run test:integration
```

### Scenario 2: Adding an API Endpoint

```bash
# 1. Create API route
touch app/routes/api/bookings.tsx

# 2. Generate tests
npm run test:scaffold -- --file=app/routes/api/bookings.tsx

# 3. This creates:
# - tests/pact/consumer/bookings.pact.test.ts
# - tests/integration/routes/api/bookings.test.ts

# 4. Implement both tests
# 5. Run tests
npm run pact:consumer
npm run test:integration
```

### Scenario 3: Adding a Utility Function

```bash
# 1. Create utility
touch lib/utils/date-formatter.ts

# 2. Generate test
npm run test:scaffold -- --file=lib/utils/date-formatter.ts

# 3. Implement test
# Edit: tests/unit/lib/utils/date-formatter.test.ts

# 4. Run test
npm run test:unit
```

### Scenario 4: Adding a Complete Feature

```bash
# 1. Generate full test suite
npm run test:scaffold -- --feature=trip-scheduling

# 2. This creates E2E workflow template:
# tests/e2e/workflow/trip-scheduling.spec.ts

# 3. Implement E2E workflow
# 4. Generate tests for individual files
npm run test:scaffold -- --file=<each-modified-file>

```

## Coverage Thresholds

| Type | Lines | Functions | Branches | Statements |
|------|-------|-----------|----------|------------|
| Unit | 70% | 65% | 65% | 70% |
| Integration | 75% | 70% | 70% | 75% |
| E2E | 60% | 55% | 55% | 60% |
| **Combined** | **80%** | **75%** | **75%** | **80%** |

## Pre-Commit Hook

The pre-commit hook automatically:
- ✅ Checks tests exist for modified files
- ✅ Runs relevant tests
- ❌ Blocks commit if tests missing or failing

Install:
```bash
npm run hooks:install
```

Bypass (not recommended):
```bash
git commit --no-verify
```

## CI/CD Gates

### Develop Branch (Fast)
- ✅ Lint + typecheck
- ✅ Unit + integration tests
- ✅ Pact tests
- ✅ Coverage enforcement
- → Deploy to Dev VPS

### Staging Branch (Full)
- ✅ All develop checks
- ✅ E2E tests with coverage
- ✅ Combined coverage enforcement
- → Deploy to Test VPS

### Main Branch (Production)
- ✅ Pact can-i-deploy check
- → Deploy to Production VPS

## Troubleshooting

### ❌ "Missing tests" on commit

**Fix:**
```bash
npm run test:scaffold -- --file=<file-path>
# Fill in test template
git add .
git commit
```

### ❌ Coverage below threshold

**Fix:**
```bash
# 1. Check coverage report
npm run test:coverage
open coverage/unit/index.html

# 2. Find uncovered lines (red highlights)
# 3. Add tests for those lines
# 4. Verify
npm run coverage:enforce
```

### ❌ CI fails but tests pass locally

**Fix:**
```bash
# Run tests with CI environment
CI=true npm test

# Check for environment differences
# - Database state
# - Timing issues
# - External dependencies
```

### ❌ Pre-commit hook too slow

**Disable hook temporarily:**
```bash
git commit --no-verify
```

**Or configure hook to run only changed tests:**
Edit `scripts/pre-commit-coverage.sh`

## Configuration

Edit `.coverage-config.json` to customize enforcement:

```json
{
  "enforcement": {
    "enabled": true,
    "blockDeployment": true,  // Block deploy if coverage low
    "blockCommit": false,      // Block commit if tests missing
    "blockPR": true           // Block PR merge if coverage low
  },
  "thresholds": {
    "unit": { "lines": 70, ... }
  }
}
```

## Cheat Sheet

```bash
# Testing
npm test                          # Run all tests
npm run test:unit                 # Unit tests only
npm run test:integration          # Integration tests only
npm run test:e2e                  # E2E tests only
npm run pact:consumer             # Pact consumer tests
npm run pact:provider             # Pact provider tests

# Coverage
npm run test:coverage             # Run with coverage
npm run test:coverage:unit        # Unit coverage only
npm run test:coverage:e2e         # E2E coverage only
npm run coverage:merge            # Merge all coverage
npm run coverage:enforce          # Check thresholds

# Test Generation
npm run test:scaffold -- --file=<path>       # Generate for file
npm run test:scaffold -- --feature=<name>    # Generate for feature

# Hooks
npm run hooks:install             # Install pre-commit hook
```

## Getting Help

1. **Read full docs:** [TESTING.md](./TESTING.md)
2. **Check examples:** Look at existing tests in `tests/`
3. **Check CI logs:** View GitHub Actions for specific errors
4. **Ask team:** Ask in chat

## Remember

✅ **Write tests for every feature**
✅ **Generate scaffolding first** (saves time)
✅ **Run coverage checks before pushing**
✅ **Fix coverage issues immediately** (don't let them pile up)
❌ **Never lower thresholds to pass** (fix the coverage instead)
❌ **Never skip tests** (they catch bugs early)

**Testing is not optional. It's part of the feature.**

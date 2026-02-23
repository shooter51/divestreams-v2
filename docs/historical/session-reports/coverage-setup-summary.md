# Code Coverage Enforcement - Setup Summary

## 🎯 Overview

A comprehensive code coverage enforcement system has been implemented for DiveStreams v2. This system ensures that **no feature is deployed without complete test coverage** across all test types.

## 📋 What Was Implemented

### 1. Coverage Configuration
**File:** `.coverage-config.json`

Defines:
- Coverage thresholds for each test type (unit, integration, E2E, Pact)
- Enforcement settings (block deployment, block PR, etc.)
- Test requirements per file type
- Vibe Kanban integration settings

**Schema:** `schemas/coverage-config.schema.json` (for IDE validation)

### 2. Coverage Enforcement Script
**File:** `scripts/coverage-enforcer.ts`

Features:
- Validates coverage against thresholds
- Checks unit, integration, E2E, and Pact coverage
- Generates detailed reports
- Blocks deployment if thresholds not met
- Supports strict mode for CI/CD

**Usage:**
```bash
npm run coverage:enforce              # Check all coverage
npm run coverage:enforce:unit         # Check unit coverage only
npm run coverage:enforce:strict       # Strict mode (fail on any miss)
```

### 3. Test Scaffolding Generator
**File:** `scripts/generate-test-scaffold.ts`

Features:
- Auto-generates test file templates
- Supports unit, integration, E2E, and Pact tests
- Smart file type detection
- Creates test directory structure
- Includes TODOs for implementation

**Usage:**
```bash
npm run test:scaffold -- --file=app/routes/tenant/boats.tsx
npm run test:scaffold -- --feature=trip-scheduling
npm run test:scaffold -- --api
```

### 4. Pre-Commit Hook
**File:** `scripts/pre-commit-coverage.sh`

Features:
- Validates tests exist for modified files
- Runs relevant tests before commit
- Blocks commits if tests missing or failing
- Provides helpful error messages
- Can be bypassed with `--no-verify`

**Installation:**
```bash
npm run hooks:install
```

### 5. Vibe Kanban Integration
**File:** `scripts/vibe-test-tracker.ts`

Features:
- Tracks test status per Vibe issue
- Checks if feature is ready for merge
- Lists blockers (missing/failing tests)
- Auto-creates test scaffolding for issues
- Updates issue with coverage status

**Usage:**
```bash
npm run vibe:check -- --issue=DIVE-1234
npm run vibe:track -- --issue=DIVE-1234
npm run vibe:create-tests -- --issue=DIVE-1234
```

### 6. GitHub Actions Integration
**File:** `.github/workflows/deploy.yml` (modified)

Changes:
- Added coverage collection for unit tests
- Added coverage collection for E2E tests
- Added Pact consumer tests
- Added coverage enforcement gates
- Uploads coverage reports as artifacts
- Blocks deployment if coverage insufficient

Coverage artifacts uploaded:
- `coverage-unit`
- `coverage-e2e`
- `coverage-combined`

### 7. Documentation
**Files:**
- `TESTING.md` - Complete testing guide (12KB)
- `COVERAGE-QUICK-START.md` - Quick reference guide (7KB)
- `CLAUDE.md` - Updated with coverage requirements

## 🔧 Coverage Thresholds

| Test Type | Lines | Functions | Branches | Statements |
|-----------|-------|-----------|----------|------------|
| **Unit** | 70% | 65% | 65% | 70% |
| **Integration** | 75% | 70% | 70% | 75% |
| **E2E** | 60% | 55% | 55% | 60% |
| **Combined** | 80% | 75% | 75% | 80% |
| **Pact** | 100% contracts | 100% verifications |

## 🚀 Quick Start for Developers

### New Feature Workflow

1. **Create feature branch** (Vibe auto-creates)
   ```bash
   git checkout vk/1234-new-feature
   ```

2. **Implement feature**
   ```bash
   # Write code in app/routes, lib/, etc.
   ```

3. **Generate test scaffolding**
   ```bash
   npm run test:scaffold -- --file=<file-path>
   ```

4. **Implement tests**
   ```bash
   # Fill in generated test templates
   ```

5. **Run tests with coverage**
   ```bash
   npm run test:coverage
   npm run coverage:enforce
   ```

6. **Check Vibe issue status**
   ```bash
   npm run vibe:check -- --issue=DIVE-1234
   ```

7. **Commit (pre-commit hook runs)**
   ```bash
   git commit -m "feat: add feature (DIVE-1234)"
   ```

8. **Create PR (CI checks run)**
   ```bash
   gh pr create
   ```

## 📊 Enforcement Points

### 1. Pre-Commit Hook (Optional)
- Validates tests exist for modified files
- Runs relevant tests
- Can be bypassed with `--no-verify`

**Status:** ⚠️ Not enabled by default (set `blockCommit: false` in config)

### 2. Pull Request Checks (Enabled)
- CI runs all tests with coverage
- Enforces coverage thresholds
- Blocks merge if insufficient coverage

**Status:** ✅ Enabled (`blockPR: true`)

### 3. Deployment Gates (Enabled)
- Coverage must meet thresholds
- All tests must pass
- Blocks deployment to Dev, Test, and Prod

**Status:** ✅ Enabled (`blockDeployment: true`)

### 4. Vibe Kanban Tracking (Enabled)
- Tracks test completion per issue
- Shows blockers (missing/failing tests)
- Marks features incomplete until tests done

**Status:** ✅ Enabled (`vibeKanban.enabled: true`)

## 📦 NPM Scripts Added

```json
{
  "coverage:enforce": "Check all coverage thresholds",
  "coverage:enforce:unit": "Check unit coverage only",
  "coverage:enforce:integration": "Check integration coverage only",
  "coverage:enforce:e2e": "Check E2E coverage only",
  "coverage:enforce:strict": "Strict mode (fail on any miss)",

  "test:scaffold": "Generate test scaffolding for file",

  "vibe:check": "Check test status for Vibe issue",
  "vibe:track": "Update Vibe issue with test status",
  "vibe:create-tests": "Create all test scaffolding for issue",

  "hooks:install": "Install pre-commit coverage hook"
}
```

## 🎯 Test Requirements by File Type

| File Pattern | Unit | Integration | E2E | Pact |
|--------------|------|-------------|-----|------|
| `app/routes/api/*.tsx` | - | ✅ | - | ✅ |
| `app/routes/*.tsx` | - | ✅ | ✅ | - |
| `lib/**/*.ts` | ✅ | - | - | - |
| `app/components/*.tsx` | ✅ | - | - | - |

## 🔄 CI/CD Pipeline Changes

### Develop Branch (Fast Path)
```
Lint → Typecheck → Unit Tests (with coverage) → Pact Tests →
Coverage Enforcement → Build Docker :dev → Deploy to Dev VPS
```

### Staging Branch (Full Path)
```
Lint → Typecheck → Unit Tests (with coverage) → Pact Tests →
E2E Tests (with coverage) → Merge Coverage →
Combined Coverage Enforcement → Build Docker :test →
Deploy to Test VPS → Smoke Tests
```

### Main Branch (Production)
```
Pact can-i-deploy → Retag :test → :latest → Deploy to Prod VPS
```

## 📖 Documentation Structure

1. **CLAUDE.md** - Updated with coverage overview
2. **TESTING.md** - Complete testing guide
   - Test types explained
   - Coverage requirements
   - Workflow examples
   - Troubleshooting
   - Best practices

3. **COVERAGE-QUICK-START.md** - Quick reference
   - Common commands
   - Common scenarios
   - Cheat sheet
   - Troubleshooting

4. **This file** - Setup summary

## ⚙️ Configuration

### Enable/Disable Enforcement

Edit `.coverage-config.json`:

```json
{
  "enforcement": {
    "enabled": true,           // Master switch
    "blockDeployment": true,   // Block deployment if coverage low
    "blockCommit": false,      // Block commits (via pre-commit hook)
    "blockPR": true           // Block PR merge
  }
}
```

### Adjust Thresholds

Edit `.coverage-config.json`:

```json
{
  "thresholds": {
    "unit": {
      "lines": 70,      // Adjust as needed
      "functions": 65,
      "branches": 65,
      "statements": 70
    }
  }
}
```

### Customize Test Requirements

Edit `.coverage-config.json`:

```json
{
  "testRequirements": {
    "unit": {
      "required": true,
      "patterns": ["lib/**/*.ts"],
      "excludePatterns": ["lib/integrations/**"]
    }
  }
}
```

## 🐛 Troubleshooting

### "Coverage below threshold" in CI

**Solution:**
1. Check coverage report artifact in GitHub Actions
2. Download and open `coverage/unit/index.html`
3. Find uncovered lines (highlighted in red)
4. Add tests for those lines
5. Re-run CI

### "Missing tests" from pre-commit hook

**Solution:**
```bash
# Generate tests
npm run test:scaffold -- --file=<file-path>

# Or bypass (not recommended)
git commit --no-verify
```

### CI passes locally but fails in pipeline

**Solution:**
```bash
# Run with CI environment
CI=true npm test
CI=true npm run test:e2e

# Check for:
# - Database state differences
# - Timing issues
# - Environment variables
```

## 🎓 Best Practices

1. ✅ **Generate scaffolding first** - Saves time, ensures consistency
2. ✅ **Run coverage locally before pushing** - Catch issues early
3. ✅ **Write tests as you code** - Don't leave them for later
4. ✅ **Check Vibe status regularly** - Track your progress
5. ✅ **Review coverage reports** - Understand what's not covered
6. ❌ **Never lower thresholds to pass** - Fix coverage instead
7. ❌ **Never skip tests** - They're part of the feature
8. ❌ **Never commit without tests** - Pre-commit hook helps

## 📈 Metrics & Monitoring

### View Coverage Reports

**Locally:**
```bash
npm run test:coverage
open coverage/unit/index.html
```

**In CI:**
- Go to GitHub Actions → Run → Artifacts
- Download `coverage-unit`, `coverage-e2e`, or `coverage-combined`
- Open `index.html`

### Check Coverage Trends

Coverage reports are retained for 30 days in GitHub Actions artifacts.

### Vibe Kanban Integration

Track test completion per issue:
```bash
npm run vibe:check -- --issue=DIVE-1234
```

Output shows:
- Modified files
- Test status (exists, passing)
- Coverage percentages
- Blockers
- Ready status

## 🚀 Next Steps

### For AI Agents

1. **Install pre-commit hook** (optional):
   ```bash
   npm run hooks:install
   ```

2. **Test the system** with a sample feature:
   ```bash
   # Create test file
   touch lib/utils/test-coverage-example.ts

   # Generate test
   npm run test:scaffold -- --file=lib/utils/test-coverage-example.ts

   # Implement test
   # Edit tests/unit/lib/utils/test-coverage-example.test.ts

   # Run coverage
   npm run coverage:enforce:unit
   ```

3. **Update Vibe issues** with test requirements:
   ```bash
   npm run vibe:check -- --issue=DIVE-1220
   npm run vibe:track -- --issue=DIVE-1220
   ```

### For Team

1. **Review documentation**:
   - Read `COVERAGE-QUICK-START.md` for quick reference
   - Read `TESTING.md` for complete guide

2. **Try the workflow**:
   - Pick a simple task
   - Follow the new feature workflow
   - Generate tests
   - Run coverage checks

3. **Provide feedback**:
   - Is the workflow clear?
   - Are thresholds reasonable?
   - Any missing features?

## 📝 Files Created/Modified

### Created
- `.coverage-config.json` - Coverage configuration
- `schemas/coverage-config.schema.json` - JSON schema
- `scripts/coverage-enforcer.ts` - Enforcement script
- `scripts/generate-test-scaffold.ts` - Test generator
- `scripts/pre-commit-coverage.sh` - Pre-commit hook
- `scripts/vibe-test-tracker.ts` - Vibe integration
- `TESTING.md` - Complete testing guide
- `COVERAGE-QUICK-START.md` - Quick reference
- `COVERAGE-SETUP-SUMMARY.md` - This file

### Modified
- `package.json` - Added NPM scripts
- `.github/workflows/deploy.yml` - Added coverage gates
- `CLAUDE.md` - Added coverage section

## ✅ Feature Checklist

Before marking feature complete:

- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] E2E workflow tests written and passing
- [ ] Pact tests written (for APIs) and passing
- [ ] Coverage thresholds met (`npm run coverage:enforce`)
- [ ] Pre-commit hook passes (if enabled)
- [ ] CI pipeline passes
- [ ] Vibe issue updated (`npm run vibe:track`)
- [ ] Code reviewed and approved
- [ ] Documentation updated

**Only then is the feature truly complete.**

## 🎉 Summary

A comprehensive code coverage enforcement system is now in place for DiveStreams v2:

✅ **Automated test scaffolding** - Generate test templates instantly
✅ **Coverage enforcement** - Block deployment if thresholds not met
✅ **Pre-commit validation** - Catch issues before they reach CI
✅ **CI/CD integration** - Automated checks in pipeline
✅ **Vibe Kanban tracking** - Monitor test progress per issue
✅ **Complete documentation** - Quick start and detailed guides

**Result:** No feature can be deployed without comprehensive test coverage.

---

*Generated for DiveStreams v2 - DIVE-1220: Code Coverage*

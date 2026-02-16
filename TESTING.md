# DiveStreams v2 - Testing & Coverage Enforcement

## Overview

DiveStreams v2 enforces comprehensive code coverage across all test types. **No feature is complete until it has passing tests with valid coverage.**

## Coverage Requirements

### Thresholds

| Test Type | Lines | Functions | Branches | Statements |
|-----------|-------|-----------|----------|------------|
| **Unit** | 70% | 65% | 65% | 70% |
| **Integration** | 75% | 70% | 70% | 75% |
| **E2E** | 60% | 55% | 55% | 60% |
| **Combined** | 80% | 75% | 75% | 80% |
| **Pact** | 100% contracts | 100% verifications |

### Enforcement Points

1. **Pre-commit hook** - Validates tests exist for modified files
2. **Pull Request** - Blocks PRs with insufficient coverage
3. **CI/CD Pipeline** - Blocks deployment if coverage thresholds not met
4. **Vibe Kanban** - Tracks test completion status per issue

## Test Types

### 1. Unit Tests (Vitest)

**Purpose:** Test individual functions, utilities, and components in isolation.

**Location:** `tests/unit/`

**What to test:**
- Utility functions in `lib/utils/`
- Business logic in `lib/`
- React components in `app/components/`
- Pure functions and helpers

**Example:**
```typescript
// tests/unit/lib/utils/validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateEmail } from '~/lib/utils/validation';

describe('validateEmail', () => {
  it('returns true for valid emails', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });

  it('returns false for invalid emails', () => {
    expect(validateEmail('invalid-email')).toBe(false);
  });
});
```

**Run:**
```bash
npm run test:unit                # Run all unit tests
npm run test:coverage:unit       # With coverage report
```

### 2. Integration Tests (Vitest)

**Purpose:** Test routes, loaders, actions, and database interactions.

**Location:** `tests/integration/`

**What to test:**
- Route loaders and actions
- Database operations
- Service integrations
- Multi-tenant isolation
- Authentication flows

**Example:**
```typescript
// tests/integration/routes/tenant/boats.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequestContext } from '~/tests/setup/test-utils';

describe('Boats Route', () => {
  let context: Awaited<ReturnType<typeof createRequestContext>>;

  beforeEach(async () => {
    context = await createRequestContext();
  });

  it('loads boats for authenticated tenant', async () => {
    // Test loader
  });

  it('enforces tenant isolation', async () => {
    // Test multi-tenancy
  });
});
```

**Run:**
```bash
npm run test:integration        # Run all integration tests
```

### 3. E2E Tests (Playwright)

**Purpose:** Test complete user workflows end-to-end.

**Location:** `tests/e2e/`

**What to test:**
- User workflows (login → create → edit → delete)
- Cross-page navigation
- Form submissions
- UI interactions
- Multi-step processes

**Example:**
```typescript
// tests/e2e/workflow/boats-management.spec.ts
import { test, expect } from '@playwright/test';

test('complete boat management workflow', async ({ page }) => {
  await page.goto('/tenant/boats');

  // Create boat
  await page.click('[data-testid="create-boat"]');
  await page.fill('[name="name"]', 'Test Boat');
  await page.click('[type="submit"]');

  // Verify created
  await expect(page.locator('text=Test Boat')).toBeVisible();
});
```

**Run:**
```bash
npm run test:e2e                # Run all E2E tests
npm run test:coverage:e2e       # With coverage
```

### 4. Pact Tests (Contract Testing)

**Purpose:** Test API contracts between frontend and backend.

**Location:** `tests/pact/`

**What to test:**
- API request/response contracts
- Consumer expectations (frontend)
- Provider implementations (backend)

**Example:**
```typescript
// tests/pact/consumer/boats-api.pact.test.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';

const provider = new PactV3({
  consumer: 'DiveStreamsFrontend',
  provider: 'DiveStreamsAPI',
});

describe('Boats API Contract', () => {
  it('returns boats list', async () => {
    await provider
      .given('boats exist')
      .uponReceiving('a request for boats')
      .withRequest({
        method: 'GET',
        path: '/api/boats',
      })
      .willRespondWith({
        status: 200,
        body: MatchersV3.eachLike({ id: 1, name: 'Boat' }),
      })
      .executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/boats`);
        expect(response.status).toBe(200);
      });
  });
});
```

**Run:**
```bash
npm run pact:consumer           # Consumer tests
npm run pact:provider           # Provider verification
```

## Workflow: Adding a New Feature

### Step 1: Create Feature Branch

```bash
# Vibe Kanban creates branch automatically
git checkout vk/1234-new-feature
```

### Step 2: Implement Feature

Write your feature code in appropriate locations:
- Routes: `app/routes/`
- Components: `app/components/`
- Utilities: `lib/`
- API: `app/routes/api/`

### Step 3: Generate Test Scaffolding

```bash
# For a specific file
npm run test:scaffold -- --file=app/routes/tenant/boats.tsx

# For an API endpoint
npm run test:scaffold -- --file=app/routes/api/bookings.tsx

# For a complete feature
npm run test:scaffold -- --feature=boat-management
```

This generates:
- Unit test templates
- Integration test templates
- E2E test templates
- Pact test templates (for APIs)

### Step 4: Implement Tests

Fill in the generated test templates with actual test logic:

1. **Unit tests** - Test pure functions and components
2. **Integration tests** - Test database operations and route logic
3. **E2E tests** - Test complete user workflows
4. **Pact tests** - Test API contracts (for API routes)

### Step 5: Run Tests Locally

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Check coverage enforcement
npm run coverage:enforce
```

### Step 6: Check Vibe Kanban Status

```bash
# Check test status for your issue
npm run vibe:check -- --issue=DIVE-1234

# Update Vibe issue with test status
npm run vibe:track -- --issue=DIVE-1234
```

### Step 7: Commit Changes

The pre-commit hook automatically:
- Validates tests exist for modified files
- Runs relevant tests
- Blocks commit if tests are missing or failing

```bash
git add .
git commit -m "feat: add boat management (DIVE-1234)"
# Pre-commit hook runs automatically
```

To bypass (not recommended):
```bash
git commit --no-verify
```

### Step 8: Create Pull Request

```bash
# Push to remote
git push origin vk/1234-new-feature

# Create PR (CI checks will run)
gh pr create --title "Add boat management" --body "Closes DIVE-1234"
```

CI will:
1. Run lint and typecheck
2. Run unit + integration tests with coverage
3. Run Pact tests
4. Enforce coverage thresholds
5. Run E2E tests (on staging PRs)
6. Block merge if coverage insufficient

### Step 9: Deploy

Merging to `develop` → deploys to Dev VPS
Merging to `staging` → deploys to Test VPS (requires all tests + E2E)
Merging to `main` → deploys to Production

## Coverage Enforcement Scripts

### Check Coverage

```bash
# Check all coverage
npm run coverage:enforce

# Check specific type
npm run coverage:enforce:unit
npm run coverage:enforce:integration
npm run coverage:enforce:e2e

# Strict mode (fail on any threshold miss)
npm run coverage:enforce:strict
```

### Generate Tests

```bash
# Generate tests for a file
npm run test:scaffold -- --file=lib/utils/validation.ts

# Generate tests for an API
npm run test:scaffold -- --file=app/routes/api/bookings.tsx

# Generate E2E workflow for feature
npm run test:scaffold -- --feature=booking-management
```

### Vibe Kanban Integration

```bash
# Check test status for issue
npm run vibe:check -- --issue=DIVE-1234

# Track and update issue
npm run vibe:track -- --issue=DIVE-1234

# Create all test scaffolding for issue
npm run vibe:create-tests -- --issue=DIVE-1234
```

## Git Hooks

### Install Pre-Commit Hook

```bash
npm run hooks:install
```

This installs a pre-commit hook that:
1. Checks for test files for all modified source files
2. Runs relevant tests
3. Blocks commit if tests missing or failing

### Disable Hook (Not Recommended)

```bash
git commit --no-verify
```

## Configuration

Edit `.coverage-config.json` to customize:

```json
{
  "enforcement": {
    "enabled": true,
    "blockDeployment": true,
    "blockCommit": false,
    "blockPR": true
  },
  "thresholds": {
    "unit": { "lines": 70, "functions": 65, ... },
    "integration": { "lines": 75, "functions": 70, ... },
    "e2e": { "lines": 60, "functions": 55, ... },
    "combined": { "lines": 80, "functions": 75, ... }
  },
  "vibeKanban": {
    "enabled": true,
    "createTestTasks": true,
    "trackCoverage": true,
    "requiredTests": ["unit", "integration", "e2e", "pact"]
  }
}
```

## CI/CD Integration

### GitHub Actions Workflow

The CI/CD pipeline enforces coverage at multiple stages:

1. **develop branch** (fast path):
   - Lint + typecheck
   - Unit + integration tests with coverage
   - Pact tests
   - Coverage enforcement
   - Deploy to Dev VPS

2. **staging branch** (full gate):
   - Lint + typecheck
   - Unit + integration tests with coverage
   - Pact tests
   - E2E tests with coverage
   - Combined coverage enforcement
   - Deploy to Test VPS
   - Smoke tests

3. **main branch** (production):
   - Pact can-i-deploy check
   - Retag :test → :latest
   - Deploy to Production VPS

### Viewing Coverage Reports

Coverage reports are uploaded as artifacts:
- `coverage-unit` - Unit test coverage
- `coverage-e2e` - E2E test coverage
- `coverage-combined` - Combined coverage report

Access via GitHub Actions → Run → Artifacts

## Troubleshooting

### "Missing tests" error on commit

**Problem:** Pre-commit hook blocks commit due to missing tests.

**Solution:**
```bash
# Generate tests for the file
npm run test:scaffold -- --file=<file-path>

# Or commit with --no-verify (not recommended)
git commit --no-verify
```

### Coverage below threshold

**Problem:** CI fails due to insufficient coverage.

**Solution:**
1. Check which files have low coverage:
   ```bash
   npm run test:coverage
   open coverage/unit/index.html
   ```
2. Add tests for uncovered lines
3. Re-run coverage check:
   ```bash
   npm run coverage:enforce
   ```

### E2E tests failing

**Problem:** E2E tests pass locally but fail in CI.

**Solution:**
1. Check CI logs for specific failures
2. Ensure database is seeded correctly
3. Check for timing issues (add waits)
4. Run E2E tests with same environment:
   ```bash
   CI=true npm run test:e2e
   ```

### Pact verification failed

**Problem:** Pact provider verification fails.

**Solution:**
1. Check contract differences in Pact Broker
2. Update provider to match consumer expectations
3. Or update consumer if contract changed
4. Publish new pact:
   ```bash
   npm run pact:publish
   ```

## Best Practices

1. **Write tests first (TDD)** - Define expected behavior before implementation
2. **Test behavior, not implementation** - Focus on what it does, not how
3. **Keep tests isolated** - Each test should be independent
4. **Use descriptive names** - Test names should explain what they test
5. **Test edge cases** - Don't just test happy path
6. **Mock external dependencies** - Use MSW for API mocks
7. **Clean up test data** - Use beforeEach/afterEach hooks
8. **Run tests before committing** - Catch failures early
9. **Keep coverage high** - Don't lower thresholds to pass
10. **Review coverage reports** - Understand what's not covered

## Feature Checklist

Before marking a feature as "done":

- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] E2E workflow tests written and passing
- [ ] Pact tests written (for APIs) and passing
- [ ] Coverage thresholds met (check with `npm run coverage:enforce`)
- [ ] Pre-commit hook passes
- [ ] CI pipeline passes
- [ ] Vibe issue updated with test status (`npm run vibe:track`)
- [ ] Code reviewed and approved
- [ ] Documentation updated (if needed)

**Only then is the feature truly complete.**

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Pact Documentation](https://docs.pact.io/)
- [Testing Library](https://testing-library.com/)
- [Coverage.js](https://istanbul.js.org/)

## Support

For issues or questions about the testing setup:

1. Check this documentation
2. Review example tests in `tests/` directory
3. Check CI logs for specific errors
4. Ask in team chat or create a Vibe issue

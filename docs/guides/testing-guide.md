# DiveStreams Testing Guide

Comprehensive guide for testing in the DiveStreams v2 project, including unit tests, integration tests, E2E tests, and Jira QAlity integration.

## Table of Contents

- [Overview](#overview)
- [Test Types](#test-types)
- [Running Tests](#running-tests)
- [Jira QAlity Integration](#jira-qality-integration)
- [Writing Tests](#writing-tests)
- [Coverage](#coverage)
- [CI/CD Testing](#cicd-testing)
- [Troubleshooting](#troubleshooting)

## Overview

DiveStreams uses a comprehensive testing strategy:

- **Unit Tests**: Vitest for isolated component/function testing
- **Integration Tests**: Vitest with TestContainers for database/API testing
- **E2E Tests**: Playwright for full workflow testing (80 tests)
- **Test Reporting**: Jira QAlity integration for automated test case tracking

## Test Types

### Unit Tests (`tests/unit/`)
Fast, isolated tests for individual functions and components.

**Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { calculatePrice } from '~/lib/utils/pricing';

describe('calculatePrice', () => {
  it('should calculate correct price with discount', () => {
    expect(calculatePrice(100, 0.1)).toBe(90);
  });
});
```

### Integration Tests (`tests/integration/`)
Tests that verify multiple components working together, often with database.

**Example:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

describe('User Repository', () => {
  let container;

  beforeAll(async () => {
    container = await new PostgreSqlContainer().start();
    // Setup database
  });

  afterAll(async () => {
    await container.stop();
  });

  it('should create user', async () => {
    // Test implementation
  });
});
```

### E2E Tests (`tests/e2e/workflow/`)
Full workflow tests using Playwright. Currently 80 tests covering:

- Platform admin workflows
- Tenant management
- Customer management
- Equipment management
- Trip scheduling
- Training modules
- Public site functionality

**Example:**
```typescript
import { test, expect } from '@playwright/test';

test('[KAN-2] Admin can create tenant', async ({ page }) => {
  await page.goto('/admin');
  await page.fill('#tenant-name', 'Test Dive Shop');
  await page.click('button[type="submit"]');
  await expect(page.locator('.success-message')).toBeVisible();
});
```

## Running Tests

### Local Development

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests only
npm run test:e2e              # E2E tests only

# Run with coverage
npm run test:coverage          # Unit coverage
npm run test:coverage:e2e      # E2E coverage
npm run test:coverage:all      # Combined coverage

# Run specific E2E test files
npm run test:e2e:failing       # Run specific failing tests

# Run tests with Jira reporting
npm run test:e2e:jira          # E2E tests + Jira JSON output
```

### Watch Mode

```bash
# Unit tests in watch mode
npm test

# Run specific test file
npm test -- tests/unit/pricing.test.ts
```

### Debugging Tests

```bash
# Playwright debug mode
npx playwright test --debug

# Headed mode (see browser)
npx playwright test --headed

# Specific test with UI
npx playwright test --ui
```

## Jira QAlity Integration

### Overview

The Jira integration automatically posts E2E test results as comments to linked Jira test case issues.

### Setup

1. **Create Jira API Token:**
   - Go to https://id.atlassian.com/manage-profile/security/api-tokens
   - Click "Create API token"
   - Copy the token

2. **Configure Environment:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add:
   ```bash
   JIRA_HOST=https://your-domain.atlassian.net
   JIRA_USER_EMAIL=your-email@example.com
   JIRA_API_TOKEN=your-token-here
   JIRA_PROJECT_KEY=KAN  # Optional default project
   ```

3. **Test Connection:**
   ```bash
   tsx scripts/test-jira-connection.ts
   ```

### Tagging Tests

Link tests to Jira issues by including the issue key in the test title:

```typescript
test('[KAN-2] Admin can create tenant', async ({ page }) => {
  // Test implementation
});

// Link to multiple issues
test('[KAN-2] [KAN-10] Complex workflow', async ({ page }) => {
  // This result will post to both KAN-2 and KAN-10
});
```

### Running with Jira Reporting

```bash
# Run E2E tests and post results to Jira
npm run test:e2e:jira

# Manual reporting (after tests run)
tsx scripts/jira-test-reporter.ts

# Dry run (see what would be posted)
tsx scripts/jira-test-reporter.ts --dry-run

# Verbose output
tsx scripts/jira-test-reporter.ts --verbose

# Custom results file
tsx scripts/jira-test-reporter.ts --results-file custom-results.json
```

### What Gets Posted

For each test linked to a Jira issue, a comment is posted with:

- ✅/❌ Test status (passed/failed)
- Test title and file location
- Execution duration
- CI run information (if in GitHub Actions)
- Error message and stack trace (if failed)
- Timestamp

**Example Comment:**
```
🔗 CI Run #123 (https://github.com/...) • Branch: staging

✅ E2E Test Result: PASSED

Test: [KAN-2] Platform admin can create tenant
File: tests/e2e/workflow/full-workflow.spec.ts
Duration: 12.45s

Posted: 2024-01-19T10:30:00Z
```

### Current Mappings

See [docs/test-jira-mapping.md](./test-jira-mapping.md) for full mapping documentation.

**Pilot Tests:**
- `[KAN-2]` - Platform admin can create tenant
- `[KAN-10]` - Tenant admin can access dashboard
- `[KAN-11]` - Tenant admin can manage customers

## Writing Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/');
  });

  test('[JIRA-KEY] Test description', async ({ page }) => {
    // Arrange
    await page.goto('/some-page');

    // Act
    await page.click('#submit-button');

    // Assert
    await expect(page.locator('.success')).toBeVisible();
  });
});
```

### Best Practices

1. **Use Page Object Pattern:**
   ```typescript
   class LoginPage {
     constructor(private page: Page) {}

     async login(email: string, password: string) {
       await this.page.fill('#email', email);
       await this.page.fill('#password', password);
       await this.page.click('button[type="submit"]');
     }
   }
   ```

2. **Use Data Test IDs:**
   ```typescript
   // In component
   <button data-testid="submit-button">Submit</button>

   // In test
   await page.click('[data-testid="submit-button"]');
   ```

3. **Wait for Network Idle:**
   ```typescript
   await page.goto('/page', { waitUntil: 'networkidle' });
   ```

4. **Use Fixtures for Common Setup:**
   ```typescript
   import { test as base } from '@playwright/test';

   const test = base.extend({
     authenticatedPage: async ({ page }, use) => {
       await page.goto('/login');
       await page.fill('#email', 'test@example.com');
       // ... login
       await use(page);
     }
   });
   ```

5. **Tag Tests with Jira Keys:**
   ```typescript
   test('[KAN-2] Important workflow', async ({ page }) => {
     // This will report to KAN-2
   });
   ```

### E2E Test Guidelines

1. **Independent Tests:** Each test should be able to run independently
2. **Clean State:** Use beforeEach/afterEach for setup/teardown
3. **Explicit Waits:** Use Playwright's auto-waiting features
4. **Meaningful Assertions:** Assert on user-visible outcomes
5. **Error Context:** Add descriptive error messages

## Coverage

### Collecting Coverage

```bash
# Unit test coverage
npm run test:coverage:unit

# E2E test coverage (instrumented)
npm run test:coverage:e2e

# Combined coverage
npm run test:coverage:all
```

### Coverage Reports

Coverage reports are generated in:
- `coverage/unit/` - Unit test coverage
- `coverage/e2e/` - E2E test coverage
- `coverage/combined/` - Merged coverage

Open `coverage/combined/index.html` in a browser to view the combined report.

### Coverage Thresholds

Current coverage targets:
- **Unit Tests:** 80%+ coverage
- **E2E Tests:** Critical paths covered
- **Combined:** 70%+ overall coverage

## CI/CD Testing

### GitHub Actions Workflow

Tests run automatically on push to `main`, `develop`, and `staging` branches.

**Workflow Steps:**
1. **Unit Tests** - Fast feedback on code changes
2. **Integration Tests** - Database and API verification
3. **E2E Tests** - Full workflow validation (80 tests)
4. **Jira Reporting** - Automatic test result posting
5. **Coverage Report** - Combined coverage metrics

### Viewing CI Results

```bash
# List recent runs
gh run list --limit 5

# View specific run
gh run view <run-id>

# Watch live run
gh run watch
```

### CI Environment Variables

Required in GitHub Actions secrets:
- `JIRA_HOST`
- `JIRA_USER_EMAIL`
- `JIRA_API_TOKEN`
- `DATABASE_URL`
- `REDIS_URL`
- `AUTH_SECRET`

## Troubleshooting

### Common Issues

#### E2E Tests Timeout

**Problem:** Tests timeout waiting for elements

**Solutions:**
```typescript
// Increase timeout for specific test
test('slow test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ...
});

// Or in playwright.config.ts
timeout: 60000
```

#### Database Connection Errors

**Problem:** Integration tests can't connect to database

**Solutions:**
1. Ensure PostgreSQL is running
2. Check `DATABASE_URL` in `.env`
3. Wait for container to be ready:
   ```typescript
   await container.start();
   await waitForDatabase(container.getConnectionString());
   ```

#### Jira Reporting Fails

**Problem:** Test results not posting to Jira

**Solutions:**
1. **Check credentials:**
   ```bash
   tsx scripts/test-jira-connection.ts
   ```

2. **Verify issue exists:**
   - Ensure Jira issue key exists
   - Check you have permission to comment

3. **Check JSON output:**
   ```bash
   cat test-results/results.json
   ```

4. **Dry run to see what would post:**
   ```bash
   tsx scripts/jira-test-reporter.ts --dry-run --verbose
   ```

#### Flaky Tests

**Problem:** Tests pass/fail inconsistently

**Solutions:**
1. **Add explicit waits:**
   ```typescript
   await expect(page.locator('#element')).toBeVisible();
   ```

2. **Wait for network idle:**
   ```typescript
   await page.goto('/page', { waitUntil: 'networkidle' });
   ```

3. **Increase retry attempts:**
   ```typescript
   test.describe.configure({ retries: 2 });
   ```

#### Coverage Not Generated

**Problem:** Coverage reports empty or missing

**Solutions:**
1. **Enable instrumentation:**
   ```bash
   E2E_COVERAGE=true npm run test:e2e
   ```

2. **Check global setup/teardown:**
   - Verify `tests/e2e/coverage/global-setup.ts` exists
   - Check coverage files in `.nyc_output/`

3. **Merge coverage manually:**
   ```bash
   npm run coverage:merge
   ```

### Debug Mode

```bash
# Run with debug logging
DEBUG=pw:api npx playwright test

# Run with inspector
npx playwright test --debug

# Run with trace
npx playwright test --trace on
```

### Getting Help

1. Check test output and error messages
2. Review [Playwright documentation](https://playwright.dev)
3. Check [Jira API documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
4. Run with `--verbose` flag for detailed logs
5. Create issue in project repository with:
   - Test command used
   - Full error output
   - Environment details (OS, Node version)
   - `.env` configuration (redacted)

## Advanced Topics

### Custom Reporters

Create custom Playwright reporters in `tests/e2e/reporters/`:

```typescript
import { Reporter } from '@playwright/test/reporter';

class CustomReporter implements Reporter {
  onTestEnd(test, result) {
    console.log(`${test.title}: ${result.status}`);
  }
}

export default CustomReporter;
```

### Parallel Execution

```bash
# Run tests in parallel (default: CPU cores)
npx playwright test --workers=4

# Run fully parallel
npx playwright test --fully-parallel
```

### Test Sharding

```bash
# Split tests across machines
npx playwright test --shard=1/3  # Machine 1
npx playwright test --shard=2/3  # Machine 2
npx playwright test --shard=3/3  # Machine 3
```

### Visual Regression Testing

```typescript
test('visual test', async ({ page }) => {
  await page.goto('/page');
  await expect(page).toHaveScreenshot('page.png');
});
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Vitest Documentation](https://vitest.dev)
- [Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Test Jira Mapping](./test-jira-mapping.md)
- [Project README](../README.md)

---

**Last Updated:** 2024-01-19
**Maintainer:** DiveStreams Development Team

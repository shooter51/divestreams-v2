# E2E Testing Guide

This directory contains end-to-end tests for DiveStreams using Playwright.

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/workflow/customer-management.spec.ts

# Run with UI mode (interactive)
npx playwright test --ui

# Run with debug mode
npx playwright test --debug
```

## Testing Best Practices

### ❌ ANTI-PATTERN: Arbitrary Timeouts

**DO NOT** use `waitForTimeout()` in tests. It's an anti-pattern that causes flaky, unreliable tests.

```typescript
// ❌ WRONG - This will fail ESLint
await page.waitForTimeout(1500);
await page.waitForTimeout(3000);
```

**Why is this bad?**
- **Flaky in CI**: Arbitrary waits don't account for varying server response times
- **Slow**: Always waits the full duration, even if the condition is met earlier
- **Unreliable**: May timeout on slow machines/CI or waste time on fast ones
- **Non-deterministic**: Can't guarantee the expected state is actually reached

### ✅ CORRECT: Condition-Based Waiting

Always wait for **specific conditions** to be met, not arbitrary time periods.

```typescript
// ✅ CORRECT - Wait for network to be idle
await page.waitForLoadState('networkidle');

// ✅ CORRECT - Wait for element to be visible
await page.locator("form").waitFor({ state: "visible", timeout: 10000 });

// ✅ CORRECT - Wait for specific element with assertion
await expect(page.locator("#success-message")).toBeVisible({ timeout: 10000 });

// ✅ CORRECT - Wait for URL to change
await page.waitForURL(/\/dashboard$/);

// ✅ CORRECT - Wait for selector
await page.waitForSelector("#data-loaded", { state: "visible" });
```

### Helper Functions

Use the helper functions in `tests/e2e/helpers/wait.ts` for common wait patterns:

```typescript
import { waitForFormVisible, waitForNavigation, waitForVisible } from '../helpers/wait';

// Wait for form to appear (with auto-retry on reload)
await waitForFormVisible(page);

// Wait for navigation to complete
await page.click('a[href="/dashboard"]');
await waitForNavigation(page);

// Wait for any element to be visible
const submitButton = page.locator('button[type="submit"]');
await waitForVisible(submitButton);
```

### Common Wait Patterns

#### 1. After Navigation/Click
```typescript
await page.click('a[href="/settings"]');
await page.waitForLoadState('networkidle');
// OR
await page.waitForURL(/\/settings$/);
```

#### 2. After Form Submission
```typescript
await page.fill('input[name="email"]', 'test@example.com');
await page.click('button[type="submit"]');
await expect(page.locator('.success-message')).toBeVisible();
```

#### 3. Waiting for API Responses
```typescript
// Wait for specific API call
const responsePromise = page.waitForResponse(resp =>
  resp.url().includes('/api/data') && resp.status() === 200
);
await page.click('button#load-data');
await responsePromise;
```

#### 4. Waiting for Element to Disappear
```typescript
// Wait for loading spinner to disappear
await page.locator('.loading-spinner').waitFor({ state: 'detached' });

// OR with assertion
await expect(page.locator('.loading-spinner')).not.toBeVisible();
```

#### 5. Complex Conditions
```typescript
// Wait for multiple conditions
await Promise.all([
  page.waitForSelector('#data-loaded'),
  page.waitForLoadState('networkidle'),
  expect(page.locator('.error')).not.toBeVisible()
]);
```

## Timeout Configuration

Default timeouts can be configured in `playwright.config.ts`:

- **actionTimeout**: 10000ms (10 seconds)
- **navigationTimeout**: 30000ms (30 seconds)
- **expect timeout**: 10000ms (10 seconds)

Override per action if needed:
```typescript
await page.click('button', { timeout: 5000 });
await expect(locator).toBeVisible({ timeout: 15000 });
```

## Debugging Flaky Tests

If a test is flaky:

1. **Never add `waitForTimeout()`** - it won't fix the root cause
2. Check if you're waiting for the right condition
3. Use `page.waitForLoadState('load')` after navigation (avoid 'networkidle' for apps with polling/websockets)
4. Add explicit waits for elements: `await locator.waitFor({ state: 'visible' })`
5. Use Playwright's trace viewer: `npx playwright test --trace on`
6. Run with `--headed` to see what's happening: `npx playwright test --headed`

## Examples

See `tests/e2e/workflow/customer-management.spec.ts` for real-world examples of condition-based waiting.

## ESLint Rule

The ESLint rule will warn you if you try to use `waitForTimeout()`:

```
❌ waitForTimeout() is prohibited. Use condition-based waiting instead:
  ✅ await page.waitForLoadState('load')  # Prefer 'load' over 'networkidle'
  ✅ await locator.waitFor({ state: 'visible' })
  ✅ await expect(locator).toBeVisible({ timeout: 10000 })
```

## Related Documentation

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Waiting](https://playwright.dev/docs/navigations#waiting-for-navigation)
- [KAN-625](https://divestreams.atlassian.net/browse/KAN-625) - Original issue identifying waitForTimeout as anti-pattern
- [DIVE-ika](../../../.beads/issues.jsonl) - Refactoring 679 existing waitForTimeout instances

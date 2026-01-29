import { Page, Locator } from '@playwright/test';

/**
 * Wait for a form to become visible on the page.
 * Automatically retries by reloading the page if the form doesn't appear.
 *
 * @param page - The Playwright page object
 * @param timeout - Maximum time to wait in milliseconds (default: 10000)
 *
 * @example
 * await waitForFormVisible(page);
 */
export async function waitForFormVisible(page: Page, timeout = 10000): Promise<void> {
  try {
    await page.locator("form").waitFor({ state: "visible", timeout });
  } catch {
    // Retry once by reloading the page
    await page.reload();
    await page.locator("form").waitFor({ state: "visible", timeout });
  }
}

/**
 * Wait for navigation to complete (network idle state).
 * Useful after clicking links or submitting forms.
 *
 * @param page - The Playwright page object
 * @param timeout - Maximum time to wait in milliseconds (default: 10000)
 *
 * @example
 * await page.click('a[href="/dashboard"]');
 * await waitForNavigation(page);
 */
export async function waitForNavigation(page: Page, timeout = 10000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for a specific locator to become visible.
 * More flexible than waitForFormVisible for any element.
 *
 * @param locator - The Playwright locator to wait for
 * @param timeout - Maximum time to wait in milliseconds (default: 10000)
 *
 * @example
 * const button = page.locator('button[type="submit"]');
 * await waitForVisible(button);
 */
export async function waitForVisible(locator: Locator, timeout = 10000): Promise<void> {
  await locator.waitFor({ state: "visible", timeout });
}

/**
 * Wait for a specific locator to be attached to the DOM.
 * Useful when you need to interact with an element that might not be visible yet.
 *
 * @param locator - The Playwright locator to wait for
 * @param timeout - Maximum time to wait in milliseconds (default: 10000)
 *
 * @example
 * const hiddenInput = page.locator('input[type="hidden"]');
 * await waitForAttached(hiddenInput);
 */
export async function waitForAttached(locator: Locator, timeout = 10000): Promise<void> {
  await locator.waitFor({ state: "attached", timeout });
}

/**
 * Wait for a specific locator to be detached from the DOM.
 * Useful for waiting for loading spinners or overlays to disappear.
 *
 * @param locator - The Playwright locator to wait for
 * @param timeout - Maximum time to wait in milliseconds (default: 10000)
 *
 * @example
 * const loadingSpinner = page.locator('.loading-spinner');
 * await waitForDetached(loadingSpinner);
 */
export async function waitForDetached(locator: Locator, timeout = 10000): Promise<void> {
  await locator.waitFor({ state: "detached", timeout });
}

/**
 * Wait for the page to be fully loaded (including all resources).
 * Stricter than waitForNavigation - waits for load event.
 *
 * @param page - The Playwright page object
 * @param timeout - Maximum time to wait in milliseconds (default: 10000)
 *
 * @example
 * await page.goto('/dashboard');
 * await waitForLoad(page);
 */
export async function waitForLoad(page: Page, timeout = 10000): Promise<void> {
  await page.waitForLoadState('load', { timeout });
}

/**
 * Wait for a specific selector to appear on the page.
 * Alternative to using locators when you need a simple selector check.
 *
 * @param page - The Playwright page object
 * @param selector - CSS selector to wait for
 * @param timeout - Maximum time to wait in milliseconds (default: 10000)
 *
 * @example
 * await waitForSelector(page, '#dashboard-header');
 */
export async function waitForSelector(page: Page, selector: string, timeout = 10000): Promise<void> {
  await page.waitForSelector(selector, { state: "visible", timeout });
}

/**
 * Wait for a URL pattern to match.
 * Useful after form submissions or redirects.
 *
 * @param page - The Playwright page object
 * @param urlPattern - String or RegExp to match against the URL
 * @param timeout - Maximum time to wait in milliseconds (default: 10000)
 *
 * @example
 * await waitForURL(page, /\/dashboard$/);
 * await waitForURL(page, 'https://example.com/success');
 */
export async function waitForURL(page: Page, urlPattern: string | RegExp, timeout = 10000): Promise<void> {
  await page.waitForURL(urlPattern, { timeout });
}

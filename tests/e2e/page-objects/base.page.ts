import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Base Page Object class with common utilities
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  protected get baseUrl(): string {
    return process.env.BASE_URL || "http://localhost:5173";
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(): Promise<void> {
    await this.page.waitForLoadState("load");
  }

  /**
   * Click and wait for navigation
   */
  async clickAndWaitForNavigation(locator: Locator): Promise<void> {
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: "load" }),
      locator.click(),
    ]);
  }

  /**
   * Fill form field by label
   */
  async fillByLabel(label: string | RegExp, value: string): Promise<void> {
    await this.page.getByLabel(label).fill(value);
  }

  /**
   * Click button by name
   */
  async clickButton(name: string | RegExp): Promise<void> {
    await this.page.getByRole("button", { name }).click();
  }

  /**
   * Assert heading is visible
   */
  async expectHeading(text: string | RegExp): Promise<void> {
    await expect(this.page.getByRole("heading", { name: text })).toBeVisible();
  }

  /**
   * Assert text is visible
   */
  async expectText(text: string | RegExp): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible();
  }

  /**
   * Assert URL contains pattern
   */
  async expectUrlContains(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }

  /**
   * Take screenshot for debugging
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png` });
  }

  /**
   * Wait for element to be visible with timeout
   */
  async waitForElement(
    selector: string,
    options?: { timeout?: number }
  ): Promise<void> {
    await this.page.locator(selector).waitFor({
      state: "visible",
      timeout: options?.timeout || 10000,
    });
  }

  /**
   * Check if element exists (doesn't throw)
   */
  async elementExists(selector: string): Promise<boolean> {
    try {
      await this.page.locator(selector).waitFor({ state: "visible", timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get toast notification text
   */
  async getToastMessage(): Promise<string | null> {
    const toast = this.page.locator('[role="alert"], [class*="toast"], [class*="notification"]');
    if (await toast.isVisible({ timeout: 3000 })) {
      return await toast.textContent();
    }
    return null;
  }

  /**
   * Dismiss any modal/dialog if present
   */
  async dismissModal(): Promise<void> {
    const closeButton = this.page.locator('[aria-label="Close"], button:has-text("Cancel"), button:has-text("Close")');
    if (await closeButton.isVisible({ timeout: 1000 })) {
      await closeButton.first().click();
    }
  }
}

/**
 * Tenant-scoped base page (for subdomain routes)
 */
export abstract class TenantBasePage extends BasePage {
  constructor(page: Page, protected readonly tenantSubdomain: string = "demo") {
    super(page);
  }

  protected get tenantUrl(): string {
    const url = new URL(this.baseUrl);
    return `${url.protocol}//${this.tenantSubdomain}.${url.host}`;
  }

  /**
   * Navigate to tenant app route
   */
  async gotoApp(path: string = ""): Promise<void> {
    await this.page.goto(`${this.tenantUrl}/tenant${path}`);
    await this.waitForNavigation();
  }

  /**
   * Navigate to tenant auth route
   */
  async gotoAuth(path: string = ""): Promise<void> {
    await this.page.goto(`${this.tenantUrl}/auth${path}`);
    await this.waitForNavigation();
  }

  /**
   * Navigate to public site route (customer-facing pages)
   */
  async gotoSite(path: string = ""): Promise<void> {
    await this.page.goto(`${this.tenantUrl}/site${path}`);
    await this.waitForNavigation();
  }
}

/**
 * Admin-scoped base page (tenant admin panel)
 */
export abstract class AdminBasePage extends BasePage {
  protected get adminUrl(): string {
    const url = new URL(this.baseUrl);
    return `${url.protocol}//admin.${url.host}`;
  }

  /**
   * Navigate to admin route
   */
  async gotoAdmin(path: string = ""): Promise<void> {
    await this.page.goto(`${this.adminUrl}${path}`);
    await this.waitForNavigation();
  }
}

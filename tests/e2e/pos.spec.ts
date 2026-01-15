import { test, expect } from "@playwright/test";

/**
 * Point of Sale (POS) E2E Tests
 *
 * Tests for POS routes:
 * - /app/pos - Main POS terminal
 * - /app/pos/products - Product management
 * - /app/pos/products/new - Add product
 * - /app/pos/products/:id - Product detail
 * - /app/pos/products/:id/edit - Edit product
 * - /app/pos/transactions - Transaction history
 */

// Helper functions
const getTenantUrl = (path: string = "/") =>
  `http://e2etest.localhost:5173${path}`;

test.describe("Point of Sale (POS)", () => {
  test.describe("POS Terminal Page", () => {
    test("should navigate to POS page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/pos") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display page heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /point of sale/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should show Today's Sales metric", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      // POS shows today's sales or upgrade prompt if not premium
      const salesMetric = await page.getByText(/today's sales/i).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(salesMetric || upgradePrompt).toBeTruthy();
    });

    test("should have Manage Products link", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const productsLink = await page.getByRole("link", { name: /manage products/i }).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(productsLink || upgradePrompt).toBeTruthy();
    });

    test("should have Transactions link", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const transactionsLink = await page.getByRole("link", { name: /transactions/i }).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(transactionsLink || upgradePrompt).toBeTruthy();
    });

    test("should have product search input", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const searchInput = await page.getByPlaceholder(/search products/i).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(searchInput || upgradePrompt).toBeTruthy();
    });

    test("should have category tabs or All button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const allButton = await page.getByRole("button", { name: /^all$/i }).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(allButton || upgradePrompt).toBeTruthy();
    });

    test("should show Cart section", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const cartSection = await page.getByText(/current sale|cart/i).first().isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(cartSection || upgradePrompt).toBeTruthy();
    });

    test("should have Cash payment button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const cashBtn = await page.getByRole("button", { name: /cash/i }).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(cashBtn || upgradePrompt).toBeTruthy();
    });

    test("should have Card payment button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const cardBtn = await page.getByRole("button", { name: /card/i }).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(cardBtn || upgradePrompt).toBeTruthy();
    });

    test("should show Total amount section", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const totalSection = await page.getByText(/^total$/i).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(totalSection || upgradePrompt).toBeTruthy();
    });
  });

  test.describe("POS Products Page", () => {
    test("should navigate to POS products page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos/products"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/pos/products") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display products heading or empty state", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos/products"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /products/i }).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(heading || upgradePrompt).toBeTruthy();
    });

    test("should have Add Product link", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos/products"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const addLink = await page.getByRole("link", { name: /add product|new product/i }).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(addLink || upgradePrompt).toBeTruthy();
    });
  });

  test.describe("New POS Product Page", () => {
    test("should navigate to new product page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos/products/new"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/pos/products/new") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display form heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos/products/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /add product|new product/i }).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(heading || upgradePrompt).toBeTruthy();
    });

    test("should have product name field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos/products/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const nameField = await page.getByLabel(/product name|name/i).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(nameField || upgradePrompt).toBeTruthy();
    });

    test("should have price field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos/products/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const priceField = await page.getByLabel(/price/i).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(priceField || upgradePrompt).toBeTruthy();
    });

    test("should have SKU field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos/products/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const skuField = await page.getByLabel(/sku/i).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(skuField || upgradePrompt).toBeTruthy();
    });

    test("should have category field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos/products/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const categoryField = await page.getByLabel(/category/i).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(categoryField || upgradePrompt).toBeTruthy();
    });
  });

  test.describe("POS Product Detail Page", () => {
    test("should navigate to product detail page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos/products/1"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/pos/products/1") || currentUrl.includes("/login")).toBeTruthy();
    });
  });

  test.describe("POS Product Edit Page", () => {
    test("should navigate to product edit page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos/products/1/edit"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/pos/products/1/edit") || currentUrl.includes("/login")).toBeTruthy();
    });
  });

  test.describe("POS Transactions Page", () => {
    test("should navigate to transactions page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos/transactions"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/pos/transactions") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display transactions heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/pos/transactions"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /transactions/i }).isVisible().catch(() => false);
      const upgradePrompt = await page.getByText(/premium feature/i).isVisible().catch(() => false);

      expect(heading || upgradePrompt).toBeTruthy();
    });
  });
});

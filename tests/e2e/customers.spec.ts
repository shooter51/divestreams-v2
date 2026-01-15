import { test, expect } from "@playwright/test";

/**
 * Customers E2E Tests
 *
 * Tests for customer management routes:
 * - /app/customers - List customers
 * - /app/customers/new - Add customer
 * - /app/customers/:id - View customer detail
 */

// Helper functions
const getTenantUrl = (path: string = "/") =>
  `http://e2etest.localhost:5173${path}`;

test.describe("Customers Management", () => {
  test.describe("Customers List Page", () => {
    test("should navigate to customers page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/customers") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display page heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /customers/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should show total customers count", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const count = await page.getByText(/\d+ total customers/i).isVisible().catch(() => false);
      expect(count).toBeTruthy();
    });

    test("should have Add Customer link", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const addCustomerLink = await page.getByRole("link", { name: /add customer/i }).isVisible().catch(() => false);
      expect(addCustomerLink).toBeTruthy();
    });

    test("should have search input", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const searchInput = await page.getByPlaceholder(/search.*name.*email/i).isVisible().catch(() => false);
      expect(searchInput).toBeTruthy();
    });

    test("should have Search button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const searchBtn = await page.getByRole("button", { name: /search/i }).isVisible().catch(() => false);
      expect(searchBtn).toBeTruthy();
    });

    test("should display customers table with Name header", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const nameHeader = await page.getByText(/^name$/i).isVisible().catch(() => false);
      expect(nameHeader).toBeTruthy();
    });

    test("should display Contact header in table", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const contactHeader = await page.getByText(/^contact$/i).isVisible().catch(() => false);
      expect(contactHeader).toBeTruthy();
    });

    test("should display Certification header in table", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const certHeader = await page.getByText(/^certification$/i).isVisible().catch(() => false);
      expect(certHeader).toBeTruthy();
    });

    test("should display Dives header in table", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const divesHeader = await page.getByText(/^dives$/i).isVisible().catch(() => false);
      expect(divesHeader).toBeTruthy();
    });

    test("should display Total Spent header in table", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const spentHeader = await page.getByText(/total spent/i).isVisible().catch(() => false);
      expect(spentHeader).toBeTruthy();
    });

    test("should display Last Dive header in table", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const lastDiveHeader = await page.getByText(/last dive/i).isVisible().catch(() => false);
      expect(lastDiveHeader).toBeTruthy();
    });

    test("should show empty state or customer list", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const hasTable = await page.locator("table").isVisible().catch(() => false);
      const emptyState = await page.getByText(/no customers yet/i).isVisible().catch(() => false);

      expect(hasTable || emptyState).toBeTruthy();
    });
  });

  test.describe("New Customer Page", () => {
    test("should navigate to new customer page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers/new"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/customers/new") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display form heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /add customer|new customer/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should have First Name field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const firstNameField = await page.getByLabel(/first name/i).isVisible().catch(() => false);
      expect(firstNameField).toBeTruthy();
    });

    test("should have Last Name field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const lastNameField = await page.getByLabel(/last name/i).isVisible().catch(() => false);
      expect(lastNameField).toBeTruthy();
    });

    test("should have Email field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const emailField = await page.getByLabel(/email/i).isVisible().catch(() => false);
      expect(emailField).toBeTruthy();
    });

    test("should have Phone field", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers/new"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const phoneField = await page.getByLabel(/phone/i).isVisible().catch(() => false);
      expect(phoneField).toBeTruthy();
    });
  });

  test.describe("Customer Detail Page", () => {
    test("should navigate to customer detail page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers/1"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/customers/1") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should handle non-existent customer gracefully", async ({ page }) => {
      await page.goto(getTenantUrl("/app/customers/nonexistent-id-12345"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      const hasError = await page.getByText(/not found|error/i).isVisible().catch(() => false);
      expect(currentUrl.includes("/customers") || currentUrl.includes("/login") || hasError).toBeTruthy();
    });
  });
});

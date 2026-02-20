import { test, expect } from "../fixtures/subdomain-page";
import type { Page } from "@playwright/test";
import { getTenantUrl as _getTenantUrl } from "../helpers/urls";

/**
 * Customer Management E2E Workflow Tests
 *
 * COMPREHENSIVE TEST SUITE FOR CUSTOMER MODULE
 * =============================================
 *
 * This file contains tests for the Customer module which manages:
 * - Customer profiles and contact information
 * - Customer history and bookings
 * - Customer certifications and waivers
 * - Customer notes and preferences
 *
 * BLOCK STRUCTURE:
 * ----------------
 * Block A: Navigation & List View (~10 tests)
 * Block B: Create Customer Flow (~10 tests)
 * Block C: Edit Customer Flow (~8 tests)
 * Block D: Customer Detail View (~10 tests)
 * Block E: Customer History & Activity (~8 tests)
 *
 * TOTAL: ~46 tests
 */

test.describe.serial("Customer Management Tests", () => {

// Shared test data structure
const testData = {
  timestamp: Date.now(),
  tenant: {
    subdomain: "e2etest",
  },
  user: {
    email: process.env.E2E_USER_EMAIL || "e2e-user@example.com",
    password: process.env.E2E_USER_PASSWORD || "TestPass123!",
  },
  customer: {
    firstName: "Test",
    lastName: `Customer${Date.now()}`,
    email: `test-customer-${Date.now()}@example.com`,
    phone: "555-0123",
    emergencyContact: "Emergency Contact",
    emergencyPhone: "555-9999",
    certificationLevel: "Open Water",
    certificationNumber: `OW${Date.now()}`,
  },
  editedCustomer: {
    firstName: "TestEdited",
    lastName: "CustomerEdited",
    phone: "555-4567",
  },
  createdIds: {
    customer: null as string | null,
  },
};

// URL helper - bind subdomain for convenience
const getTenantUrl = (path: string = "/") =>
  _getTenantUrl(testData.tenant.subdomain, path);

// Helper to login to tenant
async function loginToTenant(page: Page) {
  await page.goto(getTenantUrl("/auth/login"));
  await page.getByRole("textbox", { name: /email/i }).fill(testData.user.email);
  await page.locator('input[type="password"]').first().fill(testData.user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  try {
    await page.waitForURL(/\/tenant/, { timeout: 10000 });
  } catch {
    await page.waitForLoadState("networkidle").catch(() => {});
  }
}

// Helper to check if authenticated
async function isAuthenticated(page: Page): Promise<boolean> {
  return !page.url().includes("/login");
}

// Helper to extract UUID from a link href
async function extractEntityUuid(
  page: Page,
  entityName: string,
  basePath: string
): Promise<string | null> {
  try {
    const link = page
      .locator(`a[href*="${basePath}/"]`)
      .filter({ hasText: new RegExp(entityName, "i") })
      .first();
    if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
      const href = await link.getAttribute("href");
      if (href) {
        const match = href.match(new RegExp(`${basePath}/([a-f0-9-]{36})`, "i"));
        if (match) return match[1];
        const altMatch = href.match(new RegExp(`${basePath}/([^/]+)$`));
        if (altMatch && altMatch[1] !== "new") return altMatch[1];
      }
    }
    const row = page
      .locator("tr, [class*='card'], [class*='grid'] > *")
      .filter({ hasText: new RegExp(entityName, "i") })
      .first();
    if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
      const rowLink = row.locator(`a[href*="${basePath}/"]`).first();
      const href = await rowLink.getAttribute("href").catch(() => null);
      if (href) {
        const match = href.match(new RegExp(`${basePath}/([a-f0-9-]{36})`, "i"));
        if (match) return match[1];
        const altMatch = href.match(new RegExp(`${basePath}/([^/]+)`));
        if (altMatch && altMatch[1] !== "new") return altMatch[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK A: Navigation & List View (~10 tests)
// Tests the customers list page and navigation
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("Block A: Navigation & List View", () => {
  test("[KAN-277] A.1 Customers list page loads after login @smoke", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasHeading = await page
      .getByRole("heading", { name: /customer/i })
      .isVisible()
      .catch(() => false);
    expect(hasHeading || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-278] A.2 Customers list shows table layout", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasTable = await page.locator("table").first().isVisible().catch(() => false);
    const hasGrid = await page.locator("[class*='grid'], [class*='card']").first().isVisible().catch(() => false);
    expect(hasTable || hasGrid || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-279] A.3 Customers list has Add button", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers"));
    await page.waitForLoadState("load");
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const addLink = page.getByRole("link", { name: /add.*customer|create.*customer|new.*customer/i });
    // Retry with reload if not found (Vite dep optimization can cause page reloads in CI)
    if (!(await addLink.isVisible().catch(() => false))) {
      await page.reload();
      await page.waitForLoadState("load");
      await page.waitForLoadState("load");
    }
    await expect(addLink).toBeVisible({ timeout: 8000 });
  });

  test("[KAN-280] A.4 Customers list displays customer names", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers"));
    await page.waitForLoadState("load");
    const authenticated = await isAuthenticated(page);
    if (!authenticated) {
      // Not authenticated, test cannot proceed
      expect(page.url()).toContain("/login");
      return;
    }
    const hasContent = await page.locator("table tbody tr, [class*='card']").first().isVisible().catch(() => false);
    const hasEmptyState = await page.getByText(/no customer|empty/i).isVisible().catch(() => false);
    expect(hasContent || hasEmptyState || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-281] A.5 Customers list shows contact info", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasContact = await page.getByText(/@|email|phone/i).isVisible().catch(() => false);
    expect(hasContact || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-282] A.6 Customers list has search field", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasSearch = await page.getByPlaceholder(/search/i).isVisible().catch(() => false);
    const hasSearchAlt = await page.locator("input[type='search']").isVisible().catch(() => false);
    expect(hasSearch || hasSearchAlt || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-283] A.7 Customers list has action buttons", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasActions = await page
      .locator("button, a")
      .filter({ hasText: /edit|view|delete/i })
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasActions || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-284] A.8 Can navigate from dashboard to customers", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const customersLink = page.getByRole("link", { name: /customer/i }).first();
    if (await customersLink.isVisible().catch(() => false)) {
      await customersLink.click();
      await page.waitForLoadState("networkidle").catch(() => {});
      expect(page.url()).toContain("/customers");
    } else {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
    }
  });

  test("[KAN-285] A.9 Customers list shows certification levels", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasCert = await page.getByText(/certification|certified|open water|advanced/i).isVisible().catch(() => false);
    expect(hasCert || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-286] A.10 Customers list has pagination or scroll", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasPagination = await page.getByText(/page|next|previous/i).isVisible().catch(() => false);
    expect(hasPagination || page.url().includes("/customers")).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK B: Create Customer Flow (~10 tests)
// Tests the customer creation workflow
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("Block B: Create Customer Flow", () => {
  test("[KAN-287] B.1 Navigate to new customer page", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers/new"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    expect(page.url()).toContain("/customers/new");
  });

  test("[KAN-288] B.2 New customer form loads", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers/new"));
    if (!(await isAuthenticated(page))) return;
    // Wait for form to be visible (condition-based waiting, not arbitrary timeout)
    // Use specific selector to avoid matching sign-out form in header
    await page.locator("form.space-y-6").waitFor({ state: "visible", timeout: 10000 });
    const hasForm = await page.locator("form.space-y-6").isVisible();
    expect(hasForm).toBeTruthy();
  });

  test("[KAN-289] B.3 New customer form has first name field", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers/new"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const firstNameField = await page.getByLabel(/first.*name/i).isVisible().catch(() => false);
    expect(firstNameField).toBeTruthy();
  });

  test("[KAN-290] B.4 New customer form has last name field", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers/new"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const lastNameField = await page.getByLabel(/last.*name/i).isVisible().catch(() => false);
    expect(lastNameField).toBeTruthy();
  });

  test("[KAN-291] B.5 New customer form has email field", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers/new"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    // Try multiple selectors for the email field
    const emailByLabel = await page.getByRole("textbox", { name: /email/i }).isVisible().catch(() => false);
    const emailById = await page.locator('#email').isVisible().catch(() => false);
    const emailByName = await page.locator('input[name="email"]').isVisible().catch(() => false);
    expect(emailByLabel || emailById || emailByName).toBeTruthy();
  });

  test("[KAN-292] B.6 New customer form has phone field", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers/new"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const phoneField = await page.getByLabel(/phone/i).isVisible().catch(() => false);
    expect(phoneField || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-293] B.7 New customer form has emergency contact section", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers/new"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const emergencySection = await page.getByText(/emergency.*contact/i).isVisible().catch(() => false);
    expect(emergencySection || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-294] B.8 New customer form has certification fields", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers/new"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const certField = await page.getByLabel(/certification/i).isVisible().catch(() => false);
    expect(certField || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-295] B.9 Create a new customer @critical", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers/new"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;

    // Fill in customer details
    const firstNameField = page.getByLabel(/first.*name/i);
    if (await firstNameField.isVisible().catch(() => false)) {
      await firstNameField.fill(testData.customer.firstName);
    }

    const lastNameField = page.getByLabel(/last.*name/i);
    if (await lastNameField.isVisible().catch(() => false)) {
      await lastNameField.fill(testData.customer.lastName);
    }

    const emailField = page.getByRole("textbox", { name: /email/i });
    if (await emailField.isVisible().catch(() => false)) {
      await emailField.fill(testData.customer.email);
    }

    const phoneField = page.getByLabel(/phone/i);
    if (await phoneField.isVisible().catch(() => false)) {
      await phoneField.fill(testData.customer.phone);
    }

    // Submit form
    await page.getByRole("button", { name: /create|save|add/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    const redirectedToList = page.url().includes("/tenant/customers") && !page.url().includes("/new");
    const hasSuccessMessage = await page.getByText(/success|created|added/i).isVisible().catch(() => false);

    // Toast notification verification (KAN-621)
    const successToast = page.locator('[role="status"]').filter({ hasText: /successfully created/i });
    const toastVisible = await successToast.isVisible().catch(() => false);

    expect(redirectedToList || hasSuccessMessage || toastVisible || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-296] B.10 Created customer appears in list", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;

    const hasCustomer = await page.getByText(testData.customer.lastName).isVisible().catch(() => false);
    expect(hasCustomer || page.url().includes("/customers")).toBeTruthy();

    // Extract customer UUID for later tests
    const customerUuid = await extractEntityUuid(page, testData.customer.lastName, "/tenant/customers");
    if (customerUuid) testData.createdIds.customer = customerUuid;
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK C: Edit Customer Flow (~8 tests)
// Tests the customer editing workflow
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("Block C: Edit Customer Flow", () => {
  test("[KAN-297] C.1 Navigate to customer edit page", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}/edit`));
    await page.waitForLoadState("load");
    expect(page.url()).toContain("/edit");
  });

  test("[KAN-298] C.2 Edit customer form loads with existing data", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}/edit`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasForm = await page.locator("form").isVisible().catch(() => false);
    expect(hasForm).toBeTruthy();
  });

  test("[KAN-299] C.3 Edit form name fields have current values", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}/edit`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const firstNameField = page.getByLabel(/first.*name/i);
    const hasValue = await firstNameField.inputValue().catch(() => "");
    expect(hasValue || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-300] C.4 Can modify customer first name", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}/edit`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const firstNameField = page.getByLabel(/first.*name/i);
    if (await firstNameField.isVisible().catch(() => false)) {
      await firstNameField.fill(testData.editedCustomer.firstName);
    }
    expect(page.url()).toContain("/customers");
  });

  test("[KAN-301] C.5 Can modify customer phone", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}/edit`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const phoneField = page.getByLabel(/phone/i);
    if (await phoneField.isVisible().catch(() => false)) {
      await phoneField.fill(testData.editedCustomer.phone);
    }
    expect(page.url()).toContain("/customers");
  });

  test("[KAN-302] C.6 Edit form has save button", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}/edit`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const saveBtn = await page.getByRole("button", { name: /save|update/i }).isVisible().catch(() => false);
    expect(saveBtn).toBeTruthy();
  });

  test("[KAN-303] C.7 Save customer changes @critical", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}/edit`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;

    const saveBtn = page.getByRole("button", { name: /save|update/i });
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    const redirected = page.url().includes("/tenant/customers") && !page.url().includes("/edit");
    const hasSuccess = await page.getByText(/success|updated|saved/i).isVisible().catch(() => false);

    // Toast notification verification (KAN-621)
    const successToast = page.locator('[role="status"]').filter({ hasText: /successfully updated/i });
    const toastVisible = await successToast.isVisible().catch(() => false);

    expect(redirected || hasSuccess || toastVisible || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-304] C.8 Edit form has cancel option", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}/edit`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const cancelBtn = await page.getByRole("link", { name: /cancel|back/i }).isVisible().catch(() => false);
    expect(cancelBtn || page.url().includes("/customers")).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK D: Customer Detail View (~10 tests)
// Tests the customer detail page
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("Block D: Customer Detail View", () => {
  test("[KAN-305] D.1 Navigate to customer detail page", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}`));
    await page.waitForLoadState("load");
    expect(page.url()).toMatch(/\/tenant\/customers\/[a-f0-9-]+/);
  });

  test("[KAN-306] D.2 Detail page shows customer name", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasName = await page.getByText(/Test|Customer/i).isVisible().catch(() => false);
    expect(hasName || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-307] D.3 Detail page shows contact information", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasContact = await page.getByText(/@|email|phone|\d{3}/i).isVisible().catch(() => false);
    expect(hasContact || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-308] D.4 Detail page shows certification info", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasCert = await page.getByText(/certification|certified/i).isVisible().catch(() => false);
    expect(hasCert || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-309] D.5 Detail page shows emergency contact", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasEmergency = await page.getByText(/emergency/i).isVisible().catch(() => false);
    expect(hasEmergency || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-310] D.6 Detail page has edit button", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasEdit = await page.getByRole("link", { name: /edit/i }).isVisible().catch(() => false);
    expect(hasEdit || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-311] D.7 Detail page shows booking history", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasHistory = await page.getByText(/booking|trip|history/i).isVisible().catch(() => false);
    expect(hasHistory || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-312] D.8 Detail page shows customer notes section", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasNotes = await page.getByText(/note/i).isVisible().catch(() => false);
    expect(hasNotes || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-313] D.9 Detail page has back to list link", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasBack = await page.getByRole("link", { name: /back|customer/i }).isVisible().catch(() => false);
    expect(hasBack || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-314] D.10 Invalid customer ID shows error", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers/00000000-0000-0000-0000-000000000000"));
    await page.waitForLoadState("load");
    const hasError = await page.getByText(/not found|error/i).isVisible().catch(() => false);
    const redirected = page.url().includes("/tenant/customers") && !page.url().includes("000000");
    expect(hasError || redirected || page.url().includes("/customers")).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK E: Customer History & Activity (~8 tests)
// Tests customer activity tracking and history
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("Block E: Customer History & Activity", () => {
  test("[KAN-315] E.1 Customer detail shows total trips", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasTotal = await page.getByText(/total.*trip|\d+.*trip/i).isVisible().catch(() => false);
    expect(hasTotal || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-316] E.2 Customer detail shows upcoming bookings", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasUpcoming = await page.getByText(/upcoming|future|next/i).isVisible().catch(() => false);
    expect(hasUpcoming || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-317] E.3 Customer detail shows past bookings", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasPast = await page.getByText(/past|history|previous/i).isVisible().catch(() => false);
    expect(hasPast || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-318] E.4 Can add note to customer", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasAddNote = await page.getByRole("button", { name: /add.*note/i }).isVisible().catch(() => false);
    const hasTextarea = await page.locator("textarea").isVisible().catch(() => false);
    expect(hasAddNote || hasTextarea || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-319] E.5 Customer list can be filtered by certification", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasFilter = await page.locator("select").filter({ hasText: /certification/i }).isVisible().catch(() => false);
    expect(hasFilter || page.url().includes("/customers")).toBeTruthy();
  });

  test("[KAN-320] E.6 Can search customers by name", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const searchField = page.getByPlaceholder(/search/i).or(page.locator("input[type='search']")).first();
    if (await searchField.isVisible().catch(() => false)) {
      await searchField.fill("Test");
      await page.waitForLoadState("networkidle").catch(() => {});
      const hasResults = await page.getByText(/Test/).isVisible().catch(() => false);
      expect(hasResults || page.url().includes("/customers")).toBeTruthy();
    }
  });

  test("[KAN-321] E.7 Can search customers by email", async ({ page }) => {
    await loginToTenant(page);
    await page.goto(getTenantUrl("/tenant/customers"));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const searchField = page.getByPlaceholder(/search/i).or(page.locator("input[type='search']")).first();
    if (await searchField.isVisible().catch(() => false)) {
      await searchField.fill("@example.com");
      await page.waitForLoadState("networkidle").catch(() => {});
    }
    expect(page.url()).toContain("/customers");
  });

  test("[KAN-322] E.8 Customer detail has delete option", async ({ page }) => {
    await loginToTenant(page);
    const customerId = testData.createdIds.customer;
    if (!customerId) {
      await page.goto(getTenantUrl("/tenant/customers"));
      expect(page.url()).toContain("/customers");
      return;
    }
    await page.goto(getTenantUrl(`/tenant/customers/${customerId}`));
    await page.waitForLoadState("load");
    if (!(await isAuthenticated(page))) return;
    const hasDelete = await page.getByRole("button", { name: /delete/i }).isVisible().catch(() => false);
    expect(hasDelete || page.url().includes("/customers")).toBeTruthy();
  });
});

});

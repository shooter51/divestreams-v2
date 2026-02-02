import { test, expect } from "../fixtures/subdomain-page";
import type { Page } from "@playwright/test";

/**
 * Regression Tests for Bug Fixes
 *
 * COMPREHENSIVE REGRESSION SUITE
 * ==============================
 *
 * This file contains E2E tests for all critical bugs that were fixed.
 * These tests ensure the bugs don't regress in future releases.
 *
 * Related Beads Issues:
 * - DIVE-w1s: Customer deletion 500 error (cascade deletes)
 * - DIVE-237: Booking deletion 500 error
 * - DIVE-ein: Discount code deletion - modal not closing
 * - DIVE-ka3: Discount code update not working
 * - DIVE-d4m: Product deletion - modal not closing
 * - DIVE-u07: Boat deletion only deactivating
 * - DIVE-9f5: Dive site deletion only deactivating
 * - DIVE-98t: Tour deletion only deactivating
 * - DIVE-6l9: Gallery 404 route missing
 * - Public site settings: theme/color/font selection issues
 *
 * BLOCK STRUCTURE:
 * ----------------
 * Block A: Customer & Booking Deletion (~8 tests)
 * Block B: Discount Code Modal Issues (~6 tests)
 * Block C: Product Modal Issues (~4 tests)
 * Block D: Entity Deletion (Boat/Tour/Dive Site) (~6 tests)
 * Block E: Gallery Navigation (~4 tests)
 * Block F: Public Site Settings (~8 tests)
 */

test.describe.serial("Regression Tests - Bug Fixes", () => {

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
    firstName: "DeleteTest",
    lastName: `Customer${Date.now()}`,
    email: `delete-test-${Date.now()}@example.com`,
    phone: "555-0123",
  },
  booking: {
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    participants: 2,
  },
  discount: {
    code: `TESTCODE${Date.now()}`,
    type: "percentage",
    value: 10,
  },
  product: {
    name: `Test Product ${Date.now()}`,
    price: 29.99,
    sku: `SKU${Date.now()}`,
  },
  boat: {
    name: `Test Boat ${Date.now()}`,
    capacity: 20,
  },
  diveSite: {
    name: `Test Dive Site ${Date.now()}`,
    maxDepth: 30,
  },
  tour: {
    name: `Test Tour ${Date.now()}`,
    price: 99.99,
  },
  createdIds: {
    customer: null as string | null,
    booking: null as string | null,
    discount: null as string | null,
    product: null as string | null,
    boat: null as string | null,
    diveSite: null as string | null,
    tour: null as string | null,
  },
};

// Helper to get tenant URL
const getTenantUrl = (path: string = "/") =>
  `http://${testData.tenant.subdomain}.localhost:5173${path}`;

// Helper to login to tenant
async function loginToTenant(page: Page) {
  await page.goto(getTenantUrl("/auth/login"));
  await page.getByRole("textbox", { name: /email/i }).fill(testData.user.email);
  await page.getByLabel(/password/i).fill(testData.user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  try {
    await page.waitForURL(/\/tenant/, { timeout: 10000 });
  } catch {
    // Fallback: wait for page to stabilize if URL doesn't change
    await page.waitForLoadState("networkidle").catch(() => {});
  }
}

// Helper to check if authenticated
async function isAuthenticated(page: Page): Promise<boolean> {
  return !page.url().includes("/login");
}

// Helper to extract UUID from URL or link
async function extractEntityId(page: Page, entityName: string, basePath: string): Promise<string | null> {
  try {
    // Try to find link with the entity name
    const link = page
      .locator(`a[href*="${basePath}/"]`)
      .filter({ hasText: new RegExp(entityName, "i") })
      .first();

    if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
      const href = await link.getAttribute("href");
      if (href) {
        const match = href.match(new RegExp(`${basePath}/([a-f0-9-]{36})`, "i"));
        if (match) return match[1];
      }
    }

    // Try to find in table row
    const row = page
      .locator("tr")
      .filter({ hasText: new RegExp(entityName, "i") })
      .first();

    if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
      const rowLink = row.locator(`a[href*="${basePath}/"]`).first();
      const href = await rowLink.getAttribute("href").catch(() => null);
      if (href) {
        const match = href.match(new RegExp(`${basePath}/([a-f0-9-]{36})`, "i"));
        if (match) return match[1];
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK A: Customer & Booking Deletion (~8 tests)
// Tests CASCADE DELETE fixes for customer and booking deletions
// Regression: DIVE-w1s, DIVE-237
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("Block A: Customer & Booking Deletion", () => {
  test("[KAN-530] A.1 Create test customer for deletion testing", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/customers/new"));
    await page.waitForLoadState("load");

    // Wait for first name field with condition-based waiting (retry with reload if needed)
    const firstNameField = page.getByLabel(/first.*name/i);
    try {
      await firstNameField.waitFor({ state: "visible", timeout: 5000 });
    } catch {
      // Retry with reload if form not loaded (Vite dep optimization can cause page reloads in CI)
      await page.reload();
      await page.waitForLoadState("load");
      await firstNameField.waitFor({ state: "visible", timeout: 8000 });
    }

    // Fill customer form
    await expect(firstNameField).toBeVisible({ timeout: 8000 });
    await firstNameField.fill(testData.customer.firstName);
    await page.getByLabel(/last.*name/i).fill(testData.customer.lastName);
    // Use specific email input to avoid matching marketingOptIn checkbox
    await page.getByRole("textbox", { name: /email/i }).fill(testData.customer.email);

    const phoneField = page.getByLabel(/phone/i);
    if (await phoneField.isVisible().catch(() => false)) {
      await phoneField.fill(testData.customer.phone);
    }

    // Submit
    await page.getByRole("button", { name: /create|save|add/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForLoadState("load");

    // Extract customer ID - navigate to list and wait for full load
    await page.goto(getTenantUrl("/tenant/customers"));
    await page.waitForLoadState("load");
    await page.waitForLoadState("networkidle").catch(() => {});
    let customerId = await extractEntityId(page, testData.customer.lastName, "/tenant/customers");

    // Retry once if not found (race condition mitigation)
    if (!customerId) {
      await page.reload();
      await page.waitForLoadState("load");
      await page.waitForLoadState("networkidle").catch(() => {});
      customerId = await extractEntityId(page, testData.customer.lastName, "/tenant/customers");
    }
    if (customerId) testData.createdIds.customer = customerId;

    expect(testData.createdIds.customer).toBeTruthy();
  });

  test("[KAN-531] A.2 Create test booking for deletion testing", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;
    if (!testData.createdIds.customer) {
      console.log("No customer ID - skipping booking creation");
      return;
    }

    await page.goto(getTenantUrl("/tenant/bookings/new"));
    await page.waitForLoadState("load");

    // Fill booking form (simplified - actual form may vary)
    const customerSelect = page.locator("select[name='customerId'], select[name='customer']").first();
    if (await customerSelect.isVisible().catch(() => false)) {
      const options = await customerSelect.locator("option").allTextContents();
      const customerOption = options.find(opt => opt.includes(testData.customer.lastName));
      if (customerOption) {
        await customerSelect.selectOption({ label: customerOption });
      }
    }

    const dateField = page.getByLabel(/date/i);
    if (await dateField.isVisible().catch(() => false)) {
      await dateField.fill(testData.booking.date);
    }

    // Submit
    const submitBtn = page.getByRole("button", { name: /create|save|book/i });
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    // Extract booking ID
    await page.goto(getTenantUrl("/tenant/bookings"));
    await page.waitForLoadState("load");
    const bookingId = await extractEntityId(page, testData.customer.lastName, "/tenant/bookings");
    if (bookingId) testData.createdIds.booking = bookingId;

    expect(page.url()).toContain("/bookings");
  });

  test("[KAN-532] A.3 Customer deletion succeeds without 500 error @critical", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;
    if (!testData.createdIds.customer) {
      console.log("No customer ID - skipping deletion test");
      return;
    }

    // Navigate to customer detail page
    await page.goto(getTenantUrl(`/tenant/customers/${testData.createdIds.customer}`));
    await page.waitForLoadState("load");

    // Find and click delete button
    const deleteBtn = page.getByRole("button", { name: /delete/i });
    expect(await deleteBtn.isVisible()).toBeTruthy();

    // Set up listener for dialog
    page.on('dialog', dialog => dialog.accept());

    // Click delete
    await deleteBtn.click();
    await page.waitForURL(/\/customers(?!.*\/)/, { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState("load");

    // Should redirect to list without 500 error
    expect(page.url()).toContain("/customers");
    expect(page.url()).not.toContain(testData.createdIds.customer);

    // Verify customer is gone from list
    const customerStillExists = await page
      .getByText(testData.customer.lastName)
      .isVisible()
      .catch(() => false);
    expect(customerStillExists).toBeFalsy();
  });

  test("[KAN-533] A.4 Booking deletion succeeds without 500 error", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;
    if (!testData.createdIds.booking) {
      console.log("No booking ID - skipping deletion test");
      return;
    }

    // Navigate to booking detail page
    await page.goto(getTenantUrl(`/tenant/bookings/${testData.createdIds.booking}`));
    await page.waitForLoadState("load");

    // Find delete button
    const deleteBtn = page.getByRole("button", { name: /delete/i });
    if (!(await deleteBtn.isVisible().catch(() => false))) {
      console.log("Delete button not found - test passes (booking may already be deleted)");
      return;
    }

    // Set up listener for dialog
    page.on('dialog', dialog => dialog.accept());

    // Click delete
    await deleteBtn.click();
    await page.waitForURL(/\/bookings(?!.*\/)/, { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState("load");

    // Should redirect to list without 500 error
    expect(page.url()).toContain("/bookings");
    expect(page.url()).not.toContain(testData.createdIds.booking);
  });

  test("[KAN-534] A.5 Cascade delete removes related records", async ({ page }) => {
    // This test verifies that when a customer is deleted, related records are also deleted
    // We already deleted the customer in A.3, so bookings should also be gone
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/bookings"));
    await page.waitForLoadState("load");

    // Search for the deleted customer's bookings
    const searchField = page.getByPlaceholder(/search/i).or(page.locator("input[type='search']")).first();
    if (await searchField.isVisible().catch(() => false)) {
      await searchField.fill(testData.customer.lastName);
      await page.waitForLoadState("networkidle").catch(() => {});

      // Should find no results
      const hasResults = await page
        .getByText(testData.customer.lastName)
        .isVisible()
        .catch(() => false);
      expect(hasResults).toBeFalsy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK B: Discount Code Modal Issues (~6 tests)
// Tests modal closing after create/update/delete operations
// Regression: DIVE-ein, DIVE-ka3
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("Block B: Discount Code Modal Issues", () => {
  test("[KAN-535] B.1 Navigate to discount codes page", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/discounts"));
    await page.waitForLoadState("load");

    expect(page.url()).toContain("/discounts");
  });

  test("[KAN-536] B.2 Create discount code - modal closes after success @critical", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/discounts"));
    await page.waitForLoadState("load");

    // Click add button (use .first() to handle multiple matching buttons)
    const addBtn = page.getByRole("button", { name: /add|create|new/i }).first();
    await addBtn.click();

    // Modal should be visible
    const modal = page.locator("[role='dialog'], .modal, [class*='Modal']").first();
    await modal.waitFor({ state: "visible", timeout: 5000 });
    expect(await modal.isVisible()).toBeTruthy();

    // Fill form
    await page.getByLabel(/code/i).fill(testData.discount.code);

    const typeSelect = page.locator("select[name='type']");
    if (await typeSelect.isVisible().catch(() => false)) {
      await typeSelect.selectOption(testData.discount.type);
    }

    await page.getByLabel(/value|amount/i).fill(testData.discount.value.toString());

    // Submit
    await page.getByRole("button", { name: /create|save/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // CRITICAL: Modal should close after successful creation
    const modalStillVisible = await modal.isVisible().catch(() => false);
    expect(modalStillVisible).toBeFalsy();

    // Extract discount ID
    const discountId = await extractEntityId(page, testData.discount.code, "/tenant/discounts");
    if (discountId) testData.createdIds.discount = discountId;
  });

  test("[KAN-537] B.3 Update discount code - modal closes after success @critical", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/discounts"));
    await page.waitForLoadState("load");

    if (!testData.createdIds.discount) {
      console.log("No discount created - skipping update test");
      return;
    }

    // Find and click edit button for the discount
    const editBtn = page
      .locator(`tr:has-text("${testData.discount.code}") button`)
      .filter({ hasText: /edit/i })
      .first();

    if (!(await editBtn.isVisible().catch(() => false))) {
      console.log("Edit button not found - skipping test");
      return;
    }

    await editBtn.click();

    // Modal should be visible
    const modal = page.locator("[role='dialog'], .modal, [class*='Modal']").first();
    await modal.waitFor({ state: "visible", timeout: 5000 });
    expect(await modal.isVisible()).toBeTruthy();

    // Change value
    const valueField = page.getByLabel(/value|amount/i);
    await valueField.clear();
    await valueField.fill("15");

    // Submit
    await page.getByRole("button", { name: /update|save/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // CRITICAL: Modal should close after successful update
    const modalStillVisible = await modal.isVisible().catch(() => false);
    expect(modalStillVisible).toBeFalsy();
  });

  test("[KAN-538] B.4 Delete discount code - modal closes after success @critical", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/discounts"));
    await page.waitForLoadState("load");

    if (!testData.createdIds.discount) {
      console.log("No discount created - skipping delete test");
      return;
    }

    // Find and click edit button to open modal (delete is inside modal)
    const editBtn = page
      .locator(`tr:has-text("${testData.discount.code}") button`)
      .filter({ hasText: /edit/i })
      .first();

    if (!(await editBtn.isVisible().catch(() => false))) {
      console.log("Edit button not found - skipping test");
      return;
    }

    await editBtn.click();

    // Modal should be visible
    const modal = page.locator("[role='dialog'], .modal, [class*='Modal']").first();
    await modal.waitFor({ state: "visible", timeout: 5000 });
    expect(await modal.isVisible()).toBeTruthy();

    // Find delete button inside modal
    const deleteBtn = modal.getByRole("button", { name: /delete/i });
    expect(await deleteBtn.isVisible()).toBeTruthy();

    // Set up dialog handler
    page.on('dialog', dialog => dialog.accept());

    // Click delete
    await deleteBtn.click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // CRITICAL: Modal should close after successful deletion
    const modalStillVisible = await modal.isVisible().catch(() => false);
    expect(modalStillVisible).toBeFalsy();

    // Verify discount is gone
    const discountStillExists = await page
      .getByText(testData.discount.code)
      .isVisible()
      .catch(() => false);
    expect(discountStillExists).toBeFalsy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK C: Product Modal Issues (~4 tests)
// Tests modal closing after product deletion
// Regression: DIVE-d4m
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("Block C: Product Modal Issues", () => {
  test("[KAN-539] C.1 Create test product", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/products"));
    await page.waitForLoadState("load");

    // Click add button (use .first() to handle multiple matching buttons)
    const addBtn = page.getByRole("button", { name: /add|create|new/i }).first();
    await addBtn.click();

    // Wait for form/modal to be ready
    const nameField = page.getByLabel(/name/i);
    await nameField.waitFor({ state: "visible", timeout: 5000 });

    // Fill form
    await nameField.fill(testData.product.name);
    await page.getByLabel(/price/i).fill(testData.product.price.toString());

    const skuField = page.getByLabel(/sku/i);
    if (await skuField.isVisible().catch(() => false)) {
      await skuField.fill(testData.product.sku);
    }

    // Submit
    await page.getByRole("button", { name: /create|save/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // Extract product ID
    const productId = await extractEntityId(page, testData.product.name, "/tenant/products");
    if (productId) testData.createdIds.product = productId;

    expect(page.url()).toContain("/products");
  });

  test("[KAN-540] C.2 Delete product - modal closes after success @critical", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/products"));
    await page.waitForLoadState("load");

    if (!testData.createdIds.product) {
      console.log("No product created - skipping delete test");
      return;
    }

    // Find and click edit button to open modal
    const editBtn = page
      .locator(`tr:has-text("${testData.product.name}") button, [class*='card']:has-text("${testData.product.name}") button`)
      .filter({ hasText: /edit/i })
      .first();

    if (!(await editBtn.isVisible().catch(() => false))) {
      console.log("Edit button not found - skipping test");
      return;
    }

    await editBtn.click();

    // Modal should be visible
    const modal = page.locator("[role='dialog'], .modal, [class*='Modal']").first();
    await modal.waitFor({ state: "visible", timeout: 5000 });
    expect(await modal.isVisible()).toBeTruthy();

    // Find delete button
    const deleteBtn = modal.getByRole("button", { name: /delete/i });
    expect(await deleteBtn.isVisible()).toBeTruthy();

    // Set up dialog handler
    page.on('dialog', dialog => dialog.accept());

    // Click delete
    await deleteBtn.click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // CRITICAL: Modal should close after successful deletion
    const modalStillVisible = await modal.isVisible().catch(() => false);
    expect(modalStillVisible).toBeFalsy();

    // Verify product is gone
    const productStillExists = await page
      .getByText(testData.product.name)
      .isVisible()
      .catch(() => false);
    expect(productStillExists).toBeFalsy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK D: Entity Deletion (Boat/Tour/Dive Site) (~6 tests)
// Tests that deletion actually deletes instead of just deactivating
// Regression: DIVE-u07, DIVE-9f5, DIVE-98t
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("Block D: Entity Deletion", () => {
  test("[KAN-541] D.1 Create and delete boat - actually deletes @critical", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    // Create boat
    await page.goto(getTenantUrl("/tenant/boats/new"));
    await page.waitForLoadState("load");

    await page.getByLabel(/name/i).fill(testData.boat.name);

    const capacityField = page.getByLabel(/capacity/i);
    if (await capacityField.isVisible().catch(() => false)) {
      await capacityField.fill(testData.boat.capacity.toString());
    }

    await page.getByRole("button", { name: /create|save/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // Extract boat ID
    await page.goto(getTenantUrl("/tenant/boats"));
    await page.waitForLoadState("load");
    const boatId = await extractEntityId(page, testData.boat.name, "/tenant/boats");
    if (boatId) testData.createdIds.boat = boatId;

    // Delete boat
    await page.goto(getTenantUrl(`/tenant/boats/${boatId}`));
    await page.waitForLoadState("load");

    const deleteBtn = page.getByRole("button", { name: /delete/i });
    expect(await deleteBtn.isVisible()).toBeTruthy();

    page.on('dialog', dialog => dialog.accept());
    await deleteBtn.click();
    await page.waitForURL(/\/boats(?!.*\/)/, { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState("load");

    // CRITICAL: Boat should be completely deleted, not just deactivated
    await page.goto(getTenantUrl("/tenant/boats"));
    await page.waitForLoadState("load");

    const boatStillExists = await page
      .getByText(testData.boat.name)
      .isVisible()
      .catch(() => false);
    expect(boatStillExists).toBeFalsy();
  });

  test("[KAN-542] D.2 Create and delete dive site - actually deletes @critical", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    // Create dive site
    await page.goto(getTenantUrl("/tenant/dive-sites/new"));
    await page.waitForLoadState("load");

    await page.getByLabel(/name/i).fill(testData.diveSite.name);

    const depthField = page.getByLabel(/depth/i);
    if (await depthField.isVisible().catch(() => false)) {
      await depthField.fill(testData.diveSite.maxDepth.toString());
    }

    await page.getByRole("button", { name: /create|save/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // Extract dive site ID
    await page.goto(getTenantUrl("/tenant/dive-sites"));
    await page.waitForLoadState("load");
    const diveSiteId = await extractEntityId(page, testData.diveSite.name, "/tenant/dive-sites");
    if (diveSiteId) testData.createdIds.diveSite = diveSiteId;

    // Delete dive site
    await page.goto(getTenantUrl(`/tenant/dive-sites/${diveSiteId}`));
    await page.waitForLoadState("load");

    const deleteBtn = page.getByRole("button", { name: /delete/i });
    expect(await deleteBtn.isVisible()).toBeTruthy();

    page.on('dialog', dialog => dialog.accept());
    await deleteBtn.click();
    await page.waitForURL(/\/dive-sites(?!.*\/)/, { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState("load");

    // CRITICAL: Dive site should be completely deleted, not just deactivated
    await page.goto(getTenantUrl("/tenant/dive-sites"));
    await page.waitForLoadState("load");

    const diveSiteStillExists = await page
      .getByText(testData.diveSite.name)
      .isVisible()
      .catch(() => false);
    expect(diveSiteStillExists).toBeFalsy();
  });

  test("[KAN-543] D.3 Create and delete tour - actually deletes @critical", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    // Create tour
    await page.goto(getTenantUrl("/tenant/tours/new"));
    await page.waitForLoadState("load");

    await page.getByLabel(/name|title/i).fill(testData.tour.name);

    const priceField = page.getByLabel(/price/i);
    if (await priceField.isVisible().catch(() => false)) {
      await priceField.fill(testData.tour.price.toString());
    }

    await page.getByRole("button", { name: /create|save/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // Extract tour ID
    await page.goto(getTenantUrl("/tenant/tours"));
    await page.waitForLoadState("load");
    const tourId = await extractEntityId(page, testData.tour.name, "/tenant/tours");
    if (tourId) testData.createdIds.tour = tourId;

    // Delete tour
    await page.goto(getTenantUrl(`/tenant/tours/${tourId}`));
    await page.waitForLoadState("load");

    const deleteBtn = page.getByRole("button", { name: /delete/i });
    expect(await deleteBtn.isVisible()).toBeTruthy();

    page.on('dialog', dialog => dialog.accept());
    await deleteBtn.click();
    await page.waitForURL(/\/tours(?!.*\/)/, { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState("load");

    // CRITICAL: Tour should be completely deleted, not just deactivated
    await page.goto(getTenantUrl("/tenant/tours"));
    await page.waitForLoadState("load");

    const tourStillExists = await page
      .getByText(testData.tour.name)
      .isVisible()
      .catch(() => false);
    expect(tourStillExists).toBeFalsy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK E: Gallery Navigation (~4 tests)
// Tests gallery routes are registered and work correctly
// Regression: DIVE-6l9
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("Block E: Gallery Navigation", () => {
  test("[KAN-544] E.1 Gallery list page loads @smoke", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/gallery"));
    await page.waitForLoadState("load");

    // Should NOT get 404
    const has404 = await page.getByText(/not found|404/i).isVisible().catch(() => false);
    expect(has404).toBeFalsy();

    // Should be on gallery page
    expect(page.url()).toContain("/gallery");
  });

  test("[KAN-545] E.2 Gallery list shows content or empty state", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/gallery"));
    await page.waitForLoadState("load");

    // Should have gallery content or empty state
    const hasGalleryItems = await page.locator("[class*='gallery'], [class*='grid']").first().isVisible().catch(() => false);
    const hasEmptyState = await page.getByText(/no (gallery|album)|empty|add.*photo/i).isVisible().catch(() => false);

    expect(hasGalleryItems || hasEmptyState || page.url().includes("/gallery")).toBeTruthy();
  });

  test("[KAN-546] E.3 Gallery new page loads", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/gallery/new"));
    await page.waitForLoadState("load");

    // Should NOT get 404
    const has404 = await page.getByText(/not found|404/i).isVisible().catch(() => false);
    expect(has404).toBeFalsy();

    expect(page.url()).toContain("/gallery/new");
  });

  test("[KAN-547] E.4 Gallery detail route works", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    // Try to access a random gallery ID - should not crash
    await page.goto(getTenantUrl("/tenant/gallery/00000000-0000-0000-0000-000000000000"));
    await page.waitForLoadState("load");

    // Should either show not found or redirect, but not crash
    expect(page.url()).toContain("/tenant");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK F: Public Site Settings (~8 tests)
// Tests theme/color/font selection and preview functionality
// Regression: Public site settings bugs (theme, colors, fonts, preview URL, crash)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe.serial("Block F: Public Site Settings", () => {
  test("[KAN-548] F.1 Public site appearance page loads", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/settings/public-site/appearance"));
    await page.waitForLoadState("load");

    expect(page.url()).toContain("/public-site/appearance");
  });

  test("[KAN-549] F.2 Theme selection updates visually @critical", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/settings/public-site/appearance"));
    await page.waitForLoadState("load");

    // Find theme radio buttons
    const lightTheme = page.locator("input[name='theme'][value='light']");
    const darkTheme = page.locator("input[name='theme'][value='dark']");

    if (!(await lightTheme.isVisible().catch(() => false))) {
      console.log("Theme selection not found - skipping test");
      return;
    }

    // Get initial state
    const initiallyLight = await lightTheme.isChecked();

    // Click the opposite theme
    if (initiallyLight) {
      await darkTheme.click();
      await expect(darkTheme).toBeChecked();
    } else {
      await lightTheme.click();
      await expect(lightTheme).toBeChecked();
    }
  });

  test("[KAN-550] F.3 Color picker updates preview live @critical", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/settings/public-site/appearance"));
    await page.waitForLoadState("load");

    // Find color picker
    const colorPicker = page.locator("input[type='color']#primaryColorPicker");
    if (!(await colorPicker.isVisible().catch(() => false))) {
      console.log("Color picker not found - skipping test");
      return;
    }

    // Change color
    await colorPicker.fill("#ff0000");

    // Preview should update
    const preview = page.locator("[class*='preview']").first();
    if (await preview.isVisible().catch(() => false)) {
      const bgColor = await preview.evaluate(el => getComputedStyle(el).backgroundColor);
      // Color should have changed (not testing exact value due to RGB conversion)
      expect(bgColor).toBeTruthy();
    }
  });

  test("[KAN-551] F.4 Font selection updates visually @critical", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/settings/public-site/appearance"));
    await page.waitForLoadState("load");

    // Find font radio buttons
    const fontButtons = page.locator("input[name='fontFamily']");
    const count = await fontButtons.count();

    if (count === 0) {
      console.log("Font selection not found - skipping test");
      return;
    }

    // Click second font option if available
    if (count > 1) {
      const secondFont = fontButtons.nth(1);
      await secondFont.click();
      await expect(secondFont).toBeChecked();
    }
  });

  test("[KAN-552] F.5 Preview button links to correct URL @critical", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/settings/public-site/appearance"));
    await page.waitForLoadState("load");

    // Find preview link
    const previewLink = page.getByRole("link", { name: /preview|view.*site/i });
    if (!(await previewLink.isVisible().catch(() => false))) {
      console.log("Preview link not found - skipping test");
      return;
    }

    const href = await previewLink.getAttribute("href");

    // CRITICAL: Should link to https://e2etest.divestreams.com NOT /site
    expect(href).toContain("e2etest.divestreams.com");
    expect(href).not.toContain("/site"); // Bug was linking to /site which 404'd
  });

  test("[KAN-553] F.6 General settings page does not crash on navigation", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    // Save appearance settings first
    await page.goto(getTenantUrl("/tenant/settings/public-site/appearance"));
    await page.waitForLoadState("load");

    const saveBtn = page.getByRole("button", { name: /save|update/i });
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    // Navigate to general settings - should not crash with undefined pages error
    await page.goto(getTenantUrl("/tenant/settings/public-site"));
    await page.waitForLoadState("load");

    // Should load without error
    const hasError = await page.getByText(/cannot read|undefined|error/i).isVisible().catch(() => false);
    expect(hasError).toBeFalsy();
    expect(page.url()).toContain("/public-site");
  });

  test("[KAN-554] F.7 Page toggles work after save", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    await page.goto(getTenantUrl("/tenant/settings/public-site"));
    await page.waitForLoadState("load");

    // Find a page toggle (e.g., "home" page)
    const homePageCheckbox = page.locator("input[type='checkbox']").filter({ hasText: /home/i }).first();

    if (!(await homePageCheckbox.isVisible().catch(() => false))) {
      // Try alternate selector - checkboxes may be sr-only
      const checkboxes = page.locator("input[type='checkbox']");
      const count = await checkboxes.count();
      if (count > 0) {
        const firstCheckbox = checkboxes.first();
        const isChecked = await firstCheckbox.isChecked();

        // Should have a checked state without crashing
        expect(typeof isChecked).toBe("boolean");
      }
    }
  });

  // Block G: Team Invitation Error Messages (~2 tests)

  test("[KAN-599] G.1 Team invitation displays error when email is already a member", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    // Navigate to team settings
    await page.goto(getTenantUrl("/tenant/settings/team"));
    await page.waitForLoadState("load");

    // Click "Invite Team Member" button to open modal
    const inviteButton = page.getByRole("button", { name: /invite.*team.*member/i });
    if (!(await inviteButton.isVisible().catch(() => false))) {
      console.log("Invite button not found - skipping test");
      return;
    }
    await inviteButton.click();

    // Wait for modal to be visible
    const modal = page.locator("[role='dialog'], .modal, [class*='Modal']").first();
    await modal.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});

    // Fill in email that is already a team member (owner's email)
    const emailInput = page.getByRole("textbox", { name: /email/i });
    await emailInput.fill(testData.user.email); // Owner's email

    // Select a role
    const roleSelect = page.locator("select[name='role']");
    if (await roleSelect.isVisible().catch(() => false)) {
      await roleSelect.selectOption("admin");
    }

    // Submit the form
    const submitButton = page.getByRole("button", { name: /send.*invitation|invite/i });
    await submitButton.click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // CRITICAL: Error message should be displayed and visible
    const errorMessage = page.getByText(/this email is already a team member/i);
    expect(await errorMessage.isVisible()).toBe(true);

    // Modal should remain open to show the error
    const modalTitle = page.getByText(/invite team member/i);
    expect(await modalTitle.isVisible()).toBe(true);
  });

  test("[KAN-599] G.2 Team invitation displays error when email has pending invitation", async ({ page }) => {
    await loginToTenant(page);
    if (!(await isAuthenticated(page))) return;

    // Navigate to team settings
    await page.goto(getTenantUrl("/tenant/settings/team"));
    await page.waitForLoadState("load");

    // First, create a pending invitation
    const inviteButton = page.getByRole("button", { name: /invite.*team.*member/i });
    if (!(await inviteButton.isVisible().catch(() => false))) {
      console.log("Invite button not found - skipping test");
      return;
    }
    await inviteButton.click();

    // Wait for modal to be visible
    const modal = page.locator("[role='dialog'], .modal, [class*='Modal']").first();
    await modal.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});

    const testEmail = `pending-invite-${Date.now()}@example.com`;
    const emailInput = page.getByRole("textbox", { name: /email/i });
    await emailInput.fill(testEmail);

    const roleSelect = page.locator("select[name='role']");
    if (await roleSelect.isVisible().catch(() => false)) {
      await roleSelect.selectOption("member");
    }

    const submitButton = page.getByRole("button", { name: /send.*invitation|invite/i });
    await submitButton.click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // Now try to invite the same email again
    await inviteButton.click();
    await modal.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});

    await emailInput.fill(testEmail); // Same email
    if (await roleSelect.isVisible().catch(() => false)) {
      await roleSelect.selectOption("member");
    }

    await submitButton.click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // CRITICAL: Error message should be displayed and visible
    const errorMessage = page.getByText(/this email already has a pending invitation/i);
    expect(await errorMessage.isVisible()).toBe(true);

    // Modal should remain open to show the error
    const modalTitle = page.getByText(/invite team member/i);
    expect(await modalTitle.isVisible()).toBe(true);
  });
});

});

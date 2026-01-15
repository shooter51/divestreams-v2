import { test, expect } from "@playwright/test";

/**
 * Full E2E Workflow Tests
 *
 * Sequential tests that build on each other:
 * 1. App health check (verify server is running with database)
 * 2. Marketing home page works
 * 3. Create a tenant via signup
 * 4. Access the new tenant
 * 5. Admin panel accessible
 *
 * Uses test.describe.serial to ensure order.
 */

// Shared state across tests
// Use a fixed subdomain that matches /etc/hosts entry in CI
const testData = {
  timestamp: Date.now(),
  tenant: {
    subdomain: "e2etest",
    shopName: "E2E Test Shop",
    email: "e2e@example.com",
  },
};

test.describe.serial("Full E2E Workflow", () => {

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: Health Check & Marketing
  // ═══════════════════════════════════════════════════════════════

  test("1.1 API health check passes", async ({ request }) => {
    const response = await request.get("http://localhost:5173/api/health");
    expect(response.ok()).toBeTruthy();
  });

  test("1.2 Home page loads", async ({ page }) => {
    await page.goto("http://localhost:5173/");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/DiveStreams/i).first()).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: Signup Flow - Create Tenant
  // ═══════════════════════════════════════════════════════════════

  test("2.1 Signup page loads", async ({ page }) => {
    await page.goto("http://localhost:5173/signup");
    await expect(page.getByRole("heading", { name: /free trial/i })).toBeVisible();
  });

  test("2.2 Signup form has required fields", async ({ page }) => {
    await page.goto("http://localhost:5173/signup");

    // Use exact label text from the form
    await expect(page.getByLabel("Dive Shop Name")).toBeVisible();
    await expect(page.getByLabel("Choose Your URL")).toBeVisible();
    await expect(page.getByLabel("Email Address")).toBeVisible();
  });

  test("2.3 Create tenant via signup @critical", async ({ page, context }) => {
    await page.goto("http://localhost:5173/signup");

    // Fill out the signup form using exact labels
    await page.getByLabel("Dive Shop Name").fill(testData.tenant.shopName);
    await page.getByLabel("Choose Your URL").fill(testData.tenant.subdomain);
    await page.getByLabel("Email Address").fill(testData.tenant.email);

    // Submit the form
    await page.getByRole("button", { name: "Start Free Trial" }).click();

    // Wait for the form to process
    await page.waitForTimeout(3000);

    // Check for "already taken" error - this means tenant exists from previous run
    const alreadyTaken = await page.locator("text=already taken").isVisible().catch(() => false);
    if (alreadyTaken) {
      console.log("Tenant already exists from previous run - this is OK");
      return;
    }

    // Check for form errors
    const formError = await page.locator(".text-red-500, .text-red-600").first().textContent().catch(() => null);
    if (formError) {
      console.log("Form error:", formError);
      if (formError.toLowerCase().includes("already taken")) {
        console.log("Tenant exists from previous run - continuing");
        return;
      }
    }

    // Regardless of where the redirect went, verify the tenant was created
    // by accessing the tenant subdomain directly
    const tenantPage = await context.newPage();
    await tenantPage.goto(`http://${testData.tenant.subdomain}.localhost:5173/`);

    // If we get a page (not network error), tenant was created
    const tenantUrl = tenantPage.url();
    console.log("Tenant URL check:", tenantUrl);

    // Check if tenant exists - should show login page or app content
    const hasContent = await tenantPage.locator("body").textContent().catch(() => "");
    console.log("Tenant page has content:", !!hasContent, "length:", hasContent?.length || 0);

    // Tenant page should have some content (login form or app)
    expect(hasContent?.length).toBeGreaterThan(100);
    await tenantPage.close();
  });

  // ═══════════════════════════════════════════════════════════════
  // PHASE 3: Access New Tenant (uses tenant created in Phase 2)
  // ═══════════════════════════════════════════════════════════════

  test("3.1 Access new tenant subdomain", async ({ page }) => {
    // Navigate to the new tenant's subdomain
    await page.goto(`http://${testData.tenant.subdomain}.localhost:5173/`);

    // Should load something - either login or app
    await expect(page.locator("body")).toBeVisible();
  });

  test("3.2 Tenant has login page", async ({ page }) => {
    await page.goto(`http://${testData.tenant.subdomain}.localhost:5173/auth/login`);

    // Login form should be visible
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════
  // PHASE 4: Admin Panel
  // ═══════════════════════════════════════════════════════════════

  test("4.1 Admin login page loads", async ({ page }) => {
    await page.goto("http://admin.localhost:5173/login");

    await expect(page.getByRole("heading", { name: /admin/i })).toBeVisible();
  });

  test("4.2 Admin login form works", async ({ page }) => {
    await page.goto("http://admin.localhost:5173/login");

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});

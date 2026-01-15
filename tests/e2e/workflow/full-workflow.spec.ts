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

  test("2.3 Create tenant via signup @critical", async ({ page }) => {
    await page.goto("http://localhost:5173/signup");

    // Fill out the signup form using exact labels
    await page.getByLabel("Dive Shop Name").fill(testData.tenant.shopName);
    await page.getByLabel("Choose Your URL").fill(testData.tenant.subdomain);
    await page.getByLabel("Email Address").fill(testData.tenant.email);

    // Submit the form
    await page.getByRole("button", { name: "Start Free Trial" }).click();

    // Wait for navigation or form response
    await page.waitForLoadState("networkidle");

    const currentUrl = page.url();
    console.log("After submit, current URL:", currentUrl);

    // Success case: redirected to tenant app
    if (currentUrl.includes(testData.tenant.subdomain)) {
      console.log("Tenant created successfully, redirected to:", currentUrl);
      return;
    }

    // Tenant already exists: check for error message
    const alreadyTaken = await page.locator("text=already taken").isVisible().catch(() => false);
    if (alreadyTaken) {
      console.log("Tenant already exists from previous run - this is OK");
      return;
    }

    // Check for any form error message (red error boxes)
    const formError = await page.locator(".text-red-500, .text-red-600, .bg-red-50").first().textContent().catch(() => null);
    if (formError) {
      console.log("Form error found:", formError);
      // If subdomain is already taken, that's acceptable
      if (formError.toLowerCase().includes("already taken") || formError.toLowerCase().includes("already exists")) {
        console.log("Tenant exists from previous run - continuing");
        return;
      }
    }

    // Check for failed to create error
    const failedError = await page.locator("text=Failed to create").isVisible().catch(() => false);
    if (failedError) {
      console.log("Error: Failed to create tenant - possible database issue");
    }

    // Still on signup page with no recognized error - wait longer for redirect
    try {
      await page.waitForURL((url) => url.href.includes(testData.tenant.subdomain), { timeout: 10000 });
      console.log("Redirect detected after wait:", page.url());
      return;
    } catch {
      // Log page content for debugging
      const bodyText = await page.locator("body").textContent();
      console.log("Final URL:", page.url());
      console.log("Page body excerpt:", bodyText?.substring(0, 500));
    }

    // If we get here, check if the error indicates subdomain is taken (acceptable)
    const pageText = await page.locator("body").textContent();
    if (pageText?.toLowerCase().includes("already taken")) {
      console.log("Subdomain already taken - tenant exists from previous run");
      return;
    }

    // Force fail with diagnostic info
    expect(currentUrl).toContain(testData.tenant.subdomain);
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

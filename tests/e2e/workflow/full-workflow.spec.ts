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

    await expect(page.getByLabel(/shop name|dive shop/i)).toBeVisible();
    await expect(page.getByLabel(/subdomain|url/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("2.3 Create tenant via signup @critical", async ({ page }) => {
    await page.goto("http://localhost:5173/signup");

    // Fill out the signup form
    await page.getByLabel(/shop name|dive shop/i).fill(testData.tenant.shopName);
    await page.getByLabel(/subdomain|url/i).fill(testData.tenant.subdomain);
    await page.getByLabel(/email/i).fill(testData.tenant.email);

    // Submit the form
    await page.getByRole("button", { name: /start|create|submit/i }).click();

    // Wait for either:
    // 1. Redirect to the new tenant (successful creation)
    // 2. Error message saying subdomain is taken (tenant exists from previous run)
    // 3. Stay on signup page showing an error
    const result = await Promise.race([
      page.waitForURL(
        (url) => url.href.includes(testData.tenant.subdomain) || url.href.includes("success"),
        { timeout: 15000 }
      ).then(() => "redirected"),
      page.getByText(/already taken/i).waitFor({ timeout: 15000 }).then(() => "exists"),
    ]).catch(() => "unknown");

    // If tenant already exists from a previous run, that's OK for the workflow
    if (result === "exists") {
      console.log("Tenant already exists, continuing with existing tenant");
    }
    // Either tenant was created or already exists - both are valid states
    expect(["redirected", "exists"]).toContain(result);
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

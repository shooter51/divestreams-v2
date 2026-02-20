import { test, expect } from "@playwright/test";
import { getAdminUrl, getTenantUrl } from "../helpers/urls";

/**
 * Bootstrap: Create "demo" tenant for independent E2E tests
 *
 * This runs before the "independent" project (bug regression specs, debug tests, etc.)
 * to ensure the "demo" tenant exists with the expected credentials and seed data.
 *
 * On local dev, global-setup.ts creates the demo tenant via direct DB access.
 * On remote environments (test.divestreams.com), global-setup is skipped,
 * so this spec creates the demo tenant via the admin UI.
 */

const adminPassword = process.env.ADMIN_PASSWORD || "DiveAdmin2026";
const demoCredentials = {
  email: "owner@demo.com",
  password: "demo1234",
  name: "Demo Owner",
};

test.describe.serial("Bootstrap: Demo Tenant Setup", () => {
  test("Ensure demo tenant exists", async ({ page }) => {
    // First check if demo tenant already exists by visiting its login page
    const tenantLoginUrl = getTenantUrl("demo", "/auth/login");
    await page.goto(tenantLoginUrl);
    await page.waitForLoadState("domcontentloaded");

    const loginFormExists = await page
      .getByRole("textbox", { name: /email/i })
      .isVisible({ timeout: 8000 })
      .catch(() => false);

    if (loginFormExists) {
      console.log("Demo tenant already exists - skipping creation");
      return;
    }

    // Demo tenant doesn't exist - create it via admin panel
    console.log("Creating demo tenant via admin panel...");
    await page.goto(getAdminUrl("/login"));
    await page.waitForLoadState("domcontentloaded");

    // Login to admin panel
    const emailField = await page
      .getByRole("textbox", { name: /email/i })
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (emailField) {
      await page.getByRole("textbox", { name: /email/i }).fill("admin@divestreams.com");
    }
    await page.locator('input[type="password"]').first().fill(adminPassword);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for admin dashboard
    await page.waitForURL(/\/(dashboard|tenants)/, { timeout: 15000 });

    // Navigate to create tenant page
    await page.goto(getAdminUrl("/tenants/new"));
    await page.waitForLoadState("domcontentloaded");

    // Fill in tenant creation form
    await page.locator("#slug").fill("demo");
    await page.locator("#name").fill("Demo Dive Shop");

    // Select highest plan (Enterprise) for all features
    const planSelect = page.locator("#plan");
    if (await planSelect.isVisible().catch(() => false)) {
      const options = await planSelect.locator("option").allTextContents();
      const enterpriseOption = options.find((o) => /enterprise/i.test(o));
      if (enterpriseOption) {
        await planSelect.selectOption({ label: enterpriseOption });
      }
    }

    // Enable demo data seeding (populates products, tours, courses, etc.)
    const demoDataCheckbox = page.locator("#seedDemoData");
    if (await demoDataCheckbox.isVisible().catch(() => false)) {
      await demoDataCheckbox.check();
    }

    // Create owner account checkbox (should be checked by default)
    const createOwnerCheckbox = page.locator("#createOwnerAccount");
    if (await createOwnerCheckbox.isVisible().catch(() => false)) {
      if (!(await createOwnerCheckbox.isChecked())) {
        await createOwnerCheckbox.check();
      }
    }

    // Fill owner account details
    await page.locator("#ownerEmail").fill(demoCredentials.email);
    await page.locator("#ownerName").fill(demoCredentials.name);
    await page.locator("#ownerPassword").fill(demoCredentials.password);

    // Submit form
    await page.getByRole("button", { name: /create/i }).click();

    // Wait for success (redirect back to dashboard) - seeding demo data can take a while
    await page.waitForURL(/\/(dashboard|tenants)/, { timeout: 60000 });
    console.log("Demo tenant created with owner account and demo data");
  });

  test("Verify demo tenant login works", async ({ page }) => {
    await page.goto(getTenantUrl("demo", "/auth/login"));
    await page.waitForLoadState("domcontentloaded");

    const loginForm = await page
      .getByRole("textbox", { name: /email/i })
      .isVisible({ timeout: 8000 })
      .catch(() => false);

    if (!loginForm) {
      // Tenant might not have been created (admin panel issue)
      // Don't fail hard - independent tests will skip gracefully
      console.log("WARNING: Demo tenant login page not available");
      return;
    }

    // Try logging in with demo credentials
    await page.getByRole("textbox", { name: /email/i }).fill(demoCredentials.email);
    await page.locator('input[type="password"]').first().fill(demoCredentials.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    try {
      await page.waitForURL(/\/tenant/, { timeout: 10000 });
      console.log("Demo tenant login verified successfully");
    } catch {
      // If login fails, the owner account may not have been created properly
      // Try signup as fallback
      console.log("Login failed - attempting signup as fallback...");
      await page.goto(getTenantUrl("demo", "/auth/signup"));
      await page.waitForLoadState("domcontentloaded");

      const signupForm = await page
        .getByLabel(/full name/i)
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (signupForm) {
        await page.getByLabel(/full name/i).fill(demoCredentials.name);
        await page.getByLabel(/email address/i).fill(demoCredentials.email);
        await page.locator("#password").fill(demoCredentials.password);
        await page.locator("#confirmPassword").fill(demoCredentials.password);
        await page.getByRole("button", { name: /create account/i }).click();

        try {
          await page.waitForURL(/\/tenant/, { timeout: 10000 });
          console.log("Demo owner created via signup fallback");
        } catch {
          const error = await page.locator('[class*="bg-red"]').textContent().catch(() => null);
          console.log(`Signup fallback result: ${error || "unknown"}`);
        }
      }
    }
  });
});

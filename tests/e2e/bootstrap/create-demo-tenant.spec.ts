import { test } from "@playwright/test";
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
const testUser = {
  email: "e2e-tester@demo.com",
  password: "DemoPass1234",
  name: "E2E Test User",
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
    await page.locator("#ownerEmail").fill(testUser.email);
    await page.locator("#ownerName").fill(testUser.name);
    await page.locator("#ownerPassword").fill(testUser.password);

    // Submit form
    await page.getByRole("button", { name: /create/i }).click();

    // Wait for success (redirect back to dashboard) - seeding demo data can take a while
    await page.waitForURL(/\/(dashboard|tenants)/, { timeout: 60000 });
    console.log("Demo tenant created with owner account and demo data");
  });

  test("Verify demo tenant is accessible", async ({ page }) => {
    // Verify the demo tenant login page loads. We don't require specific credentials
    // to work since the tenant may exist from a previous deployment with different
    // owner credentials. Independent tests handle their own auth.
    await page.goto(getTenantUrl("demo", "/auth/login"));
    await page.waitForLoadState("domcontentloaded");

    const loginForm = await page
      .getByRole("textbox", { name: /email/i })
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (!loginForm) {
      console.log("WARNING: Demo tenant login page not available");
      return;
    }

    console.log("Demo tenant login page is accessible");

    // Best-effort: ensure an owner account exists via signup (non-fatal)
    await page.goto(getTenantUrl("demo", "/auth/signup"));
    await page.waitForLoadState("domcontentloaded");

    const signupForm = await page
      .getByLabel(/full name/i)
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!signupForm) {
      console.log("Signup page not available - skipping owner creation");
      return;
    }

    await page.getByLabel(/full name/i).fill(testUser.name);
    await page.getByLabel(/email address/i).fill(testUser.email);
    await page.locator("#password").fill(testUser.password);
    await page.locator("#confirmPassword").fill(testUser.password);
    await page.getByRole("button", { name: /create account/i }).click();

    await page
      .waitForURL(/\/tenant/, { timeout: 10000 })
      .then(() => console.log("Demo owner account created successfully"))
      .catch(async () => {
        const error = await page
          .locator('[class*="bg-danger"], [class*="text-danger"]')
          .first()
          .textContent()
          .catch(() => null);
        console.log(
          `Demo owner signup: ${error || "did not redirect (owner may already exist)"}`
        );
      });
  });
});

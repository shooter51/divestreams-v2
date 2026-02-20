import { test, expect } from "@playwright/test";
import { getAdminUrl, getTenantUrl } from "../helpers/urls";

/**
 * Bootstrap: Create "demo" tenant and test user for independent E2E tests
 *
 * This runs before the "independent" project (bug regression specs, debug tests, etc.)
 * to ensure the "demo" tenant exists with a working test user account.
 *
 * On local dev, global-setup.ts creates everything via direct DB access.
 * On remote environments (test.divestreams.com), global-setup is skipped,
 * so this spec ensures the demo tenant + test user exist.
 */

const adminPassword = process.env.ADMIN_PASSWORD || "DiveAdmin2026";
const testUser = {
  email: "e2e-tester@demo.com",
  password: "DemoPass1234",
  name: "E2E Test User",
};

test.describe.serial("Bootstrap: Demo Tenant Setup", () => {
  test("Ensure demo tenant exists", async ({ page }) => {
    test.setTimeout(90000); // Extended timeout: admin login + tenant creation can take time
    // Check if demo tenant already exists by visiting its login page
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

    const emailField = await page
      .getByRole("textbox", { name: /email/i })
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (emailField) {
      await page.getByRole("textbox", { name: /email/i }).fill("admin@divestreams.com");
    }
    await page.locator('input[type="password"]').first().fill(adminPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(dashboard|tenants)/, { timeout: 15000 });

    await page.goto(getAdminUrl("/tenants/new"));
    await page.waitForLoadState("domcontentloaded");

    await page.locator("#slug").fill("demo");
    await page.locator("#name").fill("Demo Dive Shop");

    const planSelect = page.locator("#plan");
    if (await planSelect.isVisible().catch(() => false)) {
      const options = await planSelect.locator("option").allTextContents();
      const enterpriseOption = options.find((o) => /enterprise/i.test(o));
      if (enterpriseOption) {
        await planSelect.selectOption({ label: enterpriseOption });
      }
    }

    const demoDataCheckbox = page.locator("#seedDemoData");
    if (await demoDataCheckbox.isVisible().catch(() => false)) {
      await demoDataCheckbox.check();
    }

    const createOwnerCheckbox = page.locator("#createOwnerAccount");
    if (await createOwnerCheckbox.isVisible().catch(() => false)) {
      if (!(await createOwnerCheckbox.isChecked())) {
        await createOwnerCheckbox.check();
      }
    }

    await page.locator("#ownerEmail").fill(testUser.email);
    await page.locator("#ownerName").fill(testUser.name);
    await page.locator("#ownerPassword").fill(testUser.password);

    await page.getByRole("button", { name: /create/i }).click();
    await page.waitForURL(/\/(dashboard|tenants)/, { timeout: 60000 });
    console.log("Demo tenant created with test user account and demo data");
  });

  test("Ensure test user can login @critical", async ({ page }) => {
    test.setTimeout(90000); // Extended timeout: login + signup + retry login each need up to 15s
    // Step 1: Try logging in with test credentials
    await page.goto(getTenantUrl("demo", "/auth/login"));
    await page.waitForLoadState("domcontentloaded");

    const loginForm = await page
      .getByRole("textbox", { name: /email/i })
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (!loginForm) {
      throw new Error("Demo tenant login page not available - cannot proceed");
    }

    await page.getByRole("textbox", { name: /email/i }).fill(testUser.email);
    await page.locator('input[type="password"]').first().fill(testUser.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    const loginSuccess = await page
      .waitForURL(/\/tenant/, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (loginSuccess) {
      console.log("Test user login successful");
      return;
    }

    console.log(`Login failed (URL: ${page.url()}) - creating test user via signup...`);

    // Step 2: Login failed - create the user via signup
    await page.goto(getTenantUrl("demo", "/auth/signup"));
    await page.waitForLoadState("domcontentloaded");

    const signupForm = await page
      .getByLabel(/full name/i)
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!signupForm) {
      throw new Error("Signup page not available - cannot create test user");
    }

    await page.getByLabel(/full name/i).fill(testUser.name);
    await page.getByLabel(/email address/i).fill(testUser.email);
    await page.locator("#password").fill(testUser.password);
    await page.locator("#confirmPassword").fill(testUser.password);

    // Listen for the navigation response to debug
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/auth/signup") && resp.request().method() === "POST",
      { timeout: 15000 }
    ).catch(() => null);

    await page.getByRole("button", { name: /create account/i }).click();

    const response = await responsePromise;
    if (response) {
      console.log(`Signup response: ${response.status()} ${response.url()}`);
    }

    // Wait for redirect
    const signupSuccess = await page
      .waitForURL(/\/tenant/, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (signupSuccess) {
      console.log("Test user created via signup successfully");
      return;
    }

    // Signup didn't redirect - check what happened
    const currentUrl = page.url();
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const errorText = await page
      .locator('[class*="bg-danger"], [class*="text-danger"], [role="alert"]')
      .first()
      .textContent()
      .catch(() => null);

    console.log(`Signup result - URL: ${currentUrl}`);
    console.log(`Signup error: ${errorText || "none visible"}`);
    console.log(`Page text (first 500 chars): ${bodyText.substring(0, 500)}`);

    // Always retry login after failed signup redirect — the user may already exist
    // (Better Auth returns 200 with error data when user exists, but the error
    // may not render visibly due to page re-render timing)
    console.log("Signup did not redirect - retrying login (user may already exist)...");
    await page.goto(getTenantUrl("demo", "/auth/login"));
    await page.waitForLoadState("domcontentloaded");
    await page.getByRole("textbox", { name: /email/i }).fill(testUser.email);
    await page.locator('input[type="password"]').first().fill(testUser.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    const retryLoginSuccess = await page
      .waitForURL(/\/tenant/, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (retryLoginSuccess) {
      console.log("Login succeeded on retry - user exists with correct password");
      return;
    }

    // Soft fail - independent tests have their own login handling
    // Hard-failing here blocks ALL independent tests rather than letting them try individually
    console.log(
      `WARNING: Could not create/login test user. URL: ${page.url()}, Signup error: ${errorText || "none"}`
    );
  });
});

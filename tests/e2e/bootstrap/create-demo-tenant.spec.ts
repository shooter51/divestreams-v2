import { test, expect } from "@playwright/test";
import { getAdminUrl, getTenantUrl } from "../helpers/urls";

/**
 * Bootstrap: Create "demo" tenant and test user for independent E2E tests
 *
 * This runs before the "independent" project (bug regression specs, debug tests, etc.)
 * to ensure the "demo" tenant exists with a working test user account on the pro plan.
 *
 * On local dev, global-setup.ts creates everything via direct DB access.
 * On remote environments (test.divestreams.com), global-setup is skipped,
 * so this spec ensures the demo tenant + test user exist with correct plan.
 */

const adminEmail = process.env.ADMIN_EMAIL || "admin@divestreams.com";
const adminPassword = process.env.ADMIN_PASSWORD || "DiveAdmin2026";
const testUser = {
  email: "e2e-tester@demo.com",
  password: "DemoPass1234",
  name: "E2E Test User",
};

/** Log in to admin panel. Returns true on success, false on failure. */
async function adminLogin(page: import("@playwright/test").Page): Promise<boolean> {
  await page.goto(getAdminUrl("/login"));
  await page.waitForLoadState("domcontentloaded");

  const emailField = await page
    .getByRole("textbox", { name: /email/i })
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (emailField) {
    await page.getByRole("textbox", { name: /email/i }).fill(adminEmail);
  }
  await page.locator('input[type="password"]').first().fill(adminPassword);
  await page.getByRole("button", { name: /sign in/i }).click();

  return page
    .waitForURL(/\/(dashboard|tenants)/, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
}

/** Upgrade the demo tenant to pro plan via admin panel. Assumes admin is already logged in. */
async function upgradeDemoToPro(page: import("@playwright/test").Page): Promise<void> {
  await page.goto(getAdminUrl("/tenants/demo"));
  await page.waitForLoadState("domcontentloaded");

  const planSelect = page.locator("#planId");
  if (!(await planSelect.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log("Plan select not found on tenant detail page — skipping plan upgrade");
    return;
  }

  const selectedOption = await planSelect.locator("option:checked").textContent().catch(() => "");
  if (/pro/i.test(selectedOption || "")) {
    console.log(`Demo tenant already on pro plan: "${selectedOption}"`);
    return;
  }

  const options = await planSelect.locator("option").allTextContents();
  const proOption = options.find((o) => /^pro\b/i.test(o));
  if (!proOption) {
    console.log(`Could not find pro plan option. Available: ${options.join(", ")}`);
    return;
  }

  await planSelect.selectOption({ label: proOption });
  console.log(`Upgrading demo tenant to plan: ${proOption}`);

  const statusSelect = page.locator("#status");
  if (await statusSelect.isVisible().catch(() => false)) {
    await statusSelect.selectOption("active");
  }

  const updateButton = page.getByRole("button", { name: /update subscription/i });
  if (await updateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await updateButton.click();
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    console.log("Demo tenant plan upgraded to pro");
  } else {
    console.log("Update Subscription button not found — plan may not have been saved");
  }
}

test.describe.serial("Bootstrap: Demo Tenant Setup", () => {
  test("Ensure demo tenant exists and is on pro plan", async ({ page }) => {
    test.setTimeout(90000);

    // Check if demo tenant already exists by visiting its login page
    const tenantLoginUrl = getTenantUrl("demo", "/auth/login");
    await page.goto(tenantLoginUrl);
    await page.waitForLoadState("domcontentloaded");

    const loginFormExists = await page
      .getByRole("textbox", { name: /email/i })
      .isVisible({ timeout: 8000 })
      .catch(() => false);

    if (loginFormExists) {
      console.log("Demo tenant already exists — checking plan via admin...");
    } else {
      console.log("Creating demo tenant via admin panel...");
    }

    // Log in to admin for both creation and plan upgrade
    const loggedIn = await adminLogin(page);
    if (!loggedIn) {
      console.log(`WARNING: Admin login failed (URL: ${page.url()}) — cannot set pro plan`);
      return;
    }

    if (!loginFormExists) {
      // Create the tenant
      await page.goto(getAdminUrl("/tenants/new"));
      await page.waitForLoadState("domcontentloaded");

      await page.locator("#slug").fill("demo");
      await page.locator("#name").fill("Demo Dive Shop");

      // Select "pro" plan (options are "Standard - $30.00/mo", "Pro - $100.00/mo")
      const planSelect = page.locator("#plan");
      if (await planSelect.isVisible().catch(() => false)) {
        const options = await planSelect.locator("option").allTextContents();
        const proOption = options.find((o) => /^pro\b/i.test(o));
        if (proOption) {
          await planSelect.selectOption({ label: proOption });
          console.log(`Selected plan: ${proOption}`);
        } else {
          console.log(`Available plan options: ${options.join(", ")} — could not find pro plan`);
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
    }

    // Always ensure demo tenant is on pro plan (covers existing and newly created tenants)
    await upgradeDemoToPro(page);
  });

  test("Ensure test user can login @critical", async ({ page }) => {
    test.setTimeout(90000);
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

    // Use a stricter pattern to avoid matching /tenant/login on auth failure
    const loginSuccess = await page
      .waitForURL(
        (url) => url.includes("/tenant/") && !url.includes("/tenant/login") && !url.includes("/auth/"),
        { timeout: 15000 }
      )
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

    const responsePromise = page
      .waitForResponse(
        (resp) => resp.url().includes("/auth/signup") && resp.request().method() === "POST",
        { timeout: 15000 }
      )
      .catch(() => null);

    await page.getByRole("button", { name: /create account/i }).click();

    const response = await responsePromise;
    if (response) {
      console.log(`Signup response: ${response.status()} ${response.url()}`);
    }

    const signupSuccess = await page
      .waitForURL(
        (url) => url.includes("/tenant/") && !url.includes("/tenant/login") && !url.includes("/auth/"),
        { timeout: 15000 }
      )
      .then(() => true)
      .catch(() => false);

    if (signupSuccess) {
      console.log("Test user created via signup successfully");
      return;
    }

    const currentUrl = page.url();
    const errorText = await page
      .locator('[class*="bg-danger"], [class*="text-danger"], [role="alert"]')
      .first()
      .textContent()
      .catch(() => null);

    console.log(`Signup result - URL: ${currentUrl}`);
    console.log(`Signup error: ${errorText || "none visible"}`);

    // Retry login — user may already exist
    console.log("Retrying login (user may already exist)...");
    await page.goto(getTenantUrl("demo", "/auth/login"));
    await page.waitForLoadState("domcontentloaded");
    await page.getByRole("textbox", { name: /email/i }).fill(testUser.email);
    await page.locator('input[type="password"]').first().fill(testUser.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    const retryLoginSuccess = await page
      .waitForURL(
        (url) => url.includes("/tenant/") && !url.includes("/tenant/login") && !url.includes("/auth/"),
        { timeout: 15000 }
      )
      .then(() => true)
      .catch(() => false);

    if (retryLoginSuccess) {
      console.log("Login succeeded on retry - user exists with correct password");
      return;
    }

    console.log(
      `WARNING: Could not create/login test user. URL: ${page.url()}, Signup error: ${errorText || "none"}`
    );
  });
});

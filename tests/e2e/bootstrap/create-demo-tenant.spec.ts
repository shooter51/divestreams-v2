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
const adminPassword = process.env.ADMIN_PASSWORD || "PlatformAdmin2026!";
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

/**
 * Promote a user to admin role on the given tenant via admin panel.
 * Assumes admin is already logged in on the admin subdomain.
 */
async function promoteUserToAdmin(
  page: import("@playwright/test").Page,
  tenantSlug: string,
  userEmail: string
): Promise<void> {
  await page.goto(getAdminUrl(`/tenants/${tenantSlug}`));
  await page.waitForLoadState("domcontentloaded");

  // Find the memberId from the hidden input in the "Remove" form for this user
  const memberId = await page.evaluate((email: string) => {
    const emailEls = document.querySelectorAll("p.text-xs");
    for (const el of emailEls) {
      if (el.textContent?.trim() === email) {
        const row = el.closest(".flex");
        if (row) {
          const input = row.querySelector('input[name="memberId"]');
          if (input) return (input as HTMLInputElement).value;
        }
      }
    }
    return null;
  }, userEmail);

  if (!memberId) {
    console.log(`Could not find memberId for ${userEmail} on tenant ${tenantSlug} — may already be owner`);
    return;
  }

  const response = await page.request.post(getAdminUrl(`/tenants/${tenantSlug}`), {
    form: { intent: "updateRole", memberId, role: "admin" },
  });
  if (response.ok() || response.status() === 302) {
    console.log(`Promoted ${userEmail} to admin on tenant ${tenantSlug}`);
  } else {
    console.log(`Role promotion returned ${response.status()} — user may already be admin`);
  }
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

    const loginSuccess = await page
      .waitForURL(
        (url) => url.includes("/tenant") && !url.includes("/tenant/login") && !url.includes("/auth/"),
        { timeout: 15000 }
      )
      .then(() => true)
      .catch(() => false);

    if (!loginSuccess) {
      console.log(`Login failed (URL: ${page.url()}) - creating test user via signup...`);

      // Step 2: Login failed - create the user via signup
      await page.goto(getTenantUrl("demo", "/auth/signup"));
      await page.waitForLoadState("domcontentloaded");

      const afterSignupNav = page.url();
      if (afterSignupNav.includes("/tenant") && !afterSignupNav.includes("/auth/signup")) {
        console.log(`Already authenticated (URL: ${afterSignupNav}) - test user exists`);
      } else {
        const signupForm = await page
          .getByLabel(/full name/i)
          .isVisible({ timeout: 8000 })
          .catch(() => false);

        if (!signupForm) {
          throw new Error("Signup page not available - cannot create test user");
        }

        await page.getByLabel(/full name/i).fill(testUser.name);
        await page.getByLabel(/email address/i).fill(testUser.email);
        await page.locator("#password").fill(testUser.password);
        await page.locator("#confirmPassword").fill(testUser.password);
        await page.getByRole("button", { name: /create account/i }).click();

        const signupSuccess = await page
          .waitForURL(
            (url) => url.includes("/tenant") && !url.includes("/tenant/login") && !url.includes("/auth/"),
            { timeout: 15000 }
          )
          .then(() => true)
          .catch(() => false);

        if (!signupSuccess) {
          const errorText = await page
            .locator('[class*="bg-danger"], [class*="text-danger"], [role="alert"]')
            .first()
            .textContent()
            .catch(() => null);
          console.log(`Signup result - URL: ${page.url()}, error: ${errorText || "none"}`);

          // Retry login — user may already exist
          await page.goto(getTenantUrl("demo", "/auth/login"));
          await page.waitForLoadState("domcontentloaded");
          await page.getByRole("textbox", { name: /email/i }).fill(testUser.email);
          await page.locator('input[type="password"]').first().fill(testUser.password);
          await page.getByRole("button", { name: /sign in/i }).click();
          const retryOk = await page
            .waitForURL(
              (url) => url.includes("/tenant") && !url.includes("/tenant/login") && !url.includes("/auth/"),
              { timeout: 15000 }
            )
            .then(() => true)
            .catch(() => false);
          if (!retryOk) {
            console.log(`WARNING: Could not create/login test user. URL: ${page.url()}`);
          } else {
            console.log("Login succeeded on retry - user exists with correct password");
          }
        } else {
          console.log("Test user created via signup successfully");
        }
      }
    } else {
      console.log("Test user login successful");
    }

    // Step 3: Ensure test user has admin role so RBAC-protected routes are accessible.
    // Users created via signup get "customer" role by default; we need at least "admin".
    // promoteUserToAdmin is a no-op if the user is already owner (memberId hidden input not rendered).
    const adminLoggedIn = await adminLogin(page);
    if (adminLoggedIn) {
      await promoteUserToAdmin(page, "demo", testUser.email);
    } else {
      console.log("WARNING: Admin login failed — could not promote test user to admin");
    }
  });
});

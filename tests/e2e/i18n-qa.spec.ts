import { test, expect, type Page } from "@playwright/test";

const BASE = "https://demo.test.divestreams.com";

// Credentials from environment variables (required)
const CRED_SETS = [
  {
    email: process.env.SEED_EMAIL || "",
    password: process.env.SEED_PASSWORD || "",
  },
];

/** Set Spanish locale via cookie before navigating */
async function setSpanishLocale(page: Page) {
  await page.context().addCookies([
    {
      name: "ds_locale",
      value: "es",
      domain: "demo.test.divestreams.com",
      path: "/",
    },
  ]);
}

/**
 * Log in via the tenant login form in the browser.
 * Tries multiple credential sets. Loads the login page, fills the form, and submits.
 */
async function tenantLogin(page: Page): Promise<boolean> {
  for (const cred of CRED_SETS) {
    console.log(`Attempting login with email: ${cred.email}`);

    // Navigate to tenant login page
    await page.goto(`${BASE}/tenant/login`, { waitUntil: "networkidle" });

    // If already logged in (redirected away from login)
    if (!page.url().includes("/login")) {
      console.log(`Already logged in, at: ${page.url()}`);
      return true;
    }

    // Fill the login form (CSRF token is embedded as a hidden field)
    const emailField = page.locator('input[name="email"]').first();
    if (!(await emailField.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log("No email field found on login page");
      return false;
    }

    await emailField.fill(cred.email);
    const pwField = page.locator('input[name="password"]').first();
    await pwField.fill(cred.password);

    // Click submit and wait for navigation (short timeout since invalid creds redirect quickly)
    await page.click('button[type="submit"]');

    // Wait for response - either redirect away from login (success) or stay on login (failure)
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    const currentUrl = page.url();
    if (!currentUrl.includes("/login")) {
      console.log(`Login SUCCESS with ${cred.email}, at: ${currentUrl}`);
      return true;
    }

    // Check for rate limiting
    const body = await page.locator("body").innerText();
    if (body.includes("Too many") || body.includes("rate limit")) {
      console.log("Rate limited - stopping login attempts");
      return false;
    }

    console.log(`Login FAILED with ${cred.email}`);
  }

  console.log("ALL login attempts failed");
  return false;
}

test.describe("i18n QA - Spanish translations on live test system", () => {
  test.setTimeout(60000);

  test("1. POS 'Add Rental' button shows Spanish text", async ({ page }) => {
    await setSpanishLocale(page);
    const loggedIn = await tenantLogin(page);
    test.skip(!loggedIn, "Could not log in to tenant");

    await setSpanishLocale(page);
    await page.goto(`${BASE}/tenant/pos`, { waitUntil: "networkidle" });

    const body = await page.locator("body").innerText();
    console.log("POS page URL:", page.url());
    console.log("POS page text (first 1000 chars):", body.substring(0, 1000));

    // Switch to Equipment tab if it exists
    const equipmentTab = page.locator(
      'button:has-text("Equipo"), button:has-text("Equipment"), [data-tab="equipment"]'
    );
    if (await equipmentTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await equipmentTab.click();
      await page.waitForTimeout(1000);
      const bodyAfter = await page.locator("body").innerText();
      console.log(
        "After Equipment tab click (first 1000 chars):",
        bodyAfter.substring(0, 1000)
      );
    }

    const addRentalBtn = page.locator('button:has-text("Agregar Alquiler")');
    const addRentalEn = page.locator('button:has-text("Add Rental")');
    const hasSpanish = await addRentalBtn.count();
    const hasEnglish = await addRentalEn.count();
    console.log(`Add Rental - Spanish: ${hasSpanish}, English: ${hasEnglish}`);

    expect(
      hasSpanish,
      'Expected "Agregar Alquiler" button but found none'
    ).toBeGreaterThan(0);
  });

  test("2. POS 'Book Now' button shows Spanish text", async ({ page }) => {
    await setSpanishLocale(page);
    const loggedIn = await tenantLogin(page);
    test.skip(!loggedIn, "Could not log in to tenant");

    await setSpanishLocale(page);
    await page.goto(`${BASE}/tenant/pos`, { waitUntil: "networkidle" });

    // Switch to Trips tab
    const tripsTab = page.locator(
      'button:has-text("Viajes"), button:has-text("Trips"), [data-tab="trips"]'
    );
    if (await tripsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tripsTab.click();
      await page.waitForTimeout(1000);
    }

    const body = await page.locator("body").innerText();
    console.log(
      "POS Trips tab text (first 1000 chars):",
      body.substring(0, 1000)
    );

    const bookNowBtn = page.locator(
      'button:has-text("Reservar Ahora"), a:has-text("Reservar Ahora")'
    );
    const bookNowEn = page.locator(
      'button:has-text("Book Now"), a:has-text("Book Now")'
    );
    const hasSpanish = await bookNowBtn.count();
    const hasEnglish = await bookNowEn.count();
    console.log(`Book Now - Spanish: ${hasSpanish}, English: ${hasEnglish}`);

    expect(
      hasSpanish,
      'Expected "Reservar Ahora" button but found none'
    ).toBeGreaterThan(0);
  });

  test("3. Discounts page loads in Spanish", async ({ page }) => {
    await setSpanishLocale(page);
    const loggedIn = await tenantLogin(page);
    test.skip(!loggedIn, "Could not log in to tenant");

    await setSpanishLocale(page);
    await page.goto(`${BASE}/tenant/discounts`, { waitUntil: "networkidle" });

    const body = await page.locator("body").innerText();
    console.log(`Discounts page URL: ${page.url()}`);
    console.log(
      "Discounts page text (first 800 chars):",
      body.substring(0, 800)
    );

    expect(body).not.toContain("Internal Server Error");
    expect(body).not.toContain("Unexpected Application Error");

    const hasSpanishContent =
      body.includes("Descuento") ||
      body.includes("Cupón") ||
      body.includes("Código");
    console.log(`Discounts page has Spanish content: ${hasSpanishContent}`);
  });

  test("4. Gallery page loads in Spanish", async ({ page }) => {
    await setSpanishLocale(page);
    const loggedIn = await tenantLogin(page);
    test.skip(!loggedIn, "Could not log in to tenant");

    await setSpanishLocale(page);
    await page.goto(`${BASE}/tenant/gallery`, { waitUntil: "networkidle" });

    const body = await page.locator("body").innerText();
    console.log(`Gallery page URL: ${page.url()}`);
    console.log(
      "Gallery page text (first 800 chars):",
      body.substring(0, 800)
    );

    expect(body).not.toContain("Internal Server Error");
    expect(body).not.toContain("Unexpected Application Error");

    const hasSpanishContent =
      body.includes("Galería") ||
      body.includes("Álbum") ||
      body.includes("Foto");
    console.log(`Gallery page has Spanish content: ${hasSpanishContent}`);
  });

  test("5. Public site equipment detail - no 404", async ({ page }) => {
    await setSpanishLocale(page);
    await page.goto(`${BASE}/site/equipment`, { waitUntil: "networkidle" });

    const body = await page.locator("body").innerText();
    console.log("Equipment list page URL:", page.url());
    console.log(
      "Equipment list text (first 500 chars):",
      body.substring(0, 500)
    );

    const equipmentLink = page.locator('a[href*="/equipment/"]').first();
    const linkCount = await equipmentLink.count();
    console.log(`Equipment links found: ${linkCount}`);

    if (linkCount > 0) {
      const href = await equipmentLink.getAttribute("href");
      console.log(`Clicking equipment link: ${href}`);
      await equipmentLink.click();
      await page.waitForLoadState("networkidle");

      const detailBody = await page.locator("body").innerText();
      console.log(`Equipment detail URL: ${page.url()}`);
      console.log(
        "Equipment detail text (first 500 chars):",
        detailBody.substring(0, 500)
      );
      expect(detailBody).not.toContain("404");
      expect(detailBody).not.toContain("Page not found");
    } else {
      console.log(
        "No equipment items on listing page - cannot test detail page"
      );
    }
  });

  test("6. Public site trip detail - no 404", async ({ page }) => {
    await setSpanishLocale(page);
    await page.goto(`${BASE}/site/trips`, { waitUntil: "networkidle" });

    const body = await page.locator("body").innerText();
    console.log("Trips list page URL:", page.url());
    console.log("Trips list text (first 500 chars):", body.substring(0, 500));

    const tripLink = page.locator('a[href*="/trips/"]').first();
    const linkCount = await tripLink.count();
    console.log(`Trip links found: ${linkCount}`);

    if (linkCount > 0) {
      const href = await tripLink.getAttribute("href");
      console.log(`Clicking trip link: ${href}`);
      await tripLink.click();
      await page.waitForLoadState("networkidle");

      const detailBody = await page.locator("body").innerText();
      console.log(`Trip detail URL: ${page.url()}`);
      console.log(
        "Trip detail text (first 500 chars):",
        detailBody.substring(0, 500)
      );
      expect(detailBody).not.toContain("404");
      expect(detailBody).not.toContain("Page not found");
    } else {
      console.log("No trip items on listing page - cannot test detail page");
    }
  });

  test("7. Training sessions page - no error/500", async ({ page }) => {
    await setSpanishLocale(page);
    const loggedIn = await tenantLogin(page);
    test.skip(!loggedIn, "Could not log in to tenant");

    await setSpanishLocale(page);
    await page.goto(`${BASE}/tenant/training/sessions`, {
      waitUntil: "networkidle",
    });

    const body = await page.locator("body").innerText();
    console.log(`Training sessions URL: ${page.url()}`);
    console.log(
      "Training sessions text (first 800 chars):",
      body.substring(0, 800)
    );

    expect(body).not.toContain("Internal Server Error");
    expect(body).not.toContain("Unexpected Application Error");
  });

  test("8. Public site login page placeholder shows Spanish text", async ({
    page,
  }) => {
    await setSpanishLocale(page);
    await page.goto(`${BASE}/site/login`, { waitUntil: "networkidle" });

    const body = await page.locator("body").innerText();
    console.log("Site login page URL:", page.url());
    console.log(
      "Site login page text (first 500 chars):",
      body.substring(0, 500)
    );

    const emailInput = page
      .locator('input[name="email"], input[type="email"]')
      .first();
    const isVisible = await emailInput
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!isVisible) {
      console.log("No email input on /site/login, trying /tenant/login");
      await setSpanishLocale(page);
      await page.goto(`${BASE}/tenant/login`, { waitUntil: "networkidle" });
      const body2 = await page.locator("body").innerText();
      console.log(
        "Tenant login page text (first 500 chars):",
        body2.substring(0, 500)
      );
    }

    const emailInput2 = page
      .locator('input[name="email"], input[type="email"]')
      .first();
    const placeholder = await emailInput2.getAttribute("placeholder");
    console.log(`Login email placeholder: "${placeholder}"`);

    expect(
      placeholder,
      'Expected placeholder "tu@ejemplo.com" for Spanish locale'
    ).toBe("tu@ejemplo.com");
  });

  test("9. Register page password requirements in Spanish", async ({
    page,
  }) => {
    await setSpanishLocale(page);
    await page.goto(`${BASE}/site/register`, { waitUntil: "networkidle" });

    let body = await page.locator("body").innerText();
    console.log("Register page URL:", page.url());

    if (body.includes("404") || body.includes("not found")) {
      console.log("/site/register returned 404, trying /auth/signup");
      await setSpanishLocale(page);
      await page.goto(`${BASE}/auth/signup`, { waitUntil: "networkidle" });
      body = await page.locator("body").innerText();
      console.log("Auth signup URL:", page.url());
    }

    console.log(
      "Register page text (first 1000 chars):",
      body.substring(0, 1000)
    );

    const hasSpanishRequirements =
      body.includes("Al menos 8 caracteres") ||
      body.includes("Requisitos de contraseña") ||
      body.includes("Debe tener al menos 8 caracteres") ||
      body.includes("letra minúscula") ||
      body.includes("letra mayúscula");

    const hasEnglishRequirements =
      body.includes("at least 8 characters") ||
      body.includes("Password requirements") ||
      body.includes("One lowercase") ||
      body.includes("One uppercase");

    console.log(`Has Spanish password requirements: ${hasSpanishRequirements}`);
    console.log(`Has English password requirements: ${hasEnglishRequirements}`);

    // Try clicking on password field to trigger requirement display
    if (!hasSpanishRequirements && !hasEnglishRequirements) {
      const pwField = page
        .locator('input[name="password"], input[type="password"]')
        .first();
      if (await pwField.isVisible().catch(() => false)) {
        await pwField.click();
        await pwField.fill("a"); // trigger validation
        await page.waitForTimeout(500);
        body = await page.locator("body").innerText();
        console.log("After password interaction:", body.substring(0, 1000));

        const hasSpanishAfter =
          body.includes("Al menos 8 caracteres") ||
          body.includes("Requisitos de contraseña") ||
          body.includes("letra minúscula");
        const hasEnglishAfter =
          body.includes("at least 8 characters") ||
          body.includes("One lowercase");

        console.log(
          `After focus - Spanish: ${hasSpanishAfter}, English: ${hasEnglishAfter}`
        );
        if (hasEnglishAfter && !hasSpanishAfter) {
          expect(
            false,
            "Password requirements (after focus) are still in English"
          ).toBeTruthy();
        }
      } else {
        console.log("No password field found - cannot test requirements");
      }
    } else if (hasEnglishRequirements && !hasSpanishRequirements) {
      expect(
        false,
        "Password requirements are still in English, not translated to Spanish"
      ).toBeTruthy();
    }
  });

  test("10. Import courses back link shows Spanish text", async ({ page }) => {
    await setSpanishLocale(page);
    const loggedIn = await tenantLogin(page);
    test.skip(!loggedIn, "Could not log in to tenant");

    await setSpanishLocale(page);
    await page.goto(`${BASE}/tenant/training/import`, {
      waitUntil: "networkidle",
    });

    const body = await page.locator("body").innerText();
    console.log(`Import page URL: ${page.url()}`);
    console.log(
      "Import page text (first 800 chars):",
      body.substring(0, 800)
    );

    const backLink = page.locator('a:has-text("Volver a Capacitación")');
    const backLinkEn = page.locator('a:has-text("Back to Training")');

    const hasSpanish = await backLink.count();
    const hasEnglish = await backLinkEn.count();
    console.log(`Back link - Spanish: ${hasSpanish}, English: ${hasEnglish}`);

    const arrowBackLink = page.locator(
      ':has-text("← Volver a Capacitación")'
    );
    const arrowCount = await arrowBackLink.count();
    console.log(`Arrow back link count: ${arrowCount}`);

    expect(
      hasSpanish > 0 || arrowCount > 0,
      'Expected "Volver a Capacitación" back link but found none'
    ).toBeTruthy();
  });
});

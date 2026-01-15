import { test, expect } from "@playwright/test";

test.describe("Marketing - Home Page", () => {
  test("displays home page", async ({ page }) => {
    await page.goto("http://localhost:5173/");

    // Should show main marketing page
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("has navigation links", async ({ page }) => {
    await page.goto("http://localhost:5173/");

    // Should have navigation to main sections
    await expect(page.getByRole("link", { name: /pricing|features|sign up/i }).first()).toBeVisible();
  });

  test("has call to action", async ({ page }) => {
    await page.goto("http://localhost:5173/");

    // Should have a CTA button
    await expect(page.getByRole("link", { name: /get started|try free|sign up/i }).first()).toBeVisible();
  });
});

test.describe("Marketing - Pricing Page", () => {
  test("displays pricing page", async ({ page }) => {
    await page.goto("http://localhost:5173/pricing");

    await expect(page.getByRole("heading", { name: /pricing/i })).toBeVisible();
  });

  test("shows pricing plans", async ({ page }) => {
    await page.goto("http://localhost:5173/pricing");

    // Should show at least one plan with a price
    await expect(page.getByText(/\$\d+|free/i).first()).toBeVisible();
  });

  test("has plan comparison", async ({ page }) => {
    await page.goto("http://localhost:5173/pricing");

    // Should show multiple plans for comparison
    const plans = page.locator('[class*="plan"], [class*="pricing-card"], [class*="tier"]');
    await expect(plans.first()).toBeVisible();
  });

  test("has sign up buttons", async ({ page }) => {
    await page.goto("http://localhost:5173/pricing");

    // Each plan should have a CTA
    await expect(page.getByRole("link", { name: /get started|sign up|choose|select/i }).first()).toBeVisible();
  });
});

test.describe("Marketing - Features Page", () => {
  test("displays features page", async ({ page }) => {
    await page.goto("http://localhost:5173/features");

    await expect(page.getByRole("heading", { name: /feature/i })).toBeVisible();
  });

  test("lists product features", async ({ page }) => {
    await page.goto("http://localhost:5173/features");

    // Should show feature descriptions
    await expect(page.getByText(/booking|customer|tour|pos/i).first()).toBeVisible();
  });
});

test.describe("Marketing - Terms Page", () => {
  test("displays terms of service page", async ({ page }) => {
    await page.goto("http://localhost:5173/terms");

    await expect(page.getByRole("heading", { name: /terms/i })).toBeVisible();
  });

  test("has terms content", async ({ page }) => {
    await page.goto("http://localhost:5173/terms");

    // Should have substantial text content
    await expect(page.locator("main, article, .content").first()).toBeVisible();
  });
});

test.describe("Marketing - Privacy Page", () => {
  test("displays privacy policy page", async ({ page }) => {
    await page.goto("http://localhost:5173/privacy");

    await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible();
  });

  test("has privacy content", async ({ page }) => {
    await page.goto("http://localhost:5173/privacy");

    // Should have substantial text content
    await expect(page.locator("main, article, .content").first()).toBeVisible();
  });
});

test.describe("Marketing - Signup Page", () => {
  test("displays signup page", async ({ page }) => {
    await page.goto("http://localhost:5173/signup");

    await expect(page.getByRole("heading", { name: /sign up|get started|create/i })).toBeVisible();
  });

  test("has signup form", async ({ page }) => {
    await page.goto("http://localhost:5173/signup");

    await expect(page.getByLabel(/subdomain/i)).toBeVisible();
    await expect(page.getByLabel(/business name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("shows subdomain preview", async ({ page }) => {
    await page.goto("http://localhost:5173/signup");

    await page.getByLabel(/subdomain/i).fill("testshop");

    // Should show preview of the URL
    await expect(page.getByText(/testshop.*divestreams/i)).toBeVisible();
  });

  test("validates subdomain format", async ({ page }) => {
    await page.goto("http://localhost:5173/signup");

    await page.getByLabel(/subdomain/i).fill("invalid subdomain!");
    await page.getByLabel(/business name/i).fill("Test");
    await page.getByLabel(/email/i).fill("test@test.com");
    await page.getByLabel(/password/i).fill("Test1234!");

    await page.getByRole("button", { name: /sign up|create|get started/i }).click();

    // Should show validation error
    await expect(page.getByText(/invalid|format|alphanumeric/i)).toBeVisible();
  });

  test("validates required fields", async ({ page }) => {
    await page.goto("http://localhost:5173/signup");

    await page.getByRole("button", { name: /sign up|create|get started/i }).click();

    // Form validation should require fields
    await expect(page.getByLabel(/subdomain/i)).toHaveAttribute("required", "");
  });
});

test.describe("Marketing - Navigation", () => {
  test("can navigate from home to pricing", async ({ page }) => {
    await page.goto("http://localhost:5173/");

    await page.getByRole("link", { name: /pricing/i }).click();

    await expect(page).toHaveURL(/pricing/);
  });

  test("can navigate from home to features", async ({ page }) => {
    await page.goto("http://localhost:5173/");

    await page.getByRole("link", { name: /features/i }).click();

    await expect(page).toHaveURL(/features/);
  });

  test("can navigate from home to signup", async ({ page }) => {
    await page.goto("http://localhost:5173/");

    await page.getByRole("link", { name: /get started|sign up|try free/i }).first().click();

    await expect(page).toHaveURL(/signup/);
  });
});

import { test, expect } from "@playwright/test";
import postgres from "postgres";

// CI/CD Stability Test - Pass 2 of 3
// Test data
const testData = {
  tenant: {
    subdomain: "e2etest",
  },
  user: {
    email: process.env.E2E_USER_EMAIL || "e2e-user@example.com",
    password: process.env.E2E_USER_PASSWORD || "TestPass123!",
  },
};

function getTenantUrl(path: string) {
  return `http://${testData.tenant.subdomain}.localhost:5173${path}`;
}

async function loginToTenant(page: any) {
  await page.goto(getTenantUrl("/auth/login"));
  await page.getByLabel(/email/i).fill(testData.user.email);
  await page.getByLabel(/password/i).fill(testData.user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  try {
    await page.waitForURL(/\/(app|dashboard)/, { timeout: 10000 });
  } catch {
    await page.waitForTimeout(2000);
  }
}

test.describe("Stripe Integration", () => {
  // Ensure tenant has a starter subscription (required for Stripe access)
  test.beforeAll(async () => {
    const sql = postgres(process.env.DATABASE_URL!);

    try {
      // Get organization ID for e2etest tenant
      const orgResult = await sql`
        SELECT id FROM organization WHERE slug = ${testData.tenant.subdomain}
      `;

      if (orgResult.length > 0) {
        const orgId = orgResult[0].id;

        // Delete any existing subscriptions for this org, then create a starter subscription
        await sql`DELETE FROM subscription WHERE organization_id = ${orgId}`;
        await sql`
          INSERT INTO subscription (organization_id, plan, status, created_at, updated_at)
          VALUES (${orgId}, 'starter', 'active', NOW(), NOW())
        `;
      }
    } finally {
      await sql.end();
    }
  });

  test("shows Stripe connection modal (not 'coming soon' error)", async ({ page }) => {
    // Login first
    await loginToTenant(page);

    // Navigate to integrations page
    await page.goto(getTenantUrl("/app/settings/integrations"));
    
    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Find the Stripe integration card by its unique structure
    const stripeCard = page.locator('div.bg-white.rounded-xl:has(h3:text-is("Stripe"))').first();
    await expect(stripeCard).toBeVisible();

    // Find and click the Connect button within the Stripe card
    const connectButton = stripeCard.locator('button:has-text("Connect")');
    await connectButton.click();
    
    // Verify modal appears with correct title (NOT "coming soon" error)
    await expect(page.locator('h2:has-text("Connect Stripe")')).toBeVisible();
    
    // Verify modal has the required fields
    await expect(page.locator('input[name="secretKey"]')).toBeVisible();
    await expect(page.locator('input[name="publishableKey"]')).toBeVisible();
    
    // Verify link to Stripe dashboard
    await expect(page.locator('a[href="https://dashboard.stripe.com/apikeys"]')).toBeVisible();
    
    // Verify submit button
    await expect(page.locator('button:has-text("Connect Stripe")')).toBeVisible();
  });
});

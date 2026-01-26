import { test, expect } from "@playwright/test";
import postgres from "postgres";

// CI/CD Stability Test - Pass 3 of 3 (Final)
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
    await page.waitForURL(/\/tenant/, { timeout: 10000 });
  } catch {
    await page.waitForTimeout(2000);
  }
}

test.describe("Stripe Integration", () => {
  // Ensure tenant has an enterprise subscription (required for integrations access)
  test.beforeAll(async () => {
    const sql = postgres(process.env.DATABASE_URL!);

    try {
      // Ensure subscription_plans table has the enterprise plan (CI uses db:push which doesn't seed)
      const existingPlan = await sql`
        SELECT id FROM subscription_plans WHERE name = 'enterprise'
      `;
      if (existingPlan.length === 0) {
        await sql`
          INSERT INTO subscription_plans (id, name, display_name, monthly_price, yearly_price, features, limits, is_active, created_at, updated_at)
          VALUES (
            gen_random_uuid(), 'enterprise', 'Enterprise', 9900, 95000,
            '{"has_tours_bookings": true, "has_equipment_boats": true, "has_training": true, "has_pos": true, "has_public_site": true, "has_advanced_notifications": true, "has_integrations": true, "has_api_access": true, "has_stripe": true}'::jsonb,
            '{"users": -1, "customers": -1, "toursPerMonth": -1, "storageGb": 100}'::jsonb,
            true, NOW(), NOW()
          )
        `;
      }

      // Get organization ID for e2etest tenant
      const orgResult = await sql`
        SELECT id FROM organization WHERE slug = ${testData.tenant.subdomain}
      `;

      if (orgResult.length > 0) {
        const orgId = orgResult[0].id;
        // Get the enterprise plan ID for FK reference
        const planResult = await sql`
          SELECT id FROM subscription_plans WHERE name = 'enterprise' LIMIT 1
        `;
        const planId = planResult.length > 0 ? planResult[0].id : null;

        // Delete any existing subscriptions for this org, then create an enterprise subscription
        await sql`DELETE FROM subscription WHERE organization_id = ${orgId}`;
        await sql`
          INSERT INTO subscription (organization_id, plan, plan_id, status, created_at, updated_at)
          VALUES (${orgId}, 'enterprise', ${planId}, 'active', NOW(), NOW())
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
    await page.goto(getTenantUrl("/tenant/settings/integrations"));

    // Wait for page to load
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Find the Stripe integration card by its unique structure
    const stripeCard = page.locator('div.bg-surface-raised.rounded-xl:has(h3:text-is("Stripe"))').first();
    // Retry with reload if not found (Vite dep optimization can cause page reloads in CI)
    if (!(await stripeCard.isVisible().catch(() => false))) {
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
    }
    await expect(stripeCard).toBeVisible({ timeout: 8000 });

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

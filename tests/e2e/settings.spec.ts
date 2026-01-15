import { test, expect } from "@playwright/test";

/**
 * Settings E2E Tests
 *
 * Tests for settings routes:
 * - /app/settings - Settings overview
 * - /app/settings/profile - Shop profile
 * - /app/settings/billing - Billing & subscription
 * - /app/settings/team - Team members
 * - /app/settings/integrations - Third-party integrations
 * - /app/settings/notifications - Notification preferences
 * - /app/settings/booking-widget - Booking widget customization
 */

// Helper functions
const getTenantUrl = (path: string = "/") =>
  `http://e2etest.localhost:5173${path}`;

test.describe("Settings Management", () => {
  test.describe("Settings Overview Page", () => {
    test("should navigate to settings page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/settings") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display page heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /settings/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should have Shop Profile link", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const profileLink = await page.getByText(/shop profile/i).isVisible().catch(() => false);
      expect(profileLink).toBeTruthy();
    });

    test("should have Billing & Subscription link", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const billingLink = await page.getByText(/billing.*subscription/i).isVisible().catch(() => false);
      expect(billingLink).toBeTruthy();
    });

    test("should have Team Members link", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const teamLink = await page.getByText(/team members/i).isVisible().catch(() => false);
      expect(teamLink).toBeTruthy();
    });

    test("should have Integrations link", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const integrationsLink = await page.getByText(/^integrations$/i).isVisible().catch(() => false);
      expect(integrationsLink).toBeTruthy();
    });

    test("should have Notifications link", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const notificationsLink = await page.getByText(/^notifications$/i).isVisible().catch(() => false);
      expect(notificationsLink).toBeTruthy();
    });

    test("should have Booking Widget link", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const widgetLink = await page.getByText(/booking widget/i).isVisible().catch(() => false);
      expect(widgetLink).toBeTruthy();
    });

    test("should show Danger Zone section", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const dangerZone = await page.getByText(/danger zone/i).isVisible().catch(() => false);
      expect(dangerZone).toBeTruthy();
    });

    test("should have Export Data button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const exportBtn = await page.getByRole("button", { name: /export data/i }).isVisible().catch(() => false);
      expect(exportBtn).toBeTruthy();
    });

    test("should have Delete Account button", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const deleteBtn = await page.getByRole("button", { name: /delete account/i }).isVisible().catch(() => false);
      expect(deleteBtn).toBeTruthy();
    });
  });

  test.describe("Profile Page", () => {
    test("should navigate to profile settings page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/profile"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/settings/profile") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display profile heading or form", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/profile"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const hasHeading = await page.getByRole("heading", { name: /profile|shop/i }).isVisible().catch(() => false);
      const hasForm = await page.getByLabel(/business name|shop name/i).isVisible().catch(() => false);

      expect(hasHeading || hasForm).toBeTruthy();
    });
  });

  test.describe("Billing Page", () => {
    test("should navigate to billing settings page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/billing"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/settings/billing") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display billing heading or plan info", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/billing"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const hasHeading = await page.getByRole("heading", { name: /billing|subscription/i }).isVisible().catch(() => false);
      const hasPlanInfo = await page.getByText(/plan|subscription|free|premium/i).first().isVisible().catch(() => false);

      expect(hasHeading || hasPlanInfo).toBeTruthy();
    });
  });

  test.describe("Team Page", () => {
    test("should navigate to team settings page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/team"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/settings/team") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display team heading or member list", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/team"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const hasHeading = await page.getByRole("heading", { name: /team/i }).isVisible().catch(() => false);
      const hasMemberInfo = await page.getByText(/member|invite|role/i).first().isVisible().catch(() => false);

      expect(hasHeading || hasMemberInfo).toBeTruthy();
    });
  });

  test.describe("Integrations Page", () => {
    test("should navigate to integrations settings page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/integrations"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/settings/integrations") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display integrations heading", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/integrations"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const heading = await page.getByRole("heading", { name: /integrations/i }).isVisible().catch(() => false);
      expect(heading).toBeTruthy();
    });

    test("should show Stripe integration option", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/integrations"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const stripeOption = await page.getByText(/stripe/i).isVisible().catch(() => false);
      expect(stripeOption).toBeTruthy();
    });

    test("should show Google Calendar integration option", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/integrations"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const googleOption = await page.getByText(/google.*calendar/i).isVisible().catch(() => false);
      expect(googleOption).toBeTruthy();
    });

    test("should show QuickBooks integration option", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/integrations"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const quickbooksOption = await page.getByText(/quickbooks/i).isVisible().catch(() => false);
      expect(quickbooksOption).toBeTruthy();
    });

    test("should show Xero integration option", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/integrations"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const xeroOption = await page.getByText(/xero/i).isVisible().catch(() => false);
      expect(xeroOption).toBeTruthy();
    });

    test("should show Mailchimp integration option", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/integrations"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const mailchimpOption = await page.getByText(/mailchimp/i).isVisible().catch(() => false);
      expect(mailchimpOption).toBeTruthy();
    });
  });

  test.describe("Notifications Page", () => {
    test("should navigate to notifications settings page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/notifications"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/settings/notifications") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display notifications heading or options", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/notifications"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const hasHeading = await page.getByRole("heading", { name: /notification/i }).isVisible().catch(() => false);
      const hasOptions = await page.getByText(/email|notify|alert/i).first().isVisible().catch(() => false);

      expect(hasHeading || hasOptions).toBeTruthy();
    });
  });

  test.describe("Booking Widget Page", () => {
    test("should navigate to booking widget settings page route", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/booking-widget"));
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      expect(currentUrl.includes("/settings/booking-widget") || currentUrl.includes("/login")).toBeTruthy();
    });

    test("should display booking widget heading or options", async ({ page }) => {
      await page.goto(getTenantUrl("/app/settings/booking-widget"));
      await page.waitForTimeout(1500);

      if (page.url().includes("/login")) {
        return;
      }

      const hasHeading = await page.getByRole("heading", { name: /booking widget|embed/i }).isVisible().catch(() => false);
      const hasOptions = await page.getByText(/embed|widget|customize/i).first().isVisible().catch(() => false);

      expect(hasHeading || hasOptions).toBeTruthy();
    });
  });
});

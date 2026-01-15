import { expect } from "@playwright/test";
import { TenantBasePage } from "./base.page";

/**
 * Settings Index Page Object
 */
export class SettingsPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("/settings");
  }

  async expectSettingsPage(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /settings/i })).toBeVisible();
  }

  async expectSettingsLinks(): Promise<void> {
    await expect(this.page.getByText(/shop profile/i)).toBeVisible();
    await expect(this.page.getByText(/billing.*subscription/i)).toBeVisible();
    await expect(this.page.getByText(/team members/i)).toBeVisible();
    await expect(this.page.getByText(/integrations/i)).toBeVisible();
    await expect(this.page.getByText(/notifications/i)).toBeVisible();
    await expect(this.page.getByText(/booking widget/i)).toBeVisible();
  }

  async navigateToSection(section: "profile" | "billing" | "team" | "integrations" | "notifications" | "booking-widget"): Promise<void> {
    const linkMap = {
      profile: /shop profile/i,
      billing: /billing.*subscription/i,
      team: /team members/i,
      integrations: /integrations/i,
      notifications: /notifications/i,
      "booking-widget": /booking widget/i,
    };
    await this.page.getByRole("link", { name: linkMap[section] }).click();
    await this.waitForNavigation();
  }

  async expectDangerZone(): Promise<void> {
    await expect(this.page.getByText(/danger zone/i)).toBeVisible();
    await expect(this.page.getByRole("button", { name: /export data/i })).toBeVisible();
    await expect(this.page.getByRole("button", { name: /delete account/i })).toBeVisible();
  }

  async seedDemoData(): Promise<void> {
    await this.page.getByRole("button", { name: /load demo data/i }).click();
  }

  async expectSeedSuccess(): Promise<void> {
    await expect(this.page.getByText(/demo data seeded successfully/i)).toBeVisible();
  }
}

/**
 * Billing Settings Page Object
 */
export class BillingPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("/settings/billing");
  }

  async expectBillingPage(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /billing.*subscription/i })).toBeVisible();
  }

  async expectCurrentPlanSection(): Promise<void> {
    await expect(this.page.getByText(/current plan/i)).toBeVisible();
    await expect(this.page.locator('[class*="rounded-full"]').filter({ hasText: /active|trialing/i }).first()).toBeVisible();
  }

  async expectUsageSection(): Promise<void> {
    await expect(this.page.getByText(/usage this month/i)).toBeVisible();
    await expect(this.page.getByText(/bookings/i)).toBeVisible();
    await expect(this.page.getByText(/team members/i)).toBeVisible();
  }

  async expectAvailablePlans(): Promise<void> {
    await expect(this.page.getByText(/available plans/i)).toBeVisible();
    // At least one plan should be visible
    await expect(this.page.locator(".grid").getByText(/\$\d+/)).toBeVisible();
  }

  async expectPaymentMethodSection(): Promise<void> {
    await expect(this.page.getByText(/payment method/i)).toBeVisible();
  }

  async clickUpgradePlan(planName: string): Promise<void> {
    const planCard = this.page.locator(".bg-white.rounded-xl").filter({ hasText: planName });
    await planCard.getByRole("button", { name: /upgrade|switch/i }).click();
  }

  async clickManagePayment(): Promise<void> {
    await this.page.getByRole("button", { name: /manage payment/i }).click();
  }

  async expectError(message: string | RegExp): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  async goBackToSettings(): Promise<void> {
    await this.page.getByRole("link", { name: /back to settings/i }).click();
  }
}

/**
 * Team Settings Page Object
 */
export class TeamPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("/settings/team");
  }

  async expectTeamPage(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /team/i })).toBeVisible();
  }

  async expectMembersList(): Promise<void> {
    await expect(this.page.locator("table, [class*='member-list']")).toBeVisible();
  }

  async inviteMember(email: string, role: string): Promise<void> {
    await this.page.getByRole("button", { name: /invite|add member/i }).click();
    await this.page.getByLabel(/email/i).fill(email);
    await this.page.getByLabel(/role/i).selectOption(role);
    await this.page.getByRole("button", { name: /send invite|invite/i }).click();
  }

  async expectInviteSuccess(): Promise<void> {
    await expect(this.page.getByText(/invitation sent/i)).toBeVisible();
  }
}

/**
 * Profile Settings Page Object
 */
export class ProfilePage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("/settings/profile");
  }

  async expectProfilePage(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /profile|shop/i })).toBeVisible();
  }

  async updateBusinessName(name: string): Promise<void> {
    await this.page.getByLabel(/business name/i).fill(name);
    await this.page.getByRole("button", { name: /save/i }).click();
  }

  async updateTimezone(timezone: string): Promise<void> {
    await this.page.getByLabel(/timezone/i).selectOption(timezone);
    await this.page.getByRole("button", { name: /save/i }).click();
  }

  async expectSaveSuccess(): Promise<void> {
    await expect(this.page.getByText(/saved|updated/i)).toBeVisible();
  }
}

/**
 * Integrations Settings Page Object
 */
export class IntegrationsPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("/settings/integrations");
  }

  async expectIntegrationsPage(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /integrations/i })).toBeVisible();
  }

  async expectStripeIntegration(): Promise<void> {
    await expect(this.page.getByText(/stripe/i)).toBeVisible();
  }

  async connectStripe(): Promise<void> {
    await this.page.getByRole("button", { name: /connect stripe/i }).click();
  }

  async disconnectStripe(): Promise<void> {
    await this.page.getByRole("button", { name: /disconnect stripe/i }).click();
  }
}

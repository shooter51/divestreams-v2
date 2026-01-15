import { expect } from "@playwright/test";
import { TenantBasePage } from "./base.page";

/**
 * Tenant Dashboard Page Object
 */
export class DashboardPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("");
  }

  async expectDashboard(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  }

  async expectStatsCards(): Promise<void> {
    // Check for stat cards with emojis
    await expect(this.page.getByText(/today's bookings/i)).toBeVisible();
    await expect(this.page.getByText(/this week's revenue/i)).toBeVisible();
    await expect(this.page.getByText(/active trips/i)).toBeVisible();
    await expect(this.page.getByText(/total customers/i)).toBeVisible();
  }

  async expectUpcomingTripsSection(): Promise<void> {
    await expect(this.page.getByText(/upcoming trips/i)).toBeVisible();
    await expect(this.page.getByRole("link", { name: /view all trips/i })).toBeVisible();
  }

  async expectRecentBookingsSection(): Promise<void> {
    await expect(this.page.getByText(/recent bookings/i)).toBeVisible();
    await expect(this.page.getByRole("link", { name: /view all bookings/i })).toBeVisible();
  }

  async expectSubscriptionBadge(): Promise<void> {
    await expect(this.page.locator('[class*="rounded-full"]').filter({ hasText: /free|pro|enterprise|premium/i }).first()).toBeVisible();
  }

  async clickViewAllTrips(): Promise<void> {
    await this.page.getByRole("link", { name: /view all trips/i }).click();
  }

  async clickViewAllBookings(): Promise<void> {
    await this.page.getByRole("link", { name: /view all bookings/i }).click();
  }

  async getStatValue(statName: string): Promise<string> {
    const statCard = this.page.locator(".bg-white.rounded-xl").filter({ hasText: statName });
    const value = statCard.locator("p.text-2xl.font-bold");
    return (await value.textContent()) || "";
  }

  async navigateTo(section: "bookings" | "customers" | "tours" | "trips" | "settings" | "pos"): Promise<void> {
    await this.page.getByRole("link", { name: new RegExp(section, "i") }).click();
    await this.waitForNavigation();
  }
}

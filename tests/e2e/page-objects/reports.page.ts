import { expect, type Locator } from "@playwright/test";
import { TenantBasePage } from "./base.page";

/**
 * Reports Page Object
 *
 * Encapsulates interactions with the Reports dashboard page
 */
export class ReportsPage extends TenantBasePage {
  // ==========================================
  // Locators
  // ==========================================

  get pageHeading(): Locator {
    return this.page.getByRole("heading", { name: /reports/i });
  }

  get dateRangeIndicator(): Locator {
    return this.page.getByRole("button", { name: /select date range/i });
  }

  // Revenue Overview Cards
  // Note: The first card shows the currently selected period (Today, This Week, This Month, This Year, or custom range)
  get thisMonthCard(): Locator {
    // This card is the first revenue card - shows the current period revenue
    // Using a more flexible locator since label changes based on date range selection
    return this.page.locator(".grid.grid-cols-4 .bg-white.rounded-xl").first();
  }

  get lastMonthCard(): Locator {
    // This card shows "Previous Period" for comparison
    return this.page.locator(".bg-white.rounded-xl").filter({ hasText: /previous period/i });
  }

  get yearToDateCard(): Locator {
    return this.page.locator(".bg-white.rounded-xl").filter({ hasText: /year to date/i });
  }

  get avgBookingValueCard(): Locator {
    return this.page.locator(".bg-white.rounded-xl").filter({ hasText: /avg booking value/i });
  }

  // Premium Feature Sections
  get revenueTrendSection(): Locator {
    return this.page.locator(".bg-white.rounded-xl").filter({ hasText: /revenue trend/i });
  }

  get bookingsByStatusSection(): Locator {
    return this.page.locator(".bg-white.rounded-xl").filter({ hasText: /bookings by status/i });
  }

  get topToursSection(): Locator {
    return this.page.locator(".bg-white.rounded-xl").filter({ hasText: /top tours/i });
  }

  get customerInsightsSection(): Locator {
    return this.page.locator(".bg-white.rounded-xl").filter({ hasText: /customer insights/i });
  }

  get equipmentUtilizationSection(): Locator {
    return this.page.locator(".bg-white.rounded-xl").filter({ hasText: /equipment utilization/i });
  }

  // Customer Stats Cards
  get totalCustomersCard(): Locator {
    return this.page.locator(".bg-blue-50").filter({ hasText: /total customers/i });
  }

  get newThisMonthCard(): Locator {
    // Label changes based on selected date range (e.g., "New Today", "New This Week", "New This Month")
    return this.page.locator(".bg-green-50").filter({ hasText: /new /i });
  }

  get repeatCustomersCard(): Locator {
    return this.page.locator(".bg-purple-50").filter({ hasText: /repeat customers/i });
  }

  get avgBookingsPerCustomerCard(): Locator {
    return this.page.locator(".bg-orange-50").filter({ hasText: /avg bookings/i });
  }

  // Premium Gate / Upgrade Prompts
  get premiumOverlay(): Locator {
    return this.page.locator(".bg-gray-900\\/60, [class*='backdrop-blur']");
  }

  get upgradeButton(): Locator {
    return this.page.getByRole("link", { name: /upgrade/i });
  }

  get premiumFeatureText(): Locator {
    return this.page.getByText(/premium feature/i);
  }

  // Navigation Links
  get viewAllToursLink(): Locator {
    return this.page.getByRole("link", { name: /view all tours/i });
  }

  get viewAllCustomersLink(): Locator {
    return this.page.getByRole("link", { name: /view all customers/i });
  }

  get viewAllEquipmentLink(): Locator {
    return this.page.getByRole("link", { name: /view all equipment/i });
  }

  // Empty State
  get noDataMessage(): Locator {
    return this.page.getByText(/no .* data available/i);
  }

  // ==========================================
  // Navigation
  // ==========================================

  async goto(): Promise<void> {
    await this.gotoApp("/reports");
  }

  async gotoWithLogin(): Promise<void> {
    await this.goto();
    // Handle potential login redirect
    if (this.page.url().includes("/login")) {
      await this.page.getByLabel(/email/i).fill("owner@demo.com");
      await this.page.getByLabel(/password/i).fill("demo123");
      await this.page.getByRole("button", { name: /sign in/i }).click();
      await this.page.waitForURL(/\/app\/reports/);
    }
  }

  // ==========================================
  // Assertions
  // ==========================================

  async expectReportsPage(): Promise<void> {
    await expect(this.pageHeading).toBeVisible();
  }

  async expectDateRangeIndicator(): Promise<void> {
    await expect(this.dateRangeIndicator).toBeVisible();
  }

  async expectRevenueOverviewCards(): Promise<void> {
    await expect(this.thisMonthCard).toBeVisible();
    await expect(this.lastMonthCard).toBeVisible();
    await expect(this.yearToDateCard).toBeVisible();
    await expect(this.avgBookingValueCard).toBeVisible();
  }

  async expectCustomerInsightsSection(): Promise<void> {
    await expect(this.customerInsightsSection).toBeVisible();
    await expect(this.totalCustomersCard).toBeVisible();
    await expect(this.newThisMonthCard).toBeVisible();
  }

  async expectPremiumGateOverlay(): Promise<void> {
    await expect(this.premiumOverlay.first()).toBeVisible();
    await expect(this.upgradeButton.first()).toBeVisible();
  }

  async expectNoPremiumGate(): Promise<void> {
    await expect(this.premiumFeatureText).not.toBeVisible();
  }

  // ==========================================
  // Value Getters
  // ==========================================

  async getThisMonthRevenue(): Promise<string> {
    const valueElement = this.thisMonthCard.locator("p.text-2xl.font-bold");
    return (await valueElement.textContent()) || "";
  }

  async getLastMonthRevenue(): Promise<string> {
    const valueElement = this.lastMonthCard.locator("p.text-2xl.font-bold");
    return (await valueElement.textContent()) || "";
  }

  async getYearToDateRevenue(): Promise<string> {
    const valueElement = this.yearToDateCard.locator("p.text-2xl.font-bold");
    return (await valueElement.textContent()) || "";
  }

  async getAvgBookingValue(): Promise<string> {
    const valueElement = this.avgBookingValueCard.locator("p.text-2xl.font-bold");
    return (await valueElement.textContent()) || "";
  }

  async getChangePercent(): Promise<string> {
    const changeElement = this.thisMonthCard.locator("p.text-sm").filter({ hasText: /%/ });
    return (await changeElement.textContent()) || "";
  }

  async getTotalCustomers(): Promise<string> {
    const valueElement = this.totalCustomersCard.locator("p.text-2xl.font-bold");
    return (await valueElement.textContent()) || "";
  }

  async getNewCustomersThisMonth(): Promise<string> {
    const valueElement = this.newThisMonthCard.locator("p.text-2xl.font-bold");
    return (await valueElement.textContent()) || "";
  }

  async getRepeatCustomers(): Promise<string> {
    const valueElement = this.repeatCustomersCard.locator("p.text-2xl.font-bold");
    return (await valueElement.textContent()) || "";
  }

  async getAvgBookingsPerCustomer(): Promise<string> {
    const valueElement = this.avgBookingsPerCustomerCard.locator("p.text-2xl.font-bold");
    return (await valueElement.textContent()) || "";
  }

  // ==========================================
  // Actions
  // ==========================================

  async clickUpgradeButton(): Promise<void> {
    await this.upgradeButton.first().click();
    await this.page.waitForURL(/\/settings\/billing/);
  }

  async clickViewAllTours(): Promise<void> {
    await this.viewAllToursLink.click();
    await this.page.waitForURL(/\/tours/);
  }

  async clickViewAllCustomers(): Promise<void> {
    await this.viewAllCustomersLink.click();
    await this.page.waitForURL(/\/customers/);
  }

  async clickViewAllEquipment(): Promise<void> {
    await this.viewAllEquipmentLink.click();
    await this.page.waitForURL(/\/equipment/);
  }

  // ==========================================
  // Premium Feature Checks
  // ==========================================

  async isPremiumFeatureGated(section: Locator): Promise<boolean> {
    const overlay = section.locator(".bg-gray-900\\/60, [class*='backdrop-blur']");
    return await overlay.isVisible({ timeout: 2000 }).catch(() => false);
  }

  async isRevenueTrendGated(): Promise<boolean> {
    return await this.isPremiumFeatureGated(this.revenueTrendSection);
  }

  async isBookingsByStatusGated(): Promise<boolean> {
    return await this.isPremiumFeatureGated(this.bookingsByStatusSection);
  }

  async isTopToursGated(): Promise<boolean> {
    return await this.isPremiumFeatureGated(this.topToursSection);
  }

  async isEquipmentUtilizationGated(): Promise<boolean> {
    return await this.isPremiumFeatureGated(this.equipmentUtilizationSection);
  }

  // ==========================================
  // Chart/Visualization Checks
  // ==========================================

  async hasRevenueChart(): Promise<boolean> {
    const chartBars = this.revenueTrendSection.locator(".bg-blue-500");
    return await chartBars.first().isVisible({ timeout: 2000 }).catch(() => false);
  }

  async hasStatusProgressBars(): Promise<boolean> {
    const progressBars = this.bookingsByStatusSection.locator(".rounded-full.h-2");
    return await progressBars.first().isVisible({ timeout: 2000 }).catch(() => false);
  }

  async hasEquipmentUtilizationTable(): Promise<boolean> {
    const table = this.equipmentUtilizationSection.locator("table");
    return await table.isVisible({ timeout: 2000 }).catch(() => false);
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  async parseCurrencyValue(currencyString: string): Promise<number> {
    // Parse "$1,234" or "$1,234.56" to number
    const cleaned = currencyString.replace(/[$,]/g, "");
    return parseFloat(cleaned) || 0;
  }

  async getAllMetricValues(): Promise<{
    thisMonth: string;
    lastMonth: string;
    yearToDate: string;
    avgBookingValue: string;
    totalCustomers: string;
    newThisMonth: string;
  }> {
    return {
      thisMonth: await this.getThisMonthRevenue(),
      lastMonth: await this.getLastMonthRevenue(),
      yearToDate: await this.getYearToDateRevenue(),
      avgBookingValue: await this.getAvgBookingValue(),
      totalCustomers: await this.getTotalCustomers(),
      newThisMonth: await this.getNewCustomersThisMonth(),
    };
  }

  async waitForMetricsToLoad(): Promise<void> {
    // Wait for at least one metric card to have a value
    await expect(this.thisMonthCard.locator("p.text-2xl.font-bold")).toBeVisible();
  }
}

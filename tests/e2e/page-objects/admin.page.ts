import { expect } from "@playwright/test";
import { AdminBasePage } from "./base.page";

/**
 * Admin Login Page Object
 */
export class AdminLoginPage extends AdminBasePage {
  async goto(): Promise<void> {
    await this.gotoAdmin("/login");
  }

  async login(password: string): Promise<void> {
    await this.fillByLabel(/password/i, password);
    await this.clickButton(/sign in/i);
  }

  async expectLoginForm(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /admin/i })).toBeVisible();
    await expect(this.page.getByLabel(/password/i)).toBeVisible();
    await expect(this.page.getByRole("button", { name: /sign in/i })).toBeVisible();
  }

  async expectError(): Promise<void> {
    await expect(this.page.getByText(/invalid password/i)).toBeVisible();
  }

  async expectLoadingState(): Promise<void> {
    await expect(this.page.getByRole("button", { name: /signing in/i })).toBeVisible();
  }
}

/**
 * Admin Dashboard Page Object
 */
export class AdminDashboardPage extends AdminBasePage {
  async goto(): Promise<void> {
    await this.gotoAdmin("/dashboard");
  }

  async expectDashboard(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /tenant/i })).toBeVisible();
  }

  async expectTenantTable(): Promise<void> {
    await expect(this.page.locator("table, [role='grid']")).toBeVisible();
  }

  async clickCreateTenant(): Promise<void> {
    await this.page.getByRole("link", { name: /create|new/i }).click();
  }

  async searchTenants(query: string): Promise<void> {
    await this.page.getByPlaceholder(/search/i).fill(query);
    await this.page.getByRole("button", { name: /search|filter/i }).click();
  }

  async clickTenantRow(subdomain: string): Promise<void> {
    await this.page.getByRole("row", { name: new RegExp(subdomain) }).click();
  }

  async getTenantCount(): Promise<number> {
    const rows = this.page.locator("table tbody tr, [role='row']");
    return await rows.count();
  }
}

/**
 * Admin Create Tenant Page Object
 */
export class AdminCreateTenantPage extends AdminBasePage {
  async goto(): Promise<void> {
    await this.gotoAdmin("/tenants/new");
  }

  async expectForm(): Promise<void> {
    await expect(this.page.getByLabel(/subdomain/i)).toBeVisible();
    await expect(this.page.getByLabel(/business name/i)).toBeVisible();
    await expect(this.page.getByLabel(/email/i)).toBeVisible();
  }

  async fillForm(data: {
    subdomain: string;
    businessName: string;
    email: string;
    phone?: string;
  }): Promise<void> {
    await this.page.getByLabel(/subdomain/i).fill(data.subdomain);
    await this.page.getByLabel(/business name/i).fill(data.businessName);
    await this.page.getByLabel(/email/i).fill(data.email);
    if (data.phone) {
      await this.page.getByLabel(/phone/i).fill(data.phone);
    }
  }

  async enableDemoData(): Promise<void> {
    await this.page.getByRole("checkbox", { name: /demo/i }).check();
  }

  async submit(): Promise<void> {
    await this.clickButton(/create/i);
  }

  async expectValidationError(): Promise<void> {
    await expect(this.page.getByText(/invalid|format|required/i)).toBeVisible();
  }

  async expectSuccess(): Promise<void> {
    await expect(this.page).toHaveURL(/\/dashboard/);
  }
}

/**
 * Admin Plans Page Object
 */
export class AdminPlansPage extends AdminBasePage {
  async goto(): Promise<void> {
    await this.gotoAdmin("/plans");
  }

  async expectPlansPage(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /plans/i })).toBeVisible();
  }

  async expectPlansList(): Promise<void> {
    await expect(this.page.locator("table, [class*='plan-card']")).toBeVisible();
  }

  async clickEditPlan(planName: string): Promise<void> {
    const planRow = this.page.locator("table tbody tr, [class*='plan-card']").filter({ hasText: planName });
    await planRow.getByRole("button", { name: /edit/i }).click();
  }
}

/**
 * Admin Tenant Detail Page Object
 */
export class AdminTenantDetailPage extends AdminBasePage {
  async goto(tenantId: string): Promise<void> {
    await this.gotoAdmin(`/tenants/${tenantId}`);
  }

  async expectTenantDetail(): Promise<void> {
    await expect(this.page.getByText(/subdomain|email|plan/i)).toBeVisible();
  }

  async updatePlan(planName: string): Promise<void> {
    await this.page.getByLabel(/plan/i).selectOption(planName);
    await this.clickButton(/save|update/i);
  }

  async suspendTenant(): Promise<void> {
    await this.clickButton(/suspend/i);
  }

  async activateTenant(): Promise<void> {
    await this.clickButton(/activate/i);
  }
}

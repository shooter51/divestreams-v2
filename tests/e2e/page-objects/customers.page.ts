import { expect } from "@playwright/test";
import { TenantBasePage } from "./base.page";

/**
 * Customers List Page Object
 */
export class CustomersPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("/customers");
  }

  async expectCustomersPage(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /customer/i })).toBeVisible();
  }

  async expectTable(): Promise<void> {
    await expect(this.page.locator("table")).toBeVisible();
  }

  async search(query: string): Promise<void> {
    await this.page.getByPlaceholder(/search/i).fill(query);
    await this.page.getByRole("button", { name: /search|filter/i }).click();
  }

  async clickNewCustomer(): Promise<void> {
    await this.page.getByRole("link", { name: /new customer|add customer/i }).click();
  }

  async clickCustomer(name: string): Promise<void> {
    await this.page.getByRole("link", { name: new RegExp(name, "i") }).click();
  }

  async getCustomerCount(): Promise<number> {
    const rows = this.page.locator("table tbody tr");
    return await rows.count();
  }
}

/**
 * Customer Detail Page Object
 */
export class CustomerDetailPage extends TenantBasePage {
  async goto(customerId: string): Promise<void> {
    await this.gotoApp(`/customers/${customerId}`);
  }

  async expectCustomerDetail(): Promise<void> {
    await expect(this.page.getByText(/email|phone|certification/i)).toBeVisible();
  }

  async expectContactInfo(): Promise<void> {
    await expect(this.page.getByText(/email/i)).toBeVisible();
    await expect(this.page.getByText(/phone/i)).toBeVisible();
  }

  async expectBookingHistory(): Promise<void> {
    await expect(this.page.getByText(/booking|history/i)).toBeVisible();
  }

  async editCustomer(): Promise<void> {
    await this.page.getByRole("link", { name: /edit/i }).click();
  }

  async deleteCustomer(): Promise<void> {
    await this.page.getByRole("button", { name: /delete/i }).click();
    await this.page.getByRole("button", { name: /confirm/i }).click();
  }
}

/**
 * New Customer Page Object
 */
export class NewCustomerPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("/customers/new");
  }

  async expectForm(): Promise<void> {
    await expect(this.page.getByLabel(/first name/i)).toBeVisible();
    await expect(this.page.getByLabel(/last name/i)).toBeVisible();
    await expect(this.page.getByLabel(/email/i)).toBeVisible();
  }

  async fillForm(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  }): Promise<void> {
    await this.page.getByLabel(/first name/i).fill(data.firstName);
    await this.page.getByLabel(/last name/i).fill(data.lastName);
    await this.page.getByLabel(/email/i).fill(data.email);
    if (data.phone) {
      await this.page.getByLabel(/phone/i).fill(data.phone);
    }
  }

  async submit(): Promise<void> {
    await this.page.getByRole("button", { name: /save|create/i }).click();
  }

  async expectSuccess(): Promise<void> {
    await expect(this.page).toHaveURL(/\/customers/);
  }

  async expectValidationError(): Promise<void> {
    await expect(this.page.getByText(/required|invalid/i)).toBeVisible();
  }
}

/**
 * Edit Customer Page Object
 */
export class EditCustomerPage extends TenantBasePage {
  async goto(customerId: string): Promise<void> {
    await this.gotoApp(`/customers/${customerId}/edit`);
  }

  async expectForm(): Promise<void> {
    await expect(this.page.getByLabel(/first name/i)).toBeVisible();
    await expect(this.page.getByRole("button", { name: /save|update/i })).toBeVisible();
  }

  async updateEmail(email: string): Promise<void> {
    await this.page.getByLabel(/email/i).fill(email);
  }

  async updatePhone(phone: string): Promise<void> {
    await this.page.getByLabel(/phone/i).fill(phone);
  }

  async save(): Promise<void> {
    await this.page.getByRole("button", { name: /save|update/i }).click();
  }

  async expectSaveSuccess(): Promise<void> {
    await expect(this.page.getByText(/saved|updated/i)).toBeVisible();
  }
}

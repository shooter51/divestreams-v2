import { expect } from "@playwright/test";
import { TenantBasePage } from "./base.page";

/**
 * Equipment List Page Object
 */
export class EquipmentPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("/equipment");
  }

  async expectEquipmentPage(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /equipment/i })).toBeVisible();
  }

  async expectEquipmentList(): Promise<void> {
    await expect(this.page.locator("table, [class*='equipment-list'], [class*='grid']")).toBeVisible();
  }

  async filterByCategory(category: string): Promise<void> {
    await this.page.getByLabel(/category/i).selectOption(category);
    await this.page.getByRole("button", { name: /filter/i }).click();
  }

  async search(query: string): Promise<void> {
    await this.page.getByPlaceholder(/search/i).fill(query);
    await this.page.getByRole("button", { name: /search|filter/i }).click();
  }

  async clickNewEquipment(): Promise<void> {
    await this.page.getByRole("link", { name: /new equipment|add equipment/i }).click();
  }

  async clickEquipment(name: string): Promise<void> {
    await this.page.getByRole("link", { name: new RegExp(name, "i") }).click();
  }
}

/**
 * Equipment Detail Page Object
 */
export class EquipmentDetailPage extends TenantBasePage {
  async goto(equipmentId: string): Promise<void> {
    await this.gotoApp(`/equipment/${equipmentId}`);
  }

  async expectEquipmentDetail(): Promise<void> {
    await expect(this.page.getByText(/category|size|rental price/i)).toBeVisible();
  }

  async expectAvailability(): Promise<void> {
    await expect(this.page.getByText(/available|rented|maintenance/i)).toBeVisible();
  }

  async editEquipment(): Promise<void> {
    await this.page.getByRole("link", { name: /edit/i }).click();
  }

  async markAsMaintenance(): Promise<void> {
    await this.page.getByRole("button", { name: /maintenance/i }).click();
  }

  async markAsAvailable(): Promise<void> {
    await this.page.getByRole("button", { name: /available/i }).click();
  }
}

/**
 * New Equipment Page Object
 */
export class NewEquipmentPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("/equipment/new");
  }

  async expectForm(): Promise<void> {
    await expect(this.page.getByLabel(/name/i)).toBeVisible();
    await expect(this.page.getByLabel(/category/i)).toBeVisible();
  }

  async fillForm(data: {
    name: string;
    category: string;
    size?: string;
    rentalPrice?: number;
    quantity?: number;
  }): Promise<void> {
    await this.page.getByLabel(/name/i).fill(data.name);
    await this.page.getByLabel(/category/i).selectOption(data.category);
    if (data.size) {
      await this.page.getByLabel(/size/i).fill(data.size);
    }
    if (data.rentalPrice) {
      await this.page.getByLabel(/rental price/i).fill(data.rentalPrice.toString());
    }
    if (data.quantity) {
      await this.page.getByLabel(/quantity/i).fill(data.quantity.toString());
    }
  }

  async submit(): Promise<void> {
    await this.page.getByRole("button", { name: /save|create/i }).click();
  }

  async expectSuccess(): Promise<void> {
    await expect(this.page).toHaveURL(/\/equipment/);
  }
}

/**
 * Edit Equipment Page Object
 */
export class EditEquipmentPage extends TenantBasePage {
  async goto(equipmentId: string): Promise<void> {
    await this.gotoApp(`/equipment/${equipmentId}/edit`);
  }

  async expectForm(): Promise<void> {
    await expect(this.page.getByLabel(/name/i)).toBeVisible();
    await expect(this.page.getByRole("button", { name: /save|update/i })).toBeVisible();
  }

  async updateRentalPrice(price: number): Promise<void> {
    await this.page.getByLabel(/rental price/i).fill(price.toString());
  }

  async updateQuantity(quantity: number): Promise<void> {
    await this.page.getByLabel(/quantity/i).fill(quantity.toString());
  }

  async save(): Promise<void> {
    await this.page.getByRole("button", { name: /save|update/i }).click();
  }

  async expectSaveSuccess(): Promise<void> {
    await expect(this.page.getByText(/saved|updated/i)).toBeVisible();
  }
}

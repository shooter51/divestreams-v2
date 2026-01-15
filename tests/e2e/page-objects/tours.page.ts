import { expect } from "@playwright/test";
import { TenantBasePage } from "./base.page";

/**
 * Tours List Page Object
 */
export class ToursPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("/tours");
  }

  async expectToursPage(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /tour/i })).toBeVisible();
  }

  async expectTourList(): Promise<void> {
    await expect(this.page.locator("table, [class*='card'], [class*='grid']")).toBeVisible();
  }

  async expectPrices(): Promise<void> {
    await expect(this.page.getByText(/\$/)).toBeVisible();
  }

  async clickNewTour(): Promise<void> {
    await this.page.getByRole("link", { name: /new tour|add tour/i }).click();
  }

  async clickTour(tourName: string): Promise<void> {
    await this.page.getByRole("link", { name: new RegExp(tourName, "i") }).click();
  }

  async toggleTourActive(tourName: string): Promise<void> {
    const tourRow = this.page.locator("table tbody tr").filter({ hasText: tourName });
    const toggle = tourRow.locator('input[type="checkbox"], button[aria-label*="active"]');
    await toggle.click();
  }
}

/**
 * Tour Detail Page Object
 */
export class TourDetailPage extends TenantBasePage {
  async goto(tourId: string): Promise<void> {
    await this.gotoApp(`/tours/${tourId}`);
  }

  async expectTourDetail(): Promise<void> {
    await expect(this.page.getByText(/trip|schedule|date/i)).toBeVisible();
  }

  async expectTourInfo(): Promise<void> {
    await expect(this.page.getByText(/price|duration|description/i)).toBeVisible();
  }

  async expectTripsSection(): Promise<void> {
    await expect(this.page.getByText(/trips|scheduled/i)).toBeVisible();
  }

  async editTour(): Promise<void> {
    await this.page.getByRole("link", { name: /edit/i }).click();
  }

  async createTrip(): Promise<void> {
    await this.page.getByRole("link", { name: /add trip|new trip|schedule/i }).click();
  }
}

/**
 * New Tour Page Object
 */
export class NewTourPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("/tours/new");
  }

  async expectForm(): Promise<void> {
    await expect(this.page.getByLabel(/name/i)).toBeVisible();
    await expect(this.page.getByLabel(/price/i)).toBeVisible();
  }

  async fillForm(data: {
    name: string;
    description?: string;
    price: number;
    duration?: string;
    maxParticipants?: number;
  }): Promise<void> {
    await this.page.getByLabel(/name/i).fill(data.name);
    if (data.description) {
      await this.page.getByLabel(/description/i).fill(data.description);
    }
    await this.page.getByLabel(/price/i).fill(data.price.toString());
    if (data.duration) {
      await this.page.getByLabel(/duration/i).fill(data.duration);
    }
    if (data.maxParticipants) {
      await this.page.getByLabel(/max participants/i).fill(data.maxParticipants.toString());
    }
  }

  async submit(): Promise<void> {
    await this.page.getByRole("button", { name: /save|create/i }).click();
  }

  async expectSuccess(): Promise<void> {
    await expect(this.page).toHaveURL(/\/tours/);
  }
}

/**
 * Edit Tour Page Object
 */
export class EditTourPage extends TenantBasePage {
  async goto(tourId: string): Promise<void> {
    await this.gotoApp(`/tours/${tourId}/edit`);
  }

  async expectForm(): Promise<void> {
    await expect(this.page.getByLabel(/name/i)).toBeVisible();
    await expect(this.page.getByRole("button", { name: /save|update/i })).toBeVisible();
  }

  async updatePrice(price: number): Promise<void> {
    await this.page.getByLabel(/price/i).fill(price.toString());
  }

  async updateDescription(description: string): Promise<void> {
    await this.page.getByLabel(/description/i).fill(description);
  }

  async save(): Promise<void> {
    await this.page.getByRole("button", { name: /save|update/i }).click();
  }

  async expectSaveSuccess(): Promise<void> {
    await expect(this.page.getByText(/saved|updated/i)).toBeVisible();
  }
}

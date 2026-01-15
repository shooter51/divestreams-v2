import { expect } from "@playwright/test";
import { TenantBasePage } from "./base.page";

/**
 * Trips List Page Object
 */
export class TripsPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("/trips");
  }

  async expectTripsPage(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /trip/i })).toBeVisible();
  }

  async expectTripList(): Promise<void> {
    await expect(this.page.locator("table, [class*='trip-list']")).toBeVisible();
  }

  async filterByDate(date: string): Promise<void> {
    await this.page.getByLabel(/date/i).fill(date);
    await this.page.getByRole("button", { name: /filter/i }).click();
  }

  async filterByStatus(status: string): Promise<void> {
    await this.page.getByLabel(/status/i).selectOption(status);
    await this.page.getByRole("button", { name: /filter/i }).click();
  }

  async clickNewTrip(): Promise<void> {
    await this.page.getByRole("link", { name: /new trip|add trip/i }).click();
  }

  async clickTrip(tripId: string): Promise<void> {
    await this.page.getByRole("link", { name: new RegExp(tripId) }).click();
  }
}

/**
 * Trip Detail Page Object
 */
export class TripDetailPage extends TenantBasePage {
  async goto(tripId: string): Promise<void> {
    await this.gotoApp(`/trips/${tripId}`);
  }

  async expectTripDetail(): Promise<void> {
    await expect(this.page.getByText(/date|time|participants/i)).toBeVisible();
  }

  async expectTourInfo(): Promise<void> {
    await expect(this.page.getByText(/tour/i)).toBeVisible();
  }

  async expectBookingsList(): Promise<void> {
    await expect(this.page.getByText(/bookings|participants/i)).toBeVisible();
  }

  async editTrip(): Promise<void> {
    await this.page.getByRole("link", { name: /edit/i }).click();
  }

  async cancelTrip(): Promise<void> {
    await this.page.getByRole("button", { name: /cancel trip/i }).click();
    await this.page.getByRole("button", { name: /confirm/i }).click();
  }

  async getParticipantCount(): Promise<string> {
    const participantsElement = this.page.locator('[class*="participants"], [data-testid="participants"]');
    return (await participantsElement.textContent()) || "0";
  }
}

/**
 * New Trip Page Object
 */
export class NewTripPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("/trips/new");
  }

  async expectForm(): Promise<void> {
    await expect(this.page.getByLabel(/tour/i)).toBeVisible();
    await expect(this.page.getByLabel(/date/i)).toBeVisible();
  }

  async selectTour(tourName: string): Promise<void> {
    await this.page.getByLabel(/tour/i).click();
    await this.page.getByText(tourName).click();
  }

  async setDate(date: string): Promise<void> {
    await this.page.getByLabel(/date/i).fill(date);
  }

  async setTime(time: string): Promise<void> {
    await this.page.getByLabel(/time/i).fill(time);
  }

  async setMaxParticipants(count: number): Promise<void> {
    await this.page.getByLabel(/max participants/i).fill(count.toString());
  }

  async selectBoat(boatName: string): Promise<void> {
    await this.page.getByLabel(/boat/i).selectOption(boatName);
  }

  async submit(): Promise<void> {
    await this.page.getByRole("button", { name: /save|create/i }).click();
  }

  async expectSuccess(): Promise<void> {
    await expect(this.page).toHaveURL(/\/trips/);
  }
}

/**
 * Edit Trip Page Object
 */
export class EditTripPage extends TenantBasePage {
  async goto(tripId: string): Promise<void> {
    await this.gotoApp(`/trips/${tripId}/edit`);
  }

  async expectForm(): Promise<void> {
    await expect(this.page.getByLabel(/date/i)).toBeVisible();
    await expect(this.page.getByRole("button", { name: /save|update/i })).toBeVisible();
  }

  async updateDate(date: string): Promise<void> {
    await this.page.getByLabel(/date/i).fill(date);
  }

  async updateTime(time: string): Promise<void> {
    await this.page.getByLabel(/time/i).fill(time);
  }

  async updateMaxParticipants(count: number): Promise<void> {
    await this.page.getByLabel(/max participants/i).fill(count.toString());
  }

  async changeStatus(status: string): Promise<void> {
    await this.page.getByLabel(/status/i).selectOption(status);
  }

  async save(): Promise<void> {
    await this.page.getByRole("button", { name: /save|update/i }).click();
  }

  async expectSaveSuccess(): Promise<void> {
    await expect(this.page.getByText(/saved|updated/i)).toBeVisible();
  }
}

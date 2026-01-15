import { expect } from "@playwright/test";
import { TenantBasePage } from "./base.page";

/**
 * Bookings List Page Object
 */
export class BookingsPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("/bookings");
  }

  async expectBookingsPage(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /booking/i })).toBeVisible();
  }

  async expectStats(): Promise<void> {
    await expect(this.page.getByText(/today|upcoming|pending/i)).toBeVisible();
  }

  async filterByStatus(status: string): Promise<void> {
    await this.page.getByRole("combobox", { name: /status/i }).selectOption(status);
    await this.page.getByRole("button", { name: /filter/i }).click();
  }

  async search(query: string): Promise<void> {
    await this.page.getByPlaceholder(/search/i).fill(query);
    await this.page.getByRole("button", { name: /filter/i }).click();
  }

  async clickNewBooking(): Promise<void> {
    await this.page.getByRole("link", { name: /new booking/i }).click();
  }

  async clickBooking(bookingRef: string): Promise<void> {
    await this.page.getByRole("link", { name: new RegExp(bookingRef) }).click();
  }

  async expectStatusBadges(): Promise<void> {
    await expect(
      this.page.locator(".bg-green-100, .bg-yellow-100, .bg-red-100, [class*='status']")
    ).toBeVisible();
  }

  async goToNextPage(): Promise<void> {
    await this.page.getByRole("button", { name: /next|>/i }).click();
  }

  async expectPagination(): Promise<void> {
    await expect(this.page.getByRole("button", { name: /next|prev|>/i })).toBeVisible();
  }
}

/**
 * Booking Detail Page Object
 */
export class BookingDetailPage extends TenantBasePage {
  async goto(bookingId: string): Promise<void> {
    await this.gotoApp(`/bookings/${bookingId}`);
  }

  async expectBookingDetail(): Promise<void> {
    await expect(this.page.getByText(/customer|trip|total/i)).toBeVisible();
  }

  async expectCustomerInfo(): Promise<void> {
    await expect(this.page.getByText(/customer/i)).toBeVisible();
  }

  async expectTripInfo(): Promise<void> {
    await expect(this.page.getByText(/trip|tour/i)).toBeVisible();
  }

  async expectPaymentInfo(): Promise<void> {
    await expect(this.page.getByText(/payment|total|paid/i)).toBeVisible();
  }

  async cancelBooking(): Promise<void> {
    await this.page.getByRole("button", { name: /cancel/i }).click();
    await this.page.getByRole("button", { name: /confirm/i }).click();
  }

  async editBooking(): Promise<void> {
    await this.page.getByRole("link", { name: /edit/i }).click();
  }

  async addPayment(amount: number): Promise<void> {
    await this.page.getByRole("button", { name: /add payment/i }).click();
    await this.page.getByLabel(/amount/i).fill(amount.toString());
    await this.page.getByRole("button", { name: /save|submit/i }).click();
  }
}

/**
 * New Booking Page Object
 */
export class NewBookingPage extends TenantBasePage {
  async goto(): Promise<void> {
    await this.gotoApp("/bookings/new");
  }

  async expectForm(): Promise<void> {
    await expect(this.page.getByLabel(/customer/i)).toBeVisible();
    await expect(this.page.getByLabel(/trip/i)).toBeVisible();
  }

  async selectCustomer(customerName: string): Promise<void> {
    await this.page.getByLabel(/customer/i).click();
    await this.page.getByText(customerName).click();
  }

  async selectTrip(tripName: string): Promise<void> {
    await this.page.getByLabel(/trip/i).click();
    await this.page.getByText(tripName).click();
  }

  async setParticipants(count: number): Promise<void> {
    await this.page.getByLabel(/participants/i).fill(count.toString());
  }

  async addNotes(notes: string): Promise<void> {
    await this.page.getByLabel(/notes/i).fill(notes);
  }

  async submit(): Promise<void> {
    await this.page.getByRole("button", { name: /create|save/i }).click();
  }

  async expectSuccess(): Promise<void> {
    await expect(this.page).toHaveURL(/\/bookings\/\d+|\/bookings$/);
  }
}

/**
 * Edit Booking Page Object
 */
export class EditBookingPage extends TenantBasePage {
  async goto(bookingId: string): Promise<void> {
    await this.gotoApp(`/bookings/${bookingId}/edit`);
  }

  async expectForm(): Promise<void> {
    await expect(this.page.getByRole("button", { name: /save|update/i })).toBeVisible();
  }

  async updateParticipants(count: number): Promise<void> {
    await this.page.getByLabel(/participants/i).fill(count.toString());
  }

  async updateNotes(notes: string): Promise<void> {
    await this.page.getByLabel(/notes/i).fill(notes);
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

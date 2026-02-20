import { expect, type Locator } from "@playwright/test";
import { TenantBasePage } from "./base.page";

/**
 * Point of Sale Page Object
 *
 * Comprehensive page object for testing POS cart functionality including
 * retail products, rentals, trips/bookings, and checkout flows.
 */
export class POSPage extends TenantBasePage {
  // Locators for commonly used elements
  private get cartContainer(): Locator {
    return this.page.locator(".w-96, [class*='cart']").first();
  }

  private get productGrid(): Locator {
    return this.page.locator(".grid");
  }

  async goto(): Promise<void> {
    await this.gotoApp("/pos");
  }

  async expectPOSInterface(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: /point of sale/i })).toBeVisible();
    // Check for main sections
    await expect(this.page.getByRole("button", { name: /new sale/i })).toBeVisible();
    await expect(this.page.getByRole("button", { name: /scan barcode/i })).toBeVisible();
  }

  // ============================================
  // Tab Navigation
  // ============================================

  async selectTab(tab: "retail" | "rentals" | "trips"): Promise<void> {
    await this.page.getByRole("button", { name: new RegExp(`^${tab}$`, "i") }).click();
    // Wait for tab content to load
    await this.page.waitForLoadState("domcontentloaded");
  }

  async expectTabActive(tab: "retail" | "rentals" | "trips"): Promise<void> {
    const tabButton = this.page.getByRole("button", { name: new RegExp(`^${tab}$`, "i") });
    // Active tabs use semantic tokens: bg-surface-raised and text-brand
    await expect(tabButton).toHaveClass(/bg-surface-raised.*text-brand/);
  }

  // ============================================
  // Product Interactions (Retail Tab)
  // ============================================

  async addProductToCart(productName: string): Promise<void> {
    const productCard = this.productGrid.locator("button").filter({ hasText: productName });
    await productCard.click();
  }

  async addProductByIndex(index: number): Promise<void> {
    const productCards = this.productGrid.locator("button");
    await productCards.nth(index).click();
  }

  async getProductCardInfo(productName: string): Promise<{ name: string; price: string; stock: string }> {
    const productCard = this.productGrid.locator("button").filter({ hasText: productName });
    const name = await productCard.locator("p.font-medium").textContent() || "";
    const price = await productCard.locator(".text-blue-600, .text-red-600").textContent() || "";
    const stock = await productCard.locator(".text-xs.text-gray-500").textContent() || "";
    return { name: name.trim(), price: price.trim(), stock: stock.trim() };
  }

  async searchProducts(query: string): Promise<void> {
    await this.page.getByPlaceholder(/search/i).fill(query);
    // Wait for filter to apply (debounced input)
    await this.page.waitForLoadState("domcontentloaded");
  }

  async clearProductSearch(): Promise<void> {
    await this.page.getByPlaceholder(/search/i).clear();
  }

  async selectCategory(category: string): Promise<void> {
    await this.page.getByRole("button", { name: new RegExp(`^${category}$`, "i") }).click();
  }

  async selectAllCategories(): Promise<void> {
    await this.page.getByRole("button", { name: /^all$/i }).click();
  }

  async getVisibleProductCount(): Promise<number> {
    return await this.productGrid.locator("button").count();
  }

  // ============================================
  // Equipment Rental Interactions (Rentals Tab)
  // ============================================

  async addRentalToCart(equipmentName: string, days: number = 1): Promise<void> {
    // Find the rental card (use .first() to handle multiple items with same name)
    const rentalCard = this.productGrid.locator("div.p-4").filter({ hasText: equipmentName }).first();

    // Click "Add Rental" button
    await rentalCard.getByRole("button", { name: /add rental/i }).click();

    // Wait for days selector to appear (the Add $X.XX button)
    await rentalCard.getByRole("button", { name: /add \$/i }).waitFor({ state: "visible" });

    // Adjust days if needed (default is 1)
    if (days > 1) {
      for (let i = 1; i < days; i++) {
        await rentalCard.locator("button").filter({ hasText: "+" }).click();
      }
    }

    // Click the final "Add $X.XX" button
    await rentalCard.getByRole("button", { name: /add \$/i }).click();
  }

  async getRentalCardInfo(equipmentName: string): Promise<{ name: string; size?: string; dailyRate: string }> {
    const rentalCard = this.productGrid.locator("div.p-4").filter({ hasText: equipmentName }).first();
    const name = await rentalCard.locator("p.font-medium").textContent() || "";
    const sizeEl = rentalCard.locator("p.text-sm.text-gray-600");
    const size = (await sizeEl.isVisible()) ? (await sizeEl.textContent())?.replace("Size: ", "") : undefined;
    const dailyRate = await rentalCard.locator(".text-green-600").textContent() || "";
    return { name: name.trim(), size: size?.trim(), dailyRate: dailyRate.trim() };
  }

  // ============================================
  // Trip/Booking Interactions (Trips Tab)
  // ============================================

  async addTripToCart(tourName: string, participants: number = 1): Promise<void> {
    // Find the trip card (use .first() to handle multiple trips with same name)
    const tripCard = this.productGrid.locator("div.p-4").filter({ hasText: tourName }).first();

    // Click "Book Now" button
    await tripCard.getByRole("button", { name: /book now/i }).click();

    // Wait for participant selector to appear (the Add $X.XX button)
    await tripCard.getByRole("button", { name: /add \$/i }).waitFor({ state: "visible" });

    // Adjust participants if needed (default is 1)
    if (participants > 1) {
      for (let i = 1; i < participants; i++) {
        await tripCard.locator("button").filter({ hasText: "+" }).click();
      }
    }

    // Click the final "Add $X.XX" button
    await tripCard.getByRole("button", { name: /add \$/i }).click();
  }

  async getTripCardInfo(tourName: string): Promise<{ name: string; time: string; price: string; spotsLeft: string }> {
    const tripCard = this.productGrid.locator("div.p-4").filter({ hasText: tourName }).first();
    const name = await tripCard.locator("p.font-medium").textContent() || "";
    const time = await tripCard.locator("p.text-sm.text-gray-600").textContent() || "";
    const price = await tripCard.locator(".text-purple-600").textContent() || "";
    const spotsLeft = await tripCard.locator(".text-xs.text-gray-500").textContent() || "";
    return { name: name.trim(), time: time.trim(), price: price.trim(), spotsLeft: spotsLeft.trim() };
  }

  // ============================================
  // Cart Interactions
  // ============================================

  async expectCartEmpty(): Promise<void> {
    await expect(this.cartContainer.getByText(/cart is empty/i)).toBeVisible();
  }

  async expectCartNotEmpty(): Promise<void> {
    await expect(this.cartContainer.getByText(/cart is empty/i)).not.toBeVisible();
  }

  async expectCartItem(itemName: string): Promise<void> {
    await expect(this.cartContainer.getByText(itemName)).toBeVisible();
  }

  async expectCartItemNotPresent(itemName: string): Promise<void> {
    await expect(this.cartContainer.getByText(itemName)).not.toBeVisible();
  }

  async getCartItemCount(): Promise<number> {
    // Each cart item is in a div with bg-surface-inset class (semantic design token)
    return await this.cartContainer.locator(".bg-surface-inset").count();
  }

  async getCartItemByIndex(index: number): Promise<{
    name: string;
    details: string;
    total: string;
  }> {
    const cartItem = this.cartContainer.locator(".bg-surface-inset").nth(index);
    const name = await cartItem.locator("p.font-medium").first().textContent() || "";
    const details = await cartItem.locator("p.text-sm.text-foreground-muted").textContent() || "";
    const total = await cartItem.locator("p.font-medium").last().textContent() || "";
    return { name: name.trim(), details: details.trim(), total: total.trim() };
  }

  async getCartItemByName(itemName: string): Promise<{
    name: string;
    details: string;
    total: string;
  }> {
    const cartItem = this.cartContainer.locator(".bg-surface-inset").filter({ hasText: itemName });
    const name = await cartItem.locator("p.font-medium").first().textContent() || "";
    const details = await cartItem.locator("p.text-sm.text-foreground-muted").textContent() || "";
    const total = await cartItem.locator("p.font-medium").last().textContent() || "";
    return { name: name.trim(), details: details.trim(), total: total.trim() };
  }

  async increaseQuantity(itemIndex: number): Promise<void> {
    const cartItem = this.cartContainer.locator(".bg-surface-inset").nth(itemIndex);
    await cartItem.locator("button").filter({ hasText: "+" }).click();
  }

  async decreaseQuantity(itemIndex: number): Promise<void> {
    const cartItem = this.cartContainer.locator(".bg-surface-inset").nth(itemIndex);
    await cartItem.locator("button").filter({ hasText: "-" }).click();
  }

  async getItemQuantity(itemIndex: number): Promise<number> {
    const cartItem = this.cartContainer.locator(".bg-surface-inset").nth(itemIndex);
    const quantityText = await cartItem.locator(".w-6.text-center").textContent();
    return parseInt(quantityText || "0", 10);
  }

  async updateItemQuantity(index: number, quantity: number): Promise<void> {
    const cartItem = this.cartContainer.locator(".bg-surface-inset").nth(index);
    const currentQty = await this.getItemQuantity(index);

    if (quantity > currentQty) {
      for (let i = currentQty; i < quantity; i++) {
        await cartItem.locator("button").filter({ hasText: "+" }).click();
        // Wait for quantity display to update
        await expect(cartItem.locator(".w-6.text-center")).toContainText(String(i + 1));
      }
    } else if (quantity < currentQty) {
      for (let i = currentQty; i > quantity; i--) {
        await cartItem.locator("button").filter({ hasText: "-" }).click();
        // Wait for quantity display to update
        await expect(cartItem.locator(".w-6.text-center")).toContainText(String(i - 1));
      }
    }
  }

  async removeCartItem(index: number): Promise<void> {
    const cartItem = this.cartContainer.locator(".bg-surface-inset").nth(index);
    // The remove button has an X icon (SVG with path)
    await cartItem.locator("button.text-red-500").click();
  }

  async removeCartItemByName(itemName: string): Promise<void> {
    const cartItem = this.cartContainer.locator(".bg-surface-inset").filter({ hasText: itemName });
    await cartItem.locator("button.text-red-500").click();
  }

  async clearCart(): Promise<void> {
    await this.page.getByRole("button", { name: /new sale/i }).click();
  }

  // ============================================
  // Cart Totals
  // ============================================

  async getSubtotal(): Promise<string> {
    const subtotalRow = this.cartContainer.locator("div").filter({ hasText: /^Subtotal$/ }).first();
    const subtotal = await subtotalRow.locator("..").locator("span").last().textContent();
    return subtotal?.trim() || "$0.00";
  }

  async getTax(): Promise<string> {
    const taxRow = this.cartContainer.locator("div").filter({ hasText: /^Tax/ }).first();
    const tax = await taxRow.locator("..").locator("span").last().textContent();
    return tax?.trim() || "$0.00";
  }

  async getCartTotal(): Promise<string> {
    // The total is the last row with font-bold
    const totalRow = this.cartContainer.locator(".font-bold").filter({ hasText: /total/i });
    const total = await totalRow.locator("..").locator("span").last().textContent();
    return total?.trim() || "$0.00";
  }

  async expectCartTotal(expectedTotal: string): Promise<void> {
    const totalRow = this.cartContainer.locator(".font-bold").filter({ hasText: /total/i });
    await expect(totalRow.locator("..")).toContainText(expectedTotal);
  }

  // ============================================
  // Customer Selection
  // ============================================

  async openCustomerSearch(): Promise<void> {
    await this.cartContainer.getByRole("button", { name: /customer|add customer/i }).click();
  }

  async searchCustomer(query: string): Promise<void> {
    await this.page.getByPlaceholder(/search customer/i).fill(query);
    // Trigger search with Enter and wait for results
    await this.page.keyboard.press("Enter");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async selectCustomer(customerName: string): Promise<void> {
    await this.page.getByText(customerName).click();
  }

  async expectCustomerSelected(customerName: string): Promise<void> {
    await expect(this.cartContainer.locator(".bg-blue-50")).toContainText(customerName);
  }

  async clearSelectedCustomer(): Promise<void> {
    const customerCard = this.cartContainer.locator(".bg-blue-50");
    await customerCard.locator("button").click();
  }

  async expectCustomerRequired(): Promise<void> {
    await expect(this.cartContainer.getByText(/customer required/i)).toBeVisible();
  }

  // ============================================
  // Barcode Scanning
  // ============================================

  async openBarcodeScanner(): Promise<void> {
    await this.page.getByRole("button", { name: /scan barcode/i }).click();
  }

  async expectBarcodeScannerModal(): Promise<void> {
    await expect(this.page.getByText(/scan product barcode/i)).toBeVisible();
  }

  async closeBarcodeScanner(): Promise<void> {
    await this.page.getByRole("button", { name: /close|cancel/i }).first().click();
  }

  /**
   * Simulate barcode scan by triggering the scan action directly.
   * In real e2e tests with camera mocking, this would interact with the camera.
   * For now, we can test the barcode input if available or use the action endpoint.
   */
  async simulateBarcodeScan(barcode: string): Promise<void> {
    // Open scanner modal
    await this.openBarcodeScanner();
    await this.expectBarcodeScannerModal();

    // If there's a manual entry input, use it
    const manualInput = this.page.getByPlaceholder(/enter barcode|manual/i);
    if (await manualInput.isVisible({ timeout: 1000 })) {
      await manualInput.fill(barcode);
      await this.page.getByRole("button", { name: /submit|scan|add/i }).click();
    } else {
      // Close and use fetcher-based scan (would need to be implemented in the page)
      await this.closeBarcodeScanner();
    }
  }

  async expectBarcodeError(barcode: string): Promise<void> {
    await expect(this.page.getByText(new RegExp(`not found.*${barcode}|${barcode}.*not found`, "i"))).toBeVisible();
  }

  // ============================================
  // Checkout Flow
  // ============================================

  async startCheckout(method: "card" | "cash" | "split"): Promise<void> {
    const methodButton = this.cartContainer.getByRole("button", { name: new RegExp(`^${method}$`, "i") });
    await methodButton.click();
  }

  async expectCheckoutButtonsDisabled(): Promise<void> {
    const cardButton = this.cartContainer.getByRole("button", { name: /^card$/i });
    await expect(cardButton).toBeDisabled();
  }

  async expectCheckoutButtonsEnabled(): Promise<void> {
    const cardButton = this.cartContainer.getByRole("button", { name: /^card$/i });
    await expect(cardButton).toBeEnabled();
  }

  async expectCardModal(): Promise<void> {
    await expect(this.page.getByText(/card payment|process card/i)).toBeVisible();
  }

  async expectCashModal(): Promise<void> {
    await expect(this.page.getByText(/cash payment|cash received/i)).toBeVisible();
  }

  async expectSplitModal(): Promise<void> {
    await expect(this.page.getByText(/split payment/i)).toBeVisible();
  }

  async closeCheckoutModal(): Promise<void> {
    await this.page.getByRole("button", { name: /close|cancel/i }).first().click();
  }

  async completeCashPayment(amountTendered: number): Promise<void> {
    await this.page.getByLabel(/amount|tendered/i).fill(amountTendered.toString());
    await this.page.getByRole("button", { name: /complete|confirm/i }).click();
  }

  async expectSaleComplete(): Promise<void> {
    await expect(this.page.getByText(/sale complete|receipt/i)).toBeVisible();
  }

  async expectSuccessToast(): Promise<void> {
    await expect(this.page.locator(".bg-green-600")).toBeVisible();
  }

  // ============================================
  // Rental Agreement Flow
  // ============================================

  async addRentalDays(days: number): Promise<void> {
    await this.page.getByLabel(/days/i).fill(days.toString());
  }

  async expectRentalAgreementModal(): Promise<void> {
    await expect(this.page.getByText(/rental agreement/i)).toBeVisible();
  }

  async signRentalAgreement(staffName: string): Promise<void> {
    await this.page.getByLabel(/staff name|signature/i).fill(staffName);
    await this.page.getByRole("button", { name: /confirm|sign/i }).click();
  }

  async closeRentalAgreementModal(): Promise<void> {
    await this.page.getByRole("button", { name: /close|cancel/i }).first().click();
  }

  // ============================================
  // Navigation & Persistence
  // ============================================

  async navigateAway(): Promise<void> {
    await this.gotoApp("/dashboard");
    await this.page.waitForLoadState("load");
  }

  async navigateBack(): Promise<void> {
    await this.goto();
    await this.page.waitForLoadState("load");
  }

  // ============================================
  // Utility Methods
  // ============================================

  async waitForCartUpdate(): Promise<void> {
    // Wait for any pending network requests to complete
    await this.page.waitForLoadState("networkidle").catch(() => {
      // Network idle may not be reached in some cases, fall back to domcontentloaded
    });
    await this.page.waitForLoadState("domcontentloaded");
  }

  async expectNoProducts(): Promise<void> {
    await expect(this.page.getByText(/no products found/i)).toBeVisible();
  }

  async expectNoEquipment(): Promise<void> {
    await expect(this.page.getByText(/no equipment available/i)).toBeVisible();
  }

  async expectNoTrips(): Promise<void> {
    await expect(this.page.getByText(/no trips scheduled/i)).toBeVisible();
  }

  /**
   * Parse price string to number (e.g., "$29.99" -> 29.99)
   */
  parsePrice(priceString: string): number {
    return parseFloat(priceString.replace(/[^0-9.]/g, "")) || 0;
  }

  /**
   * Format number to price string (e.g., 29.99 -> "$29.99")
   */
  formatPrice(amount: number): string {
    return `$${amount.toFixed(2)}`;
  }
}

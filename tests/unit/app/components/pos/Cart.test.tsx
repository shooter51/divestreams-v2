/**
 * Cart Component Unit Tests
 *
 * Tests the POS Cart component including:
 * - Empty state rendering
 * - Product, rental, and booking item display
 * - Subtotal, tax, and total calculation
 * - Quantity update and remove item callbacks
 * - Customer section display and interactions
 * - Checkout button states and callbacks
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Cart } from "../../../../../app/components/pos/Cart";

// Minimal CartItem type (mirrors lib/validation/pos CartItem union)
type CartItem =
  | {
      type: "product";
      name: string;
      quantity: number;
      unitPrice: number;
      days: number;
      dailyRate: number;
      participants: number;
      total: number;
    }
  | {
      type: "rental";
      name: string;
      quantity: number;
      unitPrice: number;
      days: number;
      dailyRate: number;
      participants: number;
      total: number;
    }
  | {
      type: "booking";
      tourName: string;
      name?: string;
      quantity: number;
      unitPrice: number;
      days: number;
      dailyRate: number;
      participants: number;
      total: number;
    };

const baseProps = {
  items: [] as CartItem[],
  onUpdateQuantity: vi.fn(),
  onRemoveItem: vi.fn(),
  customer: null,
  onSelectCustomer: vi.fn(),
  onClearCustomer: vi.fn(),
  taxRate: 10,
  onCheckout: vi.fn(),
  requiresCustomer: false,
};

const mockCustomer = {
  id: "cust-001",
  firstName: "Alice",
  lastName: "Ocean",
  email: "alice@divelab.com",
};

const productItem: CartItem = {
  type: "product",
  name: "Dive Mask Pro",
  quantity: 2,
  unitPrice: 49.99,
  days: 0,
  dailyRate: 0,
  participants: 0,
  total: 99.98,
};

const rentalItem: CartItem = {
  type: "rental",
  name: "BCD Jacket",
  quantity: 1,
  unitPrice: 0,
  days: 3,
  dailyRate: 25.0,
  participants: 0,
  total: 75.0,
};

const bookingItem: CartItem = {
  type: "booking",
  tourName: "Great Barrier Reef Dive",
  quantity: 1,
  unitPrice: 120.0,
  days: 0,
  dailyRate: 0,
  participants: 2,
  total: 240.0,
};

describe("Cart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  describe("empty state", () => {
    it("renders 'Cart is empty' when no items are provided", () => {
      render(<Cart {...baseProps} items={[]} />);
      expect(screen.getByText("Cart is empty")).toBeInTheDocument();
    });

    it("renders the Cart heading", () => {
      render(<Cart {...baseProps} items={[]} />);
      expect(screen.getByText("Cart")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Product items
  // ---------------------------------------------------------------------------
  describe("product items", () => {
    it("renders product item name", () => {
      render(<Cart {...baseProps} items={[productItem]} />);
      expect(screen.getByText("Dive Mask Pro")).toBeInTheDocument();
    });

    it("renders product item quantity × unit price detail", () => {
      render(<Cart {...baseProps} items={[productItem]} />);
      expect(screen.getByText("2 × $49.99")).toBeInTheDocument();
    });

    it("renders product item total", () => {
      render(<Cart {...baseProps} items={[productItem]} />);
      // $99.98 appears in the item row AND as the subtotal – both are correct
      const matches = screen.getAllByText("$99.98");
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it("shows quantity decrease and increase buttons for product items", () => {
      render(<Cart {...baseProps} items={[productItem]} />);
      expect(screen.getByLabelText("Decrease quantity")).toBeInTheDocument();
      expect(screen.getByLabelText("Increase quantity")).toBeInTheDocument();
    });

    it("decrease quantity button is disabled when quantity is 1", () => {
      const singleQtyItem: CartItem = { ...productItem, quantity: 1, total: 49.99 };
      render(<Cart {...baseProps} items={[singleQtyItem]} />);
      expect(screen.getByLabelText("Decrease quantity")).toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // Rental items
  // ---------------------------------------------------------------------------
  describe("rental items", () => {
    it("renders rental item name", () => {
      render(<Cart {...baseProps} items={[rentalItem]} />);
      expect(screen.getByText("BCD Jacket")).toBeInTheDocument();
    });

    it("renders rental days × daily rate detail", () => {
      render(<Cart {...baseProps} items={[rentalItem]} />);
      expect(screen.getByText("3 days × $25.00/day")).toBeInTheDocument();
    });

    it("renders singular 'day' for 1-day rentals", () => {
      const oneDayRental: CartItem = { ...rentalItem, days: 1, total: 25.0 };
      render(<Cart {...baseProps} items={[oneDayRental]} />);
      expect(screen.getByText("1 day × $25.00/day")).toBeInTheDocument();
    });

    it("renders rental total", () => {
      render(<Cart {...baseProps} items={[rentalItem]} />);
      // $75.00 appears in the item row AND as the subtotal – both are correct
      const matches = screen.getAllByText("$75.00");
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Booking items
  // ---------------------------------------------------------------------------
  describe("booking items", () => {
    it("renders booking tour name", () => {
      render(<Cart {...baseProps} items={[bookingItem]} />);
      expect(screen.getByText("Great Barrier Reef Dive")).toBeInTheDocument();
    });

    it("renders booking participants × price detail", () => {
      render(<Cart {...baseProps} items={[bookingItem]} />);
      expect(screen.getByText("2 participants × $120.00")).toBeInTheDocument();
    });

    it("renders singular 'participant' for 1-participant bookings", () => {
      const soloBooking: CartItem = { ...bookingItem, participants: 1, total: 120.0 };
      render(<Cart {...baseProps} items={[soloBooking]} />);
      expect(screen.getByText("1 participant × $120.00")).toBeInTheDocument();
    });

    it("renders booking total", () => {
      render(<Cart {...baseProps} items={[bookingItem]} />);
      // $240.00 appears in the item row AND as the subtotal – both are correct
      const matches = screen.getAllByText("$240.00");
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Totals calculation
  // ---------------------------------------------------------------------------
  describe("totals calculation", () => {
    it("calculates subtotal correctly from item totals", () => {
      // productItem.total = 99.98, rentalItem.total = 75.00  => subtotal = 174.98
      render(<Cart {...baseProps} items={[productItem, rentalItem]} taxRate={10} />);
      expect(screen.getByText("$174.98")).toBeInTheDocument();
    });

    it("calculates tax correctly at given tax rate", () => {
      // subtotal = 174.98, tax 10% = 17.498 => $17.50
      render(<Cart {...baseProps} items={[productItem, rentalItem]} taxRate={10} />);
      expect(screen.getByText("Tax (10%)")).toBeInTheDocument();
      expect(screen.getByText("$17.50")).toBeInTheDocument();
    });

    it("calculates total (subtotal + tax) correctly", () => {
      // 174.98 + 17.50 = 192.48
      render(<Cart {...baseProps} items={[productItem, rentalItem]} taxRate={10} />);
      expect(screen.getByText("$192.48")).toBeInTheDocument();
    });

    it("shows $0.00 subtotal, tax, and total for empty cart", () => {
      render(<Cart {...baseProps} items={[]} taxRate={10} />);
      const zeros = screen.getAllByText("$0.00");
      // subtotal, tax, total all 0
      expect(zeros.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Quantity buttons
  // ---------------------------------------------------------------------------
  describe("quantity buttons", () => {
    it("calls onUpdateQuantity with incremented value when increase button clicked", () => {
      const onUpdateQuantity = vi.fn();
      render(<Cart {...baseProps} items={[productItem]} onUpdateQuantity={onUpdateQuantity} />);
      fireEvent.click(screen.getByLabelText("Increase quantity"));
      expect(onUpdateQuantity).toHaveBeenCalledWith(0, 3);
    });

    it("calls onUpdateQuantity with decremented value when decrease button clicked", () => {
      const onUpdateQuantity = vi.fn();
      render(<Cart {...baseProps} items={[productItem]} onUpdateQuantity={onUpdateQuantity} />);
      fireEvent.click(screen.getByLabelText("Decrease quantity"));
      expect(onUpdateQuantity).toHaveBeenCalledWith(0, 1);
    });

    it("calls onUpdateQuantity with correct index for multiple items", () => {
      const onUpdateQuantity = vi.fn();
      const secondProduct: CartItem = { ...productItem, name: "Fins", quantity: 1, total: 30.0 };
      render(
        <Cart
          {...baseProps}
          items={[productItem, secondProduct]}
          onUpdateQuantity={onUpdateQuantity}
        />
      );
      const increaseButtons = screen.getAllByLabelText("Increase quantity");
      fireEvent.click(increaseButtons[1]);
      expect(onUpdateQuantity).toHaveBeenCalledWith(1, 2);
    });
  });

  // ---------------------------------------------------------------------------
  // Remove item
  // ---------------------------------------------------------------------------
  describe("remove item", () => {
    it("calls onRemoveItem with correct index when remove button clicked", () => {
      const onRemoveItem = vi.fn();
      render(<Cart {...baseProps} items={[productItem]} onRemoveItem={onRemoveItem} />);
      fireEvent.click(screen.getByLabelText("Remove item"));
      expect(onRemoveItem).toHaveBeenCalledWith(0);
    });

    it("calls onRemoveItem with correct index for second item", () => {
      const onRemoveItem = vi.fn();
      const secondProduct: CartItem = { ...productItem, name: "Fins", quantity: 1, total: 30.0 };
      render(
        <Cart
          {...baseProps}
          items={[productItem, secondProduct]}
          onRemoveItem={onRemoveItem}
        />
      );
      const removeButtons = screen.getAllByLabelText("Remove item");
      fireEvent.click(removeButtons[1]);
      expect(onRemoveItem).toHaveBeenCalledWith(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Customer section
  // ---------------------------------------------------------------------------
  describe("customer section", () => {
    it("shows customer first and last name when customer is provided", () => {
      render(<Cart {...baseProps} customer={mockCustomer} />);
      expect(screen.getByText("Alice Ocean")).toBeInTheDocument();
    });

    it("shows customer email when customer is provided", () => {
      render(<Cart {...baseProps} customer={mockCustomer} />);
      expect(screen.getByText("alice@divelab.com")).toBeInTheDocument();
    });

    it("calls onClearCustomer when the clear customer button is clicked", () => {
      const onClearCustomer = vi.fn();
      render(<Cart {...baseProps} customer={mockCustomer} onClearCustomer={onClearCustomer} />);
      // The close button next to the customer info clears the customer
      // It has no aria-label but we can find it by proximity – use getAllByRole and pick last
      const buttons = screen.getAllByRole("button");
      // The X button inside the customer card is the one that calls onClearCustomer
      // Find the button that triggers clearing by clicking it and observing the call
      const xButtons = buttons.filter((btn) => {
        const svg = btn.querySelector("svg");
        return svg !== null && !btn.textContent?.trim();
      });
      fireEvent.click(xButtons[xButtons.length - 1]);
      expect(onClearCustomer).toHaveBeenCalled();
    });

    it("shows 'Add Customer (Optional)' button when no customer and requiresCustomer is false", () => {
      render(<Cart {...baseProps} customer={null} requiresCustomer={false} />);
      expect(screen.getByText("Add Customer (Optional)")).toBeInTheDocument();
    });

    it("calls onSelectCustomer when 'Add Customer' button is clicked", () => {
      const onSelectCustomer = vi.fn();
      render(<Cart {...baseProps} customer={null} onSelectCustomer={onSelectCustomer} />);
      fireEvent.click(screen.getByText("Add Customer (Optional)"));
      expect(onSelectCustomer).toHaveBeenCalled();
    });

    it("shows 'Customer Required' text when requiresCustomer is true and no customer selected", () => {
      render(<Cart {...baseProps} customer={null} requiresCustomer={true} />);
      expect(screen.getByText("Customer Required")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Checkout buttons
  // ---------------------------------------------------------------------------
  describe("checkout buttons", () => {
    it("calls onCheckout with 'card' when Card button is clicked", () => {
      const onCheckout = vi.fn();
      render(
        <Cart
          {...baseProps}
          items={[productItem]}
          customer={null}
          requiresCustomer={false}
          onCheckout={onCheckout}
        />
      );
      fireEvent.click(screen.getByText("Card"));
      expect(onCheckout).toHaveBeenCalledWith("card");
    });

    it("calls onCheckout with 'cash' when Cash button is clicked", () => {
      const onCheckout = vi.fn();
      render(
        <Cart
          {...baseProps}
          items={[productItem]}
          customer={null}
          requiresCustomer={false}
          onCheckout={onCheckout}
        />
      );
      fireEvent.click(screen.getByText("Cash"));
      expect(onCheckout).toHaveBeenCalledWith("cash");
    });

    it("calls onCheckout with 'split' when Split button is clicked", () => {
      const onCheckout = vi.fn();
      render(
        <Cart
          {...baseProps}
          items={[productItem]}
          customer={null}
          requiresCustomer={false}
          onCheckout={onCheckout}
        />
      );
      fireEvent.click(screen.getByText("Split"));
      expect(onCheckout).toHaveBeenCalledWith("split");
    });

    it("disables checkout buttons when cart is empty", () => {
      render(<Cart {...baseProps} items={[]} />);
      expect(screen.getByText("Card")).toBeDisabled();
      expect(screen.getByText("Cash")).toBeDisabled();
      expect(screen.getByText("Split")).toBeDisabled();
    });

    it("disables checkout buttons when requiresCustomer is true and no customer is set", () => {
      render(
        <Cart
          {...baseProps}
          items={[productItem]}
          customer={null}
          requiresCustomer={true}
        />
      );
      expect(screen.getByText("Card")).toBeDisabled();
      expect(screen.getByText("Cash")).toBeDisabled();
      expect(screen.getByText("Split")).toBeDisabled();
    });

    it("enables checkout buttons when requiresCustomer is true and customer is set", () => {
      render(
        <Cart
          {...baseProps}
          items={[productItem]}
          customer={mockCustomer}
          requiresCustomer={true}
        />
      );
      expect(screen.getByText("Card")).not.toBeDisabled();
      expect(screen.getByText("Cash")).not.toBeDisabled();
      expect(screen.getByText("Split")).not.toBeDisabled();
    });

    it("enables checkout buttons when requiresCustomer is false even with no customer", () => {
      render(
        <Cart
          {...baseProps}
          items={[productItem]}
          customer={null}
          requiresCustomer={false}
        />
      );
      expect(screen.getByText("Card")).not.toBeDisabled();
      expect(screen.getByText("Cash")).not.toBeDisabled();
      expect(screen.getByText("Split")).not.toBeDisabled();
    });
  });
});

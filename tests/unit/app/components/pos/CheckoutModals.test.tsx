/**
 * CheckoutModals Unit Tests
 *
 * Tests for:
 *   - CashModal
 *   - CardModal
 *   - CustomerSearchModal
 *   - RentalAgreementModal
 *
 * All exported from app/components/pos/CheckoutModals.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  CashModal,
  CardModal,
  CustomerSearchModal,
  RentalAgreementModal,
} from "../../../../../app/components/pos/CheckoutModals";

// ---------------------------------------------------------------------------
// Mock react-router (useFetcher is used by CardModal and SplitModal)
// ---------------------------------------------------------------------------
vi.mock("react-router", () => ({
  useFetcher: () => ({
    state: "idle",
    data: null,
    submit: vi.fn(),
    Form: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
      <form {...props}>{children}</form>
    ),
  }),
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockCustomer = {
  id: "cust-001",
  firstName: "Sam",
  lastName: "Diver",
  email: "sam@diveclub.com",
  phone: "+61-400-000-000",
};

const mockRentals = [
  { name: "BCD Jacket", size: "M", days: 2, dailyRate: 25.0, total: 50.0 },
  { name: "Wetsuit 5mm", size: "L", days: 2, dailyRate: 15.0, total: 30.0 },
];

// ===========================================================================
// CashModal
// ===========================================================================

describe("CashModal", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onComplete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
    onComplete = vi.fn();
  });

  const renderCash = (isOpen = true, total = 55.0) =>
    render(
      <CashModal isOpen={isOpen} onClose={onClose} total={total} onComplete={onComplete} />
    );

  it("returns null (renders nothing) when isOpen is false", () => {
    const { container } = renderCash(false);
    expect(container.innerHTML).toBe("");
  });

  it("renders 'Cash Payment' heading when open", () => {
    renderCash();
    expect(screen.getByText("Cash Payment")).toBeInTheDocument();
  });

  it("renders the total amount due", () => {
    renderCash(true, 55.0);
    expect(screen.getByText("$55.00")).toBeInTheDocument();
  });

  it("renders quick amount preset buttons", () => {
    renderCash(true, 55.0);
    expect(screen.getByText("$20")).toBeInTheDocument();
    expect(screen.getByText("$50")).toBeInTheDocument();
    expect(screen.getByText("$100")).toBeInTheDocument();
  });

  it("clicking a quick amount button sets the tendered amount input", () => {
    renderCash(true, 55.0);
    fireEvent.click(screen.getByText("$100"));
    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
  });

  it("'Complete Sale' button is disabled when tendered amount is less than total", () => {
    renderCash(true, 55.0);
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "40" } });
    expect(screen.getByText("Complete Sale")).toBeDisabled();
  });

  it("'Complete Sale' button is disabled when no amount is entered", () => {
    renderCash(true, 55.0);
    expect(screen.getByText("Complete Sale")).toBeDisabled();
  });

  it("'Complete Sale' button is enabled when tendered amount equals the total", () => {
    renderCash(true, 55.0);
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "55" } });
    expect(screen.getByText("Complete Sale")).not.toBeDisabled();
  });

  it("'Complete Sale' button is enabled when tendered amount exceeds the total", () => {
    renderCash(true, 55.0);
    fireEvent.click(screen.getByText("$100"));
    expect(screen.getByText("Complete Sale")).not.toBeDisabled();
  });

  it("calls onComplete with correct cash payment when 'Complete Sale' is clicked", () => {
    renderCash(true, 55.0);
    fireEvent.click(screen.getByText("$100"));
    fireEvent.click(screen.getByText("Complete Sale"));
    expect(onComplete).toHaveBeenCalledWith([{ method: "cash", amount: 55.0 }]);
  });

  it("shows 'Change Due' section when tendered amount exceeds total", () => {
    renderCash(true, 55.0);
    fireEvent.click(screen.getByText("$100"));
    expect(screen.getByText("Change Due")).toBeInTheDocument();
    expect(screen.getByText("$45.00")).toBeInTheDocument();
  });

  it("does not show 'Change Due' when tendered amount is less than total", () => {
    renderCash(true, 55.0);
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "40" } });
    expect(screen.queryByText("Change Due")).not.toBeInTheDocument();
  });

  it("calls onClose when Cancel button is clicked", () => {
    renderCash();
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});

// ===========================================================================
// CardModal
// ===========================================================================

describe("CardModal", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onComplete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
    onComplete = vi.fn();
  });

  const renderCard = (overrides: {
    isOpen?: boolean;
    stripeConnected?: boolean;
    stripePublishableKey?: string | null;
    hasTerminalReaders?: boolean;
    total?: number;
  } = {}) =>
    render(
      <CardModal
        isOpen={overrides.isOpen !== undefined ? overrides.isOpen : true}
        onClose={onClose}
        total={overrides.total !== undefined ? overrides.total : 75.0}
        onComplete={onComplete}
        stripeConnected={overrides.stripeConnected !== undefined ? overrides.stripeConnected : true}
        stripePublishableKey={
          overrides.stripePublishableKey !== undefined
            ? overrides.stripePublishableKey
            : "pk_test_mock"
        }
        hasTerminalReaders={
          overrides.hasTerminalReaders !== undefined ? overrides.hasTerminalReaders : false
        }
      />
    );

  it("returns null (renders nothing) when isOpen is false", () => {
    const { container } = renderCard({ isOpen: false });
    expect(container.innerHTML).toBe("");
  });

  it("shows 'Stripe Not Connected' warning when stripeConnected is false", () => {
    renderCard({ stripeConnected: false });
    expect(screen.getByText("Stripe Not Connected")).toBeInTheDocument();
  });

  it("shows 'Card Payment' heading when stripe is not connected", () => {
    renderCard({ stripeConnected: false });
    expect(screen.getByText("Card Payment")).toBeInTheDocument();
  });

  it("renders the total amount on the stripe-not-connected screen", () => {
    renderCard({ stripeConnected: false, total: 75.0 });
    expect(screen.getByText("$75.00")).toBeInTheDocument();
  });

  it("shows method selection when stripeConnected is true and modal is open", () => {
    renderCard({ stripeConnected: true });
    // The method-select step shows "Enter Card Manually" and "Use Card Reader" options
    expect(screen.getByText("Enter Card Manually")).toBeInTheDocument();
  });

  it("renders 'Card Payment' heading in method-select step", () => {
    renderCard({ stripeConnected: true });
    expect(screen.getByText("Card Payment")).toBeInTheDocument();
  });

  it("renders the total amount in the method-select step", () => {
    renderCard({ stripeConnected: true, total: 75.0 });
    expect(screen.getByText("$75.00")).toBeInTheDocument();
  });

  it("'Use Card Reader' button is disabled when no terminal readers are connected", () => {
    renderCard({ stripeConnected: true, hasTerminalReaders: false });
    const readerButton = screen.getByText("Use Card Reader").closest("button");
    expect(readerButton).toBeDisabled();
  });

  it("'Use Card Reader' button is enabled when terminal readers are available", () => {
    renderCard({ stripeConnected: true, hasTerminalReaders: true });
    const readerButton = screen.getByText("Use Card Reader").closest("button");
    expect(readerButton).not.toBeDisabled();
  });

  it("calls onClose (via handleClose) when Cancel is clicked on the not-connected screen", () => {
    renderCard({ stripeConnected: false });
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Cancel is clicked on the method-select screen", () => {
    renderCard({ stripeConnected: true });
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});

// ===========================================================================
// CustomerSearchModal
// ===========================================================================

describe("CustomerSearchModal", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onSelect: ReturnType<typeof vi.fn>;
  let onCreateNew: ReturnType<typeof vi.fn>;
  let onSearch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
    onSelect = vi.fn();
    onCreateNew = vi.fn();
    onSearch = vi.fn();
  });

  const renderSearch = (overrides: {
    isOpen?: boolean;
    searchResults?: typeof mockSearchResults;
    isSearching?: boolean;
  } = {}) =>
    render(
      <CustomerSearchModal
        isOpen={overrides.isOpen !== undefined ? overrides.isOpen : true}
        onClose={onClose}
        onSelect={onSelect}
        onCreateNew={onCreateNew}
        searchResults={overrides.searchResults !== undefined ? overrides.searchResults : []}
        onSearch={onSearch}
        isSearching={overrides.isSearching !== undefined ? overrides.isSearching : false}
      />
    );

  const mockSearchResults = [
    { id: "cust-001", firstName: "Alice", lastName: "Ocean", email: "alice@ocean.com", phone: null },
    { id: "cust-002", firstName: "Bob", lastName: "Coral", email: "bob@coral.com", phone: "+61-400-111-222" },
  ];

  it("returns null (renders nothing) when isOpen is false", () => {
    const { container } = renderSearch({ isOpen: false });
    expect(container.innerHTML).toBe("");
  });

  it("renders 'Select Customer' heading when open", () => {
    renderSearch();
    expect(screen.getByText("Select Customer")).toBeInTheDocument();
  });

  it("renders the search input", () => {
    renderSearch();
    expect(
      screen.getByPlaceholderText("Search by name, email, or phone...")
    ).toBeInTheDocument();
  });

  it("shows 'Type to search...' hint when query is empty and no results", () => {
    renderSearch();
    expect(screen.getByText("Type to search...")).toBeInTheDocument();
  });

  it("shows 'Searching...' when isSearching is true", () => {
    renderSearch({ isSearching: true });
    expect(screen.getByText("Searching...")).toBeInTheDocument();
  });

  it("renders search result customer names when results are provided", () => {
    renderSearch({ searchResults: mockSearchResults });
    expect(screen.getByText("Alice Ocean")).toBeInTheDocument();
    expect(screen.getByText("Bob Coral")).toBeInTheDocument();
  });

  it("renders search result customer emails when results are provided", () => {
    renderSearch({ searchResults: mockSearchResults });
    expect(screen.getByText("alice@ocean.com")).toBeInTheDocument();
    expect(screen.getByText("bob@coral.com")).toBeInTheDocument();
  });

  it("calls onSelect with the customer object when a result is clicked", () => {
    renderSearch({ searchResults: mockSearchResults });
    fireEvent.click(screen.getByText("Alice Ocean"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cust-001", firstName: "Alice" })
    );
  });

  it("calls onCreateNew when 'New Customer' button is clicked", () => {
    renderSearch();
    fireEvent.click(screen.getByText("New Customer"));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when 'Cancel' button is clicked", () => {
    renderSearch();
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onSearch when at least 2 characters are typed in the search input", () => {
    renderSearch();
    const input = screen.getByPlaceholderText("Search by name, email, or phone...");
    fireEvent.change(input, { target: { value: "al" } });
    expect(onSearch).toHaveBeenCalledWith("al");
  });

  it("does not call onSearch when fewer than 2 characters are typed", () => {
    renderSearch();
    const input = screen.getByPlaceholderText("Search by name, email, or phone...");
    fireEvent.change(input, { target: { value: "a" } });
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("renders phone number for customers that have one", () => {
    renderSearch({ searchResults: mockSearchResults });
    expect(screen.getByText("+61-400-111-222")).toBeInTheDocument();
  });
});

// ===========================================================================
// RentalAgreementModal
// ===========================================================================

describe("RentalAgreementModal", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onConfirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
    onConfirm = vi.fn();
  });

  const renderRental = (overrides: {
    isOpen?: boolean;
    customer?: typeof mockCustomer | null;
    rentals?: typeof mockRentals;
  } = {}) =>
    render(
      <RentalAgreementModal
        isOpen={overrides.isOpen !== undefined ? overrides.isOpen : true}
        onClose={onClose}
        onConfirm={onConfirm}
        customer={overrides.customer !== undefined ? overrides.customer : mockCustomer}
        rentals={overrides.rentals !== undefined ? overrides.rentals : mockRentals}
        shopName="Reef Dive Centre"
        agreementNumber="AGR-2026-001"
      />
    );

  it("returns null when isOpen is false", () => {
    const { container } = renderRental({ isOpen: false });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when customer is null even if isOpen is true", () => {
    const { container } = renderRental({ customer: null });
    expect(container.innerHTML).toBe("");
  });

  it("renders 'Rental Agreement Required' heading when open with customer", () => {
    renderRental();
    expect(screen.getByText("Rental Agreement Required")).toBeInTheDocument();
  });

  it("renders the customer full name", () => {
    renderRental();
    expect(screen.getByText("Sam Diver")).toBeInTheDocument();
  });

  it("renders the customer email", () => {
    renderRental();
    expect(screen.getByText("sam@diveclub.com")).toBeInTheDocument();
  });

  it("renders rental item names in the equipment table", () => {
    renderRental();
    expect(screen.getByText("BCD Jacket")).toBeInTheDocument();
    expect(screen.getByText("Wetsuit 5mm")).toBeInTheDocument();
  });

  it("renders rental item sizes in the equipment table", () => {
    renderRental();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
  });

  it("renders rental item day counts in the equipment table", () => {
    renderRental();
    const daysCells = screen.getAllByText("2");
    expect(daysCells.length).toBeGreaterThanOrEqual(2);
  });

  it("renders rental item daily rates", () => {
    renderRental();
    expect(screen.getByText("$25.00")).toBeInTheDocument();
    expect(screen.getByText("$15.00")).toBeInTheDocument();
  });

  it("renders rental item totals", () => {
    renderRental();
    expect(screen.getByText("$50.00")).toBeInTheDocument();
    expect(screen.getByText("$30.00")).toBeInTheDocument();
  });

  it("'Continue to Payment' button is disabled before agreement is signed and staff name entered", () => {
    renderRental();
    expect(screen.getByText("Continue to Payment")).toBeDisabled();
  });

  it("'Continue to Payment' button is disabled when only the checkbox is checked (no staff name)", () => {
    renderRental();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("Continue to Payment")).toBeDisabled();
  });

  it("'Continue to Payment' button is disabled when only staff name is entered (checkbox unchecked)", () => {
    renderRental();
    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Jane Staff" },
    });
    expect(screen.getByText("Continue to Payment")).toBeDisabled();
  });

  it("'Continue to Payment' button is enabled when checkbox is checked and staff name entered", () => {
    renderRental();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Jane Staff" },
    });
    expect(screen.getByText("Continue to Payment")).not.toBeDisabled();
  });

  it("calls onConfirm with the staff name when 'Continue to Payment' is clicked", () => {
    renderRental();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Jane Staff" },
    });
    fireEvent.click(screen.getByText("Continue to Payment"));
    expect(onConfirm).toHaveBeenCalledWith("Jane Staff");
  });

  it("does not call onConfirm when button is disabled (no signature / no staff)", () => {
    renderRental();
    fireEvent.click(screen.getByText("Continue to Payment"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onClose when 'Cancel' button is clicked", () => {
    renderRental();
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the shop name in the agreement header", () => {
    renderRental();
    expect(screen.getByText("Reef Dive Centre")).toBeInTheDocument();
  });

  it("renders the agreement number", () => {
    renderRental();
    expect(screen.getByText("Agreement #: AGR-2026-001")).toBeInTheDocument();
  });

  it("renders the terms and conditions list", () => {
    renderRental();
    expect(
      screen.getByText(/Equipment must be returned by the due date/)
    ).toBeInTheDocument();
  });
});

/**
 * TransactionModals Unit Tests
 *
 * Tests for:
 *   - ReceiptModal
 *   - TransactionDetailsModal
 *   - EmailConfirmationModal
 *
 * All exported from app/components/pos/TransactionModals.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ReceiptModal,
  TransactionDetailsModal,
  EmailConfirmationModal,
} from "../../../../../app/components/pos/TransactionModals";

// react-router is not used directly in TransactionModals but mock it in case
// of any indirect import picked up during the test run
vi.mock("react-router", () => ({
  useFetcher: () => ({
    state: "idle",
    data: null,
    submit: vi.fn(),
    Form: "form",
  }),
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const baseOrganization = {
  name: "Coral Sea Dive Shop",
  taxRate: "10",
  taxName: "GST",
  currency: "usd",
};

const baseTransaction = {
  id: "txn-test-001",
  type: "sale",
  amount: 110.0,
  paymentMethod: "card",
  customerName: "Bob Coral",
  customerEmail: "bob@coral.com",
  items: [
    { description: "Dive Mask Pro", quantity: 1, unitPrice: 49.99, total: 49.99 },
    { description: "Wetsuit 3mm", quantity: 1, unitPrice: 50.01, total: 50.01 },
  ],
  createdAt: new Date("2026-02-18T09:30:00Z"),
  stripePaymentId: null,
  refundedTransactionId: null,
};

// ===========================================================================
// ReceiptModal
// ===========================================================================

describe("ReceiptModal", () => {
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
  });

  const renderReceipt = (overrides: { isOpen?: boolean; transaction?: Partial<typeof baseTransaction> } = {}) =>
    render(
      <ReceiptModal
        isOpen={overrides.isOpen !== undefined ? overrides.isOpen : true}
        onClose={onClose}
        transaction={{ ...baseTransaction, ...overrides.transaction }}
        organization={baseOrganization}
      />
    );

  it("returns null (renders nothing) when isOpen is false", () => {
    const { container } = renderReceipt({ isOpen: false });
    expect(container.innerHTML).toBe("");
  });

  it("renders the organization name when open", () => {
    renderReceipt();
    expect(screen.getByText("Coral Sea Dive Shop")).toBeInTheDocument();
  });

  it("renders 'Receipt' subtitle when open", () => {
    renderReceipt();
    expect(screen.getByText("Receipt")).toBeInTheDocument();
  });

  it("renders transaction item descriptions", () => {
    renderReceipt();
    expect(screen.getByText("Dive Mask Pro")).toBeInTheDocument();
    expect(screen.getByText("Wetsuit 3mm")).toBeInTheDocument();
  });

  it("renders item quantity and unit price detail", () => {
    renderReceipt();
    // Each item line: "1 × USD 49.99"
    expect(screen.getByText(/1 × USD 49\.99/)).toBeInTheDocument();
    expect(screen.getByText(/1 × USD 50\.01/)).toBeInTheDocument();
  });

  it("calls onClose when the Close (X) button in the header is clicked", () => {
    renderReceipt();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the Escape key is pressed", () => {
    renderReceipt();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("does not call onClose on Escape when modal is closed", () => {
    renderReceipt({ isOpen: false });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("has role='dialog' on the overlay element", () => {
    renderReceipt();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("has aria-modal='true' on the overlay element", () => {
    renderReceipt();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("renders 'No itemized details' when transaction items are null", () => {
    renderReceipt({ transaction: { items: null } });
    expect(screen.getByText("No itemized details")).toBeInTheDocument();
  });

  it("renders the payment method", () => {
    renderReceipt();
    expect(screen.getByText("card")).toBeInTheDocument();
  });

  it("renders customer name when provided", () => {
    renderReceipt();
    expect(screen.getByText("Bob Coral")).toBeInTheDocument();
  });
});

// ===========================================================================
// TransactionDetailsModal
// ===========================================================================

describe("TransactionDetailsModal", () => {
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
  });

  const renderDetails = (overrides: { isOpen?: boolean; transaction?: Partial<typeof baseTransaction> } = {}) =>
    render(
      <TransactionDetailsModal
        isOpen={overrides.isOpen !== undefined ? overrides.isOpen : true}
        onClose={onClose}
        transaction={{ ...baseTransaction, ...overrides.transaction }}
        organization={baseOrganization}
      />
    );

  it("returns null (renders nothing) when isOpen is false", () => {
    const { container } = renderDetails({ isOpen: false });
    expect(container.innerHTML).toBe("");
  });

  it("renders 'Transaction Details' heading when open", () => {
    renderDetails();
    expect(screen.getByText("Transaction Details")).toBeInTheDocument();
  });

  it("renders the transaction id", () => {
    renderDetails();
    expect(screen.getByText("txn-test-001")).toBeInTheDocument();
  });

  it("renders the transaction type as a badge", () => {
    renderDetails();
    expect(screen.getByText("sale")).toBeInTheDocument();
  });

  it("renders the transaction amount", () => {
    renderDetails();
    expect(screen.getByText("USD 110.00")).toBeInTheDocument();
  });

  it("renders customer name when present", () => {
    renderDetails();
    expect(screen.getByText("Bob Coral")).toBeInTheDocument();
  });

  it("renders customer email when present", () => {
    renderDetails();
    expect(screen.getByText("bob@coral.com")).toBeInTheDocument();
  });

  it("renders transaction item descriptions", () => {
    renderDetails();
    expect(screen.getByText("Dive Mask Pro")).toBeInTheDocument();
    expect(screen.getByText("Wetsuit 3mm")).toBeInTheDocument();
  });

  it("calls onClose when the close button (X) is clicked", () => {
    renderDetails();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape is pressed", () => {
    renderDetails();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a refund warning when refundedTransactionId is set", () => {
    renderDetails({ transaction: { refundedTransactionId: "txn-refund-abc" } });
    expect(screen.getByText("This transaction has been refunded")).toBeInTheDocument();
  });

  it("does not show refund warning when refundedTransactionId is null", () => {
    renderDetails({ transaction: { refundedTransactionId: null } });
    expect(
      screen.queryByText("This transaction has been refunded")
    ).not.toBeInTheDocument();
  });

  it("does not render customer section when customerName and customerEmail are both null", () => {
    renderDetails({ transaction: { customerName: null, customerEmail: null } });
    expect(screen.queryByText("Bob Coral")).not.toBeInTheDocument();
  });

  it("has role='dialog' and aria-modal='true'", () => {
    renderDetails();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});

// ===========================================================================
// EmailConfirmationModal
// ===========================================================================

describe("EmailConfirmationModal", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onConfirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
    onConfirm = vi.fn();
  });

  const renderEmail = (overrides: {
    isOpen?: boolean;
    isLoading?: boolean;
    transaction?: Partial<typeof baseTransaction>;
  } = {}) =>
    render(
      <EmailConfirmationModal
        isOpen={overrides.isOpen !== undefined ? overrides.isOpen : true}
        onClose={onClose}
        onConfirm={onConfirm}
        transaction={{ ...baseTransaction, ...overrides.transaction }}
        organization={baseOrganization}
        isLoading={overrides.isLoading !== undefined ? overrides.isLoading : false}
      />
    );

  it("returns null (renders nothing) when isOpen is false", () => {
    const { container } = renderEmail({ isOpen: false });
    expect(container.innerHTML).toBe("");
  });

  it("renders 'Email Receipt' heading when open", () => {
    renderEmail();
    expect(screen.getByText("Email Receipt")).toBeInTheDocument();
  });

  it("renders the customer email address", () => {
    renderEmail();
    expect(screen.getByText("bob@coral.com")).toBeInTheDocument();
  });

  it("calls onConfirm when 'Send Email' button is clicked", () => {
    renderEmail();
    fireEvent.click(screen.getByText("Send Email"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when 'Cancel' button is clicked", () => {
    renderEmail();
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows 'Sending...' label on the send button while loading", () => {
    renderEmail({ isLoading: true });
    expect(screen.getByText("Sending...")).toBeInTheDocument();
  });

  it("disables 'Send Email' button while loading", () => {
    renderEmail({ isLoading: true });
    expect(screen.getByText("Sending...")).toBeDisabled();
  });

  it("disables 'Cancel' button while loading", () => {
    renderEmail({ isLoading: true });
    expect(screen.getByText("Cancel")).toBeDisabled();
  });

  it("does not call onConfirm while loading (button is disabled)", () => {
    renderEmail({ isLoading: true });
    fireEvent.click(screen.getByText("Sending..."));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("renders the transaction amount summary", () => {
    renderEmail();
    expect(screen.getByText("USD 110.00")).toBeInTheDocument();
  });

  it("renders a truncated receipt number", () => {
    renderEmail();
    // Transaction id is "txn-test-001", first 8 chars = "txn-test"
    expect(screen.getByText("txn-test...")).toBeInTheDocument();
  });
});

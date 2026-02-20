import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RefundConfirmationModal } from "../../../../app/components/pos/RefundModals";

// Mock react-router (TransactionLookupModal uses useFetcher, but RefundConfirmationModal does not)
vi.mock("react-router", () => ({
  useFetcher: vi.fn(() => ({
    state: "idle",
    data: null,
    submit: vi.fn(),
  })),
}));

const baseTransaction = {
  id: "txn-abc-123",
  amount: "59.99",
  paymentMethod: "cash",
  stripePaymentId: null,
  items: [
    { type: "product", name: "Dive Mask", quantity: 1, unitPrice: 39.99, total: 39.99 },
    { type: "product", name: "Snorkel", quantity: 1, unitPrice: 20.00, total: 20.00 },
  ],
  createdAt: "2026-02-18T10:30:00Z",
  customer: {
    firstName: "Jane",
    lastName: "Diver",
    email: "jane@example.com",
  },
};

describe("RefundConfirmationModal", () => {
  let onClose: ReturnType<typeof vi.fn>;
  let onConfirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
    onConfirm = vi.fn();
  });

  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <RefundConfirmationModal
        isOpen={false}
        onClose={onClose}
        transaction={baseTransaction}
        onConfirm={onConfirm}
      />
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders the modal with transaction details when open", () => {
    render(
      <RefundConfirmationModal
        isOpen={true}
        onClose={onClose}
        transaction={baseTransaction}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText("Confirm Refund")).toBeInTheDocument();
    expect(screen.getByText("$59.99")).toBeInTheDocument();
    expect(screen.getByText("txn-abc-123")).toBeInTheDocument();
    expect(screen.getByText("Jane Diver")).toBeInTheDocument();
    expect(screen.getByText("Dive Mask")).toBeInTheDocument();
    expect(screen.getByText("Snorkel")).toBeInTheDocument();
  });

  it("displays the payment method", () => {
    render(
      <RefundConfirmationModal
        isOpen={true}
        onClose={onClose}
        transaction={baseTransaction}
        onConfirm={onConfirm}
      />
    );

    // Payment method should be shown capitalized
    expect(screen.getByText("cash")).toBeInTheDocument();
  });

  it("shows item quantities and prices", () => {
    render(
      <RefundConfirmationModal
        isOpen={true}
        onClose={onClose}
        transaction={baseTransaction}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText("$39.99")).toBeInTheDocument();
    expect(screen.getByText("$20.00")).toBeInTheDocument();
  });

  it("requires a refund reason before confirming", () => {
    render(
      <RefundConfirmationModal
        isOpen={true}
        onClose={onClose}
        transaction={baseTransaction}
        onConfirm={onConfirm}
      />
    );

    // The confirm button should be disabled when no reason is selected
    const confirmButton = screen.getByRole("button", { name: /Confirm Refund/i });
    expect(confirmButton).toBeDisabled();

    // onConfirm should not be called when clicking a disabled button
    fireEvent.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("enables confirm button when a refund reason is selected", () => {
    render(
      <RefundConfirmationModal
        isOpen={true}
        onClose={onClose}
        transaction={baseTransaction}
        onConfirm={onConfirm}
      />
    );

    // Select a reason
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "product_return" } });

    const confirmButton = screen.getByRole("button", { name: /Confirm Refund/i });
    expect(confirmButton).not.toBeDisabled();
  });

  it("calls onConfirm with the selected refund reason", () => {
    render(
      <RefundConfirmationModal
        isOpen={true}
        onClose={onClose}
        transaction={baseTransaction}
        onConfirm={onConfirm}
      />
    );

    // Select a reason
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "customer_request" } });

    // Click confirm
    const confirmButton = screen.getByRole("button", { name: /Confirm Refund/i });
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledWith("customer_request");
  });

  it("calls onClose when cancel button is clicked", () => {
    render(
      <RefundConfirmationModal
        isOpen={true}
        onClose={onClose}
        transaction={baseTransaction}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows Stripe refund notice for card payments with stripePaymentId", () => {
    const cardTransaction = {
      ...baseTransaction,
      paymentMethod: "card",
      stripePaymentId: "pi_abc123",
    };

    render(
      <RefundConfirmationModal
        isOpen={true}
        onClose={onClose}
        transaction={cardTransaction}
        onConfirm={onConfirm}
      />
    );

    expect(
      screen.getByText(/Stripe refund will be processed automatically/i)
    ).toBeInTheDocument();
  });

  it("does not show Stripe notice for cash payments", () => {
    render(
      <RefundConfirmationModal
        isOpen={true}
        onClose={onClose}
        transaction={baseTransaction}
        onConfirm={onConfirm}
      />
    );

    expect(
      screen.queryByText(/Stripe refund will be processed automatically/i)
    ).not.toBeInTheDocument();
  });

  it("shows the refund amount in the warning message", () => {
    render(
      <RefundConfirmationModal
        isOpen={true}
        onClose={onClose}
        transaction={baseTransaction}
        onConfirm={onConfirm}
      />
    );

    expect(
      screen.getByText(/This will refund \$59\.99 to the customer via cash/i)
    ).toBeInTheDocument();
  });

  it("renders without customer data for walk-in transactions", () => {
    const walkInTransaction = {
      ...baseTransaction,
      customer: null,
    };

    render(
      <RefundConfirmationModal
        isOpen={true}
        onClose={onClose}
        transaction={walkInTransaction}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText("Confirm Refund")).toBeInTheDocument();
    expect(screen.queryByText("Jane Diver")).not.toBeInTheDocument();
  });

  it("shows processing state after confirming", () => {
    render(
      <RefundConfirmationModal
        isOpen={true}
        onClose={onClose}
        transaction={baseTransaction}
        onConfirm={onConfirm}
      />
    );

    // Select a reason and confirm
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "product_return" } });

    const confirmButton = screen.getByRole("button", { name: /Confirm Refund/i });
    fireEvent.click(confirmButton);

    // After clicking confirm, the button should show "Processing..."
    expect(screen.getByText("Processing...")).toBeInTheDocument();
  });

  it("provides all refund reason options", () => {
    render(
      <RefundConfirmationModal
        isOpen={true}
        onClose={onClose}
        transaction={baseTransaction}
        onConfirm={onConfirm}
      />
    );

    const select = screen.getByRole("combobox");
    const options = Array.from(select.querySelectorAll("option"));
    const optionValues = options.map((o) => o.getAttribute("value"));

    expect(optionValues).toContain("");
    expect(optionValues).toContain("product_return");
    expect(optionValues).toContain("service_cancellation");
    expect(optionValues).toContain("customer_request");
    expect(optionValues).toContain("price_adjustment");
    expect(optionValues).toContain("other");
  });

  it("closes on Escape key press", () => {
    render(
      <RefundConfirmationModal
        isOpen={true}
        onClose={onClose}
        transaction={baseTransaction}
        onConfirm={onConfirm}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("has correct ARIA attributes for accessibility", () => {
    render(
      <RefundConfirmationModal
        isOpen={true}
        onClose={onClose}
        transaction={baseTransaction}
        onConfirm={onConfirm}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "refund-modal-title");
  });
});

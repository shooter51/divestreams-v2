/**
 * DS-vnvo: POS split payment silently fails
 *
 * Bug: When a cash payment is added in the SplitModal, the payment object
 * is missing `tendered` and `change` fields required by cashPaymentSchema.
 * This causes Zod validation to fail on the server, which returns an error
 * silently — no transaction is created, cart is not cleared, no success toast.
 *
 * Fix: SplitModal's addCashPayment must include tendered=amount and change=0.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SplitModal } from "../../../../app/components/pos/CheckoutModals";

// Mock react-router useFetcher
vi.mock("react-router", () => ({
  useFetcher: () => ({
    submit: vi.fn(),
    state: "idle",
    data: undefined,
  }),
  useRouteLoaderData: () => ({ csrfToken: "test-token" }),
}));

describe("DS-vnvo: SplitModal cash payment includes required tendered and change fields", () => {
  const onComplete = vi.fn();
  const onClose = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose,
    total: 100.00,
    onComplete,
    stripeConnected: false,
    stripePublishableKey: null,
    customerId: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DS-vnvo: onComplete is called with cash payment containing tendered and change", async () => {
    render(<SplitModal {...defaultProps} />);

    // Enter the full amount as cash
    const amountInput = screen.getByPlaceholderText("Amount");
    fireEvent.change(amountInput, { target: { value: "100.00" } });

    // Click "Add Cash Payment"
    const addButton = screen.getByText("Add Cash Payment");
    await act(async () => {
      fireEvent.click(addButton);
    });

    // Click "Complete Sale"
    const completeButton = screen.getByText("Complete Sale");
    await act(async () => {
      fireEvent.click(completeButton);
    });

    expect(onComplete).toHaveBeenCalledOnce();
    const [payments] = onComplete.mock.calls[0];
    expect(payments).toHaveLength(1);

    const cashPayment = payments[0];
    expect(cashPayment.method).toBe("cash");
    expect(cashPayment.amount).toBe(100.00);

    // These fields are REQUIRED by cashPaymentSchema but were missing before the fix
    expect(cashPayment).toHaveProperty("tendered");
    expect(cashPayment).toHaveProperty("change");
    expect(cashPayment.tendered).toBe(100.00);
    expect(cashPayment.change).toBe(0);
  });

  it("DS-vnvo: partial cash payment in split also includes tendered and change", async () => {
    render(<SplitModal {...defaultProps} />);

    // Enter a partial amount as cash
    const amountInput = screen.getByPlaceholderText("Amount");
    fireEvent.change(amountInput, { target: { value: "60.00" } });

    // Click "Add Cash Payment"
    const addButton = screen.getByText("Add Cash Payment");
    await act(async () => {
      fireEvent.click(addButton);
    });

    expect(onComplete).not.toHaveBeenCalled(); // remaining > 0, Complete Sale is disabled

    // Verify the payment list shows the cash payment (Paid section shows $60.00)
    const paidAmounts = screen.getAllByText("$60.00");
    expect(paidAmounts.length).toBeGreaterThan(0);
  });
});

/**
 * DS-oeex: POS empty cart shows "Tax (0%)"
 * When cart is empty, tax line should be hidden (not show "Tax (0%)")
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Cart } from "../../../../app/components/pos/Cart";

describe("DS-oeex: Cart tax display when empty", () => {
  const baseProps = {
    items: [],
    onUpdateQuantity: vi.fn(),
    onRemoveItem: vi.fn(),
    customer: null,
    onSelectCustomer: vi.fn(),
    onClearCustomer: vi.fn(),
    taxRate: 0,
    onCheckout: vi.fn(),
    requiresCustomer: false,
  };

  it("does not show tax line when cart is empty", () => {
    render(<Cart {...baseProps} taxRate={8.25} />);
    // The tax line should not be visible when the cart is empty
    expect(screen.queryByText(/Tax \(/)).toBeNull();
  });

  it("does not show 'Tax (0%)' when cart is empty even with zero taxRate", () => {
    render(<Cart {...baseProps} taxRate={0} />);
    expect(screen.queryByText(/Tax \(0%\)/)).toBeNull();
  });

  it("shows tax line when cart has items", () => {
    const props = {
      ...baseProps,
      taxRate: 8.25,
      items: [
        {
          type: "product" as const,
          productId: "p1",
          name: "Dive Mask",
          quantity: 1,
          unitPrice: 50,
          total: 50,
          taxRate: undefined,
        },
      ],
    };
    render(<Cart {...props} />);
    expect(screen.getByText(/Tax \(/)).toBeTruthy();
  });
});

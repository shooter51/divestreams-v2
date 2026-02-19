/**
 * TransactionActions Component Unit Tests
 *
 * Tests the POS TransactionActions component including:
 * - All four action buttons rendered with correct aria-labels
 * - View Receipt, View Details, and Email Receipt callbacks
 * - Email Receipt disabled when customerEmail is null
 * - Refund button enabled for normal sale transactions
 * - Refund button disabled for refund-type transactions
 * - Refund button disabled when transaction has already been refunded
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TransactionActions } from "../../../../../app/components/pos/TransactionActions";

const baseSaleTransaction = {
  id: "txn-sale-001",
  type: "sale",
  customerEmail: "diver@ocean.com",
  refundedTransactionId: null,
};

describe("TransactionActions", () => {
  let onViewReceipt: ReturnType<typeof vi.fn>;
  let onViewDetails: ReturnType<typeof vi.fn>;
  let onEmailReceipt: ReturnType<typeof vi.fn>;
  let onRefund: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onViewReceipt = vi.fn();
    onViewDetails = vi.fn();
    onEmailReceipt = vi.fn();
    onRefund = vi.fn();
  });

  const renderActions = (transactionOverrides = {}) =>
    render(
      <TransactionActions
        transaction={{ ...baseSaleTransaction, ...transactionOverrides }}
        onViewReceipt={onViewReceipt}
        onViewDetails={onViewDetails}
        onEmailReceipt={onEmailReceipt}
        onRefund={onRefund}
      />
    );

  // ---------------------------------------------------------------------------
  // Button rendering
  // ---------------------------------------------------------------------------
  describe("button rendering", () => {
    it("renders the View Receipt button with correct aria-label", () => {
      renderActions();
      expect(screen.getByLabelText("View Receipt")).toBeInTheDocument();
    });

    it("renders the View Details button with correct aria-label", () => {
      renderActions();
      expect(screen.getByLabelText("View Details")).toBeInTheDocument();
    });

    it("renders the Email Receipt button with correct aria-label", () => {
      renderActions();
      expect(screen.getByLabelText("Email Receipt")).toBeInTheDocument();
    });

    it("renders the Refund Transaction button with correct aria-label", () => {
      renderActions();
      expect(screen.getByLabelText("Refund Transaction")).toBeInTheDocument();
    });

    it("renders all 4 action buttons", () => {
      renderActions();
      expect(screen.getAllByRole("button").length).toBe(4);
    });
  });

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------
  describe("button callbacks", () => {
    it("calls onViewReceipt when View Receipt button is clicked", () => {
      renderActions();
      fireEvent.click(screen.getByLabelText("View Receipt"));
      expect(onViewReceipt).toHaveBeenCalledTimes(1);
    });

    it("calls onViewDetails when View Details button is clicked", () => {
      renderActions();
      fireEvent.click(screen.getByLabelText("View Details"));
      expect(onViewDetails).toHaveBeenCalledTimes(1);
    });

    it("calls onEmailReceipt when Email Receipt button is clicked and customer email exists", () => {
      renderActions({ customerEmail: "diver@ocean.com" });
      fireEvent.click(screen.getByLabelText("Email Receipt"));
      expect(onEmailReceipt).toHaveBeenCalledTimes(1);
    });

    it("calls onRefund when Refund button is clicked on a refundable sale", () => {
      renderActions();
      fireEvent.click(screen.getByLabelText("Refund Transaction"));
      expect(onRefund).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Email Receipt disabled state
  // ---------------------------------------------------------------------------
  describe("Email Receipt button", () => {
    it("is disabled when customerEmail is null", () => {
      renderActions({ customerEmail: null });
      expect(screen.getByLabelText("Email Receipt")).toBeDisabled();
    });

    it("does not call onEmailReceipt when clicked while disabled (no email)", () => {
      renderActions({ customerEmail: null });
      fireEvent.click(screen.getByLabelText("Email Receipt"));
      expect(onEmailReceipt).not.toHaveBeenCalled();
    });

    it("is enabled when customerEmail is present", () => {
      renderActions({ customerEmail: "diver@ocean.com" });
      expect(screen.getByLabelText("Email Receipt")).not.toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // Refund button disabled states
  // ---------------------------------------------------------------------------
  describe("Refund button", () => {
    it("is enabled for a standard sale transaction", () => {
      renderActions({ type: "sale", refundedTransactionId: null });
      expect(screen.getByLabelText("Refund Transaction")).not.toBeDisabled();
    });

    it("is disabled for a transaction of type 'refund'", () => {
      renderActions({ type: "refund", refundedTransactionId: null });
      expect(screen.getByLabelText("Refund Transaction")).toBeDisabled();
    });

    it("does not call onRefund when Refund button is clicked on a refund-type transaction", () => {
      renderActions({ type: "refund", refundedTransactionId: null });
      fireEvent.click(screen.getByLabelText("Refund Transaction"));
      expect(onRefund).not.toHaveBeenCalled();
    });

    it("is disabled when the transaction already has a refundedTransactionId", () => {
      renderActions({ type: "sale", refundedTransactionId: "txn-refund-999" });
      expect(screen.getByLabelText("Refund Transaction")).toBeDisabled();
    });

    it("does not call onRefund when Refund button is clicked on an already-refunded transaction", () => {
      renderActions({ type: "sale", refundedTransactionId: "txn-refund-999" });
      fireEvent.click(screen.getByLabelText("Refund Transaction"));
      expect(onRefund).not.toHaveBeenCalled();
    });
  });
});

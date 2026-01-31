/**
 * POS Transaction Modals
 */

import { useEffect } from "react";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  paymentMethod: string | null;
  customerName: string | null;
  customerEmail: string | null;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }> | null;
  createdAt: Date;
  stripePaymentId: string | null;
  refundedTransactionId: string | null;
}

interface Organization {
  name: string;
  taxRate: string;
  taxName: string;
  currency: string;
}

// ============================================================================
// Receipt Modal
// ============================================================================

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction;
  organization: Organization;
}

export function ReceiptModal({
  isOpen,
  onClose,
  transaction,
  organization,
}: ReceiptModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const taxRate = Number(organization.taxRate) / 100;
  const subtotal = transaction.amount / (1 + taxRate);
  const tax = transaction.amount - subtotal;

  const formattedDate = new Date(transaction.createdAt).toLocaleDateString();
  const formattedTime = new Date(transaction.createdAt).toLocaleTimeString();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:bg-white" role="dialog" aria-modal="true">
      <div className="absolute inset-0 print:hidden" onClick={onClose} />
      <div className="bg-surface-raised rounded-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative z-10 print:max-w-full print:rounded-none print:shadow-none">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 print:mb-8">
          <div>
            <h2 className="text-2xl font-bold">{organization.name}</h2>
            <p className="text-sm text-foreground-muted">Receipt</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-overlay rounded-lg print:hidden"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Receipt Info */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-foreground-muted">Receipt Number</p>
            <p className="font-medium">{transaction.id}</p>
          </div>
          <div>
            <p className="text-foreground-muted">Date</p>
            <p className="font-medium">{formattedDate} {formattedTime}</p>
          </div>
          {transaction.customerName && (
            <div>
              <p className="text-foreground-muted">Customer</p>
              <p className="font-medium">{transaction.customerName}</p>
            </div>
          )}
          <div>
            <p className="text-foreground-muted">Payment Method</p>
            <p className="font-medium capitalize">{transaction.paymentMethod || "N/A"}</p>
          </div>
        </div>

        <hr className="my-6" />

        {/* Items */}
        <div className="mb-6">
          <h3 className="font-medium mb-3">Items</h3>
          {transaction.items && transaction.items.length > 0 ? (
            <div className="space-y-2">
              {transaction.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{item.description}</p>
                    <p className="text-foreground-muted">
                      {item.quantity} × {organization.currency.toUpperCase()} {item.unitPrice.toFixed(2)}
                    </p>
                  </div>
                  <p className="font-medium">{organization.currency.toUpperCase()} {item.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">No itemized details</p>
          )}
        </div>

        <hr className="my-6" />

        {/* Totals */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-foreground-muted">Subtotal</span>
            <span>{organization.currency.toUpperCase()} {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-foreground-muted">{organization.taxName}</span>
            <span>{organization.currency.toUpperCase()} {tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total</span>
            <span className="text-success">{organization.currency.toUpperCase()} {transaction.amount.toFixed(2)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-6 border-t">
          <p className="text-sm text-foreground-muted">Thank you for your business!</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover font-medium"
          >
            Print Receipt
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 border rounded-lg hover:bg-surface-inset"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Transaction Details Modal
// ============================================================================

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction;
  organization: Organization;
}

export function TransactionDetailsModal({
  isOpen,
  onClose,
  transaction,
  organization,
}: TransactionDetailsModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formattedDate = new Date(transaction.createdAt).toLocaleDateString();
  const formattedTime = new Date(transaction.createdAt).toLocaleTimeString();

  const typeColors: Record<string, string> = {
    sale: "bg-success-muted text-success",
    refund: "bg-danger-muted text-danger",
    deposit: "bg-brand-muted text-brand",
    payment: "bg-info-muted text-info",
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="bg-surface-raised rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative z-10">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-bold">Transaction Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-overlay rounded-lg"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Refund Warning */}
        {transaction.refundedTransactionId && (
          <div className="mb-4 p-4 bg-warning-muted border border-warning rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-warning">This transaction has been refunded</p>
            </div>
          </div>
        )}

        {/* Transaction Info */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-surface-inset rounded-lg">
            <div>
              <p className="text-sm text-foreground-muted">Transaction ID</p>
              <p className="font-medium break-all">{transaction.id}</p>
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Type</p>
              <span className={`text-xs px-2 py-1 rounded capitalize ${typeColors[transaction.type] || "bg-surface-inset text-foreground"}`}>
                {transaction.type}
              </span>
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Date & Time</p>
              <p className="font-medium">{formattedDate} {formattedTime}</p>
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Amount</p>
              <p className="font-medium text-lg">
                {organization.currency.toUpperCase()} {transaction.amount.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Payment Details */}
          <div className="p-4 bg-surface-inset rounded-lg">
            <h3 className="font-medium mb-3">Payment Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-foreground-muted">Payment Method</p>
                <p className="font-medium capitalize">{transaction.paymentMethod || "N/A"}</p>
              </div>
              {transaction.stripePaymentId && (
                <div>
                  <p className="text-sm text-foreground-muted">Stripe Payment ID</p>
                  <p className="font-medium text-sm break-all">{transaction.stripePaymentId}</p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Info */}
          {(transaction.customerName || transaction.customerEmail) && (
            <div className="p-4 bg-surface-inset rounded-lg">
              <h3 className="font-medium mb-3">Customer</h3>
              <div className="space-y-2">
                {transaction.customerName && (
                  <div>
                    <p className="text-sm text-foreground-muted">Name</p>
                    <p className="font-medium">{transaction.customerName}</p>
                  </div>
                )}
                {transaction.customerEmail && (
                  <div>
                    <p className="text-sm text-foreground-muted">Email</p>
                    <p className="font-medium">{transaction.customerEmail}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items */}
          {transaction.items && transaction.items.length > 0 && (
            <div className="p-4 bg-surface-inset rounded-lg">
              <h3 className="font-medium mb-3">Items</h3>
              <div className="space-y-2">
                {transaction.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm pb-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-foreground-muted">
                        Qty: {item.quantity} × {organization.currency.toUpperCase()} {item.unitPrice.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-medium">{organization.currency.toUpperCase()} {item.total.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full py-3 border rounded-lg hover:bg-surface-inset"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Email Confirmation Modal
// ============================================================================

interface EmailConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  transaction: Transaction;
  organization: Organization;
  isLoading: boolean;
}

export function EmailConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  transaction,
  organization,
  isLoading,
}: EmailConfirmationModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const formattedDate = new Date(transaction.createdAt).toLocaleDateString();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={!isLoading ? onClose : undefined} />
      <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md relative z-10">
        <h2 className="text-xl font-bold mb-4">Email Receipt</h2>

        <div className="space-y-4 mb-6">
          <p className="text-foreground-muted">
            Send receipt to <span className="font-medium text-foreground">{transaction.customerEmail}</span>?
          </p>

          <div className="p-4 bg-surface-inset rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground-muted">Receipt #</span>
              <span className="font-medium">{transaction.id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Amount</span>
              <span className="font-medium">{organization.currency.toUpperCase()} {transaction.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Date</span>
              <span className="font-medium">{formattedDate}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 border rounded-lg hover:bg-surface-inset disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-surface-overlay disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? "Sending..." : "Send Email"}
          </button>
        </div>
      </div>
    </div>
  );
}

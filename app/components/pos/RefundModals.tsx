/**
 * POS Refund Modals
 */

import { useState, useEffect } from "react";
import { useFetcher } from "react-router";

interface TransactionData {
  id: string;
  amount: string;
  paymentMethod: string;
  stripePaymentId: string | null;
  items: Array<{
    type: string;
    name: string;
    quantity?: number;
    unitPrice: number;
    total: number;
  }>;
  createdAt: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

interface TransactionLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionFound: (transaction: TransactionData) => void;
}

interface RefundConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionData;
  onConfirm: (refundReason: string) => void;
}

// Transaction Lookup Modal
export function TransactionLookupModal({
  isOpen,
  onClose,
  onTransactionFound,
}: TransactionLookupModalProps) {
  const fetcher = useFetcher();
  const [transactionId, setTransactionId] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Handle fetcher response
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const data = fetcher.data as { transaction?: TransactionData; error?: string };

      if (data.error) {
        setError(data.error);
      } else if (data.transaction) {
        setError(null);
        onTransactionFound(data.transaction);
      }
    }
  }, [fetcher.state, fetcher.data, onTransactionFound]);

  const handleSearch = () => {
    if (!transactionId.trim()) {
      setError("Please enter a transaction ID");
      return;
    }

    setError(null);

    const formData = new FormData();
    formData.append("intent", "lookup-transaction");
    formData.append("transactionId", transactionId.trim());
    fetcher.submit(formData, { method: "POST" });
  };

  const handleClose = () => {
    setTransactionId("");
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Lookup Transaction</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Transaction ID (Receipt Number)</label>
            <input
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Enter transaction ID..."
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-brand"
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 bg-danger-muted border border-danger rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-danger flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-danger">{error}</p>
              </div>
            </div>
          )}

          {fetcher.state === "submitting" && (
            <div className="text-center py-4">
              <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-foreground-muted">Searching...</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClose}
            className="flex-1 py-3 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </button>
          <button
            onClick={handleSearch}
            disabled={!transactionId.trim() || fetcher.state === "submitting"}
            className="flex-1 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-surface-overlay disabled:cursor-not-allowed font-medium"
          >
            Search
          </button>
        </div>
      </div>
    </div>
  );
}

// Refund Confirmation Modal
export function RefundConfirmationModal({
  isOpen,
  onClose,
  transaction,
  onConfirm,
}: RefundConfirmationModalProps) {
  const [refundReason, setRefundReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = () => {
    if (!refundReason) {
      return;
    }
    setIsProcessing(true);
    onConfirm(refundReason);
  };

  const handleClose = () => {
    setRefundReason("");
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  const amount = Math.abs(Number(transaction.amount));
  const formattedDate = new Date(transaction.createdAt).toLocaleDateString();
  const formattedTime = new Date(transaction.createdAt).toLocaleTimeString();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-raised rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Confirm Refund</h2>

        {/* Transaction Summary */}
        <div className="space-y-4 mb-6">
          <div className="p-4 bg-surface-inset rounded-lg">
            <h3 className="font-medium mb-3">Transaction Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-foreground-muted">Receipt Number</p>
                <p className="font-medium">{transaction.id}</p>
              </div>
              <div>
                <p className="text-foreground-muted">Date</p>
                <p className="font-medium">{formattedDate} {formattedTime}</p>
              </div>
              {transaction.customer && (
                <div>
                  <p className="text-foreground-muted">Customer</p>
                  <p className="font-medium">
                    {transaction.customer.firstName} {transaction.customer.lastName}
                  </p>
                </div>
              )}
              <div>
                <p className="text-foreground-muted">Payment Method</p>
                <p className="font-medium capitalize">{transaction.paymentMethod}</p>
              </div>
              <div>
                <p className="text-foreground-muted">Total Amount</p>
                <p className="font-medium text-lg">${amount.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Items List */}
          <div className="p-4 bg-surface-inset rounded-lg">
            <h3 className="font-medium mb-3">Items</h3>
            <div className="space-y-2">
              {transaction.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    {item.quantity && (
                      <p className="text-foreground-muted">Qty: {item.quantity} × ${item.unitPrice.toFixed(2)}</p>
                    )}
                  </div>
                  <p className="font-medium">${item.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Refund Reason */}
          <div>
            <label className="block text-sm font-medium mb-2">Refund Reason</label>
            <select
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-brand"
            >
              <option value="">Select a reason...</option>
              <option value="product_return">Product Return</option>
              <option value="service_cancellation">Service Cancellation</option>
              <option value="customer_request">Customer Request</option>
              <option value="price_adjustment">Price Adjustment</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Warning Message */}
          <div className="p-4 bg-warning-muted border border-warning rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-warning flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-medium text-warning">Refund Confirmation</p>
                <p className="text-sm text-warning mt-1">
                  This will refund ${amount.toFixed(2)} to the customer via {transaction.paymentMethod}.
                </p>
                {transaction.paymentMethod === "card" && transaction.stripePaymentId && (
                  <p className="text-sm text-warning mt-1">
                    A Stripe refund will be processed automatically.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="flex-1 py-3 border rounded-lg hover:bg-surface-inset disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!refundReason || isProcessing}
            className="flex-1 py-3 bg-danger text-white rounded-lg hover:bg-danger-hover disabled:bg-surface-overlay disabled:cursor-not-allowed font-medium"
          >
            {isProcessing ? "Processing..." : `Confirm Refund $${amount.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

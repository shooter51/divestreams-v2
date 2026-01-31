/**
 * POS Transaction Action Buttons
 */

interface TransactionActionsProps {
  transaction: {
    id: string;
    type: string;
    customerEmail: string | null;
    refundedTransactionId: string | null;
  };
  onViewReceipt: () => void;
  onViewDetails: () => void;
  onEmailReceipt: () => void;
  onRefund: () => void;
}

export function TransactionActions({
  transaction,
  onViewReceipt,
  onViewDetails,
  onEmailReceipt,
  onRefund,
}: TransactionActionsProps) {
  const canEmail = !!transaction.customerEmail;
  const canRefund = transaction.type !== "refund" && !transaction.refundedTransactionId;

  return (
    <div className="flex gap-2">
      {/* View Receipt */}
      <button
        onClick={onViewReceipt}
        className="p-2 hover:bg-surface-overlay rounded-lg transition-colors"
        title="View Receipt"
        aria-label="View Receipt"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </button>

      {/* View Details */}
      <button
        onClick={onViewDetails}
        className="p-2 hover:bg-surface-overlay rounded-lg transition-colors"
        title="View Details"
        aria-label="View Details"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Email Receipt */}
      <button
        onClick={onEmailReceipt}
        disabled={!canEmail}
        className={`p-2 rounded-lg transition-colors ${
          canEmail
            ? "hover:bg-surface-overlay"
            : "opacity-40 cursor-not-allowed"
        }`}
        title={canEmail ? "Email Receipt" : "No customer email"}
        aria-label="Email Receipt"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Refund */}
      <button
        onClick={onRefund}
        disabled={!canRefund}
        className={`p-2 rounded-lg transition-colors ${
          canRefund
            ? "hover:bg-danger-muted text-danger"
            : "opacity-40 cursor-not-allowed"
        }`}
        title={
          transaction.type === "refund"
            ? "Cannot refund a refund"
            : transaction.refundedTransactionId
            ? "Already refunded"
            : "Refund Transaction"
        }
        aria-label="Refund Transaction"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>
    </div>
  );
}

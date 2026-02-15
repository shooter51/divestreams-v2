/**
 * POS Checkout Modals
 */

import { useState, useEffect, useCallback } from "react";
import { useFetcher } from "react-router";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onComplete: (payments: Array<{ method: "card" | "cash"; amount: number; stripePaymentIntentId?: string }>) => void;
}

interface CardModalProps extends CheckoutModalProps {
  stripeConnected: boolean;
  stripePublishableKey: string | null;
  hasTerminalReaders: boolean;
  customerId?: string;
}

type CardModalStep = "method-select" | "manual-entry" | "terminal" | "processing" | "success" | "error";

// Stripe types (loaded dynamically)
type StripeType = {
  elements: (options?: object) => StripeElementsType;
  confirmCardPayment: (clientSecret: string, data: object) => Promise<{ error?: { message: string }; paymentIntent?: { id: string; status: string } }>;
};
type StripeElementsType = {
  create: (type: string, options?: object) => StripeCardElementType;
};
type StripeCardElementType = {
  mount: (selector: string | HTMLElement) => void;
  unmount: () => void;
  on: (event: string, handler: (e: { complete: boolean; error?: { message: string } }) => void) => void;
};

// Card Payment Modal with Stripe Integration
export function CardModal({
  isOpen,
  onClose,
  total,
  onComplete,
  stripeConnected,
  stripePublishableKey,
  hasTerminalReaders,
  customerId,
}: CardModalProps) {
  const fetcher = useFetcher();
  const [step, setStep] = useState<CardModalStep>("method-select");
  const [error, setError] = useState<string | null>(null);
  const [stripe, setStripe] = useState<StripeType | null>(null);
  const [cardElement, setCardElement] = useState<StripeCardElementType | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  // Load Stripe.js when modal opens with manual entry
  useEffect(() => {
    if (!isOpen || !stripePublishableKey || step !== "manual-entry") return;

    // Check if Stripe is already loaded
    if ((window as unknown as { Stripe?: (key: string) => StripeType }).Stripe) {
      const stripeInstance = (window as unknown as { Stripe: (key: string) => StripeType }).Stripe(stripePublishableKey);
      setStripe(stripeInstance);
      return;
    }

    // Load Stripe.js
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.onload = () => {
      if ((window as unknown as { Stripe?: (key: string) => StripeType }).Stripe) {
        const stripeInstance = (window as unknown as { Stripe: (key: string) => StripeType }).Stripe(stripePublishableKey);
        setStripe(stripeInstance);
      }
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup script if modal closes
    };
  }, [isOpen, stripePublishableKey, step]);

  // Mount card element when Stripe is loaded
  useEffect(() => {
    if (!stripe || step !== "manual-entry") return;

    const elements = stripe.elements();
    const card = elements.create("card", {
      style: {
        base: {
          fontSize: "16px",
          color: "#424770",
          "::placeholder": { color: "#aab7c4" },
        },
        invalid: { color: "#9e2146" },
      },
    });

    // Wait for the DOM element to be available
    const mountCard = () => {
      const cardContainer = document.getElementById("stripe-card-element");
      if (cardContainer) {
        card.mount("#stripe-card-element");
        card.on("change", (e) => {
          setCardComplete(e.complete);
          if (e.error) {
            setError(e.error.message);
          } else {
            setError(null);
          }
        });
        setCardElement(card);
      } else {
        // Retry after a short delay
        setTimeout(mountCard, 100);
      }
    };

    mountCard();

    return () => {
      card.unmount();
      setCardElement(null);
    };
  }, [stripe, step]);

  // Handle fetcher response for payment intent creation
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const data = fetcher.data as { clientSecret?: string; paymentIntentId?: string; error?: string };

      if (data.error) {
        setError(data.error);
        setStep("error");
      } else if (data.clientSecret && stripe && cardElement) {
        // Confirm the payment
        confirmPayment(data.clientSecret, data.paymentIntentId!);
      }
    }
  }, [fetcher.state, fetcher.data, stripe, cardElement]);

  const confirmPayment = async (clientSecret: string, intentId: string) => {
    if (!stripe || !cardElement) return;

    setStep("processing");

    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    });

    if (result.error) {
      setError(result.error.message || "Payment failed");
      setStep("error");
    } else if (result.paymentIntent?.status === "succeeded") {
      setPaymentIntentId(intentId);
      setStep("success");
      // Auto-complete after showing success
      setTimeout(() => {
        onComplete([{ method: "card", amount: total, stripePaymentIntentId: intentId }]);
        handleClose();
      }, 1500);
    }
  };

  const handleManualEntry = () => {
    setStep("manual-entry");
  };

  const handleTerminal = () => {
    setStep("terminal");
    // Terminal implementation would go here
    // For now, show a placeholder
  };

  const handlePaymentSubmit = () => {
    if (!cardComplete) {
      setError("Please enter complete card details");
      return;
    }

    setError(null);
    setStep("processing");

    // Create payment intent via action
    const formData = new FormData();
    formData.append("intent", "create-payment-intent");
    formData.append("amount", Math.round(total * 100).toString()); // Convert to cents
    if (customerId) {
      formData.append("customerId", customerId);
    }
    fetcher.submit(formData, { method: "post" });
  };

  const handleClose = useCallback(() => {
    setStep("method-select");
    setError(null);
    setCardComplete(false);
    setPaymentIntentId(null);
    onClose();
  }, [onClose]);

  const handleRetry = () => {
    setError(null);
    setStep("manual-entry");
  };

  if (!isOpen) return null;

  // Not connected state
  if (!stripeConnected) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
          <h2 className="text-xl font-bold mb-4">Card Payment</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Total Due</label>
              <p className="text-3xl font-bold text-brand">${total.toFixed(2)}</p>
            </div>
            <div className="p-6 bg-warning-muted border border-warning rounded-lg text-center">
              <div className="w-12 h-12 bg-warning-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-warning font-medium mb-2">Stripe Not Connected</p>
              <p className="text-sm text-warning">Connect Stripe in Settings → Integrations to accept card payments</p>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleClose} className="flex-1 py-3 border rounded-lg hover:bg-surface-inset">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Method selection
  if (step === "method-select") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
          <h2 className="text-xl font-bold mb-4">Card Payment</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Total Due</label>
              <p className="text-3xl font-bold text-brand">${total.toFixed(2)}</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={handleManualEntry}
                className="w-full p-4 border-2 border-brand rounded-lg hover:border-brand hover:bg-brand-muted transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-muted rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">Enter Card Manually</p>
                    <p className="text-sm text-foreground-muted">Type card number, expiry, and CVC</p>
                  </div>
                </div>
              </button>
              <button
                onClick={handleTerminal}
                disabled={!hasTerminalReaders}
                className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                  hasTerminalReaders
                    ? "border-success hover:border-success hover:bg-success-muted"
                    : "border-border bg-surface-inset cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    hasTerminalReaders ? "bg-success-muted" : "bg-surface-overlay"
                  }`}>
                    <svg className={`w-5 h-5 ${hasTerminalReaders ? "text-success" : "text-foreground-subtle"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>
                  <div>
                    <p className={`font-medium ${!hasTerminalReaders && "text-foreground-subtle"}`}>Use Card Reader</p>
                    <p className={`text-sm ${hasTerminalReaders ? "text-foreground-muted" : "text-foreground-subtle"}`}>
                      {hasTerminalReaders ? "Tap, insert, or swipe card" : "No reader connected"}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleClose} className="flex-1 py-3 border rounded-lg hover:bg-surface-inset">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Manual card entry
  if (step === "manual-entry") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
          <h2 className="text-xl font-bold mb-4">Enter Card Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Total Due</label>
              <p className="text-3xl font-bold text-brand">${total.toFixed(2)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Card Information</label>
              <div
                id="stripe-card-element"
                className="p-3 border rounded-lg bg-surface-raised min-h-[44px]"
              />
              {error && <p className="text-sm text-danger mt-2">{error}</p>}
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep("method-select")}
              className="flex-1 py-3 border rounded-lg hover:bg-surface-inset"
            >
              Back
            </button>
            <button
              onClick={handlePaymentSubmit}
              disabled={!cardComplete || fetcher.state !== "idle"}
              className="flex-1 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-surface-overlay disabled:cursor-not-allowed font-medium"
            >
              Pay ${total.toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Terminal placeholder
  if (step === "terminal") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
          <h2 className="text-xl font-bold mb-4">Card Reader</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Total Due</label>
              <p className="text-3xl font-bold text-brand">${total.toFixed(2)}</p>
            </div>
            <div className="p-8 bg-surface-inset rounded-lg text-center">
              <div className="w-16 h-16 bg-success-muted rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-foreground">Present Card on Reader</p>
              <p className="text-sm text-foreground-muted mt-1">Tap, insert, or swipe the customer's card</p>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep("method-select")}
              className="flex-1 py-3 border rounded-lg hover:bg-surface-inset"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Processing state
  if (step === "processing") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
          <div className="text-center py-8">
            <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium">Processing Payment...</p>
            <p className="text-sm text-foreground-muted mt-1">Please wait</p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (step === "success") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-success-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-medium text-success">Payment Approved</p>
            <p className="text-3xl font-bold mt-2">${total.toFixed(2)}</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (step === "error") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-danger-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-lg font-medium text-danger">Payment Failed</p>
            <p className="text-sm text-foreground-muted mt-2">{error || "An error occurred"}</p>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleClose} className="flex-1 py-3 border rounded-lg hover:bg-surface-inset">
              Cancel
            </button>
            <button
              onClick={handleRetry}
              className="flex-1 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Cash Payment Modal
export function CashModal({ isOpen, onClose, total, onComplete }: CheckoutModalProps) {
  const [tendered, setTendered] = useState("");
  const tenderedAmount = parseFloat(tendered) || 0;
  const change = tenderedAmount - total;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Cash Payment</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Total Due</label>
            <p className="text-3xl font-bold text-brand">${total.toFixed(2)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Amount Tendered</label>
            <input
              type="number"
              step="0.01"
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              className="w-full px-4 py-3 text-2xl border rounded-lg focus:ring-2 focus:ring-brand"
              placeholder="0.00"
              autoFocus
            />
          </div>

          {tenderedAmount >= total && (
            <div className="p-4 bg-success-muted rounded-lg">
              <label className="block text-sm font-medium mb-1">Change Due</label>
              <p className="text-3xl font-bold text-success">${change.toFixed(2)}</p>
            </div>
          )}

          {/* Quick amount buttons */}
          <div className="grid grid-cols-4 gap-2">
            {[20, 50, 100, Math.ceil(total)].map(amount => (
              <button
                key={amount}
                onClick={() => setTendered(amount.toString())}
                className="py-2 bg-surface-inset rounded-lg hover:bg-surface-overlay font-medium"
              >
                ${amount}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              setTendered("");
              onClose();
            }}
            className="flex-1 py-3 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </button>
          <button
            onClick={() => onComplete([{ method: "cash", amount: total }])}
            disabled={tenderedAmount < total}
            className="flex-1 py-3 bg-success text-white rounded-lg hover:bg-success-hover disabled:bg-surface-overlay disabled:cursor-not-allowed font-medium"
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  );
}

// Split Payment Modal
export function SplitModal({ isOpen, onClose, total, onComplete }: CheckoutModalProps) {
  const [payments, setPayments] = useState<Array<{ method: "card" | "cash"; amount: number }>>([]);
  const [currentMethod, setCurrentMethod] = useState<"card" | "cash">("card");
  const [currentAmount, setCurrentAmount] = useState("");

  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - paidAmount;

  const addPayment = () => {
    const amount = parseFloat(currentAmount);
    if (!isNaN(amount) && amount > 0 && amount <= remaining) {
      setPayments([...payments, { method: currentMethod, amount }]);
      setCurrentAmount("");
    }
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Split Payment</h2>

        <div className="space-y-4">
          <div className="flex justify-between">
            <span>Total</span>
            <span className="font-bold">${total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-success">
            <span>Paid</span>
            <span className="font-bold">${paidAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg">
            <span>Remaining</span>
            <span className="font-bold text-brand">${remaining.toFixed(2)}</span>
          </div>

          {/* Existing payments */}
          {payments.length > 0 && (
            <div className="space-y-2">
              {payments.map((payment, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-surface-inset rounded">
                  <span className="capitalize">{payment.method}</span>
                  <div className="flex items-center gap-2">
                    <span>${payment.amount.toFixed(2)}</span>
                    <button
                      onClick={() => removePayment(index)}
                      className="text-danger hover:text-danger"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add payment */}
          {remaining > 0 && (
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentMethod("card")}
                  className={`flex-1 py-2 rounded-lg ${
                    currentMethod === "card"
                      ? "bg-brand text-white"
                      : "bg-surface-inset hover:bg-surface-overlay"
                  }`}
                >
                  Card
                </button>
                <button
                  onClick={() => setCurrentMethod("cash")}
                  className={`flex-1 py-2 rounded-lg ${
                    currentMethod === "cash"
                      ? "bg-success text-white"
                      : "bg-surface-inset hover:bg-surface-overlay"
                  }`}
                >
                  Cash
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  placeholder="Amount"
                  className="flex-1 px-3 py-2 border rounded-lg"
                />
                <button
                  onClick={() => setCurrentAmount(remaining.toFixed(2))}
                  className="px-3 py-2 bg-surface-inset rounded-lg hover:bg-surface-overlay text-sm"
                >
                  Rest
                </button>
                <button
                  onClick={addPayment}
                  disabled={!currentAmount || parseFloat(currentAmount) <= 0}
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-surface-overlay"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              setPayments([]);
              onClose();
            }}
            className="flex-1 py-3 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </button>
          <button
            onClick={() => onComplete(payments)}
            disabled={remaining > 0.01}
            className="flex-1 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-surface-overlay disabled:cursor-not-allowed font-medium"
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  );
}

// Rental Agreement Modal
interface RentalAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (staffName: string) => void;
  customer: { firstName: string; lastName: string; email: string; phone?: string | null } | null;
  rentals: Array<{
    name: string;
    size?: string;
    days: number;
    dailyRate: number;
    total: number;
  }>;
  shopName: string;
  agreementNumber: string;
}

export function RentalAgreementModal({
  isOpen,
  onClose,
  onConfirm,
  customer,
  rentals,
  shopName,
  agreementNumber,
}: RentalAgreementModalProps) {
  const [staffName, setStaffName] = useState("");
  const [agreementSigned, setAgreementSigned] = useState(false);

  const dueDate = new Date();
  const maxDays = rentals.length > 0 ? Math.max(...rentals.map(r => r.days)) : 1;
  dueDate.setDate(dueDate.getDate() + maxDays);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-raised rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Rental Agreement Required</h2>

        {/* Printable Agreement Preview */}
        <div id="rental-agreement" className="p-6 border rounded-lg mb-4 print:border-none">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">{shopName}</h1>
            <h2 className="text-lg">Equipment Rental Agreement</h2>
            <p className="text-sm text-foreground-muted">Agreement #: {agreementNumber}</p>
            <p className="text-sm text-foreground-muted">{new Date().toLocaleDateString()}</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-bold mb-2">Customer</h3>
              <p>{customer.firstName} {customer.lastName}</p>
              <p>{customer.email}</p>
              {customer.phone && <p>{customer.phone}</p>}
            </div>
            <div>
              <h3 className="font-bold mb-2">Rental Period</h3>
              <p>From: {new Date().toLocaleDateString()}</p>
              <p>Due: {dueDate.toLocaleDateString()}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-bold mb-2">Equipment</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Item</th>
                  <th className="text-left py-2">Size</th>
                  <th className="text-right py-2">Days</th>
                  <th className="text-right py-2">Rate</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map((rental, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{rental.name}</td>
                    <td className="py-2">{rental.size || "-"}</td>
                    <td className="text-right py-2">{rental.days}</td>
                    <td className="text-right py-2">${rental.dailyRate.toFixed(2)}</td>
                    <td className="text-right py-2">${rental.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-6 text-sm">
            <h3 className="font-bold mb-2">Terms and Conditions</h3>
            <ol className="list-decimal list-inside space-y-1 text-foreground">
              <li>Equipment must be returned by the due date in the same condition.</li>
              <li>Customer is responsible for any damage or loss of equipment.</li>
              <li>Late returns will incur additional daily charges.</li>
              <li>Equipment should not be used beyond certified limits.</li>
              <li>Customer has inspected equipment and confirms it is in good working condition.</li>
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-8">
            <div>
              <p className="mb-8">Customer Signature: _______________________</p>
              <p>Date: _______________________</p>
            </div>
            <div>
              <p className="mb-8">Staff Signature: _______________________</p>
              <p>Date: _______________________</p>
            </div>
          </div>
        </div>

        {/* Confirmation Section */}
        <div className="space-y-4">
          <button
            onClick={handlePrint}
            className="w-full py-3 border-2 border-brand text-brand rounded-lg hover:bg-brand-muted font-medium"
          >
            Print Agreement
          </button>

          <div className="p-4 bg-surface-inset rounded-lg space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={agreementSigned}
                onChange={(e) => setAgreementSigned(e.target.checked)}
                className="w-5 h-5"
              />
              <span>Customer has signed the rental agreement</span>
            </label>

            <div>
              <label className="block text-sm font-medium mb-1">Staff Name</label>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(staffName)}
            disabled={!agreementSigned || !staffName.trim()}
            className="flex-1 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-surface-overlay disabled:cursor-not-allowed font-medium"
          >
            Continue to Payment
          </button>
        </div>
      </div>
    </div>
  );
}

// Customer Search Modal
interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: { id: string; firstName: string; lastName: string; email: string; phone?: string | null }) => void;
  onCreateNew: () => void;
  searchResults: Array<{ id: string; firstName: string; lastName: string; email: string; phone?: string | null }>;
  onSearch: (query: string) => void;
  isSearching: boolean;
}

export function CustomerSearchModal({
  isOpen,
  onClose,
  onSelect,
  onCreateNew,
  searchResults,
  onSearch,
  isSearching,
}: CustomerSearchModalProps) {
  const [query, setQuery] = useState("");

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.length >= 2) {
      onSearch(value);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Select Customer</h2>

        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name, email, or phone..."
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand mb-4"
          autoFocus
        />

        <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
          {isSearching ? (
            <p className="text-center text-foreground-muted py-4">Searching...</p>
          ) : searchResults.length > 0 ? (
            searchResults.map(customer => (
              <button
                key={customer.id}
                onClick={() => onSelect(customer)}
                className="w-full p-3 text-left border rounded-lg hover:border-brand hover:bg-brand-muted"
              >
                <p className="font-medium">{customer.firstName} {customer.lastName}</p>
                <p className="text-sm text-foreground-muted">{customer.email}</p>
                {customer.phone && <p className="text-sm text-foreground-muted">{customer.phone}</p>}
              </button>
            ))
          ) : query.length >= 2 ? (
            <p className="text-center text-foreground-muted py-4">No customers found</p>
          ) : (
            <p className="text-center text-foreground-muted py-4">Type to search...</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </button>
          <button
            onClick={onCreateNew}
            className="flex-1 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover font-medium"
          >
            New Customer
          </button>
        </div>
      </div>
    </div>
  );
}

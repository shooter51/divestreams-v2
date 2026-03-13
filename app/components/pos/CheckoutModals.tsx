/**
 * POS Checkout Modals
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useFetcher } from "react-router";
import { useT } from "../../i18n/use-t";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onComplete: (payments: Array<{ method: "card" | "cash"; amount: number; stripePaymentIntentId?: string; tendered?: number; change?: number }>) => void;
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
  const t = useT();
  const fetcher = useFetcher();
  const [step, setStep] = useState<CardModalStep>("method-select");
  const [error, setError] = useState<string | null>(null);
  const [stripe, setStripe] = useState<StripeType | null>(null);
  const [cardElement, setCardElement] = useState<StripeCardElementType | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{ clientSecret: string; paymentIntentId: string } | null>(null);

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

    // Get colors from CSS variables
    const computedStyle = getComputedStyle(document.documentElement);
    const foreground = computedStyle.getPropertyValue("--foreground").trim() || 'currentColor';
    const foregroundMuted = computedStyle.getPropertyValue("--foreground-muted").trim() || 'currentColor';
    const danger = computedStyle.getPropertyValue("--danger").trim() || 'currentColor';

    const elements = stripe.elements();
    const card = elements.create("card", {
      style: {
        base: {
          fontSize: "16px",
          color: foreground,
          "::placeholder": { color: foregroundMuted },
        },
        invalid: { color: danger },
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
      } else if (data.clientSecret && data.paymentIntentId) {
        // Store payment details - will be processed when Stripe is ready
        setPendingPayment({
          clientSecret: data.clientSecret,
          paymentIntentId: data.paymentIntentId,
        });
      }
    }
  }, [fetcher.state, fetcher.data]);

  // Process pending payment when Stripe and card element are ready
  useEffect(() => {
    if (pendingPayment && stripe && cardElement) {
      confirmPayment(pendingPayment.clientSecret, pendingPayment.paymentIntentId);
      setPendingPayment(null); // Clear pending payment
    }
  }, [pendingPayment, stripe, cardElement]);

  const confirmPayment = async (clientSecret: string, intentId: string) => {
    if (!stripe || !cardElement) return;

    setStep("processing");

    try {
      // Wrap Stripe call in Promise.race for 30-second timeout
      const result = await Promise.race([
        stripe.confirmCardPayment(clientSecret, {
          payment_method: { card: cardElement },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Payment timeout - please try again")), 30000)
        ),
      ]);

      if (result.error) {
        setError(result.error.message || "Payment failed");
        setStep("error");
      } else if (result.paymentIntent?.status === "succeeded") {
        setStep("success");
        // Auto-complete after showing success
        setTimeout(() => {
          onComplete([{ method: "card", amount: total, stripePaymentIntentId: intentId }]);
          handleClose();
        }, 1500);
      } else {
        // Handle unexpected response format
        console.error("Unexpected payment response:", result);
        setError("Payment status unclear - please contact support");
        setStep("error");
      }
    } catch (err) {
      // Handle timeout, network errors, and other exceptions
      const errorMessage = err instanceof Error ? err.message : "Payment failed - please try again";
      console.error("Payment confirmation error:", err);
      setError(errorMessage);
      setStep("error");
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
    setPendingPayment(null);
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
          <h2 className="text-xl font-bold mb-4">{t("tenant.pos.checkout.cardPayment")}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("tenant.pos.checkout.totalDue")}</label>
              <p className="text-3xl font-bold text-brand">${total.toFixed(2)}</p>
            </div>
            <div className="p-6 bg-warning-muted border border-warning rounded-lg text-center">
              <div className="w-12 h-12 bg-warning-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-warning font-medium mb-2">{t("tenant.pos.checkout.stripeNotConnected")}</p>
              <p className="text-sm text-warning">{t("tenant.pos.checkout.connectStripeMessage")}</p>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleClose} className="flex-1 py-3 border rounded-lg hover:bg-surface-inset">
              {t("common.cancel")}
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
          <h2 className="text-xl font-bold mb-4">{t("tenant.pos.checkout.cardPayment")}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("tenant.pos.checkout.totalDue")}</label>
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
                    <p className="font-medium">{t("tenant.pos.checkout.enterCardManually")}</p>
                    <p className="text-sm text-foreground-muted">{t("tenant.pos.checkout.typeCardDetails")}</p>
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
                    <p className={`font-medium ${!hasTerminalReaders && "text-foreground-subtle"}`}>{t("tenant.pos.checkout.useCardReader")}</p>
                    <p className={`text-sm ${hasTerminalReaders ? "text-foreground-muted" : "text-foreground-subtle"}`}>
                      {hasTerminalReaders ? t("tenant.pos.checkout.tapInsertSwipe") : t("tenant.pos.checkout.noReaderConnected")}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleClose} className="flex-1 py-3 border rounded-lg hover:bg-surface-inset">
              {t("common.cancel")}
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
          <h2 className="text-xl font-bold mb-4">{t("tenant.pos.checkout.enterCardDetails")}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("tenant.pos.checkout.totalDue")}</label>
              <p className="text-3xl font-bold text-brand">${total.toFixed(2)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t("tenant.pos.checkout.cardInformation")}</label>
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
              {t("common.back")}
            </button>
            <button
              onClick={handlePaymentSubmit}
              disabled={!cardComplete || fetcher.state !== "idle"}
              className="flex-1 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-surface-overlay disabled:cursor-not-allowed font-medium"
            >
              {t("tenant.pos.checkout.pay")} ${total.toFixed(2)}
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
          <h2 className="text-xl font-bold mb-4">{t("tenant.pos.checkout.cardReader")}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("tenant.pos.checkout.totalDue")}</label>
              <p className="text-3xl font-bold text-brand">${total.toFixed(2)}</p>
            </div>
            <div className="p-8 bg-surface-inset rounded-lg text-center">
              <div className="w-16 h-16 bg-success-muted rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-foreground">{t("tenant.pos.checkout.presentCard")}</p>
              <p className="text-sm text-foreground-muted mt-1">{t("tenant.pos.checkout.tapInsertSwipeCustomer")}</p>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep("method-select")}
              className="flex-1 py-3 border rounded-lg hover:bg-surface-inset"
            >
              {t("common.cancel")}
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
            <p className="text-lg font-medium">{t("tenant.pos.checkout.processingPayment")}</p>
            <p className="text-sm text-foreground-muted mt-1">{t("tenant.pos.checkout.pleaseWait")}</p>
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
            <p className="text-lg font-medium text-success">{t("tenant.pos.checkout.paymentApproved")}</p>
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
            <p className="text-lg font-medium text-danger">{t("tenant.pos.checkout.paymentFailed")}</p>
            <p className="text-sm text-foreground-muted mt-2">{error || t("tenant.pos.checkout.anErrorOccurred")}</p>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleClose} className="flex-1 py-3 border rounded-lg hover:bg-surface-inset">
              {t("common.cancel")}
            </button>
            <button
              onClick={handleRetry}
              className="flex-1 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover font-medium"
            >
              {t("tenant.pos.checkout.tryAgain")}
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
  const t = useT();
  const [tendered, setTendered] = useState("");
  const tenderedAmount = parseFloat(tendered) || 0;
  const change = tenderedAmount - total;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{t("tenant.pos.checkout.cashPayment")}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("tenant.pos.checkout.totalDue")}</label>
            <p className="text-3xl font-bold text-brand">${total.toFixed(2)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t("tenant.pos.checkout.amountTendered")}</label>
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
              <label className="block text-sm font-medium mb-1">{t("tenant.pos.checkout.changeDue")}</label>
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
            {t("common.cancel")}
          </button>
          <button
            onClick={() => onComplete([{ method: "cash", amount: total, tendered: tenderedAmount, change: Math.max(0, change) }])}
            disabled={tenderedAmount < total}
            className="flex-1 py-3 bg-success text-white rounded-lg hover:bg-success-hover disabled:bg-surface-overlay disabled:cursor-not-allowed font-medium"
          >
            {t("tenant.pos.checkout.completeSale")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Split Payment Modal - supports Cash and Credit Card splits
interface SplitModalProps extends CheckoutModalProps {
  stripeConnected: boolean;
  stripePublishableKey: string | null;
  customerId?: string;
}

export function SplitModal({
  isOpen,
  onClose,
  total,
  onComplete,
  stripeConnected,
  stripePublishableKey,
  customerId
}: SplitModalProps) {
  const t = useT();
  const fetcher = useFetcher();
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [payments, setPayments] = useState<Array<{ method: "cash" | "card"; amount: number; stripePaymentIntentId?: string; tendered?: number; change?: number }>>([]);
  const [currentAmount, setCurrentAmount] = useState("");
  const [currentMethod, setCurrentMethod] = useState<"cash" | "card">("cash");
  const [processingCard, setProcessingCard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripe, setStripe] = useState<StripeType | null>(null);
  const [cardElement, setCardElement] = useState<StripeCardElementType | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [pendingCardPayment, setPendingCardPayment] = useState<{ amount: number; clientSecret: string; paymentIntentId: string } | null>(null);

  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - paidAmount;

  // Load Stripe.js when modal opens
  useEffect(() => {
    if (!isOpen || !stripePublishableKey) return;

    if ((window as unknown as { Stripe?: (key: string) => StripeType }).Stripe) {
      const stripeInstance = (window as unknown as { Stripe: (key: string) => StripeType }).Stripe(stripePublishableKey);
      setStripe(stripeInstance);
      return;
    }

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
  }, [isOpen, stripePublishableKey]);

  // Mount card element when Stripe is loaded and card method is selected
  useEffect(() => {
    if (!stripe || currentMethod !== "card") return;

    const computedStyle = getComputedStyle(document.documentElement);
    const foreground = computedStyle.getPropertyValue("--foreground").trim() || 'currentColor';
    const foregroundMuted = computedStyle.getPropertyValue("--foreground-muted").trim() || 'currentColor';
    const danger = computedStyle.getPropertyValue("--danger").trim() || 'currentColor';

    const elements = stripe.elements();
    const card = elements.create("card", {
      style: {
        base: {
          fontSize: "16px",
          color: foreground,
          "::placeholder": { color: foregroundMuted },
        },
        invalid: { color: danger },
      },
    });

    const mountCard = () => {
      const cardContainer = document.getElementById("split-stripe-card-element");
      if (cardContainer) {
        card.mount("#split-stripe-card-element");
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
        setTimeout(mountCard, 100);
      }
    };

    mountCard();

    return () => {
      card.unmount();
      setCardElement(null);
    };
  }, [stripe, currentMethod]);

  // Handle fetcher response for payment intent creation
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const data = fetcher.data as { clientSecret?: string; paymentIntentId?: string; error?: string };

      if (data.error) {
        setError(data.error);
        setProcessingCard(false);
      } else if (data.clientSecret && data.paymentIntentId) {
        const amount = parseFloat(currentAmount);
        setPendingCardPayment({
          amount,
          clientSecret: data.clientSecret,
          paymentIntentId: data.paymentIntentId,
        });
      }
    }
  }, [fetcher.state, fetcher.data, currentAmount]);

  // Process pending card payment
  useEffect(() => {
    if (pendingCardPayment && stripe && cardElement) {
      confirmCardPayment(pendingCardPayment);
      setPendingCardPayment(null);
    }
  }, [pendingCardPayment, stripe, cardElement]);

  const confirmCardPayment = async (payment: { amount: number; clientSecret: string; paymentIntentId: string }) => {
    if (!stripe || !cardElement) return;

    try {
      // Add 30-second timeout protection (matches CardModal pattern)
      const result = await Promise.race([
        stripe.confirmCardPayment(payment.clientSecret, {
          payment_method: { card: cardElement },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Payment timeout - please try again")), 30000)
        ),
      ]);

      if (result.error) {
        setError(result.error.message || "Payment failed");
        setProcessingCard(false);
      } else if (result.paymentIntent?.status === "succeeded") {
        // Add card payment to list
        setPayments([...payments, {
          method: "card",
          amount: payment.amount,
          stripePaymentIntentId: payment.paymentIntentId
        }]);
        setCurrentAmount("");
        setProcessingCard(false);
        setError(null);
        setCardComplete(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Payment failed";
      setError(errorMessage);
      setProcessingCard(false);
    }
  };

  const addCashPayment = () => {
    // Read from DOM ref first - more reliable than React state when Playwright's
    // fill() triggers onChange but the state update hasn't committed before click.
    const inputValue = amountInputRef.current?.value ?? currentAmount;
    const amount = parseFloat(inputValue);
    if (!isNaN(amount) && amount > 0 && amount <= remaining + 0.005) {
      // If within 0.5 cents of remaining, treat as full payment (handles floating-point display rounding)
      const adjustedAmount = amount >= remaining - 0.005 ? remaining : Math.min(amount, remaining);
      setPayments([...payments, { method: "cash", amount: adjustedAmount, tendered: adjustedAmount, change: 0 }]);
      setCurrentAmount("");
      if (amountInputRef.current) amountInputRef.current.value = "";
      setError(null);
    }
  };

  const addCardPayment = () => {
    const amount = parseFloat(currentAmount);
    if (!isNaN(amount) && amount > 0 && amount <= remaining + 0.005) {
      if (!cardComplete) {
        setError("Please enter complete card details");
        return;
      }

      setError(null);
      setProcessingCard(true);

      const formData = new FormData();
      formData.append("intent", "create-payment-intent");
      formData.append("amount", Math.round(amount * 100).toString());
      if (customerId) {
        formData.append("customerId", customerId);
      }
      fetcher.submit(formData, { method: "post" });
    }
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    setPayments([]);
    setCurrentAmount("");
    setCurrentMethod("cash");
    setError(null);
    setProcessingCard(false);
    setCardComplete(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-raised rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{t("tenant.pos.checkout.splitPayment")}</h2>

        <div className="space-y-4">
          <div className="flex justify-between">
            <span>{t("common.total")}</span>
            <span className="font-bold">${total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-success">
            <span>{t("tenant.pos.checkout.paid")}</span>
            <span className="font-bold">${paidAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg">
            <span>{t("tenant.pos.checkout.remaining")}</span>
            <span className="font-bold text-brand">${remaining.toFixed(2)}</span>
          </div>

          {/* Existing payments */}
          {payments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground-muted">{t("tenant.pos.checkout.paymentsAdded")}</p>
              {payments.map((payment, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-surface-inset rounded-lg">
                  <div className="flex items-center gap-2">
                    {payment.method === "cash" ? (
                      <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    )}
                    <span className="font-medium capitalize">{payment.method}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">${payment.amount.toFixed(2)}</span>
                    <button
                      onClick={() => removePayment(index)}
                      className="text-danger hover:text-danger text-xl font-bold"
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
            <div className="p-4 border-2 border-brand rounded-lg space-y-3 max-w-full break-words">
              <p className="text-sm font-medium">{t("tenant.pos.checkout.addPayment")}</p>

              {/* Payment method tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentMethod("cash")}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors ${
                    currentMethod === "cash"
                      ? "bg-success text-white"
                      : "bg-surface-inset hover:bg-surface-overlay"
                  }`}
                >
                  {t("tenant.pos.cart.cash")}
                </button>
                <button
                  onClick={() => setCurrentMethod("card")}
                  disabled={!stripeConnected}
                  className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors ${
                    currentMethod === "card"
                      ? "bg-brand text-white"
                      : stripeConnected
                      ? "bg-surface-inset hover:bg-surface-overlay"
                      : "bg-surface-inset opacity-50 cursor-not-allowed"
                  }`}
                >
                  {t("tenant.pos.cart.card")}
                </button>
              </div>

              {/* Amount input */}
              <div className="flex gap-2">
                <input
                  ref={amountInputRef}
                  type="text"
                  inputMode="decimal"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  placeholder={t("tenant.pos.checkout.amount")}
                  className="flex-1 px-3 py-2 border rounded-lg"
                  disabled={processingCard}
                />
                <button
                  onClick={() => setCurrentAmount(remaining.toFixed(2))}
                  disabled={processingCard}
                  className="px-3 py-2 bg-surface-inset rounded-lg hover:bg-surface-overlay text-sm"
                >
                  {t("tenant.pos.checkout.remaining")}
                </button>
              </div>

              {/* Card details (only show when card method selected) */}
              {currentMethod === "card" && stripeConnected && (
                <div>
                  <label className="block text-sm font-medium mb-2">{t("tenant.pos.checkout.cardInformation")}</label>
                  <div
                    id="split-stripe-card-element"
                    className="p-3 border rounded-lg bg-surface-raised min-h-[44px]"
                  />
                </div>
              )}

              {error && (
                <p className="text-sm text-danger max-w-full break-words">{error}</p>
              )}

              {/* Add button */}
              <button
                onClick={currentMethod === "cash" ? addCashPayment : addCardPayment}
                disabled={
                  processingCard ||
                  (currentMethod === "card" && !cardComplete)
                }
                className={`w-full py-2 rounded-lg font-medium ${
                  currentMethod === "cash"
                    ? "bg-success text-white hover:bg-success-hover disabled:bg-surface-overlay"
                    : "bg-brand text-white hover:bg-brand-hover disabled:bg-surface-overlay"
                } disabled:cursor-not-allowed`}
              >
                {processingCard ? t("tenant.pos.checkout.processing") : currentMethod === "cash" ? t("tenant.pos.checkout.addCashPayment") : t("tenant.pos.checkout.addCardPayment")}
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClose}
            className="flex-1 py-3 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={() => onComplete(payments)}
            disabled={remaining > 0.005 || processingCard}
            className="flex-1 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-surface-overlay disabled:cursor-not-allowed font-medium"
          >
            {t("tenant.pos.checkout.completeSale")}
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
  const t = useT();
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
        <h2 className="text-xl font-bold mb-4">{t("tenant.pos.checkout.rentalAgreementRequired")}</h2>

        {/* Printable Agreement Preview */}
        <div id="rental-agreement" className="p-6 border rounded-lg mb-4 print:border-none">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">{shopName}</h1>
            <h2 className="text-lg">{t("tenant.pos.checkout.equipmentRentalAgreement")}</h2>
            <p className="text-sm text-foreground-muted">Agreement #: {agreementNumber}</p>
            <p className="text-sm text-foreground-muted">{new Date().toLocaleDateString()}</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-bold mb-2">{t("tenant.pos.checkout.customer")}</h3>
              <p>{customer.firstName} {customer.lastName}</p>
              <p>{customer.email}</p>
              {customer.phone && <p>{customer.phone}</p>}
            </div>
            <div>
              <h3 className="font-bold mb-2">{t("tenant.pos.checkout.rentalPeriod")}</h3>
              <p>{t("tenant.pos.checkout.from")}: {new Date().toLocaleDateString()}</p>
              <p>{t("tenant.pos.checkout.due")}: {dueDate.toLocaleDateString()}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-bold mb-2">{t("tenant.pos.checkout.equipment")}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">{t("tenant.pos.checkout.item")}</th>
                  <th className="text-left py-2">{t("tenant.pos.checkout.size")}</th>
                  <th className="text-right py-2">{t("tenant.pos.checkout.daysHeader")}</th>
                  <th className="text-right py-2">{t("tenant.pos.checkout.rate")}</th>
                  <th className="text-right py-2">{t("common.total")}</th>
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
            <h3 className="font-bold mb-2">{t("tenant.pos.checkout.termsAndConditions")}</h3>
            <ol className="list-decimal list-inside space-y-1 text-foreground">
              <li>{t("tenant.pos.checkout.term1")}</li>
              <li>{t("tenant.pos.checkout.term2")}</li>
              <li>{t("tenant.pos.checkout.term3")}</li>
              <li>{t("tenant.pos.checkout.term4")}</li>
              <li>{t("tenant.pos.checkout.term5")}</li>
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-8">
            <div>
              <p className="mb-8">{t("tenant.pos.checkout.customerSignature")}: _______________________</p>
              <p>{t("tenant.pos.checkout.date")}: _______________________</p>
            </div>
            <div>
              <p className="mb-8">{t("tenant.pos.checkout.staffSignature")}: _______________________</p>
              <p>{t("tenant.pos.checkout.date")}: _______________________</p>
            </div>
          </div>
        </div>

        {/* Confirmation Section */}
        <div className="space-y-4">
          <button
            onClick={handlePrint}
            className="w-full py-3 border-2 border-brand text-brand rounded-lg hover:bg-brand-muted font-medium"
          >
            {t("tenant.pos.checkout.printAgreement")}
          </button>

          <div className="p-4 bg-surface-inset rounded-lg space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={agreementSigned}
                onChange={(e) => setAgreementSigned(e.target.checked)}
                className="w-5 h-5"
              />
              <span>{t("tenant.pos.checkout.customerSignedAgreement")}</span>
            </label>

            <div>
              <label className="block text-sm font-medium mb-1">{t("tenant.pos.checkout.staffName")}</label>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder={t("tenant.pos.checkout.yourName")}
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
            {t("common.cancel")}
          </button>
          <button
            onClick={() => onConfirm(staffName)}
            disabled={!agreementSigned || !staffName.trim()}
            className="flex-1 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-surface-overlay disabled:cursor-not-allowed font-medium"
          >
            {t("tenant.pos.checkout.continueToPayment")}
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
  const t = useT();
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
        <h2 className="text-xl font-bold mb-4">{t("tenant.pos.checkout.selectCustomer")}</h2>

        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t("tenant.pos.checkout.searchCustomerPlaceholder")}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand mb-4"
          autoFocus
        />

        <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
          {isSearching ? (
            <p className="text-center text-foreground-muted py-4">{t("tenant.pos.checkout.searching")}</p>
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
            <p className="text-center text-foreground-muted py-4">{t("tenant.pos.checkout.noCustomersFound")}</p>
          ) : (
            <p className="text-center text-foreground-muted py-4">{t("tenant.pos.checkout.typeToSearch")}</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border rounded-lg hover:bg-surface-inset"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onCreateNew}
            className="flex-1 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover font-medium"
          >
            {t("tenant.pos.checkout.newCustomer")}
          </button>
        </div>
      </div>
    </div>
  );
}

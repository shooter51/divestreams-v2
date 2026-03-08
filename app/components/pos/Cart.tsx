/**
 * POS Cart Component
 */

import type { CartItem } from "../../../lib/validation/pos";
import { useT } from "../../i18n/use-t";

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (index: number, quantity: number) => void;
  onRemoveItem: (index: number) => void;
  customer: { id: string; firstName: string; lastName: string; email: string } | null;
  onSelectCustomer: () => void;
  onClearCustomer: () => void;
  taxRate: number;
  onCheckout: (method: "card" | "cash" | "split") => void;
  requiresCustomer: boolean;
}

export function Cart({
  items,
  onUpdateQuantity,
  onRemoveItem,
  customer,
  onSelectCustomer,
  onClearCustomer,
  taxRate,
  onCheckout,
  requiresCustomer,
}: CartProps) {
  const t = useT();
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  // Use per-product taxRate when available (same logic as pos.tsx) so displayed
  // total matches the value passed to checkout modals.
  const tax = items.reduce((sum, item) => {
    const itemTaxRate = item.type === "product" && item.taxRate != null ? item.taxRate : taxRate;
    return sum + item.total * (itemTaxRate / 100);
  }, 0);
  const total = subtotal + tax;
  // Compute the effective tax rate to display — when products have per-item taxRates
  // the org-level taxRate of 0% would be misleading. Show the actual effective rate.
  const effectiveTaxRate = subtotal > 0 ? Math.round((tax / subtotal) * 10000) / 100 : taxRate;

  const canCheckout = items.length > 0 && (!requiresCustomer || customer);

  return (
    <div className="flex flex-col h-full bg-surface-raised rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">{t("tenant.pos.cart.title")}</h2>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-foreground-muted text-center py-8">{t("tenant.pos.cart.empty")}</p>
        ) : (
          items.map((item, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-surface-inset rounded-lg">
              <div className="flex-1">
                <p className="font-medium" title={item.type === "booking" ? item.tourName : item.name}>
                  {item.type === "booking" ? item.tourName : item.name}
                </p>
                <p className="text-sm text-foreground-muted">
                  {item.type === "product" && `${item.quantity} × $${item.unitPrice.toFixed(2)}`}
                  {item.type === "rental" && `${item.days} ${item.days > 1 ? t("tenant.pos.cart.days") : t("tenant.pos.cart.day")} × $${item.dailyRate.toFixed(2)}/${t("tenant.pos.cart.day")}`}
                  {item.type === "booking" && `${item.participants} ${item.participants > 1 ? t("tenant.pos.cart.participants") : t("tenant.pos.cart.participant")} × $${item.unitPrice.toFixed(2)}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">${item.total.toFixed(2)}</p>
                {item.type === "product" && (
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                      className="w-6 h-6 rounded bg-surface-overlay hover:bg-border text-sm"
                      disabled={item.quantity <= 1}
                      aria-label="Decrease quantity"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                      className="w-6 h-6 rounded bg-surface-overlay hover:bg-border text-sm"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => onRemoveItem(index)}
                className="text-danger hover:text-danger"
                aria-label="Remove item"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Customer */}
      <div className="p-4 border-t">
        {customer ? (
          <div className="flex items-center justify-between p-3 bg-brand-muted rounded-lg">
            <div>
              <p className="font-medium">{customer.firstName} {customer.lastName}</p>
              <p className="text-sm text-foreground-muted">{customer.email}</p>
            </div>
            <button onClick={onClearCustomer} className="text-foreground-muted hover:text-foreground">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={onSelectCustomer}
            className={`w-full p-3 border-2 border-dashed rounded-lg text-center ${
              requiresCustomer ? "border-danger text-danger" : "border-border-strong text-foreground-muted"
            } hover:border-brand hover:text-brand`}
          >
            {requiresCustomer ? t("tenant.pos.cart.customerRequired") : t("tenant.pos.cart.addCustomerOptional")}
          </button>
        )}
      </div>

      {/* Totals */}
      <div className="p-4 border-t space-y-2">
        <div className="flex justify-between text-sm">
          <span>{t("tenant.pos.cart.subtotal")}</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        {items.length > 0 && (
          <div className="flex justify-between text-sm">
            <span>{t("tenant.pos.cart.tax", { rate: effectiveTaxRate })}</span>
            <span>${tax.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold">
          <span>{t("tenant.pos.cart.total")}</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Checkout Buttons */}
      <div className="p-4 border-t space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onCheckout("card")}
            disabled={!canCheckout}
            className="py-3 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-surface-overlay disabled:cursor-not-allowed font-medium"
          >
            {t("tenant.pos.cart.card")}
          </button>
          <button
            onClick={() => onCheckout("cash")}
            disabled={!canCheckout}
            className="py-3 bg-success text-white rounded-lg hover:bg-success-hover disabled:bg-surface-overlay disabled:cursor-not-allowed font-medium"
          >
            {t("tenant.pos.cart.cash")}
          </button>
          <button
            onClick={() => onCheckout("split")}
            disabled={!canCheckout}
            className="py-3 bg-info text-white rounded-lg hover:bg-info-hover disabled:bg-surface-overlay disabled:cursor-not-allowed font-medium"
          >
            {t("tenant.pos.cart.split")}
          </button>
        </div>
      </div>
    </div>
  );
}

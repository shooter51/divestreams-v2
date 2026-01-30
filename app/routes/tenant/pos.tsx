/**
 * Point of Sale (POS)
 *
 * Full-featured POS for retail, rentals, and quick bookings.
 */

import { useState, useCallback, useEffect } from "react";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Link } from "react-router";
import { z } from "zod";
import { requireOrgContext } from "../../../lib/auth/org-context.server";
import { requireFeature } from "../../../lib/require-feature.server";
import { PLAN_FEATURES } from "../../../lib/plan-features";
import { getTenantDb } from "../../../lib/db/tenant.server";
import {
  getPOSProducts,
  getPOSEquipment,
  getPOSTrips,
  searchPOSCustomers,
  processPOSCheckout,
  generateAgreementNumber,
  getProductByBarcode,
  getTransactionById,
  processPOSRefund,
} from "../../../lib/db/pos.server";
import { db } from "../../../lib/db/index";
import { organizationSettings } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getStripeSettings,
  getStripePublishableKey,
  createPOSPaymentIntent,
  createTerminalConnectionToken,
  listTerminalReaders,
  createStripeRefund,
} from "../../../lib/integrations/stripe.server";
import { BarcodeScannerModal } from "../../components/BarcodeScannerModal";
import { Cart } from "../../components/pos/Cart";
import { ProductGrid } from "../../components/pos/ProductGrid";
import {
  CardModal,
  CashModal,
  SplitModal,
  RentalAgreementModal,
  CustomerSearchModal,
} from "../../components/pos/CheckoutModals";
import {
  TransactionLookupModal,
  RefundConfirmationModal,
} from "../../components/pos/RefundModals";
import type { CartItem } from "../../../lib/validation/pos";

export const meta: MetaFunction = () => [{ title: "Point of Sale - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  requireFeature(ctx.subscription?.planDetails?.features ?? {}, PLAN_FEATURES.HAS_POS);
  const tenant = {
    id: ctx.org.id,
    subdomain: ctx.org.slug,
    schemaName: `tenant_${ctx.org.slug}`,
    name: ctx.org.name,
  };
  const organizationId = ctx.org.id;
  const { schema: tables } = getTenantDb(tenant.schemaName);

  const [products, equipment, trips] = await Promise.all([
    getPOSProducts(tables, organizationId),
    getPOSEquipment(tables, organizationId),
    getPOSTrips(tables, organizationId, "UTC"), // Default timezone - could be stored in organization settings
  ]);

  // Get organization settings for tax rate
  const [settings] = await db
    .select()
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, organizationId))
    .limit(1);

  const taxRate = settings?.taxRate ? parseFloat(settings.taxRate) : 0;

  // Generate agreement number - handle case where rentals table may not exist yet
  let agreementNumber = `RA-${new Date().getFullYear()}-0001`;
  try {
    agreementNumber = await generateAgreementNumber(tables, organizationId);
  } catch (error) {
    console.error("Could not generate agreement number:", error);
    // Use default - rentals table may not exist yet
  }

  // Check Stripe integration status for card payments
  const [stripeSettings, stripePublishableKey, terminalReaders] = await Promise.all([
    getStripeSettings(organizationId),
    getStripePublishableKey(organizationId),
    listTerminalReaders(organizationId),
  ]);

  const stripeConnected = stripeSettings?.connected && stripeSettings?.chargesEnabled;
  const hasTerminalReaders = terminalReaders && terminalReaders.length > 0;

  return {
    tenant,
    organizationId,
    products,
    equipment,
    trips,
    agreementNumber,
    taxRate,
    // Stripe card payment info
    stripeConnected: stripeConnected || false,
    stripePublishableKey: stripeConnected ? stripePublishableKey : null,
    hasTerminalReaders: hasTerminalReaders || false,
    terminalReaders: terminalReaders || [],
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const tenant = {
    id: ctx.org.id,
    subdomain: ctx.org.slug,
    schemaName: `tenant_${ctx.org.slug}`,
    name: ctx.org.name,
  };
  const organizationId = ctx.org.id;
  const { schema: tables } = getTenantDb(tenant.schemaName);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "search-customers") {
    const query = formData.get("query") as string;
    const customers = await searchPOSCustomers(tables, organizationId, query);
    return { customers };
  }

  if (intent === "create-payment-intent") {
    try {
      const amount = parseInt(formData.get("amount") as string, 10);
      const customerId = formData.get("customerId") as string | null;

      if (!amount || amount <= 0) {
        return { error: "Invalid payment amount" };
      }

      const result = await createPOSPaymentIntent(organizationId, amount, {
        customerId: customerId || undefined,
      });

      if (!result) {
        return { error: "Stripe not connected. Please connect Stripe in Settings → Integrations." };
      }

      return {
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Failed to create payment" };
    }
  }

  if (intent === "connection-token") {
    try {
      const result = await createTerminalConnectionToken(organizationId);

      if (!result) {
        return { error: "Stripe not connected" };
      }

      return { secret: result.secret };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Failed to create connection token" };
    }
  }

  if (intent === "scan-barcode") {
    const barcode = formData.get("barcode") as string;
    const product = await getProductByBarcode(tables, organizationId, barcode);

    if (product) {
      return {
        scannedProduct: {
          id: product.id,
          name: product.name,
          price: product.price,
          stockQuantity: product.stockQuantity,
        },
      };
    }
    return { barcodeNotFound: true, scannedBarcode: barcode };
  }

  if (intent === "lookup-transaction") {
    try {
      // Validate input with Zod schema
      const transactionLookupSchema = z.object({
        transactionId: z.string().uuid("Invalid transaction ID format"),
      });

      const { transactionId } = transactionLookupSchema.parse({
        transactionId: formData.get("transactionId"),
      });

      const transaction = await getTransactionById(tables, organizationId, transactionId);

      if (!transaction) {
        return { error: "Transaction not found" };
      }

      return { transaction };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { error: error.errors[0].message };
      }
      return { error: error instanceof Error ? error.message : "Failed to lookup transaction" };
    }
  }

  if (intent === "process-refund") {
    try {
      // Validate input with Zod schema
      const refundRequestSchema = z.object({
        originalTransactionId: z.string().uuid("Invalid transaction ID format"),
        paymentMethod: z.enum(["cash", "card", "split"]),
        stripePaymentId: z.string().optional(),
        refundReason: z.string().min(1, "Refund reason is required").max(500, "Refund reason too long"),
      });

      const rawData = JSON.parse(formData.get("data") as string);
      const data = refundRequestSchema.parse(rawData);
      const userId = ctx.user.id;

      // If original payment was by card, process Stripe refund first
      let stripeRefundId: string | undefined;

      if (data.paymentMethod === "card" && data.stripePaymentId) {
        const refund = await createStripeRefund(organizationId, data.stripePaymentId, {
          reason: "requested_by_customer",
          metadata: {
            originalTransactionId: data.originalTransactionId,
            refundReason: data.refundReason,
          },
        });

        if (!refund) {
          return { error: "Stripe refund failed. Stripe not connected." };
        }

        stripeRefundId = refund.refundId;
      }

      // Process the refund in our system
      const result = await processPOSRefund(tables, organizationId, {
        originalTransactionId: data.originalTransactionId,
        userId,
        refundReason: data.refundReason,
        stripeRefundId,
      });

      return {
        success: true,
        refundId: result.refundTransaction.id,
        amount: Math.abs(Number(result.refundTransaction.amount)),
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { error: error.errors[0].message };
      }
      return { error: error instanceof Error ? error.message : "Refund processing failed" };
    }
  }

  if (intent === "checkout") {
    try {
      const data = JSON.parse(formData.get("data") as string);

      // Get the actual user ID from the authenticated session
      const userId = ctx.user.id;

      const result = await processPOSCheckout(tables, organizationId, {
        items: data.items,
        customerId: data.customerId,
        userId,
        payments: data.payments,
        subtotal: data.subtotal,
        tax: data.tax,
        total: data.total,
        notes: data.notes,
      });

      return { success: true, receiptNumber: result.receiptNumber };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Checkout failed" };
    }
  }

  return { error: "Invalid intent" };
}

export default function POSPage() {
  const {
    tenant,
    products,
    equipment,
    trips,
    agreementNumber,
    taxRate,
    stripeConnected,
    stripePublishableKey,
    hasTerminalReaders,
  } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  // State
  const [tab, setTab] = useState<"retail" | "rentals" | "trips">("retail");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
  } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [checkoutMethod, setCheckoutMethod] = useState<"card" | "cash" | "split" | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showRentalAgreement, setShowRentalAgreement] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState<Array<{ id: string; firstName: string; lastName: string; email: string; phone?: string | null }>>([]);
  const [pendingCheckout, setPendingCheckout] = useState<"card" | "cash" | "split" | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  // Refund modal state
  const [showTransactionLookup, setShowTransactionLookup] = useState(false);
  const [showRefundConfirmation, setShowRefundConfirmation] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<{
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
  } | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<{ amount: number } | null>(null);

  // Cart calculations
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  // Check if cart requires customer (has rentals or bookings)
  const hasRentals = cart.some(item => item.type === "rental");
  const hasBookings = cart.some(item => item.type === "booking");
  const requiresCustomer = hasRentals || hasBookings;

  // Cart operations
  const addProduct = useCallback((product: { id: string; name: string; price: string }) => {
    setCart(prev => {
      const existing = prev.findIndex(
        item => item.type === "product" && item.productId === product.id
      );
      if (existing >= 0) {
        const updated = [...prev];
        const item = updated[existing] as CartItem & { type: "product" };
        item.quantity += 1;
        item.total = item.quantity * item.unitPrice;
        return updated;
      }
      return [...prev, {
        type: "product" as const,
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: Number(product.price),
        total: Number(product.price),
      }];
    });
  }, []);

  const addRental = useCallback((equipment: { id: string; name: string; size: string | null; rentalPrice: string | null }, days: number) => {
    const dailyRate = Number(equipment.rentalPrice);
    setCart(prev => [...prev, {
      type: "rental" as const,
      equipmentId: equipment.id,
      name: equipment.name,
      size: equipment.size || undefined,
      days,
      dailyRate,
      total: dailyRate * days,
    }]);
  }, []);

  const addBooking = useCallback((trip: { id: string; tour: { name: string; price: string } }, participants: number) => {
    const unitPrice = Number(trip.tour.price);
    setCart(prev => [...prev, {
      type: "booking" as const,
      tripId: trip.id,
      tourName: trip.tour.name,
      participants,
      unitPrice,
      total: unitPrice * participants,
    }]);
  }, []);

  const updateQuantity = useCallback((index: number, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter((_, i) => i !== index));
    } else {
      setCart(prev => {
        const updated = [...prev];
        const item = updated[index];
        if (item.type === "product") {
          item.quantity = quantity;
          item.total = item.quantity * item.unitPrice;
        }
        return updated;
      });
    }
  }, []);

  const removeItem = useCallback((index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCustomer(null);
  }, []);

  // Checkout flow
  const handleCheckout = useCallback((method: "card" | "cash" | "split") => {
    if (hasRentals && !showRentalAgreement) {
      setPendingCheckout(method);
      setShowRentalAgreement(true);
      return;
    }
    setCheckoutMethod(method);
  }, [hasRentals, showRentalAgreement]);

  const handleRentalAgreementConfirm = useCallback((_staffName: string) => {
    setShowRentalAgreement(false);
    if (pendingCheckout) {
      setCheckoutMethod(pendingCheckout);
      setPendingCheckout(null);
    }
  }, [pendingCheckout]);

  const completeCheckout = useCallback(async (payments: Array<{ method: "card" | "cash"; amount: number; stripePaymentIntentId?: string }>) => {
    const formData = new FormData();
    formData.append("intent", "checkout");
    formData.append("data", JSON.stringify({
      items: cart,
      customerId: customer?.id,
      payments,
      subtotal,
      tax,
      total,
    }));

    fetcher.submit(formData, { method: "POST" });

    // Clear on success
    clearCart();
    setCheckoutMethod(null);
  }, [cart, customer, subtotal, tax, total, fetcher, clearCart]);

  // Customer search
  const handleCustomerSearch = useCallback((query: string) => {
    const formData = new FormData();
    formData.append("intent", "search-customers");
    formData.append("query", query);
    fetcher.submit(formData, { method: "POST" });
  }, [fetcher]);

  // Barcode scanning
  const handleBarcodeScan = useCallback((barcode: string) => {
    setBarcodeError(null);
    setShowBarcodeScanner(false);

    const formData = new FormData();
    formData.append("intent", "scan-barcode");
    formData.append("barcode", barcode);
    fetcher.submit(formData, { method: "POST" });
  }, [fetcher]);

  // Refund handling
  const handleTransactionFound = useCallback((transaction: typeof selectedTransaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionLookup(false);
    setShowRefundConfirmation(true);
  }, []);

  const handleRefundConfirm = useCallback((refundReason: string) => {
    if (!selectedTransaction) return;

    const formData = new FormData();
    formData.append("intent", "process-refund");
    formData.append("data", JSON.stringify({
      originalTransactionId: selectedTransaction.id,
      paymentMethod: selectedTransaction.paymentMethod,
      stripePaymentId: selectedTransaction.stripePaymentId,
      refundReason,
    }));

    fetcher.submit(formData, { method: "POST" });
  }, [selectedTransaction, fetcher]);

  // Update search results and handle barcode results when fetcher returns
  useEffect(() => {
    const fetcherData = fetcher.data as {
      customers?: Array<{ id: string; firstName: string; lastName: string; email: string; phone?: string | null }>;
      scannedProduct?: { id: string; name: string; price: string; stockQuantity: number };
      barcodeNotFound?: boolean;
      scannedBarcode?: string;
      success?: boolean;
      refundId?: string;
      amount?: number;
    } | undefined;

    if (fetcherData?.customers) {
      setCustomerSearchResults(fetcherData.customers);
    }

    if (fetcherData?.scannedProduct) {
      // Auto-add product to cart
      addProduct(fetcherData.scannedProduct);
      setBarcodeError(null);
    }

    if (fetcherData?.barcodeNotFound) {
      setBarcodeError(`Product not found for barcode: ${fetcherData.scannedBarcode}`);
      // Clear error after 3 seconds
      setTimeout(() => setBarcodeError(null), 3000);
    }

    // Handle refund success
    if (fetcherData?.success && fetcherData?.refundId && fetcherData?.amount) {
      setRefundSuccess({ amount: fetcherData.amount });
      setShowRefundConfirmation(false);
      setSelectedTransaction(null);
      // Clear success message after 5 seconds
      setTimeout(() => setRefundSuccess(null), 5000);
    }
  }, [fetcher.data, addProduct]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-surface-raised">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Point of Sale</h1>
          <button
            type="button"
            onClick={clearCart}
            className="px-4 py-2 text-sm bg-surface-inset rounded-lg hover:bg-surface-overlay transition-colors"
            aria-label="Start new sale and clear cart"
          >
            New Sale
          </button>
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Scan Barcode
          </button>
          <button
            onClick={() => setShowTransactionLookup(true)}
            className="px-4 py-2 text-sm border border-amber-600 text-amber-600 rounded-lg hover:bg-amber-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
            </svg>
            Refund
          </button>
          <Link
            to="/tenant/pos/transactions"
            className="px-4 py-2 text-sm border rounded-lg hover:bg-surface-inset flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Transactions
          </Link>
        </div>
        <div className="text-sm text-foreground-muted">
          {tenant.name} - {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Product Grid */}
        <div className="flex-1 flex flex-col bg-surface-inset">
          {/* Tabs */}
          <div className="flex gap-1 p-4 pb-0">
            {(["retail", "rentals", "trips"] as const).map(t => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setSelectedCategory(null);
                  setSearchQuery("");
                }}
                className={`px-6 py-2 rounded-t-lg font-medium capitalize ${
                  tab === t
                    ? "bg-surface-raised text-brand border-t border-x"
                    : "bg-surface-overlay text-foreground-muted hover:bg-border"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 bg-surface-raised border-t overflow-hidden">
            <ProductGrid
              tab={tab}
              products={products}
              equipment={equipment}
              trips={trips}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onAddProduct={addProduct}
              onAddRental={addRental}
              onAddBooking={addBooking}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>
        </div>

        {/* Right Panel - Cart */}
        <div className="w-96 border-l">
          <Cart
            items={cart}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            customer={customer}
            onSelectCustomer={() => setShowCustomerSearch(true)}
            onClearCustomer={() => setCustomer(null)}
            taxRate={taxRate}
            onCheckout={handleCheckout}
            requiresCustomer={requiresCustomer}
          />
        </div>
      </div>

      {/* Modals */}
      <CardModal
        isOpen={checkoutMethod === "card"}
        onClose={() => setCheckoutMethod(null)}
        total={total}
        onComplete={completeCheckout}
        stripeConnected={stripeConnected}
        stripePublishableKey={stripePublishableKey}
        hasTerminalReaders={hasTerminalReaders}
        customerId={customer?.id}
      />

      <CashModal
        isOpen={checkoutMethod === "cash"}
        onClose={() => setCheckoutMethod(null)}
        total={total}
        onComplete={completeCheckout}
      />

      <SplitModal
        isOpen={checkoutMethod === "split"}
        onClose={() => setCheckoutMethod(null)}
        total={total}
        onComplete={completeCheckout}
      />

      <RentalAgreementModal
        isOpen={showRentalAgreement}
        onClose={() => {
          setShowRentalAgreement(false);
          setPendingCheckout(null);
        }}
        onConfirm={handleRentalAgreementConfirm}
        customer={customer}
        rentals={cart
          .filter((item): item is CartItem & { type: "rental" } => item.type === "rental")
          .map(item => ({
            name: item.name,
            size: item.size,
            days: item.days,
            dailyRate: item.dailyRate,
            total: item.total,
          }))}
        shopName={tenant.name}
        agreementNumber={agreementNumber}
      />

      <CustomerSearchModal
        isOpen={showCustomerSearch}
        onClose={() => setShowCustomerSearch(false)}
        onSelect={(c) => {
          setCustomer(c);
          setShowCustomerSearch(false);
        }}
        onCreateNew={() => {
          setShowCustomerSearch(false);
          window.location.href = "/tenant/customers/new";
        }}
        searchResults={customerSearchResults}
        onSearch={handleCustomerSearch}
        isSearching={fetcher.state === "submitting"}
      />

      <BarcodeScannerModal
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScan}
        title="Scan Product Barcode"
        showConfirmation={false}
      />

      {/* Refund Modals */}
      <TransactionLookupModal
        isOpen={showTransactionLookup}
        onClose={() => setShowTransactionLookup(false)}
        onTransactionFound={handleTransactionFound}
      />

      {selectedTransaction && (
        <RefundConfirmationModal
          isOpen={showRefundConfirmation}
          onClose={() => {
            setShowRefundConfirmation(false);
            setSelectedTransaction(null);
          }}
          transaction={selectedTransaction}
          onConfirm={handleRefundConfirm}
        />
      )}

      {/* Barcode Error Toast */}
      {barcodeError && (
        <div className="fixed bottom-4 left-4 bg-amber-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {barcodeError}
        </div>
      )}

      {/* Success Toast */}
      {(fetcher.data as { success?: boolean; receiptNumber?: string } | undefined)?.success && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg">
          Sale complete! Receipt #{(fetcher.data as { receiptNumber: string }).receiptNumber}
        </div>
      )}

      {/* Refund Success Toast */}
      {refundSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg">
          Refund processed successfully! ${refundSuccess.amount.toFixed(2)} refunded to customer.
        </div>
      )}
    </div>
  );
}

/**
 * Point of Sale (POS)
 *
 * Full-featured POS for retail, rentals, and quick bookings.
 */

import { useState, useCallback, useEffect } from "react";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { requireOrgContext } from "../../../lib/auth/org-context.server";
import { getTenantDb } from "../../../lib/db/tenant.server";
import {
  getPOSProducts,
  getPOSEquipment,
  getPOSTrips,
  searchPOSCustomers,
  processPOSCheckout,
  generateAgreementNumber,
  getProductByBarcode,
} from "../../../lib/db/pos.server";
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
import type { CartItem } from "../../../lib/validation/pos";

export const meta: MetaFunction = () => [{ title: "Point of Sale - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
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

  // Generate agreement number - handle case where rentals table may not exist yet
  let agreementNumber = `RA-${new Date().getFullYear()}-0001`;
  try {
    agreementNumber = await generateAgreementNumber(tables, organizationId);
  } catch (error) {
    console.error("Could not generate agreement number:", error);
    // Use default - rentals table may not exist yet
  }

  return {
    tenant,
    organizationId,
    products,
    equipment,
    trips,
    agreementNumber,
    taxRate: 0, // TODO: Get from tenant settings
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
  const { tenant, products, equipment, trips, agreementNumber, taxRate } = useLoaderData<typeof loader>();
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

  // Update search results and handle barcode results when fetcher returns
  useEffect(() => {
    const fetcherData = fetcher.data as {
      customers?: Array<{ id: string; firstName: string; lastName: string; email: string; phone?: string | null }>;
      scannedProduct?: { id: string; name: string; price: string; stockQuantity: number };
      barcodeNotFound?: boolean;
      scannedBarcode?: string;
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
  }, [fetcher.data, addProduct]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Point of Sale</h1>
          <button
            onClick={clearCart}
            className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            New Sale
          </button>
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Scan Barcode
          </button>
        </div>
        <div className="text-sm text-gray-600">
          {tenant.name} - {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Product Grid */}
        <div className="flex-1 flex flex-col bg-gray-50">
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
                    ? "bg-white text-blue-600 border-t border-x"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 bg-white border-t overflow-hidden">
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
          // TODO: Open create customer modal
          setShowCustomerSearch(false);
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
    </div>
  );
}

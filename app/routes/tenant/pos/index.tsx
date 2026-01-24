/**
 * POS (Point of Sale) Terminal
 *
 * Main checkout interface for retail sales.
 * Supports product search, cart management, and payment processing.
 *
 * PREMIUM FEATURE: POS is only available to premium subscribers.
 */

import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useFetcher, Link } from "react-router";
import { useState, useCallback, useMemo } from "react";
import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { db } from "../../../../lib/db";
import { products, transactions } from "../../../../lib/db/schema";
import { eq, sql, count, and, gte } from "drizzle-orm";
import { PremiumGate } from "../../../components/ui/UpgradePrompt";

export const meta: MetaFunction = () => [{ title: "POS - DiveStreams" }];

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  category: string;
  trackInventory: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  trackInventory: boolean;
}

interface POSSummary {
  totalSales: number;
  transactionCount: number;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Check if POS feature is available
  if (!ctx.limits.hasPOS) {
    return {
      isPremium: false,
      requiresUpgrade: true,
      products: [] as Product[],
      categories: [] as string[],
      summary: { totalSales: 0, transactionCount: 0 } as POSSummary,
    };
  }

  // Get products for POS
  const productList = await db
    .select()
    .from(products)
    .where(eq(products.organizationId, ctx.org.id))
    .orderBy(products.name);

  // Get unique categories
  const categories = [...new Set(productList.map((p) => p.category).filter(Boolean))];

  // Get today's sales summary
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [salesData] = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      transactionCount: count(),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.organizationId, ctx.org.id),
        eq(transactions.type, "sale"),
        gte(transactions.createdAt, today)
      )
    );

  const summary: POSSummary = {
    totalSales: Number(salesData?.totalSales || 0),
    transactionCount: salesData?.transactionCount || 0,
  };

  return {
    isPremium: true,
    requiresUpgrade: false,
    products: productList.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: Number(p.price),
      category: p.category || "other",
      trackInventory: p.trackInventory ?? false,
      stockQuantity: p.stockQuantity ?? 0,
      lowStockThreshold: p.lowStockThreshold ?? 5,
    })),
    categories,
    summary,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);

  // Enforce premium check on actions too
  if (!ctx.limits.hasPOS) {
    return { error: "POS is a premium feature. Please upgrade to continue." };
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "checkout") {
    const items = JSON.parse(formData.get("items") as string) as CartItem[];
    const paymentMethod = formData.get("paymentMethod") as string;
    const total = Number(formData.get("total"));

    // Create transaction
    const [transaction] = await db
      .insert(transactions)
      .values({
        organizationId: ctx.org.id,
        type: "sale",
        amount: String(total),
        paymentMethod,
        items: items.map((item) => ({
          description: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.price * item.quantity,
        })),
        createdAt: new Date(),
      })
      .returning({ id: transactions.id });

    // Adjust stock for each item
    for (const item of items) {
      if (item.trackInventory) {
        await db
          .update(products)
          .set({
            stockQuantity: sql`${products.stockQuantity} - ${item.quantity}`,
          })
          .where(eq(products.id, item.id));
      }
    }

    return { success: true, transactionId: transaction.id };
  }

  return { error: "Invalid action" };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// Product category colors
const categoryColors: Record<string, string> = {
  equipment: "bg-blue-100 text-blue-700",
  apparel: "bg-purple-100 text-purple-700",
  accessories: "bg-green-100 text-green-700",
  courses: "bg-orange-100 text-orange-700",
  rental: "bg-cyan-100 text-cyan-700",
};

export default function POSPage() {
  const { isPremium, requiresUpgrade, products, categories, summary } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const fetcher = useFetcher();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    return products.filter((product: Product) => {
      const matchesSearch =
        !searchQuery ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Cart calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + tax;

  // Add product to cart
  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          trackInventory: product.trackInventory,
        },
      ];
    });
  }, []);

  // Update cart item quantity
  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id));
    } else {
      setCart((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity } : item))
      );
    }
  }, []);

  // Clear cart
  const clearCart = useCallback(() => {
    setCart([]);
    setShowReceipt(false);
  }, []);

  // Process payment
  const processPayment = useCallback(
    (paymentMethod: string) => {
      if (cart.length === 0) return;

      const formData = new FormData();
      formData.set("intent", "checkout");
      formData.set("items", JSON.stringify(cart));
      formData.set("paymentMethod", paymentMethod);
      formData.set("total", total.toString());

      fetcher.submit(formData, { method: "post" });
      setShowReceipt(true);
    },
    [cart, total, fetcher]
  );

  // If not premium, show the upgrade gate
  if (requiresUpgrade) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Point of Sale</h1>
            <p className="text-sm text-gray-500">Premium Feature</p>
          </div>
        </div>

        <PremiumGate feature="Point of Sale" isPremium={isPremium}>
          <div className="bg-white rounded-xl p-8 shadow-sm min-h-[400px] flex items-center justify-center">
            <div className="text-center text-gray-400">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <p className="text-lg font-medium text-gray-500">POS Terminal</p>
              <p className="text-sm">Process sales, manage inventory, and track transactions</p>
            </div>
          </div>
        </PremiumGate>
      </div>
    );
  }

  // Show receipt after successful transaction
  if (showReceipt && fetcher.data?.success) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <div className="bg-white rounded-xl p-8 shadow-lg text-center">
          <div className="text-6xl mb-4">+</div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">Payment Complete</h2>
          <p className="text-gray-600 mb-6">Transaction ID: {fetcher.data.transactionId?.slice(0, 8)}...</p>

          <div className="border-t border-dashed pt-4 mb-6">
            <div className="space-y-2 text-left">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>
                    {item.name} x {item.quantity}
                  </span>
                  <span>{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t mt-4 pt-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax (8%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between font-bold mt-2">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={clearCart}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            New Sale
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Point of Sale</h1>
          <p className="text-sm text-gray-500">Today's Sales: {formatCurrency(summary.totalSales)}</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/tenant/pos/products"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
          >
            Manage Products
          </Link>
          <Link
            to="/tenant/pos/transactions"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
          >
            Transactions
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Product Grid - Left 2 columns */}
        <div className="col-span-2 bg-white rounded-xl p-6 shadow-sm">
          {/* Search and Filter */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg
                className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                selectedCategory === null
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {categories.map((category: string) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap capitalize transition-colors ${
                  selectedCategory === category
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {filteredProducts.map((product: Product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="p-4 border rounded-lg text-left hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded capitalize ${
                        categoryColors[product.category] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {product.category}
                    </span>
                    {product.trackInventory && product.stockQuantity <= product.lowStockThreshold && (
                      <span className="text-xs text-orange-600">Low</span>
                    )}
                  </div>
                  <p className="font-medium truncate">{product.name}</p>
                  {product.sku && (
                    <p className="text-xs text-gray-500">{product.sku}</p>
                  )}
                  <p className="text-lg font-bold text-blue-600 mt-1">
                    {formatCurrency(product.price)}
                  </p>
                  {product.trackInventory && (
                    <p className="text-xs text-gray-400">{product.stockQuantity} in stock</p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              {products.length === 0 ? (
                <div>
                  <p className="mb-4">No products yet</p>
                  <Link
                    to="/tenant/pos/products/new"
                    className="text-blue-600 hover:underline"
                  >
                    Add your first product
                  </Link>
                </div>
              ) : (
                <p>No products match your search</p>
              )}
            </div>
          )}
        </div>

        {/* Cart - Right column */}
        <div className="bg-white rounded-xl p-6 shadow-sm flex flex-col">
          <h2 className="font-semibold mb-4">Current Sale</h2>

          {/* Cart Items */}
          <div className="flex-1 overflow-auto">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No items in cart</p>
                <p className="text-sm mt-1">Click products to add</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(item.price)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                    <p className="font-medium w-20 text-right">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="border-t pt-4 mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax (8%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold pt-2 border-t">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Payment Buttons */}
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => processPayment("cash")}
                disabled={cart.length === 0 || fetcher.state !== "idle"}
                className="py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <span>Cash</span>
              </button>
              <button
                onClick={() => processPayment("card")}
                disabled={cart.length === 0 || fetcher.state !== "idle"}
                className="py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <span>Card</span>
              </button>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="w-full py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
              >
                Clear Cart
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

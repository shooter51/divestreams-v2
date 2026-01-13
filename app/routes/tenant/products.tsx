/**
 * Products Management (Inventory for POS)
 */

import { useState } from "react";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Form } from "react-router";
import { requireTenant } from "../../../lib/auth/tenant-auth.server";
import { getTenantDb } from "../../../lib/db/tenant.server";
import { db } from "../../../lib/db/index";
import { eq } from "drizzle-orm";

export const meta: MetaFunction = () => [{ title: "Products - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const { schema: tables } = getTenantDb(tenant.schemaName);

  const products = await db
    .select()
    .from(tables.products)
    .orderBy(tables.products.category, tables.products.name);

  return { tenant, products };
}

export async function action({ request }: ActionFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const { schema: tables } = getTenantDb(tenant.schemaName);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name") as string;
    const category = formData.get("category") as string;
    const price = formData.get("price") as string;
    const sku = formData.get("sku") as string || null;
    const description = formData.get("description") as string || null;
    const stockQuantity = parseInt(formData.get("stockQuantity") as string) || 0;
    const lowStockThreshold = parseInt(formData.get("lowStockThreshold") as string) || 5;
    const costPrice = formData.get("costPrice") as string || null;

    await db.insert(tables.products).values({
      name,
      category,
      price,
      sku,
      description,
      stockQuantity,
      lowStockThreshold,
      costPrice,
      trackInventory: true,
      isActive: true,
    });

    return { success: true, message: "Product created" };
  }

  if (intent === "update") {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const category = formData.get("category") as string;
    const price = formData.get("price") as string;
    const sku = formData.get("sku") as string || null;
    const description = formData.get("description") as string || null;
    const stockQuantity = parseInt(formData.get("stockQuantity") as string) || 0;
    const lowStockThreshold = parseInt(formData.get("lowStockThreshold") as string) || 5;
    const costPrice = formData.get("costPrice") as string || null;
    const isActive = formData.get("isActive") === "true";

    await db
      .update(tables.products)
      .set({
        name,
        category,
        price,
        sku,
        description,
        stockQuantity,
        lowStockThreshold,
        costPrice,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(tables.products.id, id));

    return { success: true, message: "Product updated" };
  }

  if (intent === "adjust-stock") {
    const id = formData.get("id") as string;
    const adjustment = parseInt(formData.get("adjustment") as string) || 0;

    const [product] = await db
      .select()
      .from(tables.products)
      .where(eq(tables.products.id, id));

    if (product) {
      const newQuantity = Math.max(0, product.stockQuantity + adjustment);
      await db
        .update(tables.products)
        .set({ stockQuantity: newQuantity, updatedAt: new Date() })
        .where(eq(tables.products.id, id));
    }

    return { success: true, message: `Stock adjusted by ${adjustment}` };
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await db.delete(tables.products).where(eq(tables.products.id, id));
    return { success: true, message: "Product deleted" };
  }

  return { error: "Invalid intent" };
}

const CATEGORIES = [
  "equipment",
  "apparel",
  "accessories",
  "courses",
  "rental",
  "consumables",
  "other",
];

export default function ProductsPage() {
  const { products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<typeof products[0] | null>(null);
  const [stockAdjustment, setStockAdjustment] = useState<{ id: string; name: string } | null>(null);

  const isSubmitting = fetcher.state === "submitting";

  // Group products by category
  const productsByCategory = products.reduce((acc, product) => {
    const cat = product.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {} as Record<string, typeof products>);

  const lowStockProducts = products.filter(
    (p) => p.trackInventory && p.stockQuantity <= (p.lowStockThreshold || 5)
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Products & Inventory</h1>
          <p className="text-gray-600">Manage your retail products and stock levels</p>
        </div>
        <button
          onClick={() => {
            setEditingProduct(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Product
        </button>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-amber-800 mb-2">Low Stock Alert</h3>
          <div className="flex flex-wrap gap-2">
            {lowStockProducts.map((p) => (
              <span
                key={p.id}
                className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm"
              >
                {p.name}: {p.stockQuantity} left
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Success Message */}
      {(fetcher.data as { success?: boolean; message?: string })?.success && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg mb-4">
          {(fetcher.data as { message: string }).message}
        </div>
      )}

      {/* Products List */}
      {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
        <div key={category} className="mb-8">
          <h2 className="text-lg font-semibold capitalize mb-3 text-gray-700">
            {category} ({categoryProducts.length})
          </h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Product</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">SKU</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Price</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Stock</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {categoryProducts.map((product) => (
                  <tr key={product.id} className={!product.isActive ? "bg-gray-50 opacity-60" : ""}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{product.name}</div>
                      {product.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {product.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{product.sku || "-"}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      ${Number(product.price).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-medium ${
                          product.stockQuantity <= (product.lowStockThreshold || 5)
                            ? "text-red-600"
                            : "text-gray-900"
                        }`}
                      >
                        {product.stockQuantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          product.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setStockAdjustment({ id: product.id, name: product.name })}
                          className="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
                          title="Adjust Stock"
                        >
                          +/-
                        </button>
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setShowForm(true);
                          }}
                          className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {products.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">No products yet. Add your first product to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Add Product
          </button>
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingProduct ? "Edit Product" : "Add Product"}
              </h2>

              <fetcher.Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value={editingProduct ? "update" : "create"} />
                {editingProduct && <input type="hidden" name="id" value={editingProduct.id} />}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={editingProduct?.name || ""}
                      required
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Category *</label>
                    <select
                      name="category"
                      defaultValue={editingProduct?.category || "equipment"}
                      required
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">SKU</label>
                    <input
                      type="text"
                      name="sku"
                      defaultValue={editingProduct?.sku || ""}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Price *</label>
                    <input
                      type="number"
                      name="price"
                      step="0.01"
                      min="0"
                      defaultValue={editingProduct?.price || ""}
                      required
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Cost Price</label>
                    <input
                      type="number"
                      name="costPrice"
                      step="0.01"
                      min="0"
                      defaultValue={editingProduct?.costPrice || ""}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="For margin calc"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Stock Quantity</label>
                    <input
                      type="number"
                      name="stockQuantity"
                      min="0"
                      defaultValue={editingProduct?.stockQuantity ?? 0}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Low Stock Alert</label>
                    <input
                      type="number"
                      name="lowStockThreshold"
                      min="0"
                      defaultValue={editingProduct?.lowStockThreshold ?? 5}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      name="description"
                      rows={2}
                      defaultValue={editingProduct?.description || ""}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {editingProduct && (
                    <div className="col-span-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="isActive"
                          value="true"
                          defaultChecked={editingProduct.isActive}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm">Active (visible in POS)</span>
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingProduct(null);
                    }}
                    className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                  >
                    {isSubmitting ? "Saving..." : editingProduct ? "Update" : "Create"}
                  </button>
                </div>

                {editingProduct && (
                  <div className="pt-4 border-t">
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={editingProduct.id} />
                      <button
                        type="submit"
                        onClick={(e) => {
                          if (!confirm("Delete this product?")) {
                            e.preventDefault();
                          } else {
                            setShowForm(false);
                            setEditingProduct(null);
                          }
                        }}
                        className="w-full py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                      >
                        Delete Product
                      </button>
                    </fetcher.Form>
                  </div>
                )}
              </fetcher.Form>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {stockAdjustment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4">Adjust Stock: {stockAdjustment.name}</h2>

            <fetcher.Form
              method="post"
              onSubmit={() => setStockAdjustment(null)}
              className="space-y-4"
            >
              <input type="hidden" name="intent" value="adjust-stock" />
              <input type="hidden" name="id" value={stockAdjustment.id} />

              <div>
                <label className="block text-sm font-medium mb-1">
                  Adjustment (+ to add, - to remove)
                </label>
                <input
                  type="number"
                  name="adjustment"
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-center text-xl"
                  placeholder="e.g., 10 or -5"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStockAdjustment(null)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {isSubmitting ? "Saving..." : "Adjust"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Product Detail View
 */

import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, Form, redirect } from "react-router";
import { requireTenant } from "../../../../../lib/auth/tenant-auth.server";
import { getProductById, deleteProduct, adjustProductStock } from "../../../../../lib/db/queries.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.product ? `${data.product.name} - DiveStreams` : "Product - DiveStreams" },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const product = await getProductById(tenant.schemaName, params.id!);

  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  return { product };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    await deleteProduct(tenant.schemaName, params.id!);
    return redirect("/app/pos/products");
  }

  if (intent === "adjustStock") {
    const adjustment = parseInt(formData.get("adjustment") as string);
    await adjustProductStock(tenant.schemaName, params.id!, adjustment);
    return { success: true };
  }

  return { error: "Invalid action" };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const categoryColors: Record<string, string> = {
  equipment: "bg-blue-100 text-blue-700",
  apparel: "bg-purple-100 text-purple-700",
  accessories: "bg-green-100 text-green-700",
  courses: "bg-orange-100 text-orange-700",
  rental: "bg-cyan-100 text-cyan-700",
};

export default function ProductDetailPage() {
  const { product } = useLoaderData<typeof loader>();

  const margin = product.costPrice
    ? Math.round(((product.price - product.costPrice) / product.price) * 100)
    : null;

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/app/pos/products" className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs px-2 py-1 rounded capitalize ${
                  categoryColors[product.category] || "bg-gray-100 text-gray-700"
                }`}
              >
                {product.category}
              </span>
              {product.sku && (
                <span className="text-sm text-gray-500">SKU: {product.sku}</span>
              )}
              <span
                className={`text-xs px-2 py-1 rounded ${
                  product.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {product.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            to={`/app/pos/products/${product.id}/edit`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Edit Product
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Pricing */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Pricing</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Sell Price</span>
              <span className="text-2xl font-bold text-blue-600">{formatCurrency(product.price)}</span>
            </div>
            {product.costPrice && (
              <div className="flex justify-between">
                <span className="text-gray-500">Cost Price</span>
                <span className="font-medium">{formatCurrency(product.costPrice)}</span>
              </div>
            )}
            {margin !== null && (
              <div className="flex justify-between">
                <span className="text-gray-500">Margin</span>
                <span className={`font-medium ${margin >= 30 ? "text-green-600" : margin >= 15 ? "text-yellow-600" : "text-red-600"}`}>
                  {margin}%
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Tax Rate</span>
              <span className="font-medium">{product.taxRate}%</span>
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Inventory</h2>
          {product.trackInventory ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">In Stock</span>
                <span
                  className={`text-2xl font-bold ${
                    product.stockQuantity <= product.lowStockThreshold
                      ? "text-orange-600"
                      : "text-green-600"
                  }`}
                >
                  {product.stockQuantity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Low Stock Alert</span>
                <span className="font-medium">{product.lowStockThreshold} units</span>
              </div>

              {/* Quick Stock Adjustment */}
              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-gray-500 mb-2">Quick Adjustment</p>
                <div className="flex gap-2">
                  <Form method="post" className="flex gap-2">
                    <input type="hidden" name="intent" value="adjustStock" />
                    <input type="hidden" name="adjustment" value="-1" />
                    <button
                      type="submit"
                      className="px-3 py-1 border rounded hover:bg-gray-50"
                    >
                      -1
                    </button>
                  </Form>
                  <Form method="post" className="flex gap-2">
                    <input type="hidden" name="intent" value="adjustStock" />
                    <input type="hidden" name="adjustment" value="1" />
                    <button
                      type="submit"
                      className="px-3 py-1 border rounded hover:bg-gray-50"
                    >
                      +1
                    </button>
                  </Form>
                  <Form method="post" className="flex gap-2">
                    <input type="hidden" name="intent" value="adjustStock" />
                    <input type="hidden" name="adjustment" value="10" />
                    <button
                      type="submit"
                      className="px-3 py-1 border rounded hover:bg-gray-50"
                    >
                      +10
                    </button>
                  </Form>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Inventory tracking disabled</p>
          )}
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <div className="bg-white rounded-xl p-6 shadow-sm mt-6">
          <h2 className="font-semibold mb-2">Description</h2>
          <p className="text-gray-600">{product.description}</p>
        </div>
      )}

      {/* Danger Zone */}
      <div className="bg-white rounded-xl p-6 shadow-sm mt-6 border border-red-200">
        <h2 className="font-semibold text-red-600 mb-4">Danger Zone</h2>
        <Form method="post">
          <input type="hidden" name="intent" value="delete" />
          <button
            type="submit"
            onClick={(e) => {
              if (!confirm("Are you sure you want to delete this product? This cannot be undone.")) {
                e.preventDefault();
              }
            }}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
          >
            Delete Product
          </button>
        </Form>
      </div>
    </div>
  );
}

/**
 * Products List
 *
 * Displays all products for the POS system with search and filtering.
 */

import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, Form, useSearchParams } from "react-router";
import { requireTenant } from "../../../../../lib/auth/org-context.server";
import {
  getProducts,
  getProductCategories,
  deleteProduct,
  type Product,
} from "../../../../../lib/db/queries.server";

export const meta: MetaFunction = () => [{ title: "Products - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const url = new URL(request.url);
  const category = url.searchParams.get("category") || undefined;
  const search = url.searchParams.get("search") || undefined;

  const [products, categories] = await Promise.all([
    getProducts(organizationId, { category, search, isActive: undefined }),
    getProductCategories(organizationId),
  ]);

  return { products, categories };
}

export async function action({ request }: ActionFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await deleteProduct(organizationId, id);
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

export default function ProductsPage() {
  const { products, categories } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentCategory = searchParams.get("category") || "";
  const currentSearch = searchParams.get("search") || "";

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-gray-500">{products.length} products</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/app/pos"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Back to POS
          </Link>
          <Link
            to="/app/pos/products/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Product
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <Form method="get" className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              name="search"
              defaultValue={currentSearch}
              placeholder="Search products..."
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            name="category"
            defaultValue={currentCategory}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat: string) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Filter
          </button>
          {(currentCategory || currentSearch) && (
            <Link
              to="/app/pos/products"
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Clear
            </Link>
          )}
        </Form>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {products.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Product</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Category</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">SKU</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Price</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Stock</th>
                <th className="text-center px-6 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product: Product) => (
                <tr key={product.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      to={`/app/pos/products/${product.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {product.name}
                    </Link>
                    {product.description && (
                      <p className="text-sm text-gray-500 truncate max-w-xs">
                        {product.description}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-1 rounded capitalize ${
                        categoryColors[product.category] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {product.sku || "-"}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    {formatCurrency(product.price)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {product.trackInventory ? (
                      <span
                        className={
                          product.stockQuantity <= product.lowStockThreshold
                            ? "text-orange-600 font-medium"
                            : ""
                        }
                      >
                        {product.stockQuantity}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        product.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/app/pos/products/${product.id}/edit`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Edit
                      </Link>
                      <Form method="post" className="inline">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={product.id} />
                        <button
                          type="submit"
                          onClick={(e) => {
                            if (!confirm("Delete this product?")) {
                              e.preventDefault();
                            }
                          }}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No products found</p>
            <Link
              to="/app/pos/products/new"
              className="text-blue-600 hover:underline"
            >
              Add your first product
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

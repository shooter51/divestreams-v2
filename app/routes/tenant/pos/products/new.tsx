/**
 * New Product Form
 */

import type { MetaFunction, ActionFunctionArgs } from "react-router";
import { Form, Link, useActionData, useNavigation, redirect } from "react-router";
import { requireTenant } from "../../../../../lib/auth/org-context.server";
import { createProduct } from "../../../../../lib/db/queries.server";

export const meta: MetaFunction = () => [{ title: "New Product - DiveStreams" }];

export async function action({ request }: ActionFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const category = formData.get("category") as string;
  const price = parseFloat(formData.get("price") as string);

  if (!name || !category || isNaN(price)) {
    return { error: "Name, category, and price are required" };
  }

  const product = await createProduct(organizationId, {
    name,
    category,
    price,
    sku: (formData.get("sku") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    costPrice: formData.get("costPrice") ? parseFloat(formData.get("costPrice") as string) : undefined,
    taxRate: formData.get("taxRate") ? parseFloat(formData.get("taxRate") as string) : undefined,
    trackInventory: formData.get("trackInventory") === "on",
    stockQuantity: formData.get("stockQuantity") ? parseInt(formData.get("stockQuantity") as string) : undefined,
    lowStockThreshold: formData.get("lowStockThreshold") ? parseInt(formData.get("lowStockThreshold") as string) : undefined,
  });

  return redirect(`/tenant/pos/products/${product.id}`);
}

const categories = [
  { value: "equipment", label: "Equipment" },
  { value: "apparel", label: "Apparel" },
  { value: "accessories", label: "Accessories" },
  { value: "courses", label: "Courses" },
  { value: "rental", label: "Rental" },
];

export default function NewProductPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/tenant/pos/products" className="text-foreground-subtle hover:text-foreground-muted">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">New Product</h1>
      </div>

      {actionData?.error && (
        <div className="bg-danger-muted text-danger px-4 py-3 rounded-lg mb-6">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="bg-surface-raised rounded-xl p-6 shadow-sm space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
              Product Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
              placeholder="e.g., Dive Mask Pro"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-foreground mb-1">
              Category *
            </label>
            <select
              id="category"
              name="category"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sku" className="block text-sm font-medium text-foreground mb-1">
              SKU
            </label>
            <input
              type="text"
              id="sku"
              name="sku"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
              placeholder="e.g., DM-001"
            />
          </div>

          <div className="col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
              placeholder="Product description..."
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="border-t pt-6">
          <h3 className="font-medium mb-4">Pricing</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-foreground mb-1">
                Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-foreground-muted">$</span>
                <input
                  type="number"
                  id="price"
                  name="price"
                  required
                  step="0.01"
                  min="0"
                  className="w-full pl-7 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label htmlFor="costPrice" className="block text-sm font-medium text-foreground mb-1">
                Cost Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-foreground-muted">$</span>
                <input
                  type="number"
                  id="costPrice"
                  name="costPrice"
                  step="0.01"
                  min="0"
                  className="w-full pl-7 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label htmlFor="taxRate" className="block text-sm font-medium text-foreground mb-1">
                Tax Rate
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="taxRate"
                  name="taxRate"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue="8"
                  className="w-full pr-8 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                />
                <span className="absolute right-3 top-2 text-foreground-muted">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div className="border-t pt-6">
          <h3 className="font-medium mb-4">Inventory</h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="trackInventory"
                defaultChecked
                className="w-4 h-4 text-brand border-border-strong rounded focus:ring-brand"
              />
              <span className="text-sm text-foreground">Track inventory for this product</span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="stockQuantity" className="block text-sm font-medium text-foreground mb-1">
                  Initial Stock
                </label>
                <input
                  type="number"
                  id="stockQuantity"
                  name="stockQuantity"
                  min="0"
                  defaultValue="0"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>

              <div>
                <label htmlFor="lowStockThreshold" className="block text-sm font-medium text-foreground mb-1">
                  Low Stock Alert
                </label>
                <input
                  type="number"
                  id="lowStockThreshold"
                  name="lowStockThreshold"
                  min="0"
                  defaultValue="5"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t pt-6 flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? "Creating..." : "Create Product"}
          </button>
          <Link
            to="/tenant/pos/products"
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </Form>
    </div>
  );
}

/**
 * Edit Product Form
 */

import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Form, Link, useNavigation, redirect } from "react-router";
import { eq, and, asc } from "drizzle-orm";
import { requireTenant } from "../../../../../../lib/auth/org-context.server";
import { getProductById, updateProduct } from "../../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../../lib/db/tenant.server";
import { ImageManager, type Image } from "../../../../../../app/components/ui";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.product ? `Edit ${data.product.name} - DiveStreams` : "Edit Product - DiveStreams" },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const productId = params.id!;

  // Get tenant database for images query
  const { db, schema } = getTenantDb(organizationId);

  const [product, productImages] = await Promise.all([
    getProductById(organizationId, productId),
    db
      .select({
        id: schema.images.id,
        url: schema.images.url,
        thumbnailUrl: schema.images.thumbnailUrl,
        filename: schema.images.filename,
        width: schema.images.width,
        height: schema.images.height,
        alt: schema.images.alt,
        sortOrder: schema.images.sortOrder,
        isPrimary: schema.images.isPrimary,
      })
      .from(schema.images)
      .where(
        and(
          eq(schema.images.organizationId, organizationId),
          eq(schema.images.entityType, "product"),
          eq(schema.images.entityId, productId)
        )
      )
      .orderBy(asc(schema.images.sortOrder)),
  ]);

  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  // Format images for the component
  const images: Image[] = productImages.map((img) => ({
    id: img.id,
    url: img.url,
    thumbnailUrl: img.thumbnailUrl || img.url,
    filename: img.filename,
    width: img.width ?? undefined,
    height: img.height ?? undefined,
    alt: img.alt ?? undefined,
    sortOrder: img.sortOrder,
    isPrimary: img.isPrimary,
  }));

  return { product, images };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { organizationId } = await requireTenant(request);
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const category = formData.get("category") as string;
  const price = parseFloat(formData.get("price") as string);

  if (!name || !category || isNaN(price)) {
    return { error: "Name, category, and price are required" };
  }

  await updateProduct(organizationId, params.id!, {
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
    isActive: formData.get("isActive") === "on",
  });

  return redirect(`/tenant/pos/products/${params.id}`);
}

const categories = [
  { value: "equipment", label: "Equipment" },
  { value: "apparel", label: "Apparel" },
  { value: "accessories", label: "Accessories" },
  { value: "courses", label: "Courses" },
  { value: "rental", label: "Rental" },
];

export default function EditProductPage() {
  const { product, images } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/tenant/pos/products/${product.id}`} className="text-foreground-subtle hover:text-foreground-muted">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">Edit Product</h1>
      </div>

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
              defaultValue={product.name}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
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
              defaultValue={product.category}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
            >
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
              defaultValue={product.sku || ""}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
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
              defaultValue={product.description || ""}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
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
                  defaultValue={product.price}
                  className="w-full pl-7 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
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
                  defaultValue={product.costPrice || ""}
                  className="w-full pl-7 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
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
                  defaultValue={product.taxRate}
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
                defaultChecked={product.trackInventory}
                className="w-4 h-4 text-brand border-border-strong rounded focus:ring-brand"
              />
              <span className="text-sm text-foreground">Track inventory for this product</span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="stockQuantity" className="block text-sm font-medium text-foreground mb-1">
                  Stock Quantity
                </label>
                <input
                  type="number"
                  id="stockQuantity"
                  name="stockQuantity"
                  min="0"
                  defaultValue={product.stockQuantity}
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
                  defaultValue={product.lowStockThreshold}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Product Images */}
        <div className="border-t pt-6">
          <h3 className="font-medium mb-4">Product Images</h3>
          <ImageManager
            entityType="product"
            entityId={product.id}
            images={images}
            maxImages={5}
          />
        </div>

        {/* Status */}
        <div className="border-t pt-6">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={product.isActive}
              className="w-4 h-4 text-brand border-border-strong rounded focus:ring-brand"
            />
            <span className="text-sm text-foreground">Product is active and available for sale</span>
          </label>
        </div>

        {/* Actions */}
        <div className="border-t pt-6 flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <Link
            to={`/tenant/pos/products/${product.id}`}
            className="px-6 py-2 border rounded-lg hover:bg-surface-inset"
          >
            Cancel
          </Link>
        </div>
      </Form>
    </div>
  );
}

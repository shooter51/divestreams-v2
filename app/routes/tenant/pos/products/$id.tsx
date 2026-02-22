/**
 * Product Detail View
 */

import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, Link, Form, redirect } from "react-router";
import { useState } from "react";
import { eq, and, asc } from "drizzle-orm";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { getProductById, deleteProduct, adjustProductStock } from "../../../../../lib/db/queries.server";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import { CsrfInput } from "../../../../components/CsrfInput";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.product ? `${data.product.name} - DiveStreams` : "Product - DiveStreams" },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const productId = params.id!;

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

  const images = productImages.map((img) => ({
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
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    await deleteProduct(organizationId, params.id!);
    return redirect("/tenant/pos/products");
  }

  if (intent === "adjustStock") {
    const adjustment = parseInt(formData.get("adjustment") as string);
    const result = await adjustProductStock(organizationId, params.id!, adjustment);
    if (!result.success) {
      return { error: result.error };
    }
    return { success: true, newQuantity: result.newQuantity };
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
  equipment: "bg-brand-muted text-brand",
  apparel: "bg-info-muted text-info",
  accessories: "bg-success-muted text-success",
  courses: "bg-accent-muted text-accent",
  rental: "bg-accent-muted text-accent",
};

export default function ProductDetailPage() {
  const { product, images } = useLoaderData<typeof loader>();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const margin = product.costPrice
    ? Math.round(((product.price - product.costPrice) / product.price) * 100)
    : null;

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/tenant/pos/products" className="text-foreground-subtle hover:text-foreground-muted">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs px-2 py-1 rounded capitalize ${
                  categoryColors[product.category] || "bg-surface-inset text-foreground"
                }`}
              >
                {product.category}
              </span>
              {product.sku && (
                <span className="text-sm text-foreground-muted">SKU: {product.sku}</span>
              )}
              <span
                className={`text-xs px-2 py-1 rounded ${
                  product.isActive ? "bg-success-muted text-success" : "bg-surface-inset text-foreground-muted"
                }`}
              >
                {product.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            to={`/tenant/pos/products/${product.id}/edit`}
            className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
          >
            Edit Product
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Pricing */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Pricing</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-foreground-muted">Sell Price</span>
              <span className="text-2xl font-bold text-brand">{formatCurrency(product.price)}</span>
            </div>
            {product.costPrice && (
              <div className="flex justify-between">
                <span className="text-foreground-muted">Cost Price</span>
                <span className="font-medium">{formatCurrency(product.costPrice)}</span>
              </div>
            )}
            {margin !== null && (
              <div className="flex justify-between">
                <span className="text-foreground-muted">Margin</span>
                <span className={`font-medium ${margin >= 30 ? "text-success" : margin >= 15 ? "text-warning" : "text-danger"}`}>
                  {margin}%
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-foreground-muted">Tax Rate</span>
              <span className="font-medium">{product.taxRate}%</span>
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Inventory</h2>
          {product.trackInventory ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-foreground-muted">In Stock</span>
                <span
                  className={`text-2xl font-bold ${
                    product.stockQuantity <= product.lowStockThreshold
                      ? "text-accent"
                      : "text-success"
                  }`}
                >
                  {product.stockQuantity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Low Stock Alert</span>
                <span className="font-medium">{product.lowStockThreshold} units</span>
              </div>

              {/* Quick Stock Adjustment */}
              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-foreground-muted mb-2">Quick Adjustment</p>
                <div className="flex gap-2">
                  <Form method="post" className="flex gap-2">
                    <CsrfInput />
                    <input type="hidden" name="intent" value="adjustStock" />
                    <input type="hidden" name="adjustment" value="-1" />
                    <button
                      type="submit"
                      className="px-3 py-1 border border-border-strong rounded bg-surface-raised text-foreground hover:bg-surface-inset"
                    >
                      -1
                    </button>
                  </Form>
                  <Form method="post" className="flex gap-2">
                    <CsrfInput />
                    <input type="hidden" name="intent" value="adjustStock" />
                    <input type="hidden" name="adjustment" value="1" />
                    <button
                      type="submit"
                      className="px-3 py-1 border border-border-strong rounded bg-surface-raised text-foreground hover:bg-surface-inset"
                    >
                      +1
                    </button>
                  </Form>
                  <Form method="post" className="flex gap-2">
                    <CsrfInput />
                    <input type="hidden" name="intent" value="adjustStock" />
                    <input type="hidden" name="adjustment" value="10" />
                    <button
                      type="submit"
                      className="px-3 py-1 border border-border-strong rounded bg-surface-raised text-foreground hover:bg-surface-inset"
                    >
                      +10
                    </button>
                  </Form>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-foreground-muted">Inventory tracking disabled</p>
          )}
        </div>
      </div>

      {/* Product Images */}
      <div className="bg-surface-raised rounded-xl p-6 shadow-sm mt-6" data-testid="product-images-section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Product Images</h2>
          <Link
            to={`/tenant/pos/products/${product.id}/edit`}
            className="text-sm text-brand hover:text-brand-hover"
          >
            Manage Images
          </Link>
        </div>
        {images.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  className={`relative rounded-lg overflow-hidden border-2 cursor-pointer ${
                    image.isPrimary ? "border-brand" : "border-border"
                  }`}
                  onClick={() => setLightboxIndex(index)}
                >
                  <img
                    src={image.thumbnailUrl || image.url}
                    alt={image.alt || image.filename}
                    className="w-full aspect-square object-cover"
                  />
                  {image.isPrimary && (
                    <div className="absolute top-1 left-1 bg-brand text-white text-xs px-1.5 py-0.5 rounded">
                      Primary
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Lightbox */}
            {lightboxIndex !== null && (
              <div
                className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
                onClick={() => setLightboxIndex(null)}
                data-testid="image-lightbox"
              >
                <button
                  className="absolute top-4 right-4 text-white text-3xl hover:text-foreground-muted"
                  onClick={() => setLightboxIndex(null)}
                  aria-label="Close lightbox"
                >
                  &times;
                </button>
                {lightboxIndex > 0 && (
                  <button
                    className="absolute left-4 text-white text-3xl hover:text-foreground-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(lightboxIndex - 1);
                    }}
                    aria-label="Previous image"
                  >
                    &#8249;
                  </button>
                )}
                {lightboxIndex < images.length - 1 && (
                  <button
                    className="absolute right-4 text-white text-3xl hover:text-foreground-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(lightboxIndex + 1);
                    }}
                    aria-label="Next image"
                  >
                    &#8250;
                  </button>
                )}
                <img
                  src={images[lightboxIndex].url}
                  alt={images[lightboxIndex].alt || images[lightboxIndex].filename}
                  className="max-h-[90vh] max-w-[90vw] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </>
        ) : (
          <div className="border-2 border-dashed border-border-strong rounded-lg p-8 text-center" data-testid="no-images-placeholder">
            <div className="text-foreground-subtle text-4xl mb-2">📷</div>
            <p className="text-foreground-muted text-sm mb-3">No product images yet</p>
            <Link
              to={`/tenant/pos/products/${product.id}/edit`}
              className="inline-block px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand-hover"
            >
              Add Images
            </Link>
          </div>
        )}
      </div>

      {/* Description */}
      {product.description && (
        <div className="bg-surface-raised rounded-xl p-6 shadow-sm mt-6">
          <h2 className="font-semibold mb-2">Description</h2>
          <p className="text-foreground-muted">{product.description}</p>
        </div>
      )}

      {/* Danger Zone */}
      <div className="bg-surface-raised rounded-xl p-6 shadow-sm mt-6 border border-danger">
        <h2 className="font-semibold text-danger mb-4">Danger Zone</h2>
        <Form method="post">
          <CsrfInput />
          <input type="hidden" name="intent" value="delete" />
          <button
            type="submit"
            onClick={(e) => {
              if (!confirm("Are you sure you want to delete this product? This cannot be undone.")) {
                e.preventDefault();
              }
            }}
            className="px-4 py-2 border border-danger text-danger rounded-lg hover:bg-danger-muted"
          >
            Delete Product
          </button>
        </Form>
      </div>
    </div>
  );
}

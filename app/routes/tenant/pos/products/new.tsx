/**
 * New Product Form
 */

import type { MetaFunction, ActionFunctionArgs } from "react-router";
import { Form, Link, useActionData, useNavigation, redirect } from "react-router";
import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { createProduct } from "../../../../../lib/db/queries.server";
import { uploadToB2, getImageKey, processImage, isValidImageType, getWebPMimeType, getS3Client } from "../../../../../lib/storage";
import { getTenantDb } from "../../../../../lib/db/tenant.server";
import { redirectWithNotification } from "../../../../../lib/use-notification";

export const meta: MetaFunction = () => [{ title: "New Product - DiveStreams" }];

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireOrgContext(request);
  const organizationId = ctx.org.id;
  const formData = await request.formData();

  // Extract image files before processing other form data
  const imageFiles: File[] = [];
  const allImages = formData.getAll("images");
  for (const item of allImages) {
    if (item instanceof File && item.size > 0) {
      imageFiles.push(item);
    }
  }

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

  // Process uploaded images if any
  if (imageFiles.length > 0) {
    // Check if storage is configured BEFORE attempting uploads
    const s3Client = getS3Client();
    if (!s3Client) {
      return redirect(redirectWithNotification(
        `/tenant/pos/products/${product.id}`,
        `Product "${name}" created, but image storage is not configured. Contact support to enable image uploads.`,
        "warning"
      ));
    }

    const { db, schema } = getTenantDb(ctx.org.slug);
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    let uploadedCount = 0;
    const skippedFiles: string[] = [];
    const failedFiles: string[] = [];

    for (let i = 0; i < Math.min(imageFiles.length, 5); i++) {
      const file = imageFiles[i];

      // Validate file type
      if (!isValidImageType(file.type)) {
        skippedFiles.push(`${file.name} (invalid type: ${file.type})`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        skippedFiles.push(`${file.name} (exceeds 10MB limit)`);
        continue;
      }

      try {
        // Process image
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const processed = await processImage(buffer);

        // Generate storage keys
        const baseKey = getImageKey(ctx.org.slug, "product", product.id, file.name);
        const originalKey = `${baseKey}.webp`;
        const thumbnailKey = `${baseKey}-thumb.webp`;

        // Upload to S3/B2
        const originalUpload = await uploadToB2(originalKey, processed.original, getWebPMimeType());
        if (!originalUpload) {
          failedFiles.push(`${file.name} (storage error)`);
          continue;
        }

        const thumbnailUpload = await uploadToB2(thumbnailKey, processed.thumbnail, getWebPMimeType());

        // Save to database
        await db.insert(schema.images).values({
          organizationId,
          entityType: "product",
          entityId: product.id,
          url: originalUpload.cdnUrl,
          thumbnailUrl: thumbnailUpload?.cdnUrl || originalUpload.cdnUrl,
          filename: file.name,
          mimeType: getWebPMimeType(),
          sizeBytes: processed.original.length,
          width: processed.width,
          height: processed.height,
          alt: file.name,
          sortOrder: i,
          isPrimary: i === 0,
        });

        uploadedCount++;
      } catch (error) {
        console.error(`Failed to upload image ${file.name}:`, error);
        failedFiles.push(`${file.name} (upload failed)`);
      }
    }

    // Build detailed message based on results
    let message: string;
    let messageType: "success" | "warning" | "error" = "success";

    if (uploadedCount === imageFiles.length) {
      message = `Product "${name}" created with ${uploadedCount} image${uploadedCount > 1 ? "s" : ""}!`;
    } else if (uploadedCount > 0) {
      message = `Product "${name}" created with ${uploadedCount} of ${imageFiles.length} images.`;
      if (skippedFiles.length > 0) message += ` Skipped: ${skippedFiles.join(", ")}`;
      if (failedFiles.length > 0) message += ` Failed: ${failedFiles.join(", ")}`;
      messageType = "warning";
    } else {
      message = `Product "${name}" created, but all ${imageFiles.length} image(s) failed to upload.`;
      if (skippedFiles.length > 0) message += ` Skipped: ${skippedFiles.join(", ")}`;
      if (failedFiles.length > 0) message += ` Failed: ${failedFiles.join(", ")}`;
      messageType = "error";
    }

    return redirect(redirectWithNotification(`/tenant/pos/products/${product.id}`, message, messageType));
  }

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
        <div className="bg-danger-muted text-danger px-4 py-3 rounded-lg mb-6 max-w-4xl break-words">
          {actionData.error}
        </div>
      )}

      <Form method="post" encType="multipart/form-data" className="bg-surface-raised rounded-xl p-6 shadow-sm space-y-6">
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

        {/* Images */}
        <div className="border-t pt-6">
          <h3 className="font-medium mb-4">Product Images (Optional)</h3>
          <div>
            <label htmlFor="images" className="block text-sm font-medium mb-2">
              Upload up to 5 images
            </label>
            <input
              type="file"
              id="images"
              name="images"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="block w-full text-sm text-foreground-muted
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-brand file:text-white
                hover:file:bg-brand-hover
                file:cursor-pointer cursor-pointer"
            />
            <p className="mt-2 text-sm text-foreground-muted">
              JPEG, PNG, WebP, or GIF. Max 10MB each.
            </p>
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

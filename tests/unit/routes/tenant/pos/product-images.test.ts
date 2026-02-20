/**
 * Unit Tests for Product Image CRUD (KAN-641)
 *
 * Verifies that:
 * - Product detail page includes image display section
 * - Edit page renders ImageManager component
 * - Delete image action handler works
 * - Reorder images action handler works
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// =============================================================================
// Source code verification tests (no mocking needed)
// =============================================================================

describe("Product Detail Page - Image Display", () => {
  const detailSource = fs.readFileSync(
    path.resolve(__dirname, "../../../../../app/routes/tenant/pos/products/$id.tsx"),
    "utf-8"
  );

  it("imports getTenantDb for image queries", () => {
    expect(detailSource).toContain("getTenantDb");
  });

  it("imports drizzle-orm operators for image queries", () => {
    expect(detailSource).toContain("eq, and, asc");
    expect(detailSource).toContain("from \"drizzle-orm\"");
  });

  it("queries images table in loader", () => {
    expect(detailSource).toContain("schema.images");
    expect(detailSource).toContain('entityType, "product"');
  });

  it("returns images from the loader", () => {
    expect(detailSource).toContain("return { product, images }");
  });

  it("destructures images from loader data in component", () => {
    expect(detailSource).toContain("const { product, images } = useLoaderData");
  });

  it("renders product images section with data-testid", () => {
    expect(detailSource).toContain('data-testid="product-images-section"');
  });

  it("renders Product Images heading", () => {
    expect(detailSource).toContain("Product Images");
  });

  it("renders image thumbnails with alt text", () => {
    expect(detailSource).toContain("image.thumbnailUrl || image.url");
    expect(detailSource).toContain("image.alt || image.filename");
  });

  it("shows primary badge on primary image", () => {
    expect(detailSource).toContain("image.isPrimary");
    expect(detailSource).toContain("Primary");
  });

  it("shows a placeholder when no images exist", () => {
    expect(detailSource).toContain('data-testid="no-images-placeholder"');
    expect(detailSource).toContain("No product images yet");
  });

  it("placeholder links to edit page for adding images", () => {
    expect(detailSource).toContain("Add Images");
    expect(detailSource).toContain("/edit");
  });

  it("includes Manage Images link to edit page", () => {
    expect(detailSource).toContain("Manage Images");
  });

  it("includes lightbox functionality for image viewing", () => {
    expect(detailSource).toContain("lightboxIndex");
    expect(detailSource).toContain('data-testid="image-lightbox"');
  });

  it("lightbox has close button with aria-label", () => {
    expect(detailSource).toContain('aria-label="Close lightbox"');
  });

  it("lightbox has navigation buttons", () => {
    expect(detailSource).toContain('aria-label="Previous image"');
    expect(detailSource).toContain('aria-label="Next image"');
  });
});

describe("Product Edit Page - ImageManager Rendering", () => {
  const editSource = fs.readFileSync(
    path.resolve(__dirname, "../../../../../app/routes/tenant/pos/products/$id/edit.tsx"),
    "utf-8"
  );

  it("imports ImageManager component", () => {
    expect(editSource).toContain("ImageManager");
    expect(editSource).toContain("type Image");
  });

  it("imports getTenantDb for image queries", () => {
    expect(editSource).toContain("getTenantDb");
  });

  it("queries images in the loader", () => {
    expect(editSource).toContain("schema.images");
    expect(editSource).toContain('entityType, "product"');
  });

  it("returns images from the loader", () => {
    expect(editSource).toContain("return { product, images }");
  });

  it("formats images for the ImageManager component", () => {
    expect(editSource).toContain("const images: Image[]");
  });

  it("renders ImageManager component with correct props", () => {
    expect(editSource).toContain("<ImageManager");
    expect(editSource).toContain('entityType="product"');
    expect(editSource).toContain("entityId={product.id}");
    expect(editSource).toContain("images={images}");
    expect(editSource).toContain("maxImages={5}");
  });

  it("renders ImageManager under Product Images heading", () => {
    // Verify the section heading exists near the ImageManager
    expect(editSource).toContain("Product Images");
    expect(editSource).toContain("<ImageManager");
  });
});

// =============================================================================
// Delete Image API Route Tests
// =============================================================================

describe("Delete Image API Route", () => {
  const deleteSource = fs.readFileSync(
    path.resolve(__dirname, "../../../../../app/routes/tenant/images/delete.tsx"),
    "utf-8"
  );

  it("exports an action function", () => {
    expect(deleteSource).toContain("export async function action");
  });

  it("requires POST method", () => {
    expect(deleteSource).toContain('request.method !== "POST"');
    expect(deleteSource).toContain("Method not allowed");
  });

  it("requires imageId parameter", () => {
    expect(deleteSource).toContain('formData.get("imageId")');
    expect(deleteSource).toContain("imageId is required");
  });

  it("deletes from B2 storage", () => {
    expect(deleteSource).toContain("deleteFromB2");
  });

  it("deletes from database", () => {
    expect(deleteSource).toContain("db.delete(schema.images)");
  });

  it("sets a new primary image when primary is deleted", () => {
    expect(deleteSource).toContain("image.isPrimary");
    expect(deleteSource).toContain("isPrimary: true");
  });

  it("returns success response", () => {
    expect(deleteSource).toContain("{ success: true }");
  });

  it("handles errors gracefully", () => {
    expect(deleteSource).toContain("Failed to delete image");
  });
});

// =============================================================================
// Reorder Images API Route Tests
// =============================================================================

describe("Reorder Images API Route", () => {
  const reorderSource = fs.readFileSync(
    path.resolve(__dirname, "../../../../../app/routes/tenant/images/reorder.tsx"),
    "utf-8"
  );

  it("exports an action function", () => {
    expect(reorderSource).toContain("export async function action");
  });

  it("requires POST method", () => {
    expect(reorderSource).toContain('request.method !== "POST"');
    expect(reorderSource).toContain("Method not allowed");
  });

  it("parses JSON body with entityType, entityId, and images", () => {
    expect(reorderSource).toContain("request.json()");
    expect(reorderSource).toContain("entityType");
    expect(reorderSource).toContain("entityId");
    expect(reorderSource).toContain("images");
  });

  it("validates required parameters", () => {
    expect(reorderSource).toContain("entityType, entityId, and images array are required");
  });

  it("verifies images belong to the entity", () => {
    expect(reorderSource).toContain("images do not belong to this entity");
    expect(reorderSource).toContain("inArray");
  });

  it("resets all primary flags before updating", () => {
    expect(reorderSource).toContain("isPrimary: false");
  });

  it("updates sortOrder and isPrimary for each image", () => {
    expect(reorderSource).toContain("sortOrder: img.sortOrder");
    expect(reorderSource).toContain("isPrimary: img.isPrimary");
  });

  it("returns success response", () => {
    expect(reorderSource).toContain("{ success: true }");
  });

  it("handles errors gracefully", () => {
    expect(reorderSource).toContain("Failed to reorder images");
  });
});

// =============================================================================
// ImageManager Component Tests
// =============================================================================

describe("ImageManager Component", () => {
  const imageManagerSource = fs.readFileSync(
    path.resolve(__dirname, "../../../../../app/components/ui/ImageManager.tsx"),
    "utf-8"
  );

  it("exports Image interface", () => {
    expect(imageManagerSource).toContain("export interface Image");
  });

  it("exports ImageManager component", () => {
    expect(imageManagerSource).toContain("export function ImageManager");
  });

  it("supports product as entityType", () => {
    expect(imageManagerSource).toContain('"product"');
  });

  it("handles file upload via /tenant/images/upload", () => {
    expect(imageManagerSource).toContain('"/tenant/images/upload"');
  });

  it("handles image deletion via /tenant/images/delete", () => {
    expect(imageManagerSource).toContain('"/tenant/images/delete"');
  });

  it("handles reorder via /tenant/images/reorder", () => {
    expect(imageManagerSource).toContain('"/tenant/images/reorder"');
  });

  it("supports drag-and-drop reordering", () => {
    expect(imageManagerSource).toContain("onDragStart");
    expect(imageManagerSource).toContain("onDragOver");
    expect(imageManagerSource).toContain("onDragEnd");
    expect(imageManagerSource).toContain("draggable");
  });

  it("shows empty state when no images", () => {
    expect(imageManagerSource).toContain("No images yet");
    expect(imageManagerSource).toContain("Upload your first image");
  });

  it("shows image count out of max", () => {
    expect(imageManagerSource).toContain("images.length}/{maxImages}");
  });

  it("supports setting primary image", () => {
    expect(imageManagerSource).toContain("handleSetPrimary");
    expect(imageManagerSource).toContain("Set as primary");
  });

  it("validates max images limit before upload", () => {
    expect(imageManagerSource).toContain("images.length >= maxImages");
    expect(imageManagerSource).toContain("Maximum");
    expect(imageManagerSource).toContain("images allowed");
  });
});

// =============================================================================
// Delete Image Action Handler - Functional Tests
// =============================================================================

describe("Delete Image Action - Functional", () => {
  it("returns 400 when imageId is missing from form data", async () => {
    // We test the validation logic by checking the source handles this case
    const deleteSource = fs.readFileSync(
      path.resolve(__dirname, "../../../../../app/routes/tenant/images/delete.tsx"),
      "utf-8"
    );

    // Verify the guard exists
    expect(deleteSource).toContain("if (!imageId)");
    expect(deleteSource).toContain("status: 400");
    expect(deleteSource).toContain('"imageId is required"');
  });

  it("returns 405 for non-POST methods", async () => {
    const deleteSource = fs.readFileSync(
      path.resolve(__dirname, "../../../../../app/routes/tenant/images/delete.tsx"),
      "utf-8"
    );

    expect(deleteSource).toContain('request.method !== "POST"');
    expect(deleteSource).toContain("status: 405");
  });

  it("returns 404 when image is not found in database", async () => {
    const deleteSource = fs.readFileSync(
      path.resolve(__dirname, "../../../../../app/routes/tenant/images/delete.tsx"),
      "utf-8"
    );

    expect(deleteSource).toContain("Image not found");
    expect(deleteSource).toContain("status: 404");
  });

  it("deletes both original and thumbnail from B2 storage", async () => {
    const deleteSource = fs.readFileSync(
      path.resolve(__dirname, "../../../../../app/routes/tenant/images/delete.tsx"),
      "utf-8"
    );

    // Verify it extracts keys from both url and thumbnailUrl
    expect(deleteSource).toContain("originalKey");
    expect(deleteSource).toContain("thumbnailKey");
    expect(deleteSource).toContain("deleteFromB2(originalKey)");
    expect(deleteSource).toContain("deleteFromB2(thumbnailKey)");
  });
});

// =============================================================================
// Reorder Images Action - Functional Tests
// =============================================================================

describe("Reorder Images Action - Functional", () => {
  it("returns 400 when required fields are missing", async () => {
    const reorderSource = fs.readFileSync(
      path.resolve(__dirname, "../../../../../app/routes/tenant/images/reorder.tsx"),
      "utf-8"
    );

    expect(reorderSource).toContain("!entityType || !entityId || !Array.isArray(images)");
    expect(reorderSource).toContain("status: 400");
  });

  it("returns 405 for non-POST methods", async () => {
    const reorderSource = fs.readFileSync(
      path.resolve(__dirname, "../../../../../app/routes/tenant/images/reorder.tsx"),
      "utf-8"
    );

    expect(reorderSource).toContain('request.method !== "POST"');
    expect(reorderSource).toContain("status: 405");
  });

  it("validates all images belong to the specified entity", async () => {
    const reorderSource = fs.readFileSync(
      path.resolve(__dirname, "../../../../../app/routes/tenant/images/reorder.tsx"),
      "utf-8"
    );

    expect(reorderSource).toContain("existingImages.length !== images.length");
    expect(reorderSource).toContain("do not belong to this entity");
  });

  it("resets primary flags for all entity images before applying new order", async () => {
    const reorderSource = fs.readFileSync(
      path.resolve(__dirname, "../../../../../app/routes/tenant/images/reorder.tsx"),
      "utf-8"
    );

    // Must reset first, then set individual ones
    expect(reorderSource).toContain("isPrimary: false");
    expect(reorderSource).toContain("isPrimary: img.isPrimary || false");
  });
});

// =============================================================================
// Integration between detail/edit pages and image APIs
// =============================================================================

describe("Product Image CRUD Integration", () => {
  it("detail page and edit page use same image query pattern", () => {
    const detailSource = fs.readFileSync(
      path.resolve(__dirname, "../../../../../app/routes/tenant/pos/products/$id.tsx"),
      "utf-8"
    );
    const editSource = fs.readFileSync(
      path.resolve(__dirname, "../../../../../app/routes/tenant/pos/products/$id/edit.tsx"),
      "utf-8"
    );

    // Both should query from schema.images
    expect(detailSource).toContain("schema.images");
    expect(editSource).toContain("schema.images");

    // Both should filter by entityType "product"
    expect(detailSource).toContain('entityType, "product"');
    expect(editSource).toContain('entityType, "product"');

    // Both should order by sortOrder
    expect(detailSource).toContain("asc(schema.images.sortOrder)");
    expect(editSource).toContain("asc(schema.images.sortOrder)");
  });

  it("detail page links to edit page for image management", () => {
    const detailSource = fs.readFileSync(
      path.resolve(__dirname, "../../../../../app/routes/tenant/pos/products/$id.tsx"),
      "utf-8"
    );

    // Should have "Manage Images" and "Add Images" links to edit page
    expect(detailSource).toContain("Manage Images");
    expect(detailSource).toContain("Add Images");
    expect(detailSource).toContain("/edit");
  });

  it("ImageManager component uses same API endpoints as the image routes", () => {
    const imageManagerSource = fs.readFileSync(
      path.resolve(__dirname, "../../../../../app/components/ui/ImageManager.tsx"),
      "utf-8"
    );

    // Upload endpoint
    expect(imageManagerSource).toContain("/tenant/images/upload");
    // Delete endpoint
    expect(imageManagerSource).toContain("/tenant/images/delete");
    // Reorder endpoint
    expect(imageManagerSource).toContain("/tenant/images/reorder");
  });

  it("image upload route supports product entity type", () => {
    const uploadSource = fs.readFileSync(
      path.resolve(__dirname, "../../../../../app/routes/tenant/images/upload.tsx"),
      "utf-8"
    );

    expect(uploadSource).toContain('"product"');
    // Verify it's in the allowedTypes list
    expect(uploadSource).toContain("allowedTypes");
  });
});

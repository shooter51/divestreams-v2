/**
 * Products Management (Inventory for POS)
 */

import { useState, useRef, useEffect } from "react";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, Form } from "react-router";
import { requireTenant } from "../../../lib/auth/org-context.server";
import { getTenantDb } from "../../../lib/db/tenant.server";
import { db } from "../../../lib/db/index";
import { eq } from "drizzle-orm";
import { BarcodeScannerModal } from "../../components/BarcodeScannerModal";

export const meta: MetaFunction = () => [{ title: "Products - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant, organizationId } = await requireTenant(request);
  const { schema: tables } = getTenantDb(organizationId);

  try {
    const products = await db
      .select()
      .from(tables.products)
      .orderBy(tables.products.category, tables.products.name);

    return { tenant, products, migrationNeeded: false };
  } catch (error) {
    // If sale_price columns don't exist yet, try without them
    console.error("Products query failed, trying basic query:", error);
    try {
      const products = await db
        .select({
          id: tables.products.id,
          name: tables.products.name,
          sku: tables.products.sku,
          category: tables.products.category,
          description: tables.products.description,
          price: tables.products.price,
          costPrice: tables.products.costPrice,
          currency: tables.products.currency,
          taxRate: tables.products.taxRate,
          trackInventory: tables.products.trackInventory,
          stockQuantity: tables.products.stockQuantity,
          lowStockThreshold: tables.products.lowStockThreshold,
          imageUrl: tables.products.imageUrl,
          isActive: tables.products.isActive,
          createdAt: tables.products.createdAt,
          updatedAt: tables.products.updatedAt,
        })
        .from(tables.products)
        .orderBy(tables.products.category, tables.products.name);

      return { tenant, products, migrationNeeded: true };
    } catch (fallbackError) {
      console.error("Basic products query also failed:", fallbackError);
      return { tenant, products: [], migrationNeeded: true };
    }
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { tenant, organizationId } = await requireTenant(request);
  const { schema: tables } = getTenantDb(organizationId);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name") as string;
    const category = formData.get("category") as string;
    const price = formData.get("price") as string;
    const sku = formData.get("sku") as string || null;
    const barcode = formData.get("barcode") as string || null;
    const description = formData.get("description") as string || null;
    const stockQuantity = parseInt(formData.get("stockQuantity") as string) || 0;
    const lowStockThreshold = parseInt(formData.get("lowStockThreshold") as string) || 5;
    const costPrice = formData.get("costPrice") as string || null;
    const salePrice = formData.get("salePrice") as string || null;
    const saleStartDate = formData.get("saleStartDate") as string || null;
    const saleEndDate = formData.get("saleEndDate") as string || null;

    await db.insert(tables.products).values({
      organizationId: tenant.subdomain, // Using subdomain as org identifier
      name,
      category,
      price,
      sku,
      barcode,
      description,
      stockQuantity,
      lowStockThreshold,
      costPrice,
      salePrice: salePrice || null,
      saleStartDate: saleStartDate ? new Date(saleStartDate) : null,
      saleEndDate: saleEndDate ? new Date(saleEndDate) : null,
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
    const barcode = formData.get("barcode") as string || null;
    const description = formData.get("description") as string || null;
    const stockQuantity = parseInt(formData.get("stockQuantity") as string) || 0;
    const lowStockThreshold = parseInt(formData.get("lowStockThreshold") as string) || 5;
    const costPrice = formData.get("costPrice") as string || null;
    const salePrice = formData.get("salePrice") as string || null;
    const saleStartDate = formData.get("saleStartDate") as string || null;
    const saleEndDate = formData.get("saleEndDate") as string || null;
    const isActive = formData.get("isActive") === "true";

    await db
      .update(tables.products)
      .set({
        name,
        category,
        price,
        sku,
        barcode,
        description,
        stockQuantity,
        lowStockThreshold,
        costPrice,
        salePrice: salePrice || null,
        saleStartDate: saleStartDate ? new Date(saleStartDate) : null,
        saleEndDate: saleEndDate ? new Date(saleEndDate) : null,
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

  if (intent === "bulk-update-stock") {
    const productIds = JSON.parse(formData.get("productIds") as string) as string[];
    const updateType = formData.get("updateType") as "set" | "adjust";
    const value = parseInt(formData.get("value") as string) || 0;

    if (productIds.length === 0) {
      return { error: "No products selected" };
    }

    let updatedCount = 0;

    for (const productId of productIds) {
      if (updateType === "set") {
        // Set stock to specific value
        await db
          .update(tables.products)
          .set({ stockQuantity: Math.max(0, value), updatedAt: new Date() })
          .where(eq(tables.products.id, productId));
        updatedCount++;
      } else {
        // Adjust by value
        const [product] = await db
          .select()
          .from(tables.products)
          .where(eq(tables.products.id, productId));

        if (product) {
          const newQuantity = Math.max(0, product.stockQuantity + value);
          await db
            .update(tables.products)
            .set({ stockQuantity: newQuantity, updatedAt: new Date() })
            .where(eq(tables.products.id, productId));
          updatedCount++;
        }
      }
    }

    return {
      success: true,
      message: `Updated stock for ${updatedCount} product${updatedCount !== 1 ? 's' : ''}`
    };
  }

  if (intent === "import-csv") {
    const csvData = formData.get("csvData") as string;

    if (!csvData) {
      return { error: "No CSV data provided" };
    }

    const lines = csvData.split("\n").filter(line => line.trim());
    if (lines.length < 2) {
      return { error: "CSV must have a header row and at least one data row" };
    }

    // Parse header row
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    // Validate required columns
    const requiredColumns = ["name", "sku", "price", "stockquantity"];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      return { error: `Missing required columns: ${missingColumns.join(", ")}` };
    }

    const validCategories = ["equipment", "apparel", "accessories", "courses", "rental", "consumables", "other"];

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0 || values.every(v => !v.trim())) continue;

      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx]?.trim() || "";
      });

      // Validate required fields
      if (!row.name) {
        errors.push(`Row ${i + 1}: Missing required field 'name'`);
        errorCount++;
        continue;
      }
      if (!row.sku) {
        errors.push(`Row ${i + 1}: Missing required field 'sku'`);
        errorCount++;
        continue;
      }
      if (!row.price || isNaN(parseFloat(row.price))) {
        errors.push(`Row ${i + 1}: Invalid or missing 'price'`);
        errorCount++;
        continue;
      }
      if (row.stockquantity === "" || isNaN(parseInt(row.stockquantity))) {
        errors.push(`Row ${i + 1}: Invalid or missing 'stockQuantity'`);
        errorCount++;
        continue;
      }

      // Validate category
      const category = row.category?.toLowerCase() || "other";
      if (!validCategories.includes(category)) {
        errors.push(`Row ${i + 1}: Invalid category '${row.category}', using 'other'`);
      }

      try {
        await db.insert(tables.products).values({
          organizationId: tenant.subdomain, // Using subdomain as org identifier
          name: row.name,
          sku: row.sku,
          category: validCategories.includes(category) ? category : "other",
          price: row.price,
          costPrice: row.costprice || null,
          stockQuantity: parseInt(row.stockquantity),
          lowStockThreshold: row.lowstockthreshold ? parseInt(row.lowstockthreshold) : 5,
          description: row.description || null,
          isActive: row.isactive?.toLowerCase() !== "false",
          trackInventory: true,
        });
        successCount++;
      } catch (err) {
        errors.push(`Row ${i + 1}: Database error - ${err instanceof Error ? err.message : "Unknown error"}`);
        errorCount++;
      }
    }

    return {
      success: true,
      message: `Imported ${successCount} products${errorCount > 0 ? `, ${errorCount} errors` : ""}`,
      importResult: { successCount, errorCount, errors: errors.slice(0, 10) },
    };
  }

  return { error: "Invalid intent" };
}

// Helper function to parse CSV line, handling quoted values with commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
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

// Helper to check if product is currently on sale
function isOnSale(product: {
  salePrice?: string | null;
  saleStartDate?: Date | string | null;
  saleEndDate?: Date | string | null;
}): boolean {
  if (!product.salePrice) return false;
  const now = new Date();
  if (product.saleStartDate && new Date(product.saleStartDate) > now) return false;
  if (product.saleEndDate && new Date(product.saleEndDate) < now) return false;
  return true;
}

// Helper to get the effective price (sale price if on sale, otherwise regular price)
function getEffectivePrice(product: {
  price: string;
  salePrice?: string | null;
  saleStartDate?: Date | string | null;
  saleEndDate?: Date | string | null;
}): number {
  if (isOnSale(product)) {
    return Number(product.salePrice);
  }
  return Number(product.price);
}

// Helper to format date for datetime-local input
function formatDateForInput(dateVal: Date | string | null): string {
  if (!dateVal) return "";
  const date = dateVal instanceof Date ? dateVal : new Date(dateVal);
  return date.toISOString().slice(0, 16);
}

// Extended product type that includes optional sale fields
type ProductWithSaleFields = {
  id: string;
  name: string;
  sku: string | null;
  barcode?: string | null;
  category: string;
  description: string | null;
  price: string;
  costPrice: string | null;
  currency: string;
  taxRate: string | null;
  trackInventory: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  salePrice?: string | null;
  saleStartDate?: Date | string | null;
  saleEndDate?: Date | string | null;
};

export default function ProductsPage() {
  const { products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithSaleFields | null>(null);
  const [stockAdjustment, setStockAdjustment] = useState<{ id: string; name: string } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    errorCount: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [bulkUpdateType, setBulkUpdateType] = useState<"set" | "adjust">("adjust");
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState("");

  const isSubmitting = fetcher.state === "submitting";

  const fetcherData = fetcher.data as {
    success?: boolean;
    message?: string;
    error?: string;
    importResult?: { successCount: number; errorCount: number; errors: string[] };
  } | undefined;

  // Close modal on successful create/update/delete
  useEffect(() => {
    if (fetcherData?.success) {
      setShowForm(false);
      setEditingProduct(null);
    }
  }, [fetcherData?.success]);

  // Toggle product selection
  const toggleProductSelection = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  // Select/deselect all products
  const toggleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  // Handle bulk stock update
  const handleBulkUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("intent", "bulk-update-stock");
    formData.append("productIds", JSON.stringify(Array.from(selectedProducts)));
    formData.append("updateType", bulkUpdateType);
    fetcher.submit(formData, { method: "post" });
    setShowBulkUpdate(false);
    setSelectedProducts(new Set());
  };

  // Handle CSV export
  const handleExportCSV = () => {
    const headers = [
      "name",
      "sku",
      "category",
      "price",
      "costPrice",
      "stockQuantity",
      "lowStockThreshold",
      "description",
      "isActive",
    ];

    const escapeCSV = (value: string | number | boolean | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      headers.join(","),
      ...products.map((p) =>
        [
          escapeCSV(p.name),
          escapeCSV(p.sku),
          escapeCSV(p.category),
          escapeCSV(p.price),
          escapeCSV(p.costPrice),
          escapeCSV(p.stockQuantity),
          escapeCSV(p.lowStockThreshold),
          escapeCSV(p.description),
          escapeCSV(p.isActive),
        ].join(",")
      ),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `products-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Handle CSV file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();

    // Submit the CSV data via the fetcher
    const formData = new FormData();
    formData.append("intent", "import-csv");
    formData.append("csvData", text);

    fetcher.submit(formData, { method: "post" });
    setShowImportModal(false);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Update import result when fetcher completes
  if (fetcherData?.importResult && fetcherData.importResult !== importResult) {
    setImportResult(fetcherData.importResult);
  }

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
          <p className="text-foreground-muted">Manage your retail products and stock levels</p>
        </div>
        <div className="flex gap-2">
          {selectedProducts.size > 0 && (
            <button
              onClick={() => setShowBulkUpdate(true)}
              className="px-4 py-2 bg-warning-muted text-white rounded-lg hover:bg-warning"
            >
              Bulk Update ({selectedProducts.size})
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 border border-border-strong text-foreground rounded-lg hover:bg-surface-inset"
            disabled={products.length === 0}
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 border border-border-strong text-foreground rounded-lg hover:bg-surface-inset"
          >
            Import CSV
          </button>
          <button
            onClick={() => {
              setEditingProduct(null);
              setBarcodeValue("");
              setShowForm(true);
            }}
            className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-warning-muted border border-warning rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-warning mb-2">Low Stock Alert</h3>
          <div className="flex flex-wrap gap-2">
            {lowStockProducts.map((p) => (
              <span
                key={p.id}
                className="px-3 py-1 bg-warning-muted text-warning rounded-full text-sm"
              >
                {p.name}: {p.stockQuantity} left
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Success Message */}
      {fetcherData?.success && (
        <div className="bg-success-muted border border-success text-success p-3 rounded-lg mb-4">
          {fetcherData.message}
        </div>
      )}

      {/* Error Message */}
      {fetcherData?.error && (
        <div className="bg-danger-muted border border-danger text-danger p-3 rounded-lg mb-4">
          {fetcherData.error}
        </div>
      )}

      {/* Import Results */}
      {importResult && importResult.errors.length > 0 && (
        <div className="bg-warning-muted border border-warning rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-warning">Import Errors</h3>
            <button
              onClick={() => setImportResult(null)}
              className="text-warning hover:text-warning text-sm"
            >
              Dismiss
            </button>
          </div>
          <ul className="text-sm text-warning space-y-1">
            {importResult.errors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
            {importResult.errorCount > 10 && (
              <li className="italic">...and {importResult.errorCount - 10} more errors</li>
            )}
          </ul>
        </div>
      )}

      {/* Products List */}
      {Object.entries(productsByCategory).map(([category, categoryProducts]: [string, typeof products]) => (
        <div key={category} className="mb-8">
          <h2 className="text-lg font-semibold capitalize mb-3 text-foreground">
            {category} ({categoryProducts.length})
          </h2>
          <div className="bg-surface-raised rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-inset">
                <tr>
                  <th className="px-4 py-3 text-left w-8">
                    <input
                      type="checkbox"
                      checked={selectedProducts.size === products.length && products.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">Product</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">SKU</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-foreground-muted">Price</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-foreground-muted">Stock</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-foreground-muted">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-foreground-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {categoryProducts.map((product) => {
                  // Cast product to include optional sale fields for type checking
                  const productWithSale = product as typeof product & { salePrice?: string | null; saleStartDate?: Date | string | null; saleEndDate?: Date | string | null };
                  const onSale = isOnSale(productWithSale);
                  return (
                  <tr key={product.id} className={!product.isActive ? "bg-surface-inset opacity-60" : ""}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        className="w-4 h-4 rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{product.name}</span>
                        {onSale && (
                          <span className="px-1.5 py-0.5 text-xs bg-danger text-white rounded font-semibold">
                            SALE
                          </span>
                        )}
                      </div>
                      {product.description && (
                        <div className="text-sm text-foreground-muted truncate max-w-xs">
                          {product.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground-muted">{product.sku || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      {onSale ? (
                        <div>
                          <span className="font-bold text-danger">
                            ${Number(productWithSale.salePrice).toFixed(2)}
                          </span>
                          <span className="text-sm text-foreground-subtle line-through ml-2">
                            ${Number(product.price).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-medium">
                          ${Number(product.price).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-medium ${
                          product.stockQuantity <= (product.lowStockThreshold || 5)
                            ? "text-danger"
                            : "text-foreground"
                        }`}
                      >
                        {product.stockQuantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          product.isActive
                            ? "bg-success-muted text-success"
                            : "bg-surface-inset text-foreground-muted"
                        }`}
                      >
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setStockAdjustment({ id: product.id, name: product.name })}
                          className="px-2 py-1 text-sm bg-surface-inset rounded hover:bg-surface-overlay"
                          title="Adjust Stock"
                        >
                          +/-
                        </button>
                        <button
                          onClick={() => {
                            setEditingProduct(product as ProductWithSaleFields);
                            setBarcodeValue((product as ProductWithSaleFields).barcode || "");
                            setShowForm(true);
                          }}
                          className="px-2 py-1 text-sm text-brand hover:bg-brand-muted rounded"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {products.length === 0 && (
        <div className="text-center py-12 bg-surface-inset rounded-lg">
          <p className="text-foreground-muted mb-4">No products yet. Add your first product to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover"
          >
            + Add Product
          </button>
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Category *</label>
                    <select
                      name="category"
                      defaultValue={editingProduct?.category || "equipment"}
                      required
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                      placeholder="Optional"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Barcode</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="barcode"
                        value={barcodeValue || editingProduct?.barcode || ""}
                        onChange={(e) => setBarcodeValue(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand"
                        placeholder="EAN-13, UPC-A, etc."
                      />
                      <button
                        type="button"
                        onClick={() => setShowBarcodeScanner(true)}
                        className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        Scan
                      </button>
                    </div>
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
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Low Stock Alert</label>
                    <input
                      type="number"
                      name="lowStockThreshold"
                      min="0"
                      defaultValue={editingProduct?.lowStockThreshold ?? 5}
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  {/* Sale Pricing Section */}
                  <div className="col-span-2 border-t pt-4 mt-2">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Sale Pricing (Optional)</h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Sale Price</label>
                    <input
                      type="number"
                      name="salePrice"
                      step="0.01"
                      min="0"
                      defaultValue={editingProduct?.salePrice || ""}
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                      placeholder="Leave empty for no sale"
                    />
                  </div>

                  <div className="col-span-1">
                    {/* Empty div for grid alignment */}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Sale Starts</label>
                    <input
                      type="datetime-local"
                      name="saleStartDate"
                      defaultValue={formatDateForInput(editingProduct?.saleStartDate || null)}
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Sale Ends</label>
                    <input
                      type="datetime-local"
                      name="saleEndDate"
                      defaultValue={formatDateForInput(editingProduct?.saleEndDate || null)}
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      name="description"
                      rows={2}
                      defaultValue={editingProduct?.description || ""}
                      className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand"
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
                      setBarcodeValue("");
                    }}
                    className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
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
                          }
                          // Don't close modal here - let useEffect handle it after success
                        }}
                        className="w-full py-2 text-danger hover:bg-danger-muted rounded-lg text-sm"
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
          <div className="bg-surface-raised rounded-xl w-full max-w-sm p-6">
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
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand text-center text-xl"
                  placeholder="e.g., 10 or -5"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStockAdjustment(null)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:bg-brand-disabled"
                >
                  {isSubmitting ? "Saving..." : "Adjust"}
                </button>
              </div>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Import Products from CSV</h2>

            <div className="space-y-4">
              <div className="bg-surface-inset rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-sm">CSV Format Requirements:</h3>
                    <p className="text-sm text-foreground-muted mt-1">
                      Your CSV file must include a header row with these columns:
                    </p>
                  </div>
                  <a
                    href="/templates/products-import-template.csv"
                    download
                    className="px-3 py-1 bg-brand text-white text-xs rounded hover:bg-brand-hover flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Template
                  </a>
                </div>
                <ul className="text-xs text-foreground-muted space-y-1 ml-4 list-disc">
                  <li><strong>name</strong> (required)</li>
                  <li><strong>sku</strong> (required)</li>
                  <li><strong>category</strong> (equipment, apparel, accessories, courses, rental, consumables, other)</li>
                  <li><strong>price</strong> (required)</li>
                  <li><strong>costPrice</strong> (optional)</li>
                  <li><strong>stockQuantity</strong> (required)</li>
                  <li><strong>lowStockThreshold</strong> (optional, defaults to 5)</li>
                  <li><strong>description</strong> (optional)</li>
                  <li><strong>isActive</strong> (true/false, defaults to true)</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Select CSV File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand text-sm"
                />
              </div>

              {products.length > 0 && (
                <div className="text-sm text-foreground-muted">
                  <strong>Tip:</strong> Export your existing products first to get a properly formatted CSV template.
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Update Modal */}
      {showBulkUpdate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-raised rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">
              Bulk Update Stock ({selectedProducts.size} products)
            </h2>

            <form onSubmit={handleBulkUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Update Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="updateTypeRadio"
                      checked={bulkUpdateType === "adjust"}
                      onChange={() => setBulkUpdateType("adjust")}
                      className="w-4 h-4"
                    />
                    <span>Adjust by amount (+/-)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="updateTypeRadio"
                      checked={bulkUpdateType === "set"}
                      onChange={() => setBulkUpdateType("set")}
                      className="w-4 h-4"
                    />
                    <span>Set to value</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {bulkUpdateType === "adjust" ? "Adjustment Amount" : "New Stock Value"}
                </label>
                <input
                  type="number"
                  name="value"
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand text-center text-xl"
                  placeholder={bulkUpdateType === "adjust" ? "e.g., 10 or -5" : "e.g., 50"}
                />
                <p className="text-xs text-foreground-muted mt-1">
                  {bulkUpdateType === "adjust"
                    ? "Use positive numbers to add stock, negative to remove"
                    : "All selected products will be set to this quantity"
                  }
                </p>
              </div>

              <div className="bg-surface-inset rounded-lg p-3">
                <h4 className="text-sm font-medium mb-2">Selected Products:</h4>
                <div className="max-h-32 overflow-y-auto text-sm text-foreground-muted">
                  {products
                    .filter(p => selectedProducts.has(p.id))
                    .map(p => (
                      <div key={p.id} className="flex justify-between py-1">
                        <span>{p.name}</span>
                        <span className="text-foreground-subtle">Current: {p.stockQuantity}</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkUpdate(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-surface-inset"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-warning-muted text-white rounded-lg hover:bg-warning disabled:bg-warning-muted"
                >
                  {isSubmitting ? "Updating..." : "Update Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={(barcode) => {
          setBarcodeValue(barcode);
          setShowBarcodeScanner(false);
        }}
        title="Scan Product Barcode"
      />
    </div>
  );
}

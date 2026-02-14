/**
 * Product Queries (Retail Products)
 *
 * All retail product-related database operations including CRUD, stock management,
 * POS transactions, and inventory reports.
 *
 * Note: This covers both product management and POS transaction functionality.
 */

import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "../index";
import * as schema from "../schema";
import { mapProduct, type Product } from "./mappers";

// ============================================================================
// Product CRUD Queries
// ============================================================================

export async function getProducts(
  organizationId: string,
  options: { category?: string; search?: string; activeOnly?: boolean; limit?: number } = {}
): Promise<Product[]> {
  const { category, search, activeOnly = true, limit = 100 } = options;

  const whereConditions = [eq(schema.products.organizationId, organizationId)];
  if (activeOnly) whereConditions.push(eq(schema.products.isActive, true));
  if (category) whereConditions.push(eq(schema.products.category, category));
  if (search) {
    whereConditions.push(sql`${schema.products.name} ILIKE ${'%' + search + '%'}`);
  }

  const products = await db
    .select()
    .from(schema.products)
    .where(and(...whereConditions))
    .orderBy(schema.products.category, schema.products.name)
    .limit(limit);

  return products.map(mapProduct);
}

export async function getProductById(organizationId: string, id: string): Promise<Product | null> {
  const [product] = await db
    .select()
    .from(schema.products)
    .where(and(
      eq(schema.products.organizationId, organizationId),
      eq(schema.products.id, id)
    ))
    .limit(1);

  return product ? mapProduct(product) : null;
}

export async function getProductCategories(organizationId: string): Promise<string[]> {
  const result = await db
    .selectDistinct({ category: schema.products.category })
    .from(schema.products)
    .where(eq(schema.products.organizationId, organizationId))
    .orderBy(schema.products.category);

  return result.map((r) => r.category);
}

export async function createProduct(organizationId: string, data: {
  name: string;
  sku?: string;
  category: string;
  description?: string;
  price: number;
  costPrice?: number;
  currency?: string;
  taxRate?: number;
  trackInventory?: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
  imageUrl?: string;
}): Promise<Product> {
  const [product] = await db
    .insert(schema.products)
    .values({
      organizationId,
      name: data.name,
      sku: data.sku || null,
      category: data.category,
      description: data.description || null,
      price: String(data.price),
      costPrice: data.costPrice ? String(data.costPrice) : null,
      currency: data.currency || "USD",
      taxRate: data.taxRate ? String(data.taxRate) : "0",
      trackInventory: data.trackInventory ?? true,
      stockQuantity: data.stockQuantity ?? 0,
      lowStockThreshold: data.lowStockThreshold ?? 5,
      imageUrl: data.imageUrl || null,
    })
    .returning();

  return mapProduct(product);
}

export async function updateProduct(organizationId: string, id: string, data: {
  name?: string;
  sku?: string;
  category?: string;
  description?: string;
  price?: number;
  costPrice?: number;
  currency?: string;
  taxRate?: number;
  trackInventory?: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
  imageUrl?: string;
  isActive?: boolean;
}): Promise<Product | null> {
  const updateData: any = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.sku !== undefined) updateData.sku = data.sku;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.price !== undefined) updateData.price = String(data.price);
  if (data.costPrice !== undefined) updateData.costPrice = String(data.costPrice);
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.taxRate !== undefined) updateData.taxRate = String(data.taxRate);
  if (data.trackInventory !== undefined) updateData.trackInventory = data.trackInventory;
  if (data.stockQuantity !== undefined) updateData.stockQuantity = data.stockQuantity;
  if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = data.lowStockThreshold;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const [product] = await db
    .update(schema.products)
    .set(updateData)
    .where(and(
      eq(schema.products.organizationId, organizationId),
      eq(schema.products.id, id)
    ))
    .returning();

  return product ? mapProduct(product) : null;
}

export async function deleteProduct(organizationId: string, id: string): Promise<boolean> {
  await db
    .update(schema.products)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(schema.products.organizationId, organizationId),
      eq(schema.products.id, id)
    ));
  return true;
}

// ============================================================================
// POS Transaction Queries
// ============================================================================

export async function createPOSTransaction(organizationId: string, data: {
  customerId?: string;
  items: Array<{ productId: string; name?: string; quantity: number; price: number }>;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
}) {
  // Transform items to match the transactions table schema
  const transactionItems = data.items.map(item => ({
    description: item.name || `Product ${item.productId.substring(0, 8)}`,
    quantity: item.quantity,
    unitPrice: item.price,
    total: item.quantity * item.price,
  }));

  const [transaction] = await db
    .insert(schema.transactions)
    .values({
      organizationId,
      type: "sale",
      customerId: data.customerId || null,
      amount: String(data.total),
      currency: "USD",
      paymentMethod: data.paymentMethod,
      items: transactionItems,
    })
    .returning();

  // Update product stock quantities
  for (const item of data.items) {
    await db
      .update(schema.products)
      .set({
        stockQuantity: sql`${schema.products.stockQuantity} - ${item.quantity}`,
      })
      .where(eq(schema.products.id, item.productId));
  }

  return transaction;
}

export async function getPOSSummary(organizationId: string, date?: string): Promise<{
  totalSales: number;
  transactionCount: number;
  averageTransaction: number;
}> {
  const targetDate = date || new Date().toISOString().split("T")[0];

  const result = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(CAST(${schema.transactions.amount} AS DECIMAL)), 0)`,
      transactionCount: sql<number>`count(*)`,
    })
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.organizationId, organizationId),
      eq(schema.transactions.type, "sale"),
      sql`DATE(${schema.transactions.createdAt}) = ${targetDate}`
    ));

  const totalSales = Number(result[0]?.totalSales || 0);
  const transactionCount = Number(result[0]?.transactionCount || 0);

  return {
    totalSales,
    transactionCount,
    averageTransaction: transactionCount > 0 ? totalSales / transactionCount : 0,
  };
}

export async function getLowStockProducts(organizationId: string): Promise<Product[]> {
  const products = await db
    .select()
    .from(schema.products)
    .where(and(
      eq(schema.products.organizationId, organizationId),
      eq(schema.products.isActive, true),
      eq(schema.products.trackInventory, true),
      sql`${schema.products.stockQuantity} <= ${schema.products.lowStockThreshold}`
    ))
    .orderBy(schema.products.stockQuantity);

  return products.map(mapProduct);
}

export type POSTransaction = {
  id: string;
  type: string;
  amount: number;
  paymentMethod: string;
  customerName: string | null;
  items: unknown[] | null;
  createdAt: Date;
};

export async function getPOSTransactions(
  organizationId: string,
  options: {
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  } = {}
): Promise<POSTransaction[]> {
  const { type, dateFrom, dateTo, limit = 50 } = options;

  const conditions = [eq(schema.transactions.organizationId, organizationId)];

  if (type) {
    conditions.push(eq(schema.transactions.type, type));
  }
  if (dateFrom) {
    conditions.push(sql`DATE(${schema.transactions.createdAt}) >= ${dateFrom}`);
  }
  if (dateTo) {
    conditions.push(sql`DATE(${schema.transactions.createdAt}) <= ${dateTo}`);
  }

  const transactions = await db
    .select({
      id: schema.transactions.id,
      type: schema.transactions.type,
      amount: schema.transactions.amount,
      paymentMethod: schema.transactions.paymentMethod,
      items: schema.transactions.items,
      createdAt: schema.transactions.createdAt,
      customerFirstName: schema.customers.firstName,
      customerLastName: schema.customers.lastName,
    })
    .from(schema.transactions)
    .leftJoin(schema.customers, eq(schema.transactions.customerId, schema.customers.id))
    .where(and(...conditions))
    .orderBy(desc(schema.transactions.createdAt))
    .limit(limit);

  return transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    paymentMethod: t.paymentMethod || "unknown",
    customerName: t.customerFirstName && t.customerLastName
      ? `${t.customerFirstName} ${t.customerLastName}`
      : null,
    items: t.items as unknown[] | null,
    createdAt: t.createdAt,
  }));
}

export async function adjustProductStock(
  organizationId: string,
  productId: string,
  adjustment: number
): Promise<{ success: boolean; error?: string; newQuantity?: number }> {
  // [KAN-620 FIX] Pre-validate stock adjustment to prevent negative inventory
  const [product] = await db
    .select({
      name: schema.products.name,
      stockQuantity: schema.products.stockQuantity,
    })
    .from(schema.products)
    .where(and(
      eq(schema.products.organizationId, organizationId),
      eq(schema.products.id, productId)
    ))
    .limit(1);

  if (!product) {
    return { success: false, error: "Product not found" };
  }

  const newQuantity = product.stockQuantity + adjustment;

  if (newQuantity < 0) {
    return {
      success: false,
      error: `Cannot adjust stock: adjustment of ${adjustment} would result in negative stock (${newQuantity}). Current stock is ${product.stockQuantity}.`,
    };
  }

  await db
    .update(schema.products)
    .set({
      stockQuantity: newQuantity,
      updatedAt: new Date(),
    })
    .where(and(
      eq(schema.products.organizationId, organizationId),
      eq(schema.products.id, productId)
    ));

  return { success: true, newQuantity };
}

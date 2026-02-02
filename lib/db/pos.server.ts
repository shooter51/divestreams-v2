/**
 * POS Database Queries
 */

import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "./index";
import * as schema from "./schema";
import type { CartItem, Payment } from "../validation/pos";

// Type for the tables object that getTenantDb returns
// This provides the same interface as the old createTenantSchema
type TenantTables = typeof schema;

// POS Product type with optional sale fields
type POSProduct = {
  id: string;
  name: string;
  category: string;
  price: string;
  salePrice: string | null;
  saleStartDate: Date | null;
  saleEndDate: Date | null;
  stockQuantity: number;
  imageUrl: string | null;
};

/**
 * Get active products for POS display
 * Includes sale price fields for displaying sale indicators
 */
export async function getPOSProducts(tables: TenantTables, organizationId: string): Promise<POSProduct[]> {
  try {
    return await db
      .select({
        id: tables.products.id,
        name: tables.products.name,
        category: tables.products.category,
        price: tables.products.price,
        salePrice: tables.products.salePrice,
        saleStartDate: tables.products.saleStartDate,
        saleEndDate: tables.products.saleEndDate,
        stockQuantity: tables.products.stockQuantity,
        imageUrl: tables.products.imageUrl,
      })
      .from(tables.products)
      .where(
        and(
          eq(tables.products.organizationId, organizationId),
          eq(tables.products.isActive, true)
        )
      )
      .orderBy(tables.products.category, tables.products.name);
  } catch (error) {
    // Fallback if sale_price columns don't exist yet
    console.error("POS products query failed, trying without sale fields:", error);
    const basicProducts = await db
      .select({
        id: tables.products.id,
        name: tables.products.name,
        category: tables.products.category,
        price: tables.products.price,
        stockQuantity: tables.products.stockQuantity,
        imageUrl: tables.products.imageUrl,
      })
      .from(tables.products)
      .where(
        and(
          eq(tables.products.organizationId, organizationId),
          eq(tables.products.isActive, true)
        )
      )
      .orderBy(tables.products.category, tables.products.name);

    // Add null sale fields to match the expected type
    return basicProducts.map(p => ({
      ...p,
      salePrice: null,
      saleStartDate: null,
      saleEndDate: null,
    }));
  }
}

/**
 * Get available equipment for rental
 */
export async function getPOSEquipment(tables: TenantTables, organizationId: string) {
  return db
    .select()
    .from(tables.equipment)
    .where(
      and(
        eq(tables.equipment.organizationId, organizationId),
        eq(tables.equipment.isRentable, true),
        eq(tables.equipment.status, "available"),
        sql`${tables.equipment.rentalPrice} IS NOT NULL AND ${tables.equipment.rentalPrice} > 0`
      )
    )
    .orderBy(tables.equipment.category, tables.equipment.name);
}

/**
 * Get today's and future trips with availability
 */
export async function getPOSTrips(tables: TenantTables, organizationId: string, _timezone: string) {
  const today = new Date().toISOString().split("T")[0];

  const trips = await db
    .select({
      trip: tables.trips,
      tour: tables.tours,
      bookedCount: sql<number>`COALESCE(SUM(${tables.bookings.participants}), 0)`.as("booked_count"),
    })
    .from(tables.trips)
    .innerJoin(tables.tours, eq(tables.trips.tourId, tables.tours.id))
    .leftJoin(
      tables.bookings,
      and(
        eq(tables.bookings.tripId, tables.trips.id),
        sql`${tables.bookings.status} NOT IN ('canceled', 'no_show')`
      )
    )
    .where(
      and(
        eq(tables.trips.organizationId, organizationId),
        sql`${tables.trips.date} >= ${today}`,
        eq(tables.trips.status, "scheduled")
      )
    )
    .groupBy(tables.trips.id, tables.tours.id)
    .orderBy(tables.trips.date, tables.trips.startTime);

  return trips.map((row) => {
    const maxParticipants = row.trip.maxParticipants || row.tour.maxParticipants;
    const available = maxParticipants - Number(row.bookedCount);
    return {
      ...row.trip,
      tour: row.tour,
      bookedCount: Number(row.bookedCount),
      maxParticipants,
      available: Math.max(0, available),
    };
  });
}

/**
 * Search customers for POS
 */
export async function searchPOSCustomers(
  tables: TenantTables,
  organizationId: string,
  query: string,
  limit = 10
) {
  const searchTerm = `%${query}%`;
  return db
    .select({
      id: tables.customers.id,
      email: tables.customers.email,
      firstName: tables.customers.firstName,
      lastName: tables.customers.lastName,
      phone: tables.customers.phone,
    })
    .from(tables.customers)
    .where(
      and(
        eq(tables.customers.organizationId, organizationId),
        sql`(
          ${tables.customers.firstName} ILIKE ${searchTerm} OR
          ${tables.customers.lastName} ILIKE ${searchTerm} OR
          ${tables.customers.email} ILIKE ${searchTerm} OR
          ${tables.customers.phone} ILIKE ${searchTerm}
        )`
      )
    )
    .limit(limit);
}

/**
 * Generate next receipt number for today
 */
export async function generateReceiptNumber(tables: TenantTables, organizationId: string): Promise<string> {
  const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const prefix = `POS-${today}-`;

  const count = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tables.transactions)
    .where(
      and(
        eq(tables.transactions.organizationId, organizationId),
        sql`DATE(${tables.transactions.createdAt}) = CURRENT_DATE`
      )
    );

  const sequence = (Number(count[0]?.count) || 0) + 1;
  return `${prefix}${sequence.toString().padStart(4, "0")}`;
}

/**
 * Generate rental agreement number
 */
export async function generateAgreementNumber(tables: TenantTables, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RA-${year}-`;

  const count = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tables.rentals)
    .where(
      and(
        eq(tables.rentals.organizationId, organizationId),
        sql`EXTRACT(YEAR FROM ${tables.rentals.createdAt}) = ${year}`
      )
    );

  const sequence = (Number(count[0]?.count) || 0) + 1;
  return `${prefix}${sequence.toString().padStart(4, "0")}`;
}

/**
 * Process POS checkout
 */
export async function processPOSCheckout(
  tables: TenantTables,
  organizationId: string,
  data: {
    items: CartItem[];
    customerId?: string;
    userId?: string | null;
    payments: Payment[];
    subtotal: number;
    tax: number;
    total: number;
    notes?: string;
  }
) {
  // SECURITY: Validate payment amounts match calculated totals
  // Recalculate subtotal from items to prevent manipulation
  const calculatedSubtotal = data.items.reduce((sum, item) => sum + item.total, 0);

  // Verify client-provided subtotal matches calculated subtotal
  if (Math.abs(calculatedSubtotal - data.subtotal) > 0.01) {
    throw new Error(
      `Payment validation failed: Subtotal mismatch. Expected ${calculatedSubtotal.toFixed(2)}, received ${data.subtotal.toFixed(2)}`
    );
  }

  // Verify total = subtotal + tax (allowing 1 cent rounding difference)
  const calculatedTotal = data.subtotal + data.tax;
  if (Math.abs(calculatedTotal - data.total) > 0.01) {
    throw new Error(
      `Payment validation failed: Total mismatch. Expected ${calculatedTotal.toFixed(2)}, received ${data.total.toFixed(2)}`
    );
  }

  // Verify payment amounts sum to transaction total
  const paymentTotal = data.payments.reduce((sum, p) => sum + p.amount, 0);
  if (Math.abs(paymentTotal - data.total) > 0.01) {
    throw new Error(
      `Payment validation failed: Payment amounts (${paymentTotal.toFixed(2)}) do not match transaction total (${data.total.toFixed(2)})`
    );
  }

  const receiptNumber = await generateReceiptNumber(tables, organizationId);

  // Determine payment method string
  let paymentMethod: string;
  if (data.payments.length === 1) {
    paymentMethod = data.payments[0].method;
  } else {
    paymentMethod = "split";
  }

  // Get stripe payment ID if card payment
  const cardPayment = data.payments.find(p => p.method === "card");
  const stripePaymentId = cardPayment && cardPayment.method === "card"
    ? cardPayment.stripePaymentIntentId
    : undefined;

  // Build items for transaction record
  const transactionItems = data.items.map(item => {
    if (item.type === "product") {
      return {
        description: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        type: item.type,
        productId: item.productId,
      };
    } else if (item.type === "booking") {
      return {
        description: item.tourName,
        quantity: item.participants,
        unitPrice: item.unitPrice,
        total: item.total,
        type: item.type,
        tripId: item.tripId,
        tourName: item.tourName,
      };
    } else {
      return {
        description: item.name,
        quantity: item.days,
        unitPrice: item.dailyRate,
        total: item.total,
        type: item.type,
        equipmentId: item.equipmentId,
        days: item.days,
        dailyRate: item.dailyRate,
      };
    }
  });

  // Create transaction
  const [transaction] = await db
    .insert(tables.transactions)
    .values({
      organizationId,
      type: "sale",
      bookingId: null,
      customerId: data.customerId || null,
      userId: data.userId,
      amount: data.total.toString(),
      currency: "USD",
      paymentMethod,
      stripePaymentId,
      items: transactionItems,
      notes: data.notes,
    })
    .returning();

  // Process rentals - create rental records and update equipment status
  const rentalItems = data.items.filter((item): item is CartItem & { type: "rental" } => item.type === "rental");

  if (rentalItems.length > 0 && data.customerId) {
    const agreementNumber = await generateAgreementNumber(tables, organizationId);

    for (const rental of rentalItems) {
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + rental.days);

      // Create rental record
      await db.insert(tables.rentals).values({
        organizationId,
        transactionId: transaction.id,
        customerId: data.customerId,
        equipmentId: rental.equipmentId,
        dueAt,
        dailyRate: rental.dailyRate.toString(),
        totalCharge: rental.total.toString(),
        status: "active",
        agreementNumber,
      });

      // Update equipment status
      await db
        .update(tables.equipment)
        .set({ status: "rented", updatedAt: new Date() })
        .where(eq(tables.equipment.id, rental.equipmentId));
    }
  }

  // Process bookings - create booking records
  const bookingItems = data.items.filter((item): item is CartItem & { type: "booking" } => item.type === "booking");

  for (const booking of bookingItems) {
    if (!data.customerId) continue;

    // Generate booking number
    const bookingNumber = `BK-${Date.now().toString(36).toUpperCase()}`;

    await db.insert(tables.bookings).values({
      organizationId,
      bookingNumber,
      tripId: booking.tripId,
      customerId: data.customerId,
      participants: booking.participants,
      status: "confirmed",
      subtotal: booking.total.toString(),
      total: booking.total.toString(),
      currency: "USD",
      paymentStatus: "paid",
      paidAmount: booking.total.toString(),
      source: "pos",
    });
  }

  // Update product inventory
  const productItems = data.items.filter((item): item is CartItem & { type: "product" } => item.type === "product");

  // [KAN-620 FIX] Pre-validate stock before decrementing to prevent negative inventory
  if (productItems.length > 0) {
    // Fetch current stock for all products in the cart
    const productIds = productItems.map(p => p.productId);
    const productsInCart = await db
      .select({
        id: tables.products.id,
        name: tables.products.name,
        stockQuantity: tables.products.stockQuantity,
      })
      .from(tables.products)
      .where(
        and(
          eq(tables.products.organizationId, organizationId),
          inArray(tables.products.id, productIds)
        )
      );

    // Check if any product would go negative
    const insufficientStock: { name: string; available: number; requested: number }[] = [];
    for (const cartItem of productItems) {
      const product = productsInCart.find(p => p.id === cartItem.productId);
      if (product && product.stockQuantity < cartItem.quantity) {
        insufficientStock.push({
          name: product.name,
          available: product.stockQuantity,
          requested: cartItem.quantity,
        });
      }
    }

    if (insufficientStock.length > 0) {
      const errorDetails = insufficientStock
        .map(p => `${p.name} (available: ${p.available}, requested: ${p.requested})`)
        .join(", ");
      throw new Error(`Insufficient stock for: ${errorDetails}`);
    }
  }

  for (const product of productItems) {
    await db
      .update(tables.products)
      .set({
        stockQuantity: sql`${tables.products.stockQuantity} - ${product.quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(tables.products.id, product.productId));
  }

  return {
    transaction,
    receiptNumber,
  };
}

/**
 * Get product by ID
 */
export async function getProductById(tables: TenantTables, organizationId: string, id: string) {
  const [product] = await db
    .select()
    .from(tables.products)
    .where(
      and(
        eq(tables.products.organizationId, organizationId),
        eq(tables.products.id, id)
      )
    )
    .limit(1);
  return product;
}

/**
 * Get equipment by ID
 */
export async function getEquipmentById(tables: TenantTables, organizationId: string, id: string) {
  const [equipment] = await db
    .select()
    .from(tables.equipment)
    .where(
      and(
        eq(tables.equipment.organizationId, organizationId),
        eq(tables.equipment.id, id)
      )
    )
    .limit(1);
  return equipment;
}

/**
 * Get product by barcode
 * Returns the first active product matching the barcode
 */
export async function getProductByBarcode(tables: TenantTables, organizationId: string, barcode: string) {
  const [product] = await db
    .select()
    .from(tables.products)
    .where(
      and(
        eq(tables.products.organizationId, organizationId),
        eq(tables.products.barcode, barcode),
        eq(tables.products.isActive, true)
      )
    )
    .limit(1);
  return product;
}

/**
 * Get equipment by barcode
 * Returns the first equipment item matching the barcode
 */
export async function getEquipmentByBarcode(tables: TenantTables, organizationId: string, barcode: string) {
  const [equipment] = await db
    .select()
    .from(tables.equipment)
    .where(
      and(
        eq(tables.equipment.organizationId, organizationId),
        eq(tables.equipment.barcode, barcode)
      )
    )
    .limit(1);
  return equipment;
}

/**
 * Get transaction by ID with items and customer info
 */
export async function getTransactionById(tables: TenantTables, organizationId: string, transactionId: string) {
  const [transaction] = await db
    .select({
      transaction: tables.transactions,
      customerFirstName: tables.customers.firstName,
      customerLastName: tables.customers.lastName,
      customerEmail: tables.customers.email,
    })
    .from(tables.transactions)
    .leftJoin(tables.customers, eq(tables.transactions.customerId, tables.customers.id))
    .where(
      and(
        eq(tables.transactions.organizationId, organizationId),
        eq(tables.transactions.id, transactionId)
      )
    )
    .limit(1);

  if (!transaction) return null;

  return {
    ...transaction.transaction,
    customer: transaction.customerFirstName
      ? {
          firstName: transaction.customerFirstName,
          lastName: transaction.customerLastName,
          email: transaction.customerEmail,
        }
      : null,
  };
}

/**
 * Process POS refund for a transaction
 * Handles full refund of all items with inventory/equipment adjustments
 *
 * IMPORTANT: Wrapped in database transaction for atomicity
 */
export async function processPOSRefund(
  tables: TenantTables,
  organizationId: string,
  data: {
    originalTransactionId: string;
    userId: string;
    refundReason: string;
    stripeRefundId?: string;
  }
) {
  // Wrap entire refund process in transaction for atomicity
  return await db.transaction(async (tx) => {
    // Get the original transaction
    const original = await getTransactionById(tables, organizationId, data.originalTransactionId);

    if (!original) {
      throw new Error("Original transaction not found");
    }

    if (original.type === "refund") {
      throw new Error("Cannot refund a refund transaction");
    }

    if (original.type !== "sale") {
      throw new Error(`Cannot refund transaction of type '${original.type}'. Only 'sale' transactions can be refunded.`);
    }

    // Check if transaction has already been refunded (double-refund prevention)
    const [existingRefund] = await tx
      .select()
      .from(tables.transactions)
      .where(eq(tables.transactions.refundedTransactionId, data.originalTransactionId))
      .limit(1);

    if (existingRefund) {
      throw new Error("Transaction has already been refunded");
    }

    // Create refund transaction
    const [refundTransaction] = await tx
      .insert(tables.transactions)
      .values({
        organizationId,
        type: "refund",
        bookingId: null,
        customerId: original.customerId,
        userId: data.userId,
        amount: `-${original.amount}`, // Negative amount for refund
        currency: original.currency,
        paymentMethod: original.paymentMethod,
        stripePaymentId: data.stripeRefundId,
        items: original.items,
        notes: `Refund for transaction ${original.id}`,
        refundedTransactionId: original.id,
        refundReason: data.refundReason,
      })
      .returning();

    // Process inventory adjustments for products
    const items = (original.items as Array<{
      type: string;
      productId?: string;
      quantity?: number;
      equipmentId?: string;
      tripId?: string;
    }>) || [];

    for (const item of items) {
      if (item.type === "product" && item.productId && item.quantity) {
        // Return products to inventory
        await tx
          .update(tables.products)
          .set({
            stockQuantity: sql`${tables.products.stockQuantity} + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(tables.products.id, item.productId));
      }

      if (item.type === "rental" && item.equipmentId) {
        // Return equipment to available status
        await tx
          .update(tables.equipment)
          .set({ status: "available", updatedAt: new Date() })
          .where(eq(tables.equipment.id, item.equipmentId));

        // Update rental status to returned
        await tx
          .update(tables.rentals)
          .set({ status: "returned", returnedAt: new Date() })
          .where(
            and(
              eq(tables.rentals.transactionId, original.id),
              eq(tables.rentals.equipmentId, item.equipmentId)
            )
          );
      }

      if (item.type === "booking" && item.tripId && original.customerId) {
        // Find and cancel the booking created by this POS transaction
        // Match by tripId, customerId, source, and creation time window
        const [booking] = await tx
          .select()
          .from(tables.bookings)
          .where(
            and(
              eq(tables.bookings.organizationId, organizationId),
              eq(tables.bookings.tripId, item.tripId),
              eq(tables.bookings.customerId, original.customerId),
              eq(tables.bookings.source, "pos"),
              sql`${tables.bookings.createdAt} >= ${original.createdAt} - interval '1 minute'`,
              sql`${tables.bookings.createdAt} <= ${original.createdAt} + interval '1 minute'`
            )
          )
          .limit(1);

        if (booking) {
          await tx
            .update(tables.bookings)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(tables.bookings.id, booking.id));
        }
      }
    }

    return {
      refundTransaction,
      originalTransaction: original,
    };
  });
}

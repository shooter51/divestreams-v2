/**
 * POS Database Queries
 */

import { eq, and, sql } from "drizzle-orm";
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
        eq(tables.equipment.status, "available")
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

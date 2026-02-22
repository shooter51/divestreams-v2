# POS System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-featured Point of Sale system for retail sales, equipment rentals, and quick trip bookings.

**Architecture:** Single-page React component with tabbed product selection (left panel) and cart/checkout (right panel). Uses existing products, equipment, and trips tables. Adds new rentals table for equipment tracking. Stripe for card payments, manual tracking for cash.

**Tech Stack:** React Router 7, Drizzle ORM, Zod validation, Stripe Payment Intents, Tailwind CSS

---

## Task 1: Add Rentals Table to Schema

**Files:**
- Modify: `lib/db/schema.ts`

**Step 1: Add rentals table to createTenantSchema function**

Add after the `transactions` table definition (around line 443):

```typescript
  // Equipment rentals tracking
  const rentals = schema.table("rentals", {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id").references(() => transactions.id),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    equipmentId: uuid("equipment_id").notNull().references(() => equipment.id),

    rentedAt: timestamp("rented_at").notNull().defaultNow(),
    dueAt: timestamp("due_at").notNull(),
    returnedAt: timestamp("returned_at"),

    dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).notNull(),
    totalCharge: decimal("total_charge", { precision: 10, scale: 2 }).notNull(),

    status: text("status").notNull().default("active"), // active, returned, overdue

    // Rental agreement
    agreementNumber: text("agreement_number").notNull(),
    agreementSignedAt: timestamp("agreement_signed_at"),
    agreementSignedBy: text("agreement_signed_by"),

    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  }, (table) => [
    index("rentals_customer_idx").on(table.customerId),
    index("rentals_equipment_idx").on(table.equipmentId),
    index("rentals_status_idx").on(table.status),
  ]);
```

**Step 2: Add rentals to the return object**

Update the return statement to include rentals:

```typescript
  return {
    schema,
    users,
    sessions,
    accounts,
    customers,
    boats,
    diveSites,
    tours,
    tourDiveSites,
    trips,
    bookings,
    equipment,
    transactions,
    products,
    rentals,  // ADD THIS
    images,
  };
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no type errors)

**Step 4: Generate migration**

Run: `npm run db:generate`
Expected: Migration file created

**Step 5: Commit**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "feat(pos): add rentals table for equipment tracking"
```

---

## Task 2: Create POS Validation Schemas

**Files:**
- Create: `lib/validation/pos.ts`

**Step 1: Create POS validation file**

```typescript
/**
 * POS Validation Schemas
 */

import { z } from "zod";

// Cart item types
export const cartProductSchema = z.object({
  type: z.literal("product"),
  productId: z.string().uuid(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  total: z.number().positive(),
});

export const cartRentalSchema = z.object({
  type: z.literal("rental"),
  equipmentId: z.string().uuid(),
  name: z.string(),
  size: z.string().optional(),
  days: z.number().int().positive(),
  dailyRate: z.number().positive(),
  total: z.number().positive(),
});

export const cartBookingSchema = z.object({
  type: z.literal("booking"),
  tripId: z.string().uuid(),
  tourName: z.string(),
  participants: z.number().int().positive(),
  unitPrice: z.number().positive(),
  total: z.number().positive(),
});

export const cartItemSchema = z.discriminatedUnion("type", [
  cartProductSchema,
  cartRentalSchema,
  cartBookingSchema,
]);

export type CartItem = z.infer<typeof cartItemSchema>;
export type CartProduct = z.infer<typeof cartProductSchema>;
export type CartRental = z.infer<typeof cartRentalSchema>;
export type CartBooking = z.infer<typeof cartBookingSchema>;

// Payment schemas
export const cashPaymentSchema = z.object({
  method: z.literal("cash"),
  amount: z.number().positive(),
  tendered: z.number().positive(),
  change: z.number().min(0),
});

export const cardPaymentSchema = z.object({
  method: z.literal("card"),
  amount: z.number().positive(),
  stripePaymentIntentId: z.string(),
});

export const paymentSchema = z.discriminatedUnion("method", [
  cashPaymentSchema,
  cardPaymentSchema,
]);

export type Payment = z.infer<typeof paymentSchema>;

// Checkout schema
export const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Cart cannot be empty"),
  customerId: z.string().uuid().optional(),
  payments: z.array(paymentSchema).min(1, "At least one payment required"),
  subtotal: z.number().positive(),
  tax: z.number().min(0),
  total: z.number().positive(),
  notes: z.string().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// Rental agreement confirmation
export const rentalAgreementSchema = z.object({
  rentalItems: z.array(z.object({
    equipmentId: z.string().uuid(),
    days: z.number().int().positive(),
    dueAt: z.string().datetime(),
  })),
  customerId: z.string().uuid(),
  agreementSignedBy: z.string().min(1, "Staff name required"),
});

export type RentalAgreementInput = z.infer<typeof rentalAgreementSchema>;
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/validation/pos.ts
git commit -m "feat(pos): add validation schemas for cart and checkout"
```

---

## Task 3: Create POS Database Queries

**Files:**
- Create: `lib/db/pos.server.ts`

**Step 1: Create POS queries file**

```typescript
/**
 * POS Database Queries
 */

import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { db } from "./index";
import { createTenantSchema } from "./schema";
import type { CartItem, Payment } from "../validation/pos";

type TenantTables = ReturnType<typeof createTenantSchema>;

/**
 * Get active products for POS display
 */
export async function getPOSProducts(tables: TenantTables) {
  return db
    .select()
    .from(tables.products)
    .where(eq(tables.products.isActive, true))
    .orderBy(tables.products.category, tables.products.name);
}

/**
 * Get available equipment for rental
 */
export async function getPOSEquipment(tables: TenantTables) {
  return db
    .select()
    .from(tables.equipment)
    .where(
      and(
        eq(tables.equipment.isRentable, true),
        eq(tables.equipment.status, "available")
      )
    )
    .orderBy(tables.equipment.category, tables.equipment.name);
}

/**
 * Get today's trips with availability
 */
export async function getPOSTrips(tables: TenantTables, timezone: string) {
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
        eq(tables.trips.date, today),
        eq(tables.trips.status, "scheduled")
      )
    )
    .groupBy(tables.trips.id, tables.tours.id)
    .orderBy(tables.trips.startTime);

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
      sql`(
        ${tables.customers.firstName} ILIKE ${searchTerm} OR
        ${tables.customers.lastName} ILIKE ${searchTerm} OR
        ${tables.customers.email} ILIKE ${searchTerm} OR
        ${tables.customers.phone} ILIKE ${searchTerm}
      )`
    )
    .limit(limit);
}

/**
 * Generate next receipt number for today
 */
export async function generateReceiptNumber(tables: TenantTables): Promise<string> {
  const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const prefix = `POS-${today}-`;

  const lastTransaction = await db
    .select({ id: tables.transactions.id })
    .from(tables.transactions)
    .where(sql`${tables.transactions.id}::text LIKE ${prefix + "%"}`)
    .orderBy(desc(tables.transactions.createdAt))
    .limit(1);

  // Simple increment based on count
  const count = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tables.transactions)
    .where(sql`DATE(${tables.transactions.createdAt}) = CURRENT_DATE`);

  const sequence = (Number(count[0]?.count) || 0) + 1;
  return `${prefix}${sequence.toString().padStart(4, "0")}`;
}

/**
 * Generate rental agreement number
 */
export async function generateAgreementNumber(tables: TenantTables): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RA-${year}-`;

  const count = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tables.rentals)
    .where(sql`EXTRACT(YEAR FROM ${tables.rentals.createdAt}) = ${year}`);

  const sequence = (Number(count[0]?.count) || 0) + 1;
  return `${prefix}${sequence.toString().padStart(4, "0")}`;
}

/**
 * Process POS checkout
 */
export async function processPOSCheckout(
  tables: TenantTables,
  data: {
    items: CartItem[];
    customerId?: string;
    userId: string;
    payments: Payment[];
    subtotal: number;
    tax: number;
    total: number;
    notes?: string;
  }
) {
  const receiptNumber = await generateReceiptNumber(tables);

  // Determine payment method string
  let paymentMethod: string;
  if (data.payments.length === 1) {
    paymentMethod = data.payments[0].method;
  } else {
    paymentMethod = "split";
  }

  // Get stripe payment ID if card payment
  const stripePaymentId = data.payments.find(p => p.method === "card")?.stripePaymentIntentId;

  // Create transaction
  const [transaction] = await db
    .insert(tables.transactions)
    .values({
      type: "sale",
      bookingId: null,
      customerId: data.customerId || null,
      userId: data.userId,
      amount: data.total.toString(),
      currency: "USD",
      paymentMethod,
      stripePaymentId,
      items: data.items.map(item => ({
        description: item.name,
        quantity: item.type === "product" ? item.quantity : item.type === "booking" ? item.participants : item.days,
        unitPrice: item.type === "product" ? item.unitPrice : item.type === "booking" ? item.unitPrice : item.dailyRate,
        total: item.total,
        ...item,
      })),
      notes: data.notes,
    })
    .returning();

  // Process rentals - create rental records and update equipment status
  const rentalItems = data.items.filter((item): item is CartItem & { type: "rental" } => item.type === "rental");

  if (rentalItems.length > 0 && data.customerId) {
    const agreementNumber = await generateAgreementNumber(tables);

    for (const rental of rentalItems) {
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + rental.days);

      // Create rental record
      await db.insert(tables.rentals).values({
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
export async function getProductById(tables: TenantTables, id: string) {
  const [product] = await db
    .select()
    .from(tables.products)
    .where(eq(tables.products.id, id))
    .limit(1);
  return product;
}

/**
 * Get equipment by ID
 */
export async function getEquipmentById(tables: TenantTables, id: string) {
  const [equipment] = await db
    .select()
    .from(tables.equipment)
    .where(eq(tables.equipment.id, id))
    .limit(1);
  return equipment;
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/db/pos.server.ts
git commit -m "feat(pos): add database queries for POS operations"
```

---

## Task 4: Create Cart Component

**Files:**
- Create: `app/components/pos/Cart.tsx`

**Step 1: Create Cart component**

```typescript
/**
 * POS Cart Component
 */

import { useState } from "react";
import type { CartItem } from "../../../lib/validation/pos";

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (index: number, quantity: number) => void;
  onRemoveItem: (index: number) => void;
  customer: { id: string; firstName: string; lastName: string; email: string } | null;
  onSelectCustomer: () => void;
  onClearCustomer: () => void;
  taxRate: number;
  onCheckout: (method: "card" | "cash" | "split") => void;
  requiresCustomer: boolean;
}

export function Cart({
  items,
  onUpdateQuantity,
  onRemoveItem,
  customer,
  onSelectCustomer,
  onClearCustomer,
  taxRate,
  onCheckout,
  requiresCustomer,
}: CartProps) {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const canCheckout = items.length > 0 && (!requiresCustomer || customer);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Cart</h2>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Cart is empty</p>
        ) : (
          items.map((item, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-gray-600">
                  {item.type === "product" && `${item.quantity} × $${item.unitPrice.toFixed(2)}`}
                  {item.type === "rental" && `${item.days} day${item.days > 1 ? "s" : ""} × $${item.dailyRate.toFixed(2)}/day`}
                  {item.type === "booking" && `${item.participants} participant${item.participants > 1 ? "s" : ""} × $${item.unitPrice.toFixed(2)}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">${item.total.toFixed(2)}</p>
                {item.type === "product" && (
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                      className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                      disabled={item.quantity <= 1}
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                      className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => onRemoveItem(index)}
                className="text-red-500 hover:text-red-700"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Customer */}
      <div className="p-4 border-t">
        {customer ? (
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div>
              <p className="font-medium">{customer.firstName} {customer.lastName}</p>
              <p className="text-sm text-gray-600">{customer.email}</p>
            </div>
            <button onClick={onClearCustomer} className="text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={onSelectCustomer}
            className={`w-full p-3 border-2 border-dashed rounded-lg text-center ${
              requiresCustomer ? "border-red-300 text-red-600" : "border-gray-300 text-gray-600"
            } hover:border-blue-400 hover:text-blue-600`}
          >
            {requiresCustomer ? "Customer Required" : "Add Customer (Optional)"}
          </button>
        )}
      </div>

      {/* Totals */}
      <div className="p-4 border-t space-y-2">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Tax ({taxRate}%)</span>
          <span>${tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Checkout Buttons */}
      <div className="p-4 border-t space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onCheckout("card")}
            disabled={!canCheckout}
            className="py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Card
          </button>
          <button
            onClick={() => onCheckout("cash")}
            disabled={!canCheckout}
            className="py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Cash
          </button>
          <button
            onClick={() => onCheckout("split")}
            disabled={!canCheckout}
            className="py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Split
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add app/components/pos/Cart.tsx
git commit -m "feat(pos): add Cart component"
```

---

## Task 5: Create Product Grid Component

**Files:**
- Create: `app/components/pos/ProductGrid.tsx`

**Step 1: Create ProductGrid component**

```typescript
/**
 * POS Product/Equipment/Trip Grid Component
 */

interface Product {
  id: string;
  name: string;
  category: string;
  price: string;
  stockQuantity: number;
  imageUrl: string | null;
}

interface Equipment {
  id: string;
  name: string;
  category: string;
  size: string | null;
  rentalPrice: string | null;
  status: string;
}

interface Trip {
  id: string;
  date: string;
  startTime: string;
  tour: {
    id: string;
    name: string;
    price: string;
  };
  available: number;
  maxParticipants: number;
}

interface ProductGridProps {
  tab: "retail" | "rentals" | "trips";
  products: Product[];
  equipment: Equipment[];
  trips: Trip[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onAddProduct: (product: Product) => void;
  onAddRental: (equipment: Equipment, days: number) => void;
  onAddBooking: (trip: Trip, participants: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ProductGrid({
  tab,
  products,
  equipment,
  trips,
  selectedCategory,
  onSelectCategory,
  onAddProduct,
  onAddRental,
  onAddBooking,
  searchQuery,
  onSearchChange,
}: ProductGridProps) {
  // Get unique categories based on tab
  const categories = tab === "retail"
    ? [...new Set(products.map(p => p.category))]
    : tab === "rentals"
    ? [...new Set(equipment.map(e => e.category))]
    : [];

  // Filter items based on search and category
  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredEquipment = equipment.filter(e => {
    const matchesSearch = !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || e.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredTrips = trips.filter(t => {
    const matchesSearch = !searchQuery || t.tour.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4">
        <input
          type="text"
          placeholder={`Search ${tab}...`}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          <button
            onClick={() => onSelectCategory(null)}
            className={`px-3 py-1 rounded-full text-sm ${
              !selectedCategory
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`px-3 py-1 rounded-full text-sm capitalize ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tab === "retail" && filteredProducts.map(product => (
            <button
              key={product.id}
              onClick={() => onAddProduct(product)}
              disabled={product.stockQuantity <= 0}
              className={`p-4 bg-white rounded-lg shadow-sm border hover:border-blue-400 hover:shadow-md transition-all text-left ${
                product.stockQuantity <= 0 ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-24 object-cover rounded-md mb-2"
                />
              )}
              <p className="font-medium truncate">{product.name}</p>
              <p className="text-lg font-bold text-blue-600">${Number(product.price).toFixed(2)}</p>
              <p className="text-xs text-gray-500">{product.stockQuantity} in stock</p>
            </button>
          ))}

          {tab === "rentals" && filteredEquipment.map(item => (
            <RentalCard
              key={item.id}
              equipment={item}
              onAddRental={onAddRental}
            />
          ))}

          {tab === "trips" && filteredTrips.map(trip => (
            <TripCard
              key={trip.id}
              trip={trip}
              onAddBooking={onAddBooking}
            />
          ))}
        </div>

        {/* Empty states */}
        {tab === "retail" && filteredProducts.length === 0 && (
          <p className="text-center text-gray-500 py-8">No products found</p>
        )}
        {tab === "rentals" && filteredEquipment.length === 0 && (
          <p className="text-center text-gray-500 py-8">No equipment available</p>
        )}
        {tab === "trips" && filteredTrips.length === 0 && (
          <p className="text-center text-gray-500 py-8">No trips scheduled today</p>
        )}
      </div>
    </div>
  );
}

// Rental card with duration selector
function RentalCard({
  equipment,
  onAddRental,
}: {
  equipment: Equipment;
  onAddRental: (equipment: Equipment, days: number) => void;
}) {
  const [showDays, setShowDays] = useState(false);
  const [days, setDays] = useState(1);

  if (!equipment.rentalPrice) return null;

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border">
      <p className="font-medium truncate">{equipment.name}</p>
      {equipment.size && <p className="text-sm text-gray-600">Size: {equipment.size}</p>}
      <p className="text-lg font-bold text-green-600">${Number(equipment.rentalPrice).toFixed(2)}/day</p>

      {!showDays ? (
        <button
          onClick={() => setShowDays(true)}
          className="mt-2 w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
        >
          Add Rental
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDays(Math.max(1, days - 1))}
              className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300"
            >
              -
            </button>
            <span className="flex-1 text-center">{days} day{days > 1 ? "s" : ""}</span>
            <button
              onClick={() => setDays(days + 1)}
              className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300"
            >
              +
            </button>
          </div>
          <button
            onClick={() => {
              onAddRental(equipment, days);
              setShowDays(false);
              setDays(1);
            }}
            className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            Add ${(Number(equipment.rentalPrice) * days).toFixed(2)}
          </button>
        </div>
      )}
    </div>
  );
}

// Trip card with participant selector
function TripCard({
  trip,
  onAddBooking,
}: {
  trip: Trip;
  onAddBooking: (trip: Trip, participants: number) => void;
}) {
  const [showParticipants, setShowParticipants] = useState(false);
  const [participants, setParticipants] = useState(1);

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border">
      <p className="font-medium">{trip.tour.name}</p>
      <p className="text-sm text-gray-600">{trip.startTime}</p>
      <p className="text-lg font-bold text-purple-600">${Number(trip.tour.price).toFixed(2)}</p>
      <p className="text-xs text-gray-500">{trip.available} spots left</p>

      {trip.available <= 0 ? (
        <p className="mt-2 text-center text-red-500 text-sm">Fully booked</p>
      ) : !showParticipants ? (
        <button
          onClick={() => setShowParticipants(true)}
          className="mt-2 w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
        >
          Book Now
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setParticipants(Math.max(1, participants - 1))}
              className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300"
            >
              -
            </button>
            <span className="flex-1 text-center">{participants}</span>
            <button
              onClick={() => setParticipants(Math.min(trip.available, participants + 1))}
              className="w-8 h-8 rounded bg-gray-200 hover:bg-gray-300"
            >
              +
            </button>
          </div>
          <button
            onClick={() => {
              onAddBooking(trip, participants);
              setShowParticipants(false);
              setParticipants(1);
            }}
            className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
          >
            Add ${(Number(trip.tour.price) * participants).toFixed(2)}
          </button>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
```

**Step 2: Fix import order (useState should be at top)**

Move the import to the top of the file.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add app/components/pos/ProductGrid.tsx
git commit -m "feat(pos): add ProductGrid component with rental and booking cards"
```

---

## Task 6: Create Checkout Modals

**Files:**
- Create: `app/components/pos/CheckoutModals.tsx`

**Step 1: Create checkout modal components**

```typescript
/**
 * POS Checkout Modals
 */

import { useState } from "react";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onComplete: (payments: Array<{ method: "card" | "cash"; amount: number; stripePaymentIntentId?: string }>) => void;
}

// Cash Payment Modal
export function CashModal({ isOpen, onClose, total, onComplete }: CheckoutModalProps) {
  const [tendered, setTendered] = useState("");
  const tenderedAmount = parseFloat(tendered) || 0;
  const change = tenderedAmount - total;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Cash Payment</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Total Due</label>
            <p className="text-3xl font-bold text-blue-600">${total.toFixed(2)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Amount Tendered</label>
            <input
              type="number"
              step="0.01"
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              className="w-full px-4 py-3 text-2xl border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              autoFocus
            />
          </div>

          {tenderedAmount >= total && (
            <div className="p-4 bg-green-50 rounded-lg">
              <label className="block text-sm font-medium mb-1">Change Due</label>
              <p className="text-3xl font-bold text-green-600">${change.toFixed(2)}</p>
            </div>
          )}

          {/* Quick amount buttons */}
          <div className="grid grid-cols-4 gap-2">
            {[20, 50, 100, Math.ceil(total)].map(amount => (
              <button
                key={amount}
                onClick={() => setTendered(amount.toString())}
                className="py-2 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
              >
                ${amount}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onComplete([{ method: "cash", amount: total }])}
            disabled={tenderedAmount < total}
            className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  );
}

// Split Payment Modal
export function SplitModal({ isOpen, onClose, total, onComplete }: CheckoutModalProps) {
  const [payments, setPayments] = useState<Array<{ method: "card" | "cash"; amount: number }>>([]);
  const [currentMethod, setCurrentMethod] = useState<"card" | "cash">("card");
  const [currentAmount, setCurrentAmount] = useState("");

  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - paidAmount;

  const addPayment = () => {
    const amount = parseFloat(currentAmount);
    if (amount > 0 && amount <= remaining) {
      setPayments([...payments, { method: currentMethod, amount }]);
      setCurrentAmount("");
    }
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Split Payment</h2>

        <div className="space-y-4">
          <div className="flex justify-between">
            <span>Total</span>
            <span className="font-bold">${total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-green-600">
            <span>Paid</span>
            <span className="font-bold">${paidAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg">
            <span>Remaining</span>
            <span className="font-bold text-blue-600">${remaining.toFixed(2)}</span>
          </div>

          {/* Existing payments */}
          {payments.length > 0 && (
            <div className="space-y-2">
              {payments.map((payment, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="capitalize">{payment.method}</span>
                  <div className="flex items-center gap-2">
                    <span>${payment.amount.toFixed(2)}</span>
                    <button
                      onClick={() => removePayment(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add payment */}
          {remaining > 0 && (
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentMethod("card")}
                  className={`flex-1 py-2 rounded-lg ${
                    currentMethod === "card"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  Card
                </button>
                <button
                  onClick={() => setCurrentMethod("cash")}
                  className={`flex-1 py-2 rounded-lg ${
                    currentMethod === "cash"
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  Cash
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  placeholder="Amount"
                  className="flex-1 px-3 py-2 border rounded-lg"
                />
                <button
                  onClick={() => setCurrentAmount(remaining.toFixed(2))}
                  className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
                >
                  Rest
                </button>
                <button
                  onClick={addPayment}
                  disabled={!currentAmount || parseFloat(currentAmount) <= 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              setPayments([]);
              onClose();
            }}
            className="flex-1 py-3 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onComplete(payments)}
            disabled={remaining > 0.01}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  );
}

// Rental Agreement Modal
interface RentalAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (staffName: string) => void;
  customer: { firstName: string; lastName: string; email: string; phone?: string | null } | null;
  rentals: Array<{
    name: string;
    size?: string;
    days: number;
    dailyRate: number;
    total: number;
  }>;
  shopName: string;
  agreementNumber: string;
}

export function RentalAgreementModal({
  isOpen,
  onClose,
  onConfirm,
  customer,
  rentals,
  shopName,
  agreementNumber,
}: RentalAgreementModalProps) {
  const [staffName, setStaffName] = useState("");
  const [agreementSigned, setAgreementSigned] = useState(false);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + Math.max(...rentals.map(r => r.days)));

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Rental Agreement Required</h2>

        {/* Printable Agreement Preview */}
        <div id="rental-agreement" className="p-6 border rounded-lg mb-4 print:border-none">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">{shopName}</h1>
            <h2 className="text-lg">Equipment Rental Agreement</h2>
            <p className="text-sm text-gray-600">Agreement #: {agreementNumber}</p>
            <p className="text-sm text-gray-600">{new Date().toLocaleDateString()}</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-bold mb-2">Customer</h3>
              <p>{customer.firstName} {customer.lastName}</p>
              <p>{customer.email}</p>
              {customer.phone && <p>{customer.phone}</p>}
            </div>
            <div>
              <h3 className="font-bold mb-2">Rental Period</h3>
              <p>From: {new Date().toLocaleDateString()}</p>
              <p>Due: {dueDate.toLocaleDateString()}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-bold mb-2">Equipment</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Item</th>
                  <th className="text-left py-2">Size</th>
                  <th className="text-right py-2">Days</th>
                  <th className="text-right py-2">Rate</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map((rental, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{rental.name}</td>
                    <td className="py-2">{rental.size || "-"}</td>
                    <td className="text-right py-2">{rental.days}</td>
                    <td className="text-right py-2">${rental.dailyRate.toFixed(2)}</td>
                    <td className="text-right py-2">${rental.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-6 text-sm">
            <h3 className="font-bold mb-2">Terms and Conditions</h3>
            <ol className="list-decimal list-inside space-y-1 text-gray-700">
              <li>Equipment must be returned by the due date in the same condition.</li>
              <li>Customer is responsible for any damage or loss of equipment.</li>
              <li>Late returns will incur additional daily charges.</li>
              <li>Equipment should not be used beyond certified limits.</li>
              <li>Customer has inspected equipment and confirms it is in good working condition.</li>
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-8">
            <div>
              <p className="mb-8">Customer Signature: _______________________</p>
              <p>Date: _______________________</p>
            </div>
            <div>
              <p className="mb-8">Staff Signature: _______________________</p>
              <p>Date: _______________________</p>
            </div>
          </div>
        </div>

        {/* Confirmation Section */}
        <div className="space-y-4">
          <button
            onClick={handlePrint}
            className="w-full py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-medium"
          >
            Print Agreement
          </button>

          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={agreementSigned}
                onChange={(e) => setAgreementSigned(e.target.checked)}
                className="w-5 h-5"
              />
              <span>Customer has signed the rental agreement</span>
            </label>

            <div>
              <label className="block text-sm font-medium mb-1">Staff Name</label>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(staffName)}
            disabled={!agreementSigned || !staffName.trim()}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Continue to Payment
          </button>
        </div>
      </div>
    </div>
  );
}

// Customer Search Modal
interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: { id: string; firstName: string; lastName: string; email: string; phone?: string | null }) => void;
  onCreateNew: () => void;
  searchResults: Array<{ id: string; firstName: string; lastName: string; email: string; phone?: string | null }>;
  onSearch: (query: string) => void;
  isSearching: boolean;
}

export function CustomerSearchModal({
  isOpen,
  onClose,
  onSelect,
  onCreateNew,
  searchResults,
  onSearch,
  isSearching,
}: CustomerSearchModalProps) {
  const [query, setQuery] = useState("");

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.length >= 2) {
      onSearch(value);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Select Customer</h2>

        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name, email, or phone..."
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
          autoFocus
        />

        <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
          {isSearching ? (
            <p className="text-center text-gray-500 py-4">Searching...</p>
          ) : searchResults.length > 0 ? (
            searchResults.map(customer => (
              <button
                key={customer.id}
                onClick={() => onSelect(customer)}
                className="w-full p-3 text-left border rounded-lg hover:border-blue-400 hover:bg-blue-50"
              >
                <p className="font-medium">{customer.firstName} {customer.lastName}</p>
                <p className="text-sm text-gray-600">{customer.email}</p>
                {customer.phone && <p className="text-sm text-gray-500">{customer.phone}</p>}
              </button>
            ))
          ) : query.length >= 2 ? (
            <p className="text-center text-gray-500 py-4">No customers found</p>
          ) : (
            <p className="text-center text-gray-500 py-4">Type to search...</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onCreateNew}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            New Customer
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add app/components/pos/CheckoutModals.tsx
git commit -m "feat(pos): add checkout modals (cash, split, rental agreement, customer search)"
```

---

## Task 7: Create Main POS Page

**Files:**
- Modify: `app/routes/tenant/pos.tsx`

**Step 1: Replace placeholder with full POS implementation**

```typescript
/**
 * Point of Sale (POS)
 *
 * Full-featured POS for retail, rentals, and quick bookings.
 */

import { useState, useCallback } from "react";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { requireTenant } from "../../../lib/auth/tenant-auth.server";
import { getTenantDb } from "../../../lib/db/index";
import {
  getPOSProducts,
  getPOSEquipment,
  getPOSTrips,
  searchPOSCustomers,
  processPOSCheckout,
  generateAgreementNumber,
} from "../../../lib/db/pos.server";
import { Cart } from "../../components/pos/Cart";
import { ProductGrid } from "../../components/pos/ProductGrid";
import {
  CashModal,
  SplitModal,
  RentalAgreementModal,
  CustomerSearchModal,
} from "../../components/pos/CheckoutModals";
import type { CartItem } from "../../../lib/validation/pos";

export const meta: MetaFunction = () => [{ title: "Point of Sale - DiveStreams" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const { tenant } = await requireTenant(request);
  const { tables } = getTenantDb(tenant.schemaName);

  const [products, equipment, trips] = await Promise.all([
    getPOSProducts(tables),
    getPOSEquipment(tables),
    getPOSTrips(tables, tenant.timezone),
  ]);

  const agreementNumber = await generateAgreementNumber(tables);

  return {
    tenant,
    products,
    equipment,
    trips,
    agreementNumber,
    taxRate: 0, // TODO: Get from tenant settings
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { tenant, user } = await requireTenant(request);
  const { tables } = getTenantDb(tenant.schemaName);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "search-customers") {
    const query = formData.get("query") as string;
    const customers = await searchPOSCustomers(tables, query);
    return { customers };
  }

  if (intent === "checkout") {
    const data = JSON.parse(formData.get("data") as string);

    const result = await processPOSCheckout(tables, {
      items: data.items,
      customerId: data.customerId,
      userId: user.id,
      payments: data.payments,
      subtotal: data.subtotal,
      tax: data.tax,
      total: data.total,
      notes: data.notes,
    });

    return { success: true, receiptNumber: result.receiptNumber };
  }

  return { error: "Invalid intent" };
}

export default function POSPage() {
  const { tenant, products, equipment, trips, agreementNumber, taxRate } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  // State
  const [tab, setTab] = useState<"retail" | "rentals" | "trips">("retail");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
  } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [checkoutMethod, setCheckoutMethod] = useState<"card" | "cash" | "split" | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showRentalAgreement, setShowRentalAgreement] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [pendingCheckout, setPendingCheckout] = useState<"card" | "cash" | "split" | null>(null);

  // Cart calculations
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  // Check if cart requires customer (has rentals or bookings)
  const hasRentals = cart.some(item => item.type === "rental");
  const hasBookings = cart.some(item => item.type === "booking");
  const requiresCustomer = hasRentals || hasBookings;

  // Cart operations
  const addProduct = useCallback((product: any) => {
    setCart(prev => {
      const existing = prev.findIndex(
        item => item.type === "product" && item.productId === product.id
      );
      if (existing >= 0) {
        const updated = [...prev];
        const item = updated[existing] as CartItem & { type: "product" };
        item.quantity += 1;
        item.total = item.quantity * item.unitPrice;
        return updated;
      }
      return [...prev, {
        type: "product" as const,
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: Number(product.price),
        total: Number(product.price),
      }];
    });
  }, []);

  const addRental = useCallback((equipment: any, days: number) => {
    const dailyRate = Number(equipment.rentalPrice);
    setCart(prev => [...prev, {
      type: "rental" as const,
      equipmentId: equipment.id,
      name: equipment.name,
      size: equipment.size || undefined,
      days,
      dailyRate,
      total: dailyRate * days,
    }]);
  }, []);

  const addBooking = useCallback((trip: any, participants: number) => {
    const unitPrice = Number(trip.tour.price);
    setCart(prev => [...prev, {
      type: "booking" as const,
      tripId: trip.id,
      tourName: trip.tour.name,
      participants,
      unitPrice,
      total: unitPrice * participants,
    }]);
  }, []);

  const updateQuantity = useCallback((index: number, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter((_, i) => i !== index));
    } else {
      setCart(prev => {
        const updated = [...prev];
        const item = updated[index];
        if (item.type === "product") {
          item.quantity = quantity;
          item.total = item.quantity * item.unitPrice;
        }
        return updated;
      });
    }
  }, []);

  const removeItem = useCallback((index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCustomer(null);
  }, []);

  // Checkout flow
  const handleCheckout = useCallback((method: "card" | "cash" | "split") => {
    if (hasRentals && !showRentalAgreement) {
      setPendingCheckout(method);
      setShowRentalAgreement(true);
      return;
    }
    setCheckoutMethod(method);
  }, [hasRentals, showRentalAgreement]);

  const handleRentalAgreementConfirm = useCallback((staffName: string) => {
    setShowRentalAgreement(false);
    if (pendingCheckout) {
      setCheckoutMethod(pendingCheckout);
      setPendingCheckout(null);
    }
  }, [pendingCheckout]);

  const completeCheckout = useCallback(async (payments: Array<{ method: "card" | "cash"; amount: number; stripePaymentIntentId?: string }>) => {
    const formData = new FormData();
    formData.append("intent", "checkout");
    formData.append("data", JSON.stringify({
      items: cart,
      customerId: customer?.id,
      payments,
      subtotal,
      tax,
      total,
    }));

    fetcher.submit(formData, { method: "POST" });

    // Clear on success
    clearCart();
    setCheckoutMethod(null);
  }, [cart, customer, subtotal, tax, total, fetcher, clearCart]);

  // Customer search
  const handleCustomerSearch = useCallback((query: string) => {
    const formData = new FormData();
    formData.append("intent", "search-customers");
    formData.append("query", query);
    fetcher.submit(formData, { method: "POST" });
  }, [fetcher]);

  // Update search results when fetcher returns
  if (fetcher.data?.customers && fetcher.data.customers !== customerSearchResults) {
    setCustomerSearchResults(fetcher.data.customers);
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Point of Sale</h1>
          <button
            onClick={clearCart}
            className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            New Sale
          </button>
        </div>
        <div className="text-sm text-gray-600">
          {tenant.name} • {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Product Grid */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {/* Tabs */}
          <div className="flex gap-1 p-4 pb-0">
            {(["retail", "rentals", "trips"] as const).map(t => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setSelectedCategory(null);
                  setSearchQuery("");
                }}
                className={`px-6 py-2 rounded-t-lg font-medium capitalize ${
                  tab === t
                    ? "bg-white text-blue-600 border-t border-x"
                    : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 bg-white border-t overflow-hidden">
            <ProductGrid
              tab={tab}
              products={products}
              equipment={equipment}
              trips={trips}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onAddProduct={addProduct}
              onAddRental={addRental}
              onAddBooking={addBooking}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>
        </div>

        {/* Right Panel - Cart */}
        <div className="w-96 border-l">
          <Cart
            items={cart}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            customer={customer}
            onSelectCustomer={() => setShowCustomerSearch(true)}
            onClearCustomer={() => setCustomer(null)}
            taxRate={taxRate}
            onCheckout={handleCheckout}
            requiresCustomer={requiresCustomer}
          />
        </div>
      </div>

      {/* Modals */}
      <CashModal
        isOpen={checkoutMethod === "cash"}
        onClose={() => setCheckoutMethod(null)}
        total={total}
        onComplete={completeCheckout}
      />

      <SplitModal
        isOpen={checkoutMethod === "split"}
        onClose={() => setCheckoutMethod(null)}
        total={total}
        onComplete={completeCheckout}
      />

      <RentalAgreementModal
        isOpen={showRentalAgreement}
        onClose={() => {
          setShowRentalAgreement(false);
          setPendingCheckout(null);
        }}
        onConfirm={handleRentalAgreementConfirm}
        customer={customer}
        rentals={cart
          .filter((item): item is CartItem & { type: "rental" } => item.type === "rental")
          .map(item => ({
            name: item.name,
            size: item.size,
            days: item.days,
            dailyRate: item.dailyRate,
            total: item.total,
          }))}
        shopName={tenant.name}
        agreementNumber={agreementNumber}
      />

      <CustomerSearchModal
        isOpen={showCustomerSearch}
        onClose={() => setShowCustomerSearch(false)}
        onSelect={(c) => {
          setCustomer(c);
          setShowCustomerSearch(false);
        }}
        onCreateNew={() => {
          // TODO: Open create customer modal
          setShowCustomerSearch(false);
        }}
        searchResults={customerSearchResults}
        onSearch={handleCustomerSearch}
        isSearching={fetcher.state === "submitting"}
      />

      {/* Success Toast */}
      {fetcher.data?.success && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg">
          Sale complete! Receipt #{fetcher.data.receiptNumber}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: May have errors to fix

**Step 3: Run build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add app/routes/tenant/pos.tsx
git commit -m "feat(pos): implement full POS page with cart, checkout, and modals"
```

---

## Task 8: Test and Deploy

**Step 1: Run full test suite**

Run: `npm test`
Expected: PASS (existing tests should still pass)

**Step 2: Run build**

Run: `npm run build`
Expected: PASS

**Step 3: Manual testing checklist**

- [ ] POS page loads with products/equipment/trips
- [ ] Can add retail items to cart
- [ ] Can add equipment rentals with day selector
- [ ] Can add trip bookings with participant selector
- [ ] Can search and select customers
- [ ] Cash checkout flow works
- [ ] Split payment flow works
- [ ] Rental agreement modal shows for rental items
- [ ] Cart requires customer for rentals/bookings

**Step 4: Commit all changes**

```bash
git add -A
git commit -m "feat(pos): complete POS system implementation"
```

**Step 5: Push and deploy**

```bash
git push shooter51 main
```

Then deploy via Hostinger MCP.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add rentals table | `lib/db/schema.ts` |
| 2 | Validation schemas | `lib/validation/pos.ts` |
| 3 | Database queries | `lib/db/pos.server.ts` |
| 4 | Cart component | `app/components/pos/Cart.tsx` |
| 5 | Product grid | `app/components/pos/ProductGrid.tsx` |
| 6 | Checkout modals | `app/components/pos/CheckoutModals.tsx` |
| 7 | Main POS page | `app/routes/tenant/pos.tsx` |
| 8 | Test and deploy | - |

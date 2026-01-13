# POS (Point of Sale) Implementation Exploration

## Current State

### Existing Schema
The database already has a `transactions` table in `/lib/db/schema.ts`:

```typescript
transactions: pgTable('transactions', {
  id: uuid().primaryKey().defaultRandom(),
  customerId: uuid().references(() => customers.id),
  bookingId: uuid().references(() => bookings.id),
  type: varchar(20).notNull(), // 'sale', 'refund', 'deposit', 'payment'
  amount: integer().notNull(), // cents
  currency: varchar(3).default('USD'),
  paymentMethod: varchar(50), // 'cash', 'card', 'stripe', 'paypal'
  status: varchar(20).default('pending'), // 'pending', 'completed', 'failed', 'refunded'
  stripePaymentIntentId: varchar(255),
  lineItems: jsonb(), // array of {description, quantity, unitPrice, total}
  notes: text(),
  processedBy: uuid(), // staff member
  createdAt: timestamp().defaultNow(),
});
```

### Missing Components
- **No POS UI routes** - No retail/checkout interface exists
- **No inventory management** - No products table
- **No cash drawer tracking** - No shift/drawer schema
- **No receipt printing** - No print templates

---

## POS Feature Set

### 1. Products & Inventory

**Schema Addition:**
```typescript
products: pgTable('products', {
  id: uuid().primaryKey(),
  name: varchar(255).notNull(),
  sku: varchar(50),
  category: varchar(50), // 'equipment', 'apparel', 'accessories', 'courses'
  description: text(),
  price: integer().notNull(), // cents
  costPrice: integer(), // for margin calculation
  taxRate: decimal(5, 2).default(0),
  trackInventory: boolean().default(true),
  stockQuantity: integer().default(0),
  lowStockThreshold: integer().default(5),
  imageUrl: varchar(500),
  isActive: boolean().default(true),
});

inventoryMovements: pgTable('inventory_movements', {
  id: uuid().primaryKey(),
  productId: uuid().references(() => products.id),
  type: varchar(20), // 'sale', 'return', 'adjustment', 'restock'
  quantity: integer(),
  previousStock: integer(),
  newStock: integer(),
  transactionId: uuid().references(() => transactions.id),
  notes: text(),
  createdBy: uuid(),
  createdAt: timestamp().defaultNow(),
});
```

### 2. Checkout Interface

**Route Structure:**
```
/app/pos                 - Main POS terminal
/app/pos/products        - Product catalog
/app/pos/transactions    - Transaction history
/app/pos/end-of-day      - Daily reports
```

**Checkout Flow:**
1. Add items to cart (scan barcode or search)
2. Apply discounts/coupons
3. Select customer (optional)
4. Choose payment method
5. Process payment
6. Print/email receipt

### 3. Payment Methods

| Method | Integration | Notes |
|--------|-------------|-------|
| Cash | Local | Cash drawer tracking |
| Card (Stripe Terminal) | Stripe | Hardware reader required |
| Card (Manual) | Stripe | Keyed entry |
| Store Credit | Internal | Pre-paid balance |
| Split Payment | Multiple | Combine methods |

### 4. Cash Drawer & Shifts

```typescript
posShifts: pgTable('pos_shifts', {
  id: uuid().primaryKey(),
  staffId: uuid().references(() => staff.id),
  startedAt: timestamp().notNull(),
  endedAt: timestamp(),
  openingCash: integer().notNull(), // cents
  closingCash: integer(),
  expectedCash: integer(), // calculated
  cashVariance: integer(), // difference
  cardTotal: integer(),
  transactionCount: integer(),
  notes: text(),
});
```

---

## UI Design

### POS Terminal Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ☰ DiveShop POS                    Staff: John   [End Shift]│
├───────────────────────────────┬─────────────────────────────┤
│                               │  CURRENT SALE               │
│  [Search products...]         │  ─────────────────────────  │
│                               │  Mask + Snorkel Set    $89  │
│  ┌─────────┐ ┌─────────┐     │  Reef-safe Sunscreen   $24  │
│  │ Masks   │ │ Fins    │     │  Logbook               $15  │
│  │   $89   │ │  $120   │     │  ─────────────────────────  │
│  └─────────┘ └─────────┘     │  Subtotal:           $128.00│
│  ┌─────────┐ ┌─────────┐     │  Tax (8%):            $10.24│
│  │ Wetsuits│ │ Courses │     │  ─────────────────────────  │
│  │  $180   │ │  $350   │     │  TOTAL:              $138.24│
│  └─────────┘ └─────────┘     │                             │
│                               │  [💵 Cash] [💳 Card]       │
│  [ All Products Grid... ]     │  [Customer: Walk-in ▼]     │
│                               │                             │
└───────────────────────────────┴─────────────────────────────┘
```

### Mobile-Friendly
- Touch-optimized buttons
- Swipe to remove items
- Quick quantity adjustment
- Works on tablet (iPad recommended)

---

## Stripe Terminal Integration

### Hardware Options
| Device | Price | Features |
|--------|-------|----------|
| BBPOS WisePOS E | $249 | Countertop, built-in receipt printer |
| Stripe Reader M2 | $59 | Mobile, Bluetooth |
| BBPOS Chipper 2X | $59 | Mobile, headphone jack |

### Integration Steps
1. Order Stripe Terminal hardware
2. Register device in Stripe Dashboard
3. Install `@stripe/terminal-js` SDK
4. Connect reader via Location API
5. Collect payment using PaymentIntent

```typescript
// Example Stripe Terminal flow
import { loadStripeTerminal } from '@stripe/terminal-js';

const terminal = await loadStripeTerminal();
await terminal.discoverReaders({ simulated: false });
await terminal.connectReader(reader);

const paymentIntent = await createPaymentIntent(amount);
const result = await terminal.collectPaymentMethod(paymentIntent.client_secret);
await terminal.processPayment(result.paymentIntent);
```

---

## Reporting

### End of Day Report
- Total sales by payment method
- Cash drawer variance
- Top selling products
- Refunds processed
- Comparison to previous day

### Inventory Reports
- Low stock alerts
- Best sellers (weekly/monthly)
- Dead stock (no movement 90+ days)
- Profit margins by category

---

## Implementation Priority

### Phase 1 (Basic POS)
1. Products table + CRUD UI
2. Simple checkout interface
3. Cash payments only
4. Basic receipt (screen display)

### Phase 2 (Payments)
1. Stripe card payments (keyed)
2. Transaction history view
3. Refund processing
4. End of day summary

### Phase 3 (Inventory)
1. Stock tracking
2. Low stock alerts
3. Inventory adjustments
4. Barcode scanning (camera)

### Phase 4 (Hardware)
1. Stripe Terminal integration
2. Receipt printer support
3. Barcode scanner hardware
4. Cash drawer integration

---

## Dependencies

```bash
npm install @stripe/terminal-js
```

## Estimated Effort

| Phase | Features | Effort |
|-------|----------|--------|
| Phase 1 | Basic POS + products | 4-5 days |
| Phase 2 | Payments + history | 3-4 days |
| Phase 3 | Inventory | 3-4 days |
| Phase 4 | Hardware | 5-7 days |

---

## Questions to Resolve

1. Start with full POS or simpler "retail add-ons to bookings"?
2. Hardware requirements (card reader, receipt printer)?
3. Inventory management priority vs simple product catalog?
4. Multi-location inventory support needed?
5. Integration with accounting (QuickBooks/Xero)?

# Point of Sale (POS) Design

## Overview

Full-featured POS system for dive shop walk-in operations: retail sales, equipment rentals, and quick trip bookings.

## Requirements

- **Retail sales**: Masks, fins, apparel, accessories, snacks
- **Equipment rentals**: BCDs, regulators, wetsuits with tracking
- **Quick bookings**: Add walk-ins to today's trips
- **Payments**: Card (Stripe), Cash, Split payments
- **Customers**: Required for rentals/bookings, optional for retail (guest sales OK)
- **Receipts**: Email only (digital)
- **Rental agreements**: Printable for manual signature
- **Future**: Barcode/QR scanner integration for inventory and cart

---

## UI Layout

### Main POS Screen

```
+------------------------------------------------------------------+
|  [New Sale]                    Paradise Dive Shop    Jan 12, 2026 |
+------------------------------------------------------------------+
|                                    |                              |
|  [Retail] [Rentals] [Trips]        |  CART                        |
|                                    |                              |
|  [Masks] [Fins] [Wetsuits] [All]   |  Mask - Cressi F1            |
|                                    |    1 x $45.00        $45.00  |
|  +--------+  +--------+  +------+  |                              |
|  | Mask   |  | Fins   |  | Wet  |  |  BCD Rental (3 days)         |
|  | $45    |  | $89    |  | $120 |  |    1 x $25/day       $75.00  |
|  +--------+  +--------+  +------+  |                              |
|                                    |  Morning Dive Trip           |
|  +--------+  +--------+  +------+  |    2 participants   $180.00  |
|  | Snork  |  | Boots  |  | Bag  |  |                              |
|  | $35    |  | $55    |  | $40  |  +------------------------------+
|  +--------+  +--------+  +------+  |  Customer: John Smith [x]    |
|                                    +------------------------------+
|  [Search products...]              |  Subtotal:           $300.00 |
|                                    |  Tax (8%):            $24.00 |
|                                    |  TOTAL:              $324.00 |
|                                    +------------------------------+
|                                    |  [CARD]  [CASH]  [SPLIT]     |
|                                    +------------------------------+
+------------------------------------------------------------------+
```

### Tabs

| Tab | Content |
|-----|---------|
| **Retail** | Products grid with category filters |
| **Rentals** | Available equipment with size selector |
| **Trips** | Today's trips with available spots |

---

## Checkout Flows

### Card Payment
1. Customer taps items → added to cart
2. Select/create customer (if rental or booking in cart)
3. Tap "Card" → Stripe Payment Element modal
4. Customer enters card → payment processed
5. Transaction saved, receipt emailed, cart cleared

### Cash Payment
1. Tap "Cash" → modal shows total
2. Enter amount tendered
3. Display change due
4. Tap "Complete" → transaction saved

### Split Payment
1. Tap "Split" → modal shows total and breakdown
2. Add payments: method + amount
3. Repeat until balance = $0
4. All payments linked to single transaction

---

## Rental Flow

### Adding Rental to Cart
1. Tap equipment in Rentals tab
2. Select size (if applicable)
3. Select duration: 1 day, 3 days, 1 week, custom
4. Added to cart with daily rate × days

### Checkout with Rentals
1. Customer REQUIRED (enforced by UI)
2. Before payment: "Print Rental Agreement" button
3. Staff prints agreement → customer signs physically
4. Staff checks "Agreement Signed" checkbox
5. Payment processed
6. Equipment marked as "rented" in database
7. Rental record created with due date

### Rental Agreement (Printable)
```
+------------------------------------------+
|          EQUIPMENT RENTAL AGREEMENT       |
|              Paradise Dive Shop           |
|                                          |
| Agreement #: RA-2026-0042                |
| Date: January 12, 2026                   |
|                                          |
| CUSTOMER                                 |
| Name: John Smith                         |
| Phone: +1 555-123-4567                   |
| Email: john@example.com                  |
|                                          |
| EQUIPMENT                                |
| - BCD Aqua Lung Pro HD (Size: L)        |
|   Serial: AQ-2024-1234                   |
|   Condition: Good                        |
|   Daily Rate: $25.00                     |
|                                          |
| Rental Period: Jan 12 - Jan 15, 2026    |
| Total Charge: $75.00                     |
|                                          |
| TERMS AND CONDITIONS                     |
| [Standard liability waiver text...]      |
|                                          |
| Customer Signature: ________________     |
| Date: ________________                   |
|                                          |
| Staff: ________________                  |
+------------------------------------------+
```

### Returns (Future Tab Addition)
- Search by customer or equipment serial
- Show active rentals
- "Return" button → marks returned, equipment available
- Option to charge overage for late returns

---

## Data Model

### Existing Tables Used
- `products` - retail items (has SKU, inventory, categories)
- `equipment` - rental gear (serial number, rental price, status)
- `trips` - today's available trips
- `customers` - customer records
- `transactions` - all POS sales

### New Table: `rentals`

```sql
CREATE TABLE rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  equipment_id UUID NOT NULL REFERENCES equipment(id),

  rented_at TIMESTAMP NOT NULL DEFAULT NOW(),
  due_at TIMESTAMP NOT NULL,
  returned_at TIMESTAMP,

  daily_rate DECIMAL(10,2) NOT NULL,
  total_charge DECIMAL(10,2) NOT NULL,

  status TEXT NOT NULL DEFAULT 'active', -- active, returned, overdue

  -- Rental agreement tracking
  agreement_number TEXT NOT NULL,
  agreement_signed_at TIMESTAMP,
  agreement_signed_by TEXT, -- staff member who confirmed

  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Transaction Items Structure

```typescript
type TransactionItem =
  | { type: "product"; productId: string; name: string; quantity: number; unitPrice: number; total: number }
  | { type: "rental"; equipmentId: string; name: string; size?: string; days: number; dailyRate: number; total: number }
  | { type: "booking"; tripId: string; tourName: string; participants: number; unitPrice: number; total: number };
```

---

## Receipt (Email)

**Subject:** Receipt from Paradise Dive Shop - #POS-20260112-0042

**Content:**
- Shop name, logo, contact info
- Transaction date/time
- Receipt number
- Line items with quantities and prices
- Subtotal, tax, total
- Payment method(s)
- Customer name
- For rentals: equipment details, due date, agreement number
- Shop policies / thank you message

---

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `lib/db/schema.ts` | Add rentals table |
| `lib/validation/pos.ts` | POS-specific validation schemas |
| `lib/db/pos.server.ts` | POS database queries and mutations |
| `app/routes/tenant/pos.tsx` | Main POS page with loader/action |
| `app/components/pos/ProductGrid.tsx` | Product/equipment/trip grid |
| `app/components/pos/Cart.tsx` | Cart sidebar |
| `app/components/pos/CheckoutModal.tsx` | Payment modals (card/cash/split) |
| `app/components/pos/CustomerSelector.tsx` | Customer search/create |
| `app/components/pos/RentalAgreement.tsx` | Printable rental agreement |
| `lib/email/templates/receipt.tsx` | Receipt email template |

---

## Future Enhancements

- **Barcode scanner**: Lookup products/equipment by SKU/serial
- **Returns tab**: Process equipment returns with overage charging
- **Cash drawer tracking**: Opening float, end-of-day reconciliation
- **Discounts**: Percentage or fixed discounts per item or cart
- **Thermal printer**: Direct receipt printing
- **Offline mode**: Queue transactions when internet unavailable

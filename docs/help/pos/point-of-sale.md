---
title: "Point of Sale Overview"
category: "Point of Sale"
tags: ["pos", "point of sale", "retail", "rentals", "payments", "checkout"]
order: 1
---

# Point of Sale Overview

The **Point of Sale (POS)** module lets you take payments for retail products, equipment rentals, and dive trip bookings — all from a single screen. It supports cash, card (via Stripe), and split payments.

> **Note:** The POS is available to accounts on a plan that includes the POS feature. If you don't see it in the sidebar, check your plan under **Settings** → **Billing**.

## Accessing the POS

Go to **Point of Sale** in the sidebar. You need the **Owner** or **Admin** role to access the POS.

## Screen Layout

The POS screen has two main areas:

- **Left panel** — product/rental/trip browser, organized by tabs
- **Right panel** — the cart showing items added to the current sale

## Three Tabs

| Tab | Shows |
|-----|-------|
| **Retail** | Products from your product catalog |
| **Rentals** | Equipment marked as rentable |
| **Trips** | Upcoming dive trips available for booking |

Click a tab to switch the browsing panel.

## Selecting a Customer

Before or during a sale you can attach a customer:

1. Click **Select Customer** at the top of the cart.
2. Type a name or email in the search box.
3. Click the customer from the results.

Attaching a customer is optional for retail and rental sales, but required when booking a trip through the POS.

## Adding Items to Cart

- **Retail**: Click a product tile to add one unit. The cart updates immediately.
- **Rentals**: Click an equipment item. A rental agreement number is auto-generated.
- **Trips**: Click a trip to add it. You must have a customer selected first.

Each cart line shows the item name, quantity, and line total. Use the **+** / **−** buttons to adjust quantities, or click the trash icon to remove a line.

## Barcode Scanning

The POS supports barcode scanning in two modes:

- **Camera scan** — click the barcode icon to open the camera scanner modal.
- **USB barcode scanner** — plug in a USB HID barcode scanner; it types the barcode as keystrokes which the POS intercepts automatically.

When a barcode is scanned, the matching product is added to the cart. If no match is found, a "product not found" message appears.

## Cart Totals

The cart panel shows:
- **Subtotal** — sum of all line items before tax
- **Tax** — calculated using your organization's tax rate (set in **Settings** → **Profile**)
- **Total** — subtotal + tax

## Checkout

Once items are in the cart, click **Checkout** to choose a payment method:

- **Card** — processes a Stripe payment. Requires Stripe to be connected under **Settings** → **Integrations**.
- **Cash** — enter the amount tendered; the POS calculates change.
- **Split** — split the total between cash and card.

See [Process a Sale](./process-sale.md) for step-by-step checkout instructions.

## Refunds

To refund a completed transaction, click **Refund** in the top bar. Enter the transaction ID or look up the sale, then confirm the refund amount. See [Refunds](./refunds.md) for full details.

## Transaction History

Go to **POS** → **Transactions** (via the top navigation) to view a history of all POS sales, filter by date or customer, and view individual transaction receipts.

---
title: "Process a Sale"
category: "Point of Sale"
tags: ["pos", "checkout", "payment", "cash", "card", "stripe", "split"]
order: 2
---

# Process a Sale

This article walks you through completing a sale in the POS from adding items to taking payment.

## Step 1: Add Items to the Cart

1. Go to **Point of Sale** in the sidebar.
2. Select the tab that matches what you are selling: **Retail**, **Rentals**, or **Trips**.
3. Click each item to add it to the cart. For retail items, click the **+** button to increase quantity.

## Step 2: Attach a Customer (Optional)

Click **Select Customer** above the cart and search by name or email. Attaching a customer is required for trip bookings and recommended for rentals so the transaction appears on the customer's record.

## Step 3: Click Checkout

Click **Checkout** at the bottom of the cart panel. A modal appears asking you to choose a payment method.

## Payment Methods

### Card (Stripe)

1. Select **Card** in the checkout modal.
2. The POS creates a Stripe payment intent for the total amount.
3. Enter the customer's card details in the Stripe form and click **Pay**.
4. On success, a receipt is shown. Click **Print Receipt** or **Done**.

> **Requirement:** Stripe must be connected under **Settings** → **Integrations** → **Stripe** before card payments are available.

### Cash

1. Select **Cash** in the checkout modal.
2. The total due is shown.
3. Enter the **Amount Tendered** (what the customer hands you).
4. The **Change Due** is calculated automatically.
5. Click **Complete Sale**.

### Split Payment

1. Select **Split** in the checkout modal.
2. Enter the amount to charge to the card and the amount to pay in cash.
3. The card and cash amounts must add up to the total.
4. Complete the card payment first, then record the cash amount.
5. Click **Complete Sale**.

## Rental Agreements

When a rental item is in the cart, the POS shows a **Rental Agreement** modal during checkout. The agreement number is pre-filled. Review the terms and click **Confirm Agreement** to proceed.

## After Checkout

Once payment is confirmed:
- A **receipt modal** appears. You can print the receipt or dismiss it.
- The sale is recorded in **POS** → **Transactions**.
- Stock is decremented for tracked products.
- If a customer was attached, the transaction appears on their record.

## Cancelling a Sale

To clear the cart without completing a sale, click **Clear Cart** at the bottom of the cart panel. This removes all items and resets the customer selection.

---
title: "Refunds"
category: "Point of Sale"
tags: ["pos", "refund", "return", "transaction"]
order: 3
---

# Refunds

You can issue a refund for any completed POS transaction. Refunds are processed back to the original payment method (card refunds via Stripe; cash refunds are manual).

## How to Issue a Refund

1. Go to **Point of Sale** in the sidebar.
2. Click **Refund** in the top action bar.
3. The **Transaction Lookup** modal opens.
4. Enter the transaction ID, or search by customer name or date, and click **Find Transaction**.
5. The transaction details are shown: items, totals, and payment method.
6. Enter the **Refund Amount** (up to the original transaction total).
7. Click **Confirm Refund**.

## Card Refunds

If the original payment was made by card via Stripe, the refund is sent back to the same card automatically. Stripe processes the refund and credits the customer's account. The time to appear on the customer's bank statement depends on the card issuer (typically 3–10 business days).

## Cash Refunds

Cash refunds are not processed automatically — you hand the cash back to the customer. The system records the refund for audit purposes.

## Partial Refunds

You can refund less than the original transaction total. Enter the partial amount in the **Refund Amount** field. The remaining balance is noted on the transaction record.

## Viewing Refunded Transactions

Go to **POS** → **Transactions**. Refunded transactions are marked with a **Refunded** badge. Click a transaction to see the full refund history including amounts and timestamps.

---
title: "Manage Payments"
category: "Bookings"
tags: ["payment", "booking", "record payment", "balance", "cash", "card"]
order: 4
---

# Manage Payments

DiveStreams lets you record payments against a booking. Payments are tracked manually — you record what was received, from what method, and the system maintains a running balance.

## View Payment Status

On any booking detail page, the **Pricing** sidebar shows:

- **Base price × participants** (subtotal)
- Equipment rental total (if any)
- Tax (if configured)
- Discount (if applied)
- **Total** (bold, large)
- **Paid** (green) — sum of all recorded payments
- **Balance Due** (red) — total minus paid

If the balance due is $0.00 or less, the booking is fully paid.

## Record a Payment

1. Open the booking detail page.
2. In the **Payment History** section, click **Record Payment** (this link only appears when there is a balance due).
3. A modal opens with:
   - **Amount** — pre-filled with the balance due. You can change this to record a partial payment.
   - **Payment Method** — select one of: Cash, Credit/Debit Card, Bank Transfer, Stripe, Other.
   - **Notes** — optional; enter a reference number or any detail you want to keep.
4. Click **Record Payment**.

The payment appears in the **Payment History** section with the amount, method, and date. The **Paid** and **Balance Due** amounts update immediately.

### Payment Amount Validation

- The amount must be at least $1.00 (or exactly $0.00 for a free adjustment).
- Amounts between $0.01 and $0.99 are not accepted.
- Negative amounts are not accepted.
- There is no upper limit — you can record a payment larger than the balance due.

## Payment History

Every payment made against a booking is listed in the **Payment History** section:

- **Amount** — in the shop's currency.
- **Method** — the payment method selected.
- **Date** — when the payment was recorded.
- **Note** — any reference text entered.

Payments are listed in order from oldest to newest.

## Stripe Integration

If you have Stripe connected (Settings → Integrations), you can process card payments directly from the POS or from the booking widget. Those payments are automatically recorded with the method **Stripe** and include a Stripe payment intent ID in the notes.

For payments taken outside DiveStreams (e.g. via a card machine), select **Credit/Debit Card** or the appropriate method and enter a reference number in the notes.

## Send Confirmation Email

After recording a payment or updating a booking, you can re-send the customer their booking confirmation. On the booking detail page, under **Quick Actions** in the right sidebar, click **Send Confirmation Email**.

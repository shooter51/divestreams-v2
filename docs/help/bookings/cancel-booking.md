---
title: "Cancel a Booking"
category: "Bookings"
tags: ["booking", "cancel", "cancellation"]
order: 3
---

# Cancel a Booking

You can cancel a booking that is in **Pending** or **Confirmed** status. Cancellation releases the spots back to the trip so they can be re-booked.

## Steps

1. Go to **Bookings** in the sidebar.
2. Click the booking number to open the booking detail page.
3. Click the **Cancel** button in the top-right button group. This button only appears when the booking is in a cancellable state (Pending or Confirmed).
4. A confirmation dialog appears — click **OK** to confirm the cancellation.

The booking status changes to **Cancelled** and the participants are removed from the trip manifest.

## Status After Cancellation

A cancelled booking:
- Shows the **Cancelled** status badge.
- Cannot be re-activated — you must create a new booking if needed.
- Retains all payment records for reference.

> **Note:** Cancellation does not automatically process a refund. If the customer has already paid, you need to issue a refund manually through your payment processor (Stripe or other).

## Mark as No-Show

If a confirmed booking's customer does not arrive for the trip, you can mark it as **No-Show** instead of cancelling. This preserves the payment record and flags the event for your records.

On the booking detail page, click **Mark as No-Show** under Quick Actions in the sidebar. This action is only available when the booking is **Confirmed**.

## Booking Status Transitions

| From | To | How |
|------|-----|-----|
| Pending | Confirmed | Click **Confirm** |
| Pending | Cancelled | Click **Cancel** |
| Confirmed | Completed | Click **Mark Complete** |
| Confirmed | Cancelled | Click **Cancel** |
| Confirmed | No-Show | Click **Mark as No-Show** |
| Completed | — | Terminal state |
| Cancelled | — | Terminal state |
| No-Show | — | Terminal state |

See [Booking Statuses](./booking-statuses.md) for a full explanation of each status.

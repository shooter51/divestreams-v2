---
title: "Booking Statuses"
category: "Bookings"
tags: ["status", "booking", "pending", "confirmed", "completed", "cancelled", "no-show"]
order: 5
---

# Booking Statuses

Every booking moves through a lifecycle of statuses. Understanding these statuses helps you manage your operation accurately.

## Status Definitions

### Pending

The default status when a booking is first created — either by staff or through the booking widget. A pending booking:
- Has reserved the spots on the trip.
- Has not been formally accepted/confirmed by your shop.
- Typically awaits a deposit or confirmation.

### Confirmed

The booking has been accepted and the customer's place on the trip is guaranteed. Move a booking to Confirmed when you have verified the customer's intent (or received a deposit).

### Completed

The trip has taken place and the booking is closed. Only **Confirmed** bookings can be marked as Completed.

### Cancelled

The booking was cancelled before the trip. Both **Pending** and **Confirmed** bookings can be cancelled. Cancelled bookings release the spots back to the trip.

### No-Show

The customer had a **Confirmed** booking but did not appear for the trip. This is different from Cancelled — it preserves a record that the trip ran and the customer did not attend.

## Status Transitions

The following transitions are allowed:

| Current Status | Can move to |
|---------------|-------------|
| Pending | Confirmed, Cancelled |
| Confirmed | Completed, Cancelled, No-Show |
| Completed | (terminal — no further changes) |
| Cancelled | (terminal — no further changes) |
| No-Show | (terminal — no further changes) |

## How to Change a Booking Status

All status changes are made from the **booking detail page** using the action buttons in the top-right corner:

- **Confirm** button — appears when the booking is Pending.
- **Mark Complete** button — appears when the booking is Confirmed.
- **Cancel** button — appears when the booking is Pending or Confirmed.
- **Mark as No-Show** — appears in the Quick Actions sidebar when the booking is Confirmed.

## Booking Status Badges

Status badges use colour coding throughout the dashboard:
- **Pending** — amber/yellow
- **Confirmed** — green
- **Completed** — blue
- **Cancelled** — red/grey
- **No-Show** — orange

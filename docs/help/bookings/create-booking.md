---
title: "Create a Booking"
category: "Bookings"
tags: ["booking", "reservation", "trip", "customer", "create"]
order: 1
---

# Create a Booking

A **Booking** links a customer to a specific trip. Only owners and admins can create bookings. Staff can view and update payment status.

## Before You Start

You need:
- At least one **Customer** in your account
- At least one **Trip** scheduled with available spots

## Steps

1. Go to **Bookings** in the sidebar.
2. Click **New Booking** in the top right.

### Customer Section

- If you navigated from a customer profile, the customer is pre-selected and shown with their name and email. Click **Change** to select a different customer.
- Otherwise, use the **Select Customer** dropdown. The list includes up to 100 customers.
- Don't see your customer? Click **+ Add New Customer** to open the new customer form in a new page.

### Trip Section

- Use the **Select Trip** dropdown to choose an upcoming, scheduled trip with available spots.
- Each option shows: tour name, date, start time, price per person, and available spots.
- Trips with zero available spots are hidden from the list.
- If you came from a trip detail page, the trip is pre-selected.

### Participants

- Enter the **Number of Participants** (minimum 1).
- If the trip has a capacity limit, the field shows the maximum number you can book.
- You can optionally enter the **Participant 1 Name**.

### Tank & Gas Selection

This section appears when the selected trip's tour has **Require tank & gas selection** enabled. For each participant:

- Select a **tank type** from the available types your shop has configured.
- Select a **gas type** (Air, Nitrox 32%, Nitrox 36%, Trimix, Oxygen).
- Set **Quantity** (default 1).
- Or check **Bring own tanks** if the diver is providing their own equipment.

If the tour requires tank selection, you must cover every participant or the booking will fail validation.

### Equipment Rental

Check any items you want to add as rentals. Each item shows its name, how many units are available, and the rental price. Equipment without a rental price is excluded.

### Notes

- **Special Requests** — Passed through to the customer's confirmation email and shown on the booking detail page.
- **Internal Notes** — Staff-only notes; not included in customer-facing communications.

### Booking Source

Choose where the booking came from:
- **Direct** — you created it manually
- **Website** — came through your website or booking widget
- **Partner** — from a third-party reseller or partner
- **Repeat** — a returning customer who contacted you directly
- **Referral** — referred by another customer
- **Other**

## Save

Click **Create Booking**. The system:
1. Checks that the trip still has enough spots (race-condition safe).
2. Calculates the total (price × participants + any equipment rentals).
3. Creates the booking with status **Pending**.
4. Sends a confirmation email to the customer if that notification is enabled.

You are redirected to the **Bookings** list with a success message.

> **Note:** The booking starts with status **Pending**. You need to manually confirm it. See [Booking Statuses](./booking-statuses.md).

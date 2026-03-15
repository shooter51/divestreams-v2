---
title: "Rental Management"
category: "Equipment"
tags: ["rental", "equipment", "available", "rented", "status", "POS"]
order: 3
---

# Rental Management

DiveStreams tracks the rental status of equipment through the equipment status field. Rentals can be processed through the POS or recorded when creating a booking.

## Making Equipment Available for Rental

For an item to appear in rental workflows, it must be:
1. Status: **Available** (not Rented, In Maintenance, or Retired)
2. **Available for Rental** checkbox: checked
3. **Rental Price Per Day**: set to a value greater than zero

Items meeting all three criteria appear:
- In the **Equipment Rental** section of the booking form
- In the **Rentals** tab in the POS

## Renting Equipment via Booking

When creating a booking, the **Equipment Rental** section shows all available rental items grouped by name. Check the items the customer wants to rent. The rental price is added to the booking total.

## Renting Equipment via POS

In the POS, click the **Rentals** tab. Each available rental item is shown as a card. Click an item to open the rental dialog where you set the number of days. The item is added to the cart with a total of `daily rate × days`.

When a rental is in the cart, a **Rental Agreement** must be confirmed before checkout. This generates an agreement number and records the staff member who authorised it.

## Viewing Current Rentals

Go to **Equipment** → **Rentals** to see all items currently marked as rented, including when they were rented and to whom.

## Updating Equipment Status

When a rented item is returned:

1. Go to **Equipment** in the sidebar.
2. Click the equipment item.
3. Click **Edit**.
4. Change **Status** from **Rented** to **Available** (or **In Maintenance** if it needs servicing).
5. Click **Save**.

## Service Tracking

When an item is sent for service, set its status to **In Maintenance**. Enter the **Last Service Date** and **Next Service Due** so you can plan maintenance schedules. Items in maintenance are excluded from rental availability.

## Retiring Equipment

When an item is no longer fit for use:
1. Edit the equipment record.
2. Set **Status** to **Retired**.
3. Optionally add a note explaining why.

Retired items are excluded from all rental workflows but their history is preserved.

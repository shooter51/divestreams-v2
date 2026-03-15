---
title: "Trip Capacity"
category: "Trips"
tags: ["capacity", "participants", "availability", "spots", "full"]
order: 3
---

# Trip Capacity

Trip capacity controls how many participants can be booked onto a single trip. DiveStreams enforces capacity limits when bookings are created.

## How Capacity Is Set

Capacity is determined in order of precedence:

1. **Trip-level override** — set the **Capacity** field when creating or editing a specific trip. This overrides the tour default.
2. **Tour default** — the **Max Participants** field on the tour. All trips inherit this unless overridden.

If a trip has no capacity set and neither does its tour (which should not happen in normal use), the system treats capacity as unlimited.

## Available Spots

On the **New Booking** form, each trip in the dropdown shows available spots in parentheses:

- `"Morning Reef Dive - Jun 10 at 08:00 ($75, 3 spots)"` — 3 spots left
- `"Night Dive - Jun 11 at 19:00 ($65, unlimited spots)"` — no capacity limit set

Trips with zero available spots are hidden from the dropdown.

## Capacity Enforcement

When a booking is submitted, DiveStreams checks capacity within a database transaction to prevent double-booking (race-condition safe). If the spots have been taken between when the form was loaded and when it is submitted, you receive an error:

> "This trip no longer has enough available spots."

In this case, go back, refresh, and either choose a different trip or reduce the participant count.

## Changing Capacity on an Existing Trip

To increase or decrease capacity on a scheduled trip:

1. Go to **Trips** in the sidebar.
2. Click the trip.
3. Click **Edit**.
4. Update the **Capacity** field.
5. Click **Save**.

> **Note:** Reducing capacity below the current number of confirmed participants is not validated by the system — take care not to overbook by reducing capacity below what's already booked.

## Boat Capacity vs Trip Capacity

The boat you assign to a trip has its own passenger capacity. This is displayed on the boat record but is **not** automatically enforced as the trip capacity. You must manually set the trip capacity to match (or not exceed) the boat's safe capacity.

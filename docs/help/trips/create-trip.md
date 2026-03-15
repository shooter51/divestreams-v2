---
title: "Create a Trip"
category: "Trips"
tags: ["trip", "schedule", "date", "time", "boat", "staff"]
order: 1
---

# Create a Trip

A **Trip** is a scheduled instance of a Tour — a specific date and time when the dive experience runs. You can take bookings against a Trip.

## Prerequisites

- At least one active **Tour**
- Optionally, at least one active **Boat** if you want to assign one

## Steps

1. Go to **Trips** in the sidebar.
2. Click **Schedule Trip** in the top right.

### Select Tour

Use the **Select Tour** dropdown to choose the tour this trip is based on. The dropdown shows all active tours with their price and duration.

If you navigated from a tour detail page, the tour is pre-selected and shown with its name, price, duration, and max participants.

Once a tour is selected, if it has associated **Dive Sites**, they are shown in a read-only panel below — this is the planned itinerary for the trip.

### Date & Time

| Field | Required | Notes |
|-------|----------|-------|
| Date | Yes | Must be today or a future date |
| Start Time | Yes | Default 08:00 |
| End Time | No | Default 12:00; calculated from duration if left blank |

### Recurring Trip

Toggle **Recurring Trip** to schedule the same trip on multiple dates automatically. See [Recurring Trips](./recurring-trips.md).

### Boat

Use the **Select Boat** dropdown to assign a boat to this trip. All active boats are listed with their capacity. Selecting a boat is optional.

### Capacity & Price Override

These fields let you override the values inherited from the tour for this specific trip only:

- **Capacity** — the maximum number of participants. Leave blank to use the tour's default.
- **Price Override** — the per-person price. Leave blank to use the tour's price. Minimum $1 if entered.

### Staff Assignment

Check one or more team members to assign them to this trip. All active staff appear with their name and role (Divemaster, Instructor, etc.).

### Notes

- **Weather Notes** — a short note about conditions (e.g. "Slight swell, 1–2 metres"). Visible to staff.
- **Internal Notes** — any other staff-only information.
- **Show on Public Site** — checked by default. Uncheck to hide this trip from your public booking page while keeping it in the system.

## Save

Click **Schedule Trip**. You are redirected to the Trips list with a success message.

## After Scheduling

From the trip detail page you can:
- View the current booking manifest
- Add bookings directly from the trip
- Export the manifest as PDF or CSV
- Cancel the trip if needed

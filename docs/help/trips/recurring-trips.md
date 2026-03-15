---
title: "Recurring Trips"
category: "Trips"
tags: ["recurring", "schedule", "repeat", "weekly", "daily", "pattern"]
order: 2
---

# Recurring Trips

The recurring trip feature lets you schedule the same trip on multiple future dates in one go. This is useful for regular departures — for example, a Monday/Wednesday/Friday morning dive that runs throughout a season.

## Enable Recurring

When creating a new trip (go to **Trips** → **Schedule Trip**), scroll to the **Recurring Trip** section and toggle the switch to enable it.

## Repeat Pattern

Choose how often the trip repeats:

| Pattern | Description |
|---------|-------------|
| **Daily** | Creates a trip on every day from the start date |
| **Weekly** | Creates a trip on the same day of the week each week |
| **Biweekly** | Creates a trip every two weeks on the selected days |
| **Monthly** | Creates a trip on the same date each month |

## Day Selection (Weekly & Biweekly)

For **Weekly** and **Biweekly** patterns, you can select specific days of the week using the day-of-week buttons (Sun, Mon, Tue, Wed, Thu, Fri, Sat). Click a day to toggle it on or off. Selected days are highlighted.

If you don't select any days, DiveStreams uses the day of the week of your start date.

## End Conditions

Choose when the recurring series ends:

- **Never** — continues indefinitely until you stop it. No end limit is set in the database, but DiveStreams generates up to a year of trips at creation time.
- **On date** — set a specific end date. Trips are created up to and including this date.
- **After occurrences** — enter a number (e.g. 10). DiveStreams creates exactly that many trips.

## Preview Dates

Once you've set a pattern, start date, and end condition, DiveStreams shows a preview of the first 10 scheduled dates as chips below the settings. The first date is highlighted. This lets you verify the pattern before saving.

## Save

Click **Schedule Trip**. DiveStreams creates all the trips in one transaction. You are redirected to the Trips list.

> **Note:** Each trip in a recurring series is independent. Editing or cancelling one trip does not affect the others.

## Managing Individual Trips in a Series

After creation, each trip appears separately in the Trips list. You can:
- Edit an individual trip's time, capacity, boat, or staff
- Cancel a specific date without affecting others
- Add bookings to specific dates

There is no "bulk edit recurring series" feature — changes must be made per-trip.

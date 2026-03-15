---
title: "Create a Tour"
category: "Tours"
tags: ["tour", "create", "template", "dive", "setup"]
order: 1
---

# Create a Tour

A **Tour** is a reusable template for a dive experience. You define the details once — name, type, price, capacity, inclusions — then schedule as many individual **Trips** as you need from it.

## Steps

1. Go to **Tours** in the sidebar.
2. Click **New Tour** in the top right.

### Basic Info

| Field | Required | Notes |
|-------|----------|-------|
| Tour Name | Yes | Appears on public booking page and customer emails |
| Description | No | Shown on public site; markdown not supported |
| Tour Type | Yes | See [Tour Types](./tour-types.md) |
| Duration (minutes) | No | Default 120; used to auto-calculate end time on trips |

### Pricing & Capacity

| Field | Required | Notes |
|-------|----------|-------|
| Price | Yes | Per-person price; minimum $1 |
| Currency | No | Default USD; options: USD, EUR, GBP, AUD, THB, IDR, MXN |
| Max Participants | Yes | Maximum divers per trip; default 8 |
| Min Participants | No | Minimum needed for the trip to run; default 1 |

### What's Included

Check any items that are included in the tour price:
- **Equipment Rental** — BCDs, regulators, wetsuits, etc.
- **Meals/Snacks** — food and beverages
- **Transport** — hotel or port transfers

**Require tank & gas selection** — if checked, anyone creating a booking for a trip based on this tour must specify tank type and gas mix for each diver. See [Tank & Gas Selection](../bookings/tank-gas-selection.md).

**Additional Inclusions** — a comma-separated list of other included items (e.g. "Dive briefing, Snorkelling gear, Towel").

**Exclusions** — comma-separated list of things not included (e.g. "Wetsuit, Hotel transfer").

### Requirements

| Field | Notes |
|-------|-------|
| Minimum Certification | Options: None, Open Water, Advanced Open Water, Rescue Diver, Divemaster |
| Minimum Age | Enter a number; leave blank for no age restriction |
| Other Requirements | Comma-separated list (e.g. "Medical form required, Proof of certification") |

### Images

Upload up to 5 images (JPEG, PNG, WebP, or GIF; max 10 MB each). Images are converted to WebP and a thumbnail is generated automatically. The first image is marked as primary.

You can also add or replace images after creation from the tour detail page using the image manager.

### Status

- **Active** — the tour can be scheduled into trips. Uncheck to archive a tour without deleting it.

## Save

Click **Create Tour**. You are redirected to the tour detail page with a success message.

## Plan Limits

Depending on your plan, there may be a monthly limit on how many tours you can create. A warning banner appears when you are close to the limit. Upgrade from **Settings** → **Billing & Subscription**.

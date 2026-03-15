---
title: "Tank Setup"
category: "Equipment"
tags: ["tank", "gas", "tank type", "nitrox", "air", "setup", "booking"]
order: 4
---

# Tank Setup

DiveStreams has two distinct tank-related features:

1. **Equipment records for tank cylinders** — physical cylinders in your inventory (tracked like any other equipment)
2. **Tank Types for booking selection** — abstract types (e.g. "12L Steel") that divers select when booking a trip that requires tank/gas pre-selection

This article covers Tank Types. For physical tanks as inventory, see [Add Equipment](./add-equipment.md).

## What Are Tank Types?

Tank Types define the categories of tanks your shop offers for selection during booking. When a tour has **Require tank & gas selection** enabled, customers or staff must choose a tank type for each diver. Examples:
- 12L Steel
- 15L Aluminium
- 10L Aluminium
- Twinset

## Where Tank Types Are Managed

Tank Types are managed from your **Equipment** section or from the settings that govern how tank selection appears in bookings. Check **Equipment** → **Tank Types** in your sidebar, or look for the Tank Types section within the Equipment settings.

## How Tank Types Appear in Bookings

When creating a booking for a trip that requires tank selection:
1. The **Tank & Gas Selection** section shows one panel per participant.
2. Each panel has a **Tank Type** dropdown populated with your configured tank types.
3. Staff (or the customer online) selects the type and the gas fill (Air, Nitrox 32%, etc.).

## Adding a Tank Type

1. Go to **Equipment** in the sidebar.
2. Look for **Tank Types** or the tank setup section.
3. Click **Add Tank Type**.
4. Enter a name (e.g. "12L Steel Cylinder").
5. Save.

Tank types you create immediately become available in the booking tank selection dropdowns.

## Gas Types for Tank Selection

Gas types are predefined and not configurable:

| Gas Type | Description |
|----------|-------------|
| Air | Standard compressed air, 21% O2 |
| Nitrox 32% | Enriched air nitrox, EAN32 |
| Nitrox 36% | Enriched air nitrox, EAN36 |
| Trimix | Helium/oxygen/nitrogen blend |
| Oxygen | Pure oxygen for technical use |

## Physical Tanks in Equipment Inventory

Physical tank cylinders should also be added as equipment records with category **Tank**. Each physical tank record has a **Gas Type** field indicating its current fill. Use service dates to track valve and cylinder inspections.

Physical tank records and Tank Types are independent — both are needed if you want full coverage (one for inventory tracking, the other for booking pre-selection).

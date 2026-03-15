---
title: "Add Equipment"
category: "Equipment"
tags: ["equipment", "add", "BCD", "regulator", "wetsuit", "tank", "inventory"]
order: 1
---

# Add Equipment

Equipment records track the physical gear your shop owns. Each record represents one physical unit — if you have 10 wetsuits, you create 10 individual equipment records (or use the duplicate feature to speed this up).

## Steps

1. Go to **Equipment** in the sidebar.
2. Click **Add Equipment** in the top right.

### Basic Info

| Field | Required | Notes |
|-------|----------|-------|
| Category | Yes | See [Equipment Categories](./equipment-categories.md) |
| Item Name | Yes | e.g. "Wetsuit 5mm" or "BCD - Scubapro Hydros Pro" |
| Brand | No | e.g. "Scubapro", "Mares" |
| Model | No | e.g. "Hydros Pro", "Instinct" |
| Serial Number | No | For tracking individual units |
| Barcode | No | EAN-13, UPC, or any barcode format |
| Size | No | XS, S, M, L, XL, XXL |
| Gas Type | No | Tanks only — Air, Nitrox 32%, Nitrox 36%, Trimix, Oxygen |

### Scanning a Barcode

Click the barcode scanner icon next to the **Barcode** field to open the camera-based barcode scanner. Point your device's camera at the barcode and DiveStreams reads it automatically. Alternatively, if you have a USB HID barcode scanner connected, just scan while the barcode field is focused.

### Status & Condition

| Field | Options |
|-------|---------|
| Status | Available, Rented, In Maintenance, Retired |
| Condition | Excellent, Good, Fair, Poor |

Set the initial status to **Available** for new equipment.

### Rental Information

- **Available for Rental** — check to include this item in rental bookings and the POS.
- **Rental Price Per Day** — required if the item is rentable; e.g. `15.00`.
- If no rental price is set, the item will not appear in the POS rental tab even if "Available for Rental" is checked.

### Service Information

- **Last Service Date** — when the equipment was last serviced
- **Next Service Due** — schedule the next service date
- **Service Notes** — any notes from the last service

### Purchase Information

- **Purchase Date** — when you bought the item
- **Purchase Price** — original cost (for asset tracking)

### Additional Notes

Any other information about the item.

**Show on Public Site** — if checked, this equipment item appears in the equipment rental section of your public booking page.

## Save

Click **Add Equipment**. You are redirected to the equipment detail page where you can add images.

## Duplicate an Item

To quickly add multiple identical items (e.g. 6 identical wetsuits):

1. Create the first item completely.
2. On the equipment detail page, click **Duplicate**.
3. A new form opens pre-filled with the same details — just change the serial number if needed.
4. Click **Add Equipment**.

Repeat as needed.

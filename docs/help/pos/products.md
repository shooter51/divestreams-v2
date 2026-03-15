---
title: "POS Products"
category: "Point of Sale"
tags: ["pos", "products", "retail", "inventory", "catalog", "SKU"]
order: 4
---

# POS Products

**Products** are retail items you sell through the POS — masks, fins, wetsuits, merchandise, or anything else. You can track inventory and set low-stock alerts.

## Add a Product

1. Go to **Point of Sale** in the sidebar.
2. Click **Products** in the POS sub-navigation.
3. Click **New Product** in the top right.

### Basic Info

| Field | Required | Notes |
|-------|----------|-------|
| Product Name | Yes | e.g. "PADI Open Water Manual", "Scubapro Mask" |
| Category | Yes | Equipment, Apparel, Accessories, Courses, Rental |
| SKU | No | Your internal stock-keeping unit reference |
| Description | No | Optional description shown in the product listing |

### Pricing

| Field | Required | Notes |
|-------|----------|-------|
| Price | Yes | Selling price (can be $0.00) |
| Cost Price | No | Your cost — used to calculate margin reports |
| Tax Rate | No | Per-product tax rate %; defaults to 8% if left as-is |

### Inventory

- **Track Inventory** — checked by default. When enabled, the POS decrements stock on each sale.
- **Initial Stock** — quantity on hand when the product is created.
- **Low Stock Alert** — when stock falls to this level, the product card shows a low-stock warning. Default is 5 units.

If you uncheck **Track Inventory**, the product is treated as always available with no stock limit.

### Images (Optional)

Upload up to 5 product images (JPEG, PNG, WebP, or GIF, max 10 MB each). Images are converted to WebP and stored in cloud storage. The first image becomes the thumbnail shown in the POS product grid.

## Save

Click **Create Product**. The product appears in the **Retail** tab of the POS immediately.

## Editing a Product

Go to **POS** → **Products**, find the product, and click it to open its detail page. Click **Edit** to update any field including price, stock level, or images.

## Product Categories

| Category | Typical use |
|----------|-------------|
| Equipment | Masks, fins, BCDs, regulators |
| Apparel | Wetsuits, rashguards, dive shirts |
| Accessories | Lights, cameras, SMBs, bags |
| Courses | Course manuals, eLearning codes |
| Rental | Items also available for hire (use Equipment module for tracked rental gear) |

## Barcode Scanning

To scan a product at the POS using a USB barcode scanner, you must first assign a barcode to the product. Open the product detail page, click **Edit**, and enter the barcode value in the **Barcode** field, then save.

> **Tip:** For equipment you also rent out, create the item in the **Equipment** module with **Is Rentable** checked. That item will appear in the **Rentals** tab of the POS rather than the Retail tab.

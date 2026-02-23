import type { SeedClient } from "../client";

interface ProductSpec {
  name: string;
  category: string;
  price: number;
  sku: string;
  description: string;
  costPrice?: number;
  taxRate?: number;
  trackInventory: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
}

const PRODUCTS: ProductSpec[] = [
  // Equipment rentals
  { name: "BCD Rental", category: "rental", price: 25, sku: "RNT-BCD-001", description: "Full day BCD rental for certified divers", costPrice: 5, taxRate: 8, trackInventory: false },
  { name: "Regulator Rental", category: "rental", price: 20, sku: "RNT-REG-001", description: "Full day regulator rental with octopus and gauges", costPrice: 4, taxRate: 8, trackInventory: false },
  { name: "Wetsuit Rental", category: "rental", price: 15, sku: "RNT-WET-001", description: "Full day wetsuit rental (3mm or 5mm)", costPrice: 3, taxRate: 8, trackInventory: false },
  { name: "Mask & Fins Rental", category: "rental", price: 10, sku: "RNT-MF-001", description: "Full day mask and fins rental set", costPrice: 2, taxRate: 8, trackInventory: false },
  { name: "Dive Computer Rental", category: "rental", price: 30, sku: "RNT-CMP-001", description: "Full day dive computer rental with wrist mount", costPrice: 6, taxRate: 8, trackInventory: false },
  { name: "Full Gear Package", category: "rental", price: 75, sku: "RNT-PKG-001", description: "Complete rental package: BCD, regulator, wetsuit, mask, fins, and computer", costPrice: 15, taxRate: 8, trackInventory: false },

  // Merchandise
  { name: "DiveStreams T-Shirt", category: "apparel", price: 25, sku: "APP-TSH-001", description: "Cotton t-shirt with DiveStreams logo", costPrice: 8, taxRate: 8, trackInventory: true, stockQuantity: 50, lowStockThreshold: 10 },
  { name: "DiveStreams Cap", category: "apparel", price: 20, sku: "APP-CAP-001", description: "Adjustable baseball cap with embroidered logo", costPrice: 6, taxRate: 8, trackInventory: true, stockQuantity: 30, lowStockThreshold: 5 },
  { name: "Dive Bag", category: "accessories", price: 45, sku: "ACC-BAG-001", description: "Mesh dive bag for carrying gear to and from the boat", costPrice: 18, taxRate: 8, trackInventory: true, stockQuantity: 20, lowStockThreshold: 5 },
  { name: "Underwater Camera Housing", category: "accessories", price: 85, sku: "ACC-CAM-001", description: "Waterproof housing for GoPro-style action cameras, rated to 40m", costPrice: 40, taxRate: 8, trackInventory: true, stockQuantity: 10, lowStockThreshold: 3 },

  // Consumables
  { name: "Nitrox Fill", category: "equipment", price: 15, sku: "CON-NTX-001", description: "Enriched air nitrox fill (32% O2)", costPrice: 5, taxRate: 0, trackInventory: false },
  { name: "Air Fill", category: "equipment", price: 8, sku: "CON-AIR-001", description: "Standard air tank fill", costPrice: 2, taxRate: 0, trackInventory: false },
  { name: "Reef-Safe Sunscreen", category: "accessories", price: 12, sku: "CON-SUN-001", description: "Biodegradable reef-safe SPF 50 sunscreen", costPrice: 4, taxRate: 8, trackInventory: true, stockQuantity: 40, lowStockThreshold: 10 },
  { name: "Defog Solution", category: "accessories", price: 5, sku: "CON-DEF-001", description: "Anti-fog solution for dive masks", costPrice: 1.5, taxRate: 8, trackInventory: true, stockQuantity: 60, lowStockThreshold: 15 },

  // Course materials
  { name: "PADI Open Water Manual", category: "courses", price: 35, sku: "CRS-OW-001", description: "Official PADI Open Water Diver manual with RDP table", costPrice: 20, taxRate: 0, trackInventory: true, stockQuantity: 25, lowStockThreshold: 5 },
  { name: "Log Book", category: "courses", price: 15, sku: "CRS-LOG-001", description: "Professional dive log book with 100 dive entries", costPrice: 5, taxRate: 0, trackInventory: true, stockQuantity: 30, lowStockThreshold: 5 },
];

export async function seedProducts(client: SeedClient): Promise<void> {
  console.log("Seeding POS products...");
  let created = 0;

  for (const spec of PRODUCTS) {
    const csrf = await client.getCsrfToken();
    const formData = new FormData();
    formData.set("_csrf", csrf);
    formData.set("name", spec.name);
    formData.set("category", spec.category);
    formData.set("price", String(spec.price));
    formData.set("sku", spec.sku);
    formData.set("description", spec.description);
    if (spec.costPrice !== undefined) {
      formData.set("costPrice", String(spec.costPrice));
    }
    if (spec.taxRate !== undefined) {
      formData.set("taxRate", String(spec.taxRate));
    }
    if (spec.trackInventory) {
      formData.set("trackInventory", "on");
    }
    if (spec.stockQuantity !== undefined) {
      formData.set("stockQuantity", String(spec.stockQuantity));
    }
    if (spec.lowStockThreshold !== undefined) {
      formData.set("lowStockThreshold", String(spec.lowStockThreshold));
    }

    const result = await client.post("/tenant/pos/products/new", formData);

    if (result.ok || result.status === 302) {
      created++;
      console.log(`  Created product: "${spec.name}"`);
    } else {
      console.warn(`  Warning: product "${spec.name}" returned status ${result.status}`);
    }

    await client.sleep(50);
  }

  console.log(`POS products seeded: ${created}/${PRODUCTS.length}`);
}

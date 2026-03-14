import type { SeedClient } from "../client";
import { uploadImage, randomPhoto } from "../images";

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
  { name: "Full Gear Rental Package", category: "rental", price: 89, sku: "RNT-FULL-001", description: "BCD, regulator, wetsuit, mask, fins, computer, and weights for the day", costPrice: 18, taxRate: 9.5, trackInventory: false },
  { name: "BCD Rental", category: "rental", price: 30, sku: "RNT-BCD-001", description: "Scubapro Hydros Pro or Aqualung Axiom i3 for the day", costPrice: 6, taxRate: 9.5, trackInventory: false },
  { name: "Regulator Rental", category: "rental", price: 25, sku: "RNT-REG-001", description: "Aqualung Leg3nd or Scubapro MK25 reg set with octopus and SPG", costPrice: 5, taxRate: 9.5, trackInventory: false },
  { name: "Wetsuit Rental", category: "rental", price: 20, sku: "RNT-WET-001", description: "5mm or 7mm wetsuit for SoCal water temperatures", costPrice: 4, taxRate: 9.5, trackInventory: false },
  { name: "Dive Computer Rental", category: "rental", price: 35, sku: "RNT-CMP-001", description: "Shearwater Peregrine TX or Garmin Descent Mk3", costPrice: 7, taxRate: 9.5, trackInventory: false },
  { name: "Dive Light Rental", category: "rental", price: 18, sku: "RNT-LGT-001", description: "Light & Motion Sola 2500 primary dive light", costPrice: 4, taxRate: 9.5, trackInventory: false },
  { name: "GoPro Hero 12 Rental", category: "rental", price: 45, sku: "RNT-CAM-001", description: "GoPro Hero 12 with underwater housing, SD card, and float mount", costPrice: 10, taxRate: 9.5, trackInventory: false },
  { name: "Dry Suit Rental", category: "rental", price: 50, sku: "RNT-DRY-001", description: "Bare or DUI dry suit rental — winter diving essential", costPrice: 12, taxRate: 9.5, trackInventory: false },

  // Tank fills & gas
  { name: "Air Fill", category: "equipment", price: 10, sku: "GAS-AIR-001", description: "Standard compressed air fill to 3000 PSI", costPrice: 3, taxRate: 0, trackInventory: false },
  { name: "Nitrox Fill (32%)", category: "equipment", price: 18, sku: "GAS-NX32-001", description: "Enriched Air Nitrox fill (32% O2) — nitrox cert required", costPrice: 6, taxRate: 0, trackInventory: false },
  { name: "Nitrox Fill (36%)", category: "equipment", price: 22, sku: "GAS-NX36-001", description: "Custom Nitrox blend (36% O2) — nitrox cert required", costPrice: 8, taxRate: 0, trackInventory: false },

  // Branded merchandise
  { name: "The Dive Shop LA T-Shirt", category: "apparel", price: 28, sku: "APP-TSH-001", description: "Organic cotton tee with kelp forest logo design. Unisex fit.", costPrice: 9, taxRate: 9.5, trackInventory: true, stockQuantity: 60, lowStockThreshold: 12 },
  { name: "The Dive Shop LA Hoodie", category: "apparel", price: 55, sku: "APP-HOD-001", description: "Heavyweight fleece hoodie — perfect for post-dive warmth at King Harbor", costPrice: 22, taxRate: 9.5, trackInventory: true, stockQuantity: 30, lowStockThreshold: 8 },
  { name: "The Dive Shop LA Cap", category: "apparel", price: 24, sku: "APP-CAP-001", description: "Adjustable performance cap with embroidered garibaldi logo", costPrice: 7, taxRate: 9.5, trackInventory: true, stockQuantity: 40, lowStockThreshold: 10 },
  { name: "Reef Guardian Sticker Pack", category: "accessories", price: 8, sku: "ACC-STK-001", description: "5 ocean conservation stickers — waterproof vinyl", costPrice: 2, taxRate: 9.5, trackInventory: true, stockQuantity: 100, lowStockThreshold: 20 },

  // Consumables & accessories
  { name: "Reef-Safe Sunscreen SPF 50", category: "accessories", price: 14, sku: "CON-SUN-001", description: "Mineral-based reef-safe sunscreen — required on our boats", costPrice: 5, taxRate: 9.5, trackInventory: true, stockQuantity: 50, lowStockThreshold: 12 },
  { name: "Mask Defog Solution", category: "accessories", price: 6, sku: "CON-DEF-001", description: "Stream2Sea biodegradable mask defog", costPrice: 2, taxRate: 9.5, trackInventory: true, stockQuantity: 80, lowStockThreshold: 20 },
  { name: "Dive Mesh Bag", category: "accessories", price: 35, sku: "ACC-BAG-001", description: "Large mesh gear bag with shoulder strap", costPrice: 14, taxRate: 9.5, trackInventory: true, stockQuantity: 20, lowStockThreshold: 5 },

  // Course materials
  { name: "PADI Open Water Manual + eRDPml", category: "courses", price: 45, sku: "CRS-OW-001", description: "Official PADI Open Water Diver manual with eRDPml dive planner", costPrice: 25, taxRate: 0, trackInventory: true, stockQuantity: 20, lowStockThreshold: 5 },
  { name: "Professional Dive Log Book", category: "courses", price: 18, sku: "CRS-LOG-001", description: "The Dive Shop LA branded log book — 200 dive entries", costPrice: 6, taxRate: 0, trackInventory: true, stockQuantity: 30, lowStockThreshold: 8 },
];

export async function seedTdslaProducts(client: SeedClient): Promise<void> {
  console.log("Seeding TDSLA POS products...");
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
    if (spec.costPrice !== undefined) formData.set("costPrice", String(spec.costPrice));
    if (spec.taxRate !== undefined) formData.set("taxRate", String(spec.taxRate));
    if (spec.trackInventory) formData.set("trackInventory", "on");
    if (spec.stockQuantity !== undefined) formData.set("stockQuantity", String(spec.stockQuantity));
    if (spec.lowStockThreshold !== undefined) formData.set("lowStockThreshold", String(spec.lowStockThreshold));

    const result = await client.post("/tenant/pos/products/new", formData);
    if (result.ok || result.status === 302) {
      created++;
      console.log(`  Created product: "${spec.name}"`);

      // Extract product ID and upload an image
      const id = result.location
        ? client.extractId(result.location, "/tenant/pos/products/")
        : null;
      if (id) {
        const photo = randomPhoto("equipment");
        const alt = spec.name;
        const img = await uploadImage(client, "product", id, photo, alt);
        if (img) console.log(`    📷 Image uploaded`);
        await client.sleep(200);
      }
    } else {
      console.warn(`  Warning: product "${spec.name}" returned ${result.status}`);
    }
    await client.sleep(30);
  }

  console.log(`  TDSLA products seeded: ${created}/${PRODUCTS.length}`);
}

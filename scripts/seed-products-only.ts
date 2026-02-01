/**
 * Seed ONLY products for demo tenant (bypass customer check)
 * Use this when products are missing but other demo data exists
 */

import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { organization } from "../lib/db/schema/auth";

const DEMO_IMAGES = {
  products: [
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400", // Dive gear
    "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400", // T-shirt
    "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400", // Accessories
  ],
};

async function main() {
  const subdomain = process.argv[2] || "demo";
  console.log(`Seeding products for organization: ${subdomain}`);

  try {
    // Get the organization ID from the subdomain
    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, subdomain))
      .limit(1);

    if (!org) {
      throw new Error(`Organization with subdomain '${subdomain}' not found`);
    }

    console.log(`Found organization ID: ${org.id}`);

    // Check if products already exist
    const [existingProduct] = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.organizationId, org.id))
      .limit(1);

    if (existingProduct) {
      console.log(`⚠️  Products already exist for organization ${org.id}`);
      console.log(`   To re-seed, first delete existing products or use a different organization`);
      process.exit(0);
    }

    const products = [
      {
        name: "BCD - Buoyancy Control Device",
        sku: "BCD-001",
        category: "equipment",
        description: "Professional dive BCD with integrated weight system",
        price: 449.99,
        costPrice: 275.00,
        stockQuantity: 15,
        imageUrl: DEMO_IMAGES.products[0],
      },
      {
        name: "DiveStreams T-Shirt",
        sku: "APPAREL-001",
        category: "apparel",
        description: "Comfortable cotton t-shirt with DiveStreams logo",
        price: 24.99,
        costPrice: 8.00,
        stockQuantity: 100,
        imageUrl: DEMO_IMAGES.products[1],
      },
      {
        name: "Dive Log Book",
        sku: "ACC-001",
        category: "accessories",
        description: "Professional dive log book - 100 dives",
        price: 19.99,
        costPrice: 6.50,
        stockQuantity: 50,
        imageUrl: DEMO_IMAGES.products[2],
      },
      {
        name: "Mask & Snorkel Set",
        sku: "EQ-002",
        category: "equipment",
        description: "High-quality mask and snorkel combo",
        price: 79.99,
        costPrice: 35.00,
        stockQuantity: 25,
        imageUrl: DEMO_IMAGES.products[2],
      },
      {
        name: "Dive Fins - Open Heel",
        sku: "EQ-003",
        category: "equipment",
        description: "Adjustable open-heel fins for all levels",
        price: 89.99,
        costPrice: 42.00,
        stockQuantity: 20,
        imageUrl: DEMO_IMAGES.products[2],
      },
      {
        name: "Wetsuit 3mm",
        sku: "EQ-004",
        category: "equipment",
        description: "Full-body 3mm wetsuit",
        price: 199.99,
        costPrice: 95.00,
        stockQuantity: 12,
        imageUrl: DEMO_IMAGES.products[0],
      },
      {
        name: "Dive Computer - Entry Level",
        sku: "EQ-005",
        category: "equipment",
        description: "Easy-to-use dive computer with air integration",
        price: 299.99,
        costPrice: 175.00,
        stockQuantity: 8,
        imageUrl: DEMO_IMAGES.products[0],
      },
      {
        name: "Waterproof Camera",
        sku: "ACC-002",
        category: "accessories",
        description: "Capture your underwater adventures",
        price: 149.99,
        costPrice: 70.00,
        stockQuantity: 10,
        imageUrl: DEMO_IMAGES.products[2],
      },
      {
        name: "Reef-Safe Sunscreen",
        sku: "ACC-003",
        category: "accessories",
        description: "Eco-friendly sunscreen for divers",
        price: 12.99,
        costPrice: 4.50,
        stockQuantity: 75,
        imageUrl: DEMO_IMAGES.products[2],
      },
      {
        name: "DiveStreams Hat",
        sku: "APPAREL-002",
        category: "apparel",
        description: "Adjustable cap with embroidered logo",
        price: 19.99,
        costPrice: 6.00,
        stockQuantity: 60,
        imageUrl: DEMO_IMAGES.products[1],
      },
    ];

    console.log(`Inserting ${products.length} products...`);

    for (const product of products) {
      await db
        .insert(schema.products)
        .values({
          organizationId: org.id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          description: product.description || null,
          price: product.price,
          costPrice: product.costPrice || null,
          stockQuantity: product.stockQuantity || 0,
          imageUrl: product.imageUrl || null,
          trackInventory: true,
          isActive: true,
        });
      console.log(`  ✓ ${product.name}`);
    }

    console.log(`\n✅ Successfully seeded ${products.length} products!`);
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed products:", error);
    process.exit(1);
  }
}

main();

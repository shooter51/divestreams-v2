/**
 * Seed Images Script
 *
 * Inserts Unsplash demo image URLs into the `images` table for existing
 * tours, boats, dive sites, and products that have no images yet.
 *
 * Usage: npm run seed:images -- <subdomain>
 * Default subdomain: demo
 */

import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import { organization } from "../lib/db/schema/auth";
import { eq, and, inArray } from "drizzle-orm";

// Unsplash image pools per entity type (cycling for entities without specific assignment)
const DIVE_SITE_IMAGES = [
  "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200",
  "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=1200",
  "https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=1200",
  "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=1200",
  "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=1200",
  "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=1200",
  "https://images.unsplash.com/photo-1580019542155-247062e19ce4?w=1200",
  "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=1200",
  "https://images.unsplash.com/photo-1560275619-4662e36fa65c?w=1200",
  "https://images.unsplash.com/photo-1596414086775-0e7a7e6d381c?w=1200",
];

const BOAT_IMAGES = [
  "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=1200",
  "https://images.unsplash.com/photo-1544551763-92ab472cad5d?w=1200",
  "https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=1200",
  "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200",
];

const TOUR_IMAGES = [
  "https://images.unsplash.com/photo-1544551763-8dd44758c2dd?w=1200",
  "https://images.unsplash.com/photo-1682687982501-1e58ab814714?w=1200",
  "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200",
  "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=1200",
  "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=1200",
  "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=1200",
  "https://images.unsplash.com/photo-1580019542155-247062e19ce4?w=1200",
];

const PRODUCT_IMAGES = [
  "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200",
  "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=1200",
  "https://images.unsplash.com/photo-1583531172005-814785a25a02?w=1200",
  "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200",
  "https://images.unsplash.com/photo-1560275619-4662e36fa65c?w=1200",
  "https://images.unsplash.com/photo-1544551763-92ab472cad5d?w=1200",
  "https://images.unsplash.com/photo-1585155770005-76b2e4cf7c70?w=1200",
  "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=1200",
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200",
  "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1200",
];

async function insertImages(
  organizationId: string,
  entityType: string,
  entityId: string,
  imageUrls: string[],
  entityName: string
) {
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    await db.insert(schema.images).values({
      organizationId,
      entityType,
      entityId,
      url,
      thumbnailUrl: url.replace("w=1200", "w=200"),
      filename: `${entityType}-${entityName.toLowerCase().replace(/\s+/g, "-")}-${i + 1}.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: 150000 + Math.floor(Math.random() * 100000),
      width: 1200,
      height: 800,
      alt: `${entityName} image`,
      sortOrder: i,
      isPrimary: i === 0,
    });
  }
}

async function main() {
  const subdomain = process.argv[2] || "demo";
  console.log(`Seeding images for organization: ${subdomain}`);

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, subdomain))
    .limit(1);

  if (!org) {
    throw new Error(`Organization with subdomain '${subdomain}' not found`);
  }

  const organizationId = org.id;
  console.log(`Found organization ID: ${organizationId}`);

  // Find entities that already have images
  const existingImages = await db
    .select({ entityType: schema.images.entityType, entityId: schema.images.entityId })
    .from(schema.images)
    .where(eq(schema.images.organizationId, organizationId));

  const alreadyHasImage = new Set(existingImages.map((i) => `${i.entityType}:${i.entityId}`));

  let inserted = 0;
  let skipped = 0;

  // === Dive Sites ===
  const diveSites = await db
    .select({ id: schema.diveSites.id, name: schema.diveSites.name })
    .from(schema.diveSites)
    .where(eq(schema.diveSites.organizationId, organizationId));

  for (let i = 0; i < diveSites.length; i++) {
    const site = diveSites[i];
    if (alreadyHasImage.has(`dive-site:${site.id}`)) {
      skipped++;
      continue;
    }
    // Pick 2 images per site, cycling through pool
    const urls = [
      DIVE_SITE_IMAGES[i * 2 % DIVE_SITE_IMAGES.length],
      DIVE_SITE_IMAGES[(i * 2 + 1) % DIVE_SITE_IMAGES.length],
    ];
    await insertImages(organizationId, "dive-site", site.id, urls, site.name);
    console.log(`  ✓ Dive site: ${site.name} (${urls.length} images)`);
    inserted += urls.length;
  }

  // === Boats ===
  const boats = await db
    .select({ id: schema.boats.id, name: schema.boats.name })
    .from(schema.boats)
    .where(eq(schema.boats.organizationId, organizationId));

  for (let i = 0; i < boats.length; i++) {
    const boat = boats[i];
    if (alreadyHasImage.has(`boat:${boat.id}`)) {
      skipped++;
      continue;
    }
    const urls = [BOAT_IMAGES[i % BOAT_IMAGES.length]];
    await insertImages(organizationId, "boat", boat.id, urls, boat.name);
    console.log(`  ✓ Boat: ${boat.name} (${urls.length} images)`);
    inserted += urls.length;
  }

  // === Tours ===
  const tours = await db
    .select({ id: schema.tours.id, name: schema.tours.name })
    .from(schema.tours)
    .where(eq(schema.tours.organizationId, organizationId));

  for (let i = 0; i < tours.length; i++) {
    const tour = tours[i];
    if (alreadyHasImage.has(`tour:${tour.id}`)) {
      skipped++;
      continue;
    }
    const urls = [
      TOUR_IMAGES[i * 2 % TOUR_IMAGES.length],
      TOUR_IMAGES[(i * 2 + 1) % TOUR_IMAGES.length],
    ];
    await insertImages(organizationId, "tour", tour.id, urls, tour.name);
    console.log(`  ✓ Tour: ${tour.name} (${urls.length} images)`);
    inserted += urls.length;
  }

  // === Products ===
  const products = await db
    .select({ id: schema.products.id, name: schema.products.name })
    .from(schema.products)
    .where(eq(schema.products.organizationId, organizationId));

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    if (alreadyHasImage.has(`product:${product.id}`)) {
      skipped++;
      continue;
    }
    const urls = [PRODUCT_IMAGES[i % PRODUCT_IMAGES.length]];
    await insertImages(organizationId, "product", product.id, urls, product.name);
    console.log(`  ✓ Product: ${product.name} (${urls.length} images)`);
    inserted += urls.length;
  }

  console.log(`\nDone! Inserted ${inserted} images, skipped ${skipped} entities that already had images.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});

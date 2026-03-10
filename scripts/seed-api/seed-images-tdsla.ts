#!/usr/bin/env tsx
/**
 * Upload images to all entities on the tdsla tenant.
 * Scrapes entity IDs from the live site, then uploads Unsplash photos.
 *
 * Usage:
 *   SEED_EMAIL=demo@divestreams.com SEED_PASSWORD=DiveShopLA2024 \
 *     npx tsx scripts/seed-api/seed-images-tdsla.ts
 */
import { SeedClient, sleep } from "./client";
import { login } from "./auth";
import { uploadImage } from "./images";
import "dotenv/config";

const BASE_URL = process.argv.find(a => a.startsWith("--url="))?.split("=")[1]
  || "https://tdsla.test.divestreams.com";

// ── Photo assignments ────────────────────────────────────────────────────

// Boats (3) — by order on list page
const BOAT_IMAGES = [
  { alt: "Kelp Dancer — 32ft center console dive boat at dock", photoId: "1568476612160-787b6a1d5fb1" },
  { alt: "Sea Wolf — Newton 42 dive boat underway", photoId: "1575859981201-1b771392ecf6" },
  { alt: "Channel Explorer — 90ft liveaboard expedition vessel", photoId: "1707172101661-cbd642c1fb4e" },
];

// Dive sites (10) — by order on list page
const DIVE_SITE_IMAGES = [
  { alt: "Kelp forest at Casino Point with garibaldi", photoId: "1745909123989-92cee1d0aaf5" },
  { alt: "Deep blue water at Farnsworth Bank", photoId: "1753190514766-633829088a07" },
  { alt: "Colorful reef at Italian Gardens, Catalina", photoId: "1708649290066-5f617003b93f" },
  { alt: "Swim-through at Cathedral Cove, Anacapa", photoId: "1682687982167-d7fb3ed8541d" },
  { alt: "Kelp forest at Scorpion Anchorage, Santa Cruz", photoId: "1745917784526-fbad88531db1" },
  { alt: "Open ocean at Pyramid Head, San Clemente", photoId: "1753190514766-633829088a07" },
  { alt: "Oil Rig Eureka at sunset", photoId: "1727461553668-45322401f863" },
  { alt: "Diver in the Palos Verdes kelp forest", photoId: "1745909835285-60fbf48fcf26" },
  { alt: "Deep blue water at Begg Rock", photoId: "1753190514766-633829088a07" },
  { alt: "Sea lion colony at Sutil Island", photoId: "1580193367026-4be12a314a96" },
];

// Tours (11) — by order on list page
const TOUR_IMAGES = [
  { alt: "Sunlight filtering through kelp canopy", photoId: "1745917784526-fbad88531db1" },
  { alt: "Oil rig platform rising from the Pacific", photoId: "1727461553668-45322401f863" },
  { alt: "Catalina Island rocky coastline", photoId: "1657665369393-81a1e4b63f41" },
  { alt: "Kelp forest with marine life at Catalina", photoId: "1745909123989-92cee1d0aaf5" },
  { alt: "Deep blue water at Farnsworth Bank", photoId: "1753190514766-633829088a07" },
  { alt: "Underwater cave at Anacapa Island", photoId: "1682687982167-d7fb3ed8541d" },
  { alt: "Divers entering the ocean", photoId: "1646947009718-1cb77aaa2a6d" },
  { alt: "Reef life at Casino Point after dark", photoId: "1708649290066-5f617003b93f" },
  { alt: "Rocky island pinnacle in the Channel Islands", photoId: "1655110126842-d71113df750e" },
  { alt: "Channel Islands panoramic view", photoId: "1748102289607-4e1270e4da65" },
  { alt: "Sea lion on the rocks at San Nicolas", photoId: "1580193367026-4be12a314a96" },
];

// Courses (18) — matched by name prefix
const COURSE_IMAGES: Record<string, { photoId: string; alt: string }> = {
  // SSI recreational
  "SSI Try Scuba": { photoId: "1502209524164-acea936639a2", alt: "Try Scuba — first breath underwater" },
  "SSI Open Water Diver": { photoId: "1586508577428-120d6b072945", alt: "Open Water Diver certification course" },
  "SSI Advanced Adventurer": { photoId: "1682687982167-d7fb3ed8541d", alt: "Advanced Adventurer exploring underwater cave" },
  "SSI Deep Diving": { photoId: "1742325989789-b42912a531dd", alt: "Deep diving in the blue" },
  "SSI Night Diving": { photoId: "1752407397058-87892850f77e", alt: "Night diving with underwater lights" },
  "SSI Navigation": { photoId: "1484507175567-a114f764f78b", alt: "Underwater navigation training" },
  "SSI Enriched Air Nitrox": { photoId: "1646947009718-1cb77aaa2a6d", alt: "Nitrox diving preparation" },
  "SSI Science of Diving": { photoId: "1516231845232-0cbd957d3594", alt: "Marine science and reef ecosystems" },
  // SSI professional
  "SSI Divemaster": { photoId: "1578403881636-6f4a77a6f9cc", alt: "Divemaster leading a group dive" },
  "SSI Dive Guide": { photoId: "1639501840591-9dbca7be82b2", alt: "Dive Guide in action" },
  // SDI recreational
  "SDI Open Water": { photoId: "1628630500614-1c8924c99c3e", alt: "SDI Open Water Scuba Diver course" },
  "SDI Advanced": { photoId: "1682686581663-179efad3cd2f", alt: "SDI Advanced Diver training" },
  "SDI Rescue": { photoId: "1496161341410-90ce6ad8b390", alt: "SDI Rescue Diver skills training" },
  // TDI technical
  "TDI Nitrox": { photoId: "1736943993933-c1a407ed783c", alt: "TDI Nitrox Diver certification" },
  "TDI Advanced Nitrox": { photoId: "1736943993933-c1a407ed783c", alt: "TDI Advanced Nitrox training" },
  "TDI Decompression": { photoId: "1758968611255-af2c6f31370a", alt: "TDI Deco Procedures — staged decompression" },
  "TDI Extended Range": { photoId: "1742325989789-b42912a531dd", alt: "TDI Extended Range deep diving" },
  "TDI Trimix": { photoId: "1742325989789-b42912a531dd", alt: "TDI Trimix — deep technical diving" },
};

// Equipment — one image per category (first item scraped per category)
// Using verified Unsplash photos showing actual dive gear in use
const EQUIPMENT_CATEGORY_IMAGE: Record<string, { photoId: string; alt: string }> = {
  "BCD": { photoId: "1639501840591-9dbca7be82b2", alt: "Diver wearing BCD underwater" },
  "Regulator": { photoId: "1578403881636-6f4a77a6f9cc", alt: "Diver breathing through regulator underwater" },
  "Wetsuit": { photoId: "1586508577428-120d6b072945", alt: "Diver in wetsuit swimming with school of fish" },
  "Shorty": { photoId: "1628630500614-1c8924c99c3e", alt: "Diver in wetsuit swimming in blue water" },
  "Mask": { photoId: "1524070600608-41d598325be8", alt: "Diver wearing dive mask underwater" },
  "Fins": { photoId: "1499242015907-fd91d5d02f13", alt: "Diver with fins swimming above reef" },
  "Boot": { photoId: "1496161341410-90ce6ad8b390", alt: "Diver in full gear underwater" },
  "Gloves": { photoId: "1484507175567-a114f764f78b", alt: "Diver in full gear with gloves" },
  "Hood": { photoId: "1727095388910-e09f14913505", alt: "Diver in full exposure protection" },
  "Dive Computer": { photoId: "1622299355484-f81b9f4fa5e8", alt: "Digital dive computer display" },
  "Primary Light": { photoId: "1682687982167-d7fb3ed8541d", alt: "Diver with primary light in underwater cave" },
  "Backup Light": { photoId: "1752407397058-87892850f77e", alt: "Underwater cave illuminated by dive light" },
  "SMB": { photoId: "1742325989789-b42912a531dd", alt: "Diver in deep blue with safety gear" },
  "Weight Belt": { photoId: "1736943993933-c1a407ed783c", alt: "Divers with weight systems in tunnel" },
  "GoPro Kit": { photoId: "1682686581663-179efad3cd2f", alt: "Diver photographing coral reef" },
  "AL80 Tank": { photoId: "1646947009718-1cb77aaa2a6d", alt: "Divers with AL80 tanks entering water" },
  "HP100 Steel": { photoId: "1736943993933-c1a407ed783c", alt: "Divers with steel tanks in formation" },
  "HP80 Steel": { photoId: "1742325989789-b42912a531dd", alt: "Diver with HP steel tank" },
  "AL40 Stage": { photoId: "1736943993933-c1a407ed783c", alt: "Tech diver with stage bottles" },
  "AL80 Doubles": { photoId: "1736943993933-c1a407ed783c", alt: "Tech diver with double tank set" },
  "Argon": { photoId: "1742325989789-b42912a531dd", alt: "Tech diver with argon bottle" },
};

// Products — match by product name prefix for equipment products (skip gas fills/services)
// Using category-specific verified Unsplash photos
const PRODUCT_IMAGES: Record<string, { photoId: string; alt: string }> = {
  // BCDs — diver with visible BCD
  "Aqua Lung Pro HD": { photoId: "1639501840591-9dbca7be82b2", alt: "Aqua Lung Pro HD BCD" },
  "ScubaPro Hydros Pro": { photoId: "1496161341410-90ce6ad8b390", alt: "ScubaPro Hydros Pro BCD" },
  "Cressi Start": { photoId: "1639501840591-9dbca7be82b2", alt: "Cressi Start BCD" },
  "ScubaPro Seahawk 2": { photoId: "1496161341410-90ce6ad8b390", alt: "ScubaPro Seahawk 2 BCD" },
  "Aqua Lung Rogue": { photoId: "1639501840591-9dbca7be82b2", alt: "Aqua Lung Rogue BCD" },
  "Apeks Black Ice": { photoId: "1496161341410-90ce6ad8b390", alt: "Apeks Black Ice BCD" },
  // Regulators — diver breathing underwater
  "Aqua Lung Core Supreme": { photoId: "1578403881636-6f4a77a6f9cc", alt: "Aqua Lung Core Supreme Regulator" },
  "ScubaPro MK25": { photoId: "1727095388910-e09f14913505", alt: "ScubaPro MK25 EVO Regulator" },
  "Cressi AC2": { photoId: "1578403881636-6f4a77a6f9cc", alt: "Cressi AC2 Regulator" },
  "Apeks XTX50": { photoId: "1727095388910-e09f14913505", alt: "Apeks XTX50 Regulator" },
  "Atomic Aquatics B2": { photoId: "1578403881636-6f4a77a6f9cc", alt: "Atomic Aquatics B2 Regulator" },
  "ScubaPro MK19": { photoId: "1727095388910-e09f14913505", alt: "ScubaPro MK19 EVO Regulator" },
  // Computers — sport watch close-ups
  "Shearwater Peregrine": { photoId: "1622299355484-f81b9f4fa5e8", alt: "Shearwater Peregrine Dive Computer" },
  "Shearwater Teric": { photoId: "1630452561204-b1198e5be60d", alt: "Shearwater Teric Dive Computer" },
  "Garmin Descent": { photoId: "1622299355484-f81b9f4fa5e8", alt: "Garmin Descent Mk3i Dive Computer" },
  "Suunto EON Core": { photoId: "1630452561204-b1198e5be60d", alt: "Suunto EON Core Dive Computer" },
  "Aqua Lung i330R": { photoId: "1622299355484-f81b9f4fa5e8", alt: "Aqua Lung i330R Dive Computer" },
  // Wetsuits — divers in wetsuits
  "O'Neill Epic 5/4": { photoId: "1586508577428-120d6b072945", alt: "O'Neill Epic 5/4mm Wetsuit" },
  "O'Neill Epic 3/2": { photoId: "1628630500614-1c8924c99c3e", alt: "O'Neill Epic 3/2mm Wetsuit" },
  "Fourth Element Proteus": { photoId: "1586508577428-120d6b072945", alt: "Fourth Element Proteus II Wetsuit" },
  "Henderson Thermoprene": { photoId: "1502209524164-acea936639a2", alt: "Henderson Thermoprene Pro 7mm" },
  "Bare Velocity": { photoId: "1628630500614-1c8924c99c3e", alt: "Bare Velocity Ultra 5mm Wetsuit" },
  "ScubaPro Everflex": { photoId: "1586508577428-120d6b072945", alt: "ScubaPro Everflex 3/2mm Wetsuit" },
  // Masks — close-up of diver with mask
  "ScubaPro Synergy": { photoId: "1524070600608-41d598325be8", alt: "ScubaPro Synergy 2 Twin Mask" },
  "Cressi Big Eyes": { photoId: "1562940922-02c838af3fdd", alt: "Cressi Big Eyes Evolution Mask" },
  "Atomic Aquatics Venom": { photoId: "1524070600608-41d598325be8", alt: "Atomic Aquatics Venom Frameless Mask" },
  "Tusa Paragon": { photoId: "1562940922-02c838af3fdd", alt: "Tusa Paragon S Mask" },
  "Aqua Lung Reveal": { photoId: "1524070600608-41d598325be8", alt: "Aqua Lung Reveal X2 Mask" },
  // Fins — diver with visible fins
  "ScubaPro Seawing": { photoId: "1499242015907-fd91d5d02f13", alt: "ScubaPro Seawing Gorilla Fins" },
  "Cressi Frog": { photoId: "1478759899771-fd5effc6f3be", alt: "Cressi Frog Plus Fins" },
  "Atomic Aquatics Split": { photoId: "1523801999971-dbb0cc4f400e", alt: "Atomic Aquatics SplitFins" },
  "Apeks RK3": { photoId: "1515459386663-33a27194bc2a", alt: "Apeks RK3 Fins" },
  "Hollis F1": { photoId: "1566356767553-e118792cae7f", alt: "Hollis F1 Fins" },
  // Lights — underwater cave/light scenes
  "Light & Motion Sola": { photoId: "1682687982167-d7fb3ed8541d", alt: "Light & Motion Sola Dive 2500" },
  "BigBlue AL1300": { photoId: "1752407397058-87892850f77e", alt: "BigBlue AL1300NP Dive Light" },
  "Kraken NR-2000": { photoId: "1758968611255-af2c6f31370a", alt: "Kraken NR-2000 Dive Light" },
  "Light & Motion GoBe": { photoId: "1682687980918-3c2149a8f110", alt: "Light & Motion GoBe 800 Spot" },
  // Tanks — divers with tanks visible
  "Luxfer AL80": { photoId: "1646947009718-1cb77aaa2a6d", alt: "Luxfer AL80 Aluminum Tank" },
  "Faber HP100": { photoId: "1736943993933-c1a407ed783c", alt: "Faber HP100 Steel Tank" },
  // Apparel & accessories
  "The Dive Shop LA Logo Tee": { photoId: "1748102289607-4e1270e4da65", alt: "The Dive Shop LA Logo T-Shirt" },
  "The Dive Shop LA Hoodie": { photoId: "1748102289607-4e1270e4da65", alt: "The Dive Shop LA Hoodie" },
  "Fourth Element Hydro-T": { photoId: "1502209524164-acea936639a2", alt: "Fourth Element Hydro-T Rashguard" },
  "The Dive Shop LA Trucker": { photoId: "1748102289607-4e1270e4da65", alt: "The Dive Shop LA Trucker Hat" },
  // Accessories
  "Shearwater Swift": { photoId: "1622299355484-f81b9f4fa5e8", alt: "Shearwater Swift Transmitter" },
  "Halcyon Diver Alert": { photoId: "1742325989789-b42912a531dd", alt: "Halcyon Diver Alert Marker SMB" },
  "Akona Adventurer": { photoId: "1708961571391-29a62c082300", alt: "Akona Adventurer Mesh Backpack" },
  "Stream2Sea": { photoId: "1502209524164-acea936639a2", alt: "Stream2Sea Reef-Safe Sunscreen" },
};

// ── Scrape IDs from list pages ───────────────────────────────────────────

function parseIds(html: string, hrefPrefix: string): string[] {
  const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const escaped = hrefPrefix.replace(/\//g, "\\/");
  const re = new RegExp(`href="${escaped}(${UUID})"`, "g");
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (!ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

function parseNamesAndIds(html: string, hrefPrefix: string): { id: string; name: string }[] {
  const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const escaped = hrefPrefix.replace(/\//g, "\\/");
  // Match href with UUID, then grab the next text content (the name)
  const re = new RegExp(`href="${escaped}(${UUID})"[^>]*>([^<]+)`, "g");
  const results: { id: string; name: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = m[1];
    const name = m[2].trim();
    if (!results.find(r => r.id === id)) {
      results.push({ id, name });
    }
  }
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const email = process.env.SEED_EMAIL || "demo@divestreams.com";
  const password = process.env.SEED_PASSWORD!;
  if (!password) throw new Error("SEED_PASSWORD env var required");

  console.log(`🖼️  Uploading entity images to ${BASE_URL}...`);
  const client = new SeedClient(BASE_URL);
  await login(client, email, password);

  let uploaded = 0;
  let failed = 0;

  const upload = async (entityType: string, entityId: string, photoId: string, alt: string) => {
    const result = await uploadImage(client, entityType, entityId, photoId, alt);
    if (result) {
      uploaded++;
      return true;
    }
    failed++;
    return false;
  };

  // ── Courses ──────────────────────────────────────────────────────────
  console.log("\n📸 Courses...");
  const coursesHtml = await client.getHtml("/tenant/training/courses");
  const courseItems = parseNamesAndIds(coursesHtml, "/tenant/training/courses/");
  console.log(`  Found ${courseItems.length} courses`);
  for (const course of courseItems) {
    const matchingKey = Object.keys(COURSE_IMAGES)
      .filter(prefix => course.name.startsWith(prefix))
      .sort((a, b) => b.length - a.length)[0];
    if (!matchingKey) continue;
    const img = COURSE_IMAGES[matchingKey];
    if (await upload("course", course.id, img.photoId, img.alt)) {
      console.log(`  ✓ ${course.name}`);
    }
    await sleep(300);
  }

  // ── Boats ────────────────────────────────────────────────────────────
  console.log("\n📸 Boats...");
  const boatsHtml = await client.getHtml("/tenant/boats");
  const boatIds = parseIds(boatsHtml, "/tenant/boats/");
  console.log(`  Found ${boatIds.length} boats`);
  for (let i = 0; i < Math.min(boatIds.length, BOAT_IMAGES.length); i++) {
    const img = BOAT_IMAGES[i];
    if (await upload("boat", boatIds[i], img.photoId, img.alt)) {
      console.log(`  ✓ Boat ${i + 1}: ${img.alt}`);
    }
    await sleep(300);
  }

  // ── Dive Sites ───────────────────────────────────────────────────────
  console.log("\n📸 Dive Sites...");
  const sitesHtml = await client.getHtml("/tenant/dive-sites");
  const siteIds = parseIds(sitesHtml, "/tenant/dive-sites/");
  console.log(`  Found ${siteIds.length} dive sites`);
  for (let i = 0; i < Math.min(siteIds.length, DIVE_SITE_IMAGES.length); i++) {
    const img = DIVE_SITE_IMAGES[i];
    if (await upload("dive-site", siteIds[i], img.photoId, img.alt)) {
      console.log(`  ✓ Site ${i + 1}: ${img.alt}`);
    }
    await sleep(300);
  }

  // ── Tours ────────────────────────────────────────────────────────────
  console.log("\n📸 Tours...");
  const toursHtml = await client.getHtml("/tenant/tours");
  const tourIds = parseIds(toursHtml, "/tenant/tours/");
  console.log(`  Found ${tourIds.length} tours`);
  for (let i = 0; i < Math.min(tourIds.length, TOUR_IMAGES.length); i++) {
    const img = TOUR_IMAGES[i];
    if (await upload("tour", tourIds[i], img.photoId, img.alt)) {
      console.log(`  ✓ Tour ${i + 1}: ${img.alt}`);
    }
    await sleep(300);
  }

  // ── Equipment (first item per category) ──────────────────────────────
  console.log("\n📸 Equipment (one per category)...");
  const equipHtml = await client.getHtml("/tenant/equipment");
  const equipItems = parseNamesAndIds(equipHtml, "/tenant/equipment/");
  console.log(`  Found ${equipItems.length} equipment items`);
  const seenCategories = new Set<string>();
  for (const item of equipItems) {
    // Match category from item name
    const category = Object.keys(EQUIPMENT_CATEGORY_IMAGE).find(prefix =>
      item.name.startsWith(prefix)
    );
    if (!category || seenCategories.has(category)) continue;
    seenCategories.add(category);

    const img = EQUIPMENT_CATEGORY_IMAGE[category];
    if (await upload("equipment", item.id, img.photoId, img.alt)) {
      console.log(`  ✓ ${item.name} (${category})`);
    }
    await sleep(300);
  }

  // ── Products ─────────────────────────────────────────────────────────
  console.log("\n📸 Products...");
  const productsHtml = await client.getHtml("/tenant/pos/products");
  const productItems = parseNamesAndIds(productsHtml, "/tenant/pos/products/");
  console.log(`  Found ${productItems.length} products`);
  for (const product of productItems) {
    // Match by longest matching prefix
    const matchingKey = Object.keys(PRODUCT_IMAGES)
      .filter(prefix => product.name.startsWith(prefix))
      .sort((a, b) => b.length - a.length)[0];
    if (!matchingKey) continue;

    const img = PRODUCT_IMAGES[matchingKey];
    if (await upload("product", product.id, img.photoId, img.alt)) {
      console.log(`  ✓ ${product.name}`);
    }
    await sleep(300);
  }

  console.log(`\n✅ Entity images complete: ${uploaded} uploaded, ${failed} failed`);
}

main().catch(err => {
  console.error("❌ Image upload failed:", err);
  process.exit(1);
});

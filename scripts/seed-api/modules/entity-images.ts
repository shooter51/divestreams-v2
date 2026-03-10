import type { SeedClient } from "../client";
import { sleep } from "../client";
import { uploadImage } from "../images";
import type { CreatedBoat } from "./boats";
import type { CreatedTour } from "./tours";
import type { CreatedDiveSite } from "./dive-sites";
import type { CreatedEquipment } from "./equipment";
import type { CreatedProduct } from "./products";

// ── Photo assignments by entity name ──────────────────────────────────────
// All IDs verified working from our gallery + Unsplash

// Boats — one photo each, matched to the boat description
const BOAT_PHOTOS: Record<string, { photoId: string; alt: string }> = {
  "Kelp Dancer": { photoId: "1568476612160-787b6a1d5fb1", alt: "Kelp Dancer — 32ft center console dive boat at dock" },
  "Sea Wolf": { photoId: "1575859981201-1b771392ecf6", alt: "Sea Wolf — Newton 42 dive boat underway" },
  "Channel Explorer": { photoId: "1707172101661-cbd642c1fb4e", alt: "Channel Explorer — 90ft liveaboard expedition vessel" },
};

// Dive sites — underwater/scenery photos matched to site character
const DIVE_SITE_PHOTOS: Record<string, { photoId: string; alt: string }[]> = {
  "Casino Point, Avalon": [
    { photoId: "1745909123989-92cee1d0aaf5", alt: "Kelp forest at Casino Point with garibaldi and sheephead" },
  ],
  "Farnsworth Bank": [
    { photoId: "1753190514766-633829088a07", alt: "Deep blue water at Farnsworth Bank" },
  ],
  "Italian Gardens": [
    { photoId: "1708649290066-5f617003b93f", alt: "Colorful reef at Italian Gardens, Catalina" },
  ],
  "Cathedral Cove": [
    { photoId: "1682687982167-d7fb3ed8541d", alt: "Swim-through at Cathedral Cove, Anacapa Island" },
  ],
  "Scorpion Anchorage": [
    { photoId: "1745917784526-fbad88531db1", alt: "Kelp forest at Scorpion Anchorage, Santa Cruz Island" },
  ],
  "Pyramid Head": [
    { photoId: "1753190514766-633829088a07", alt: "Open ocean at Pyramid Head, San Clemente Island" },
  ],
  "Oil Rig Eureka": [
    { photoId: "1727461553668-45322401f863", alt: "Oil Rig Eureka at sunset" },
  ],
  "Palos Verdes Kelp Beds": [
    { photoId: "1745909835285-60fbf48fcf26", alt: "Diver in the Palos Verdes kelp forest" },
  ],
  "Begg Rock": [
    { photoId: "1753190514766-633829088a07", alt: "Deep blue water at Begg Rock, San Nicolas Island" },
  ],
  "Sutil Island": [
    { photoId: "1580193367026-4be12a314a96", alt: "Sea lion colony at Sutil Island" },
  ],
};

// Tours — matched to tour theme
const TOUR_PHOTOS: Record<string, { photoId: string; alt: string }> = {
  "Half-Day Kelp Forest Dive": { photoId: "1745917784526-fbad88531db1", alt: "Sunlight filtering through the kelp canopy" },
  "Oil Rig Adventure": { photoId: "1727461553668-45322401f863", alt: "Oil rig platform rising from the Pacific" },
  "Catalina Express": { photoId: "1657665369393-81a1e4b63f41", alt: "Catalina Island rocky coastline" },
  "Catalina Two-Tank": { photoId: "1745909123989-92cee1d0aaf5", alt: "Kelp forest with marine life at Catalina" },
  "Catalina Deep Walls": { photoId: "1753190514766-633829088a07", alt: "Deep blue water at Farnsworth Bank" },
  "Anacapa Island Explorer": { photoId: "1682687982167-d7fb3ed8541d", alt: "Underwater cave at Anacapa Island" },
  "Discover Scuba — Ocean Experience": { photoId: "1646947009718-1cb77aaa2a6d", alt: "Divers entering the ocean" },
  "Night Dive: Catalina": { photoId: "1708649290066-5f617003b93f", alt: "Reef life at Casino Point" },
  "2-Day Catalina & Anacapa": { photoId: "1655110126842-d71113df750e", alt: "Rocky island pinnacle in the Channel Islands" },
  "3-Day Channel Islands Expedition": { photoId: "1748102289607-4e1270e4da65", alt: "Channel Islands panoramic view" },
  "5-Day Outer Islands — San Clemente & San Nicolas": { photoId: "1580193367026-4be12a314a96", alt: "Sea lion on the rocks" },
};

// Equipment — one photo per category (first item in each category gets the image)
// We use the same underwater/diving photos since Unsplash doesn't have individual gear items
const EQUIPMENT_CATEGORY_PHOTOS: Record<string, { photoId: string; alt: string }> = {
  bcd: { photoId: "1646947009718-1cb77aaa2a6d", alt: "Divers gearing up with BCDs" },
  regulator: { photoId: "1646947009718-1cb77aaa2a6d", alt: "Dive regulators ready for use" },
  wetsuit: { photoId: "1745909835285-60fbf48fcf26", alt: "Diver in wetsuit in kelp forest" },
  mask: { photoId: "1745909123989-92cee1d0aaf5", alt: "Dive mask view of underwater kelp" },
  fins: { photoId: "1745909835285-60fbf48fcf26", alt: "Diver with fins in the kelp forest" },
  boots: { photoId: "1646947009718-1cb77aaa2a6d", alt: "Dive boots and gear on the boat" },
  computer: { photoId: "1745917784526-fbad88531db1", alt: "Dive computer on the reef" },
  tank: { photoId: "1575859981201-1b771392ecf6", alt: "Tank racks on dive boat" },
};

// Products — map by SKU prefix to themed photos
const PRODUCT_SKU_PHOTOS: Record<string, { photoId: string; alt: string }> = {
  "AQL-PROHD": { photoId: "1646947009718-1cb77aaa2a6d", alt: "Aqua Lung Pro HD BCD" },
  "SCP-HYDROS": { photoId: "1646947009718-1cb77aaa2a6d", alt: "ScubaPro Hydros Pro BCD" },
  "CRS-START": { photoId: "1646947009718-1cb77aaa2a6d", alt: "Cressi Start BCD" },
  "SCP-SEHWK2": { photoId: "1646947009718-1cb77aaa2a6d", alt: "ScubaPro Seahawk 2 BCD" },
  "AQL-ROGUE": { photoId: "1646947009718-1cb77aaa2a6d", alt: "Aqua Lung Rogue BCD" },
  "APX-BLKICE": { photoId: "1646947009718-1cb77aaa2a6d", alt: "Apeks Black Ice BCD" },
  "AQL-CORE": { photoId: "1745909835285-60fbf48fcf26", alt: "Aqua Lung Core Supreme Regulator" },
  "SCP-MK25": { photoId: "1745909835285-60fbf48fcf26", alt: "ScubaPro MK25 EVO Regulator" },
  "CRS-AC2": { photoId: "1745909835285-60fbf48fcf26", alt: "Cressi AC2 Regulator" },
  "APK-XTX50": { photoId: "1745909835285-60fbf48fcf26", alt: "Apeks XTX50 Regulator" },
  "ATM-B2": { photoId: "1745909835285-60fbf48fcf26", alt: "Atomic Aquatics B2 Regulator" },
  "SCP-MK19": { photoId: "1745909835285-60fbf48fcf26", alt: "ScubaPro MK19 EVO Regulator" },
  "SHW-PERE": { photoId: "1745917784526-fbad88531db1", alt: "Shearwater Peregrine Dive Computer" },
  "SHW-TERI": { photoId: "1745917784526-fbad88531db1", alt: "Shearwater Teric Dive Computer" },
  "GAR-MK3I": { photoId: "1745917784526-fbad88531db1", alt: "Garmin Descent Mk3i Dive Computer" },
  "SUU-EONC": { photoId: "1745917784526-fbad88531db1", alt: "Suunto EON Core Dive Computer" },
  "AQL-330R": { photoId: "1745917784526-fbad88531db1", alt: "Aqua Lung i330R Dive Computer" },
  "ON-EPIC54": { photoId: "1745909835285-60fbf48fcf26", alt: "O'Neill Epic 5/4mm Wetsuit" },
  "ON-EPIC32": { photoId: "1745909835285-60fbf48fcf26", alt: "O'Neill Epic 3/2mm Wetsuit" },
  "FE-PROT5": { photoId: "1745909835285-60fbf48fcf26", alt: "Fourth Element Proteus II Wetsuit" },
  "HN-THPRO7": { photoId: "1745909835285-60fbf48fcf26", alt: "Henderson Thermoprene Pro 7mm" },
  "BA-VEL5": { photoId: "1745909835285-60fbf48fcf26", alt: "Bare Velocity Ultra 5mm Wetsuit" },
  "SP-EVER32": { photoId: "1745909835285-60fbf48fcf26", alt: "ScubaPro Everflex 3/2mm Wetsuit" },
  "SP-SYN2": { photoId: "1745909123989-92cee1d0aaf5", alt: "ScubaPro Synergy 2 Twin Mask" },
  "CR-BIGE": { photoId: "1745909123989-92cee1d0aaf5", alt: "Cressi Big Eyes Evolution Mask" },
  "AA-VENM": { photoId: "1745909123989-92cee1d0aaf5", alt: "Atomic Aquatics Venom Frameless Mask" },
  "TU-PARA": { photoId: "1745909123989-92cee1d0aaf5", alt: "Tusa Paragon S Mask" },
  "AL-RVX2": { photoId: "1745909123989-92cee1d0aaf5", alt: "Aqua Lung Reveal X2 Mask" },
  "SP-SWNG": { photoId: "1745909835285-60fbf48fcf26", alt: "ScubaPro Seawing Gorilla Fins" },
  "CR-FROG": { photoId: "1745909835285-60fbf48fcf26", alt: "Cressi Frog Plus Fins" },
  "AA-SPLT": { photoId: "1745909835285-60fbf48fcf26", alt: "Atomic Aquatics SplitFins" },
  "AP-RK3": { photoId: "1745909835285-60fbf48fcf26", alt: "Apeks RK3 Fins" },
  "HL-F1": { photoId: "1745909835285-60fbf48fcf26", alt: "Hollis F1 Fins" },
  "LM-S2500": { photoId: "1708649290066-5f617003b93f", alt: "Light & Motion Sola Dive 2500" },
  "BB-1300": { photoId: "1708649290066-5f617003b93f", alt: "BigBlue AL1300NP Dive Light" },
  "KR-2000": { photoId: "1708649290066-5f617003b93f", alt: "Kraken NR-2000 Dive Light" },
  "LM-GB800": { photoId: "1708649290066-5f617003b93f", alt: "Light & Motion GoBe 800 Spot" },
  "LUX-AL80": { photoId: "1575859981201-1b771392ecf6", alt: "Luxfer AL80 Aluminum Tank" },
  "FAB-HP100": { photoId: "1575859981201-1b771392ecf6", alt: "Faber HP100 Steel Tank" },
};

export interface EntityImageInputs {
  boats: CreatedBoat[];
  diveSites: CreatedDiveSite[];
  tours: CreatedTour[];
  equipment: CreatedEquipment[];
  products: CreatedProduct[];
}

export async function seedEntityImages(
  client: SeedClient,
  entities: EntityImageInputs
): Promise<void> {
  console.log("\nSeeding entity images...");
  let uploaded = 0;
  let failed = 0;

  // ── Boats ──────────────────────────────────────────────────────────────
  console.log("  Uploading boat images...");
  for (const boat of entities.boats) {
    const photo = BOAT_PHOTOS[boat.name];
    if (!photo) continue;
    const result = await uploadImage(client, "boat", boat.id, photo.photoId, photo.alt);
    if (result) {
      console.log(`    ✓ ${boat.name}`);
      uploaded++;
    } else {
      failed++;
    }
    await sleep(200);
  }

  // ── Dive Sites ─────────────────────────────────────────────────────────
  console.log("  Uploading dive site images...");
  for (const site of entities.diveSites) {
    const photos = DIVE_SITE_PHOTOS[site.name];
    if (!photos) continue;
    for (const photo of photos) {
      const result = await uploadImage(client, "dive-site", site.id, photo.photoId, photo.alt);
      if (result) {
        console.log(`    ✓ ${site.name}`);
        uploaded++;
      } else {
        failed++;
      }
      await sleep(200);
    }
  }

  // ── Tours ──────────────────────────────────────────────────────────────
  console.log("  Uploading tour images...");
  for (const tour of entities.tours) {
    const photo = TOUR_PHOTOS[tour.name];
    if (!photo) continue;
    const result = await uploadImage(client, "tour", tour.id, photo.photoId, photo.alt);
    if (result) {
      console.log(`    ✓ ${tour.name}`);
      uploaded++;
    } else {
      failed++;
    }
    await sleep(200);
  }

  // ── Equipment (first item per category only) ───────────────────────────
  console.log("  Uploading equipment images (one per category)...");
  const seenCategories = new Set<string>();
  for (const item of entities.equipment) {
    // Extract category from the name pattern (BCD, Regulator, Wetsuit, etc.)
    const category = inferEquipmentCategory(item.name);
    if (!category || seenCategories.has(category)) continue;
    seenCategories.add(category);

    const photo = EQUIPMENT_CATEGORY_PHOTOS[category];
    if (!photo) continue;
    const result = await uploadImage(client, "equipment", item.id, photo.photoId, photo.alt);
    if (result) {
      console.log(`    ✓ ${item.name} (${category})`);
      uploaded++;
    } else {
      failed++;
    }
    await sleep(200);
  }

  // ── Products ───────────────────────────────────────────────────────────
  console.log("  Uploading product images...");
  for (const product of entities.products) {
    // Match by SKU prefix
    const skuPrefix = product.sku.split("-").slice(0, 2).join("-");
    const photo = PRODUCT_SKU_PHOTOS[skuPrefix];
    if (!photo) continue;
    const result = await uploadImage(client, "product", product.id, photo.photoId, photo.alt);
    if (result) {
      console.log(`    ✓ ${product.name}`);
      uploaded++;
    } else {
      failed++;
    }
    await sleep(200);
  }

  console.log(`Entity images seeded: ${uploaded} uploaded, ${failed} failed`);
}

function inferEquipmentCategory(name: string): string | null {
  if (name.startsWith("BCD")) return "bcd";
  if (name.startsWith("Regulator")) return "regulator";
  if (name.startsWith("Wetsuit") || name.startsWith("Shorty")) return "wetsuit";
  if (name.startsWith("Mask")) return "mask";
  if (name.startsWith("Fins")) return "fins";
  if (name.startsWith("Boot")) return "boots";
  if (name.startsWith("Dive Computer")) return "computer";
  if (name.startsWith("AL80 Tank") || name.startsWith("HP100") || name.startsWith("HP80")) return "tank";
  return null;
}

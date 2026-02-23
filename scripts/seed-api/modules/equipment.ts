import type { SeedClient } from "../client";

export interface CreatedEquipment {
  id: string;
  name: string;
}

interface EquipmentSpec {
  category: string;
  name: string;
  brand: string;
  model: string;
  size?: string;
  rentalPrice: number;
  isRentable: boolean;
  isPublic: boolean;
}

const EQUIPMENT: EquipmentSpec[] = [
  // BCDs (4)
  { category: "bcd", name: "BCD Small", brand: "Scubapro", model: "Hydros Pro", size: "S", rentalPrice: 25, isRentable: true, isPublic: true },
  { category: "bcd", name: "BCD Medium", brand: "Scubapro", model: "Hydros Pro", size: "M", rentalPrice: 25, isRentable: true, isPublic: true },
  { category: "bcd", name: "BCD Large", brand: "Scubapro", model: "Hydros Pro", size: "L", rentalPrice: 25, isRentable: true, isPublic: true },
  { category: "bcd", name: "BCD XLarge", brand: "Scubapro", model: "Hydros Pro", size: "XL", rentalPrice: 25, isRentable: true, isPublic: true },

  // Regulators (4)
  { category: "regulator", name: "Regulator 1", brand: "Aqualung", model: "Leg3nd Elite", rentalPrice: 20, isRentable: true, isPublic: true },
  { category: "regulator", name: "Regulator 2", brand: "Aqualung", model: "Leg3nd Elite", rentalPrice: 20, isRentable: true, isPublic: true },
  { category: "regulator", name: "Regulator 3", brand: "Aqualung", model: "Leg3nd Elite", rentalPrice: 20, isRentable: true, isPublic: true },
  { category: "regulator", name: "Regulator 4", brand: "Aqualung", model: "Leg3nd Elite", rentalPrice: 20, isRentable: true, isPublic: true },

  // Wetsuits (6): 3mm S/M/L and 5mm S/M/L
  { category: "wetsuit", name: "Wetsuit 3mm Small", brand: "Bare", model: "Sport 3mm", size: "S", rentalPrice: 15, isRentable: true, isPublic: true },
  { category: "wetsuit", name: "Wetsuit 3mm Medium", brand: "Bare", model: "Sport 3mm", size: "M", rentalPrice: 15, isRentable: true, isPublic: true },
  { category: "wetsuit", name: "Wetsuit 3mm Large", brand: "Bare", model: "Sport 3mm", size: "L", rentalPrice: 15, isRentable: true, isPublic: true },
  { category: "wetsuit", name: "Wetsuit 5mm Small", brand: "Bare", model: "Sport 5mm", size: "S", rentalPrice: 15, isRentable: true, isPublic: true },
  { category: "wetsuit", name: "Wetsuit 5mm Medium", brand: "Bare", model: "Sport 5mm", size: "M", rentalPrice: 15, isRentable: true, isPublic: true },
  { category: "wetsuit", name: "Wetsuit 5mm Large", brand: "Bare", model: "Sport 5mm", size: "L", rentalPrice: 15, isRentable: true, isPublic: true },

  // Masks (4)
  { category: "mask", name: "Mask 1", brand: "Cressi", model: "Big Eyes", rentalPrice: 8, isRentable: true, isPublic: true },
  { category: "mask", name: "Mask 2", brand: "Cressi", model: "Big Eyes", rentalPrice: 8, isRentable: true, isPublic: true },
  { category: "mask", name: "Mask 3", brand: "Cressi", model: "Big Eyes", rentalPrice: 8, isRentable: true, isPublic: true },
  { category: "mask", name: "Mask 4", brand: "Cressi", model: "Big Eyes", rentalPrice: 8, isRentable: true, isPublic: true },

  // Fins (4)
  { category: "fins", name: "Fins Small", brand: "Mares", model: "Avanti Tre", size: "S", rentalPrice: 10, isRentable: true, isPublic: true },
  { category: "fins", name: "Fins Medium", brand: "Mares", model: "Avanti Tre", size: "M", rentalPrice: 10, isRentable: true, isPublic: true },
  { category: "fins", name: "Fins Large", brand: "Mares", model: "Avanti Tre", size: "L", rentalPrice: 10, isRentable: true, isPublic: true },
  { category: "fins", name: "Fins XLarge", brand: "Mares", model: "Avanti Tre", size: "XL", rentalPrice: 10, isRentable: true, isPublic: true },

  // Dive Computers (4)
  { category: "computer", name: "Dive Computer 1", brand: "Suunto", model: "D5", rentalPrice: 30, isRentable: true, isPublic: true },
  { category: "computer", name: "Dive Computer 2", brand: "Suunto", model: "D5", rentalPrice: 30, isRentable: true, isPublic: true },
  { category: "computer", name: "Dive Computer 3", brand: "Suunto", model: "D5", rentalPrice: 30, isRentable: true, isPublic: true },
  { category: "computer", name: "Dive Computer 4", brand: "Suunto", model: "D5", rentalPrice: 30, isRentable: true, isPublic: true },

  // Torches (3)
  { category: "other", name: "Dive Torch 1", brand: "UK Light", model: "C8 eLED", rentalPrice: 12, isRentable: true, isPublic: true },
  { category: "other", name: "Dive Torch 2", brand: "UK Light", model: "C8 eLED", rentalPrice: 12, isRentable: true, isPublic: true },
  { category: "other", name: "Dive Torch 3", brand: "UK Light", model: "C8 eLED", rentalPrice: 12, isRentable: true, isPublic: true },

  // Tanks (6, not public)
  { category: "tank", name: "12L Steel Tank 1", brand: "Faber", model: "Steel HP", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "12L Steel Tank 2", brand: "Faber", model: "Steel HP", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "12L Steel Tank 3", brand: "Faber", model: "Steel HP", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "12L Steel Tank 4", brand: "Faber", model: "Steel HP", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "12L Steel Tank 5", brand: "Faber", model: "Steel HP", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "12L Steel Tank 6", brand: "Faber", model: "Steel HP", rentalPrice: 0, isRentable: false, isPublic: false },
];

export async function seedEquipment(client: SeedClient): Promise<CreatedEquipment[]> {
  console.log("Seeding equipment...");
  const created: CreatedEquipment[] = [];

  for (const spec of EQUIPMENT) {
    const csrf = await client.getCsrfToken();
    const formData = new FormData();
    formData.set("_csrf", csrf);
    formData.set("category", spec.category);
    formData.set("name", spec.name);
    formData.set("brand", spec.brand);
    formData.set("model", spec.model);
    if (spec.size) {
      formData.set("size", spec.size);
    }
    formData.set("status", "available");
    formData.set("condition", "good");
    formData.set("isRentable", spec.isRentable ? "true" : "false");
    if (spec.isRentable && spec.rentalPrice > 0) {
      formData.set("rentalPrice", String(spec.rentalPrice));
    }
    formData.set("isPublic", spec.isPublic ? "true" : "false");

    const result = await client.post("/tenant/equipment/new", formData);

    if (result.ok || result.status === 302) {
      const id = result.location
        ? client.extractId(result.location, "/tenant/equipment/")
        : null;
      if (id) {
        created.push({ id, name: spec.name });
        console.log(`  Created equipment: "${spec.name}" (id: ${id})`);
      } else {
        console.warn(`  Warning: could not extract equipment ID from location: ${result.location}`);
      }
    } else {
      console.warn(`  Warning: equipment "${spec.name}" returned status ${result.status}`);
    }

    await client.sleep(50);
  }

  console.log(`Equipment seeded: ${created.length}/${EQUIPMENT.length}`);
  return created;
}

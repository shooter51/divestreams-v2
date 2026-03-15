import type { SeedClient } from "../client";
import type { CreatedEquipment } from "../modules/equipment";

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

// Real brands, real models — what you'd find at a well-stocked SoCal dive shop
const EQUIPMENT: EquipmentSpec[] = [
  // BCDs — Scubapro Hydros Pro (SoCal standard) + Aqualung Axiom
  { category: "bcd", name: "Hydros Pro BCD - XS", brand: "Scubapro", model: "Hydros Pro", size: "XS", rentalPrice: 30, isRentable: true, isPublic: true },
  { category: "bcd", name: "Hydros Pro BCD - S", brand: "Scubapro", model: "Hydros Pro", size: "S", rentalPrice: 30, isRentable: true, isPublic: true },
  { category: "bcd", name: "Hydros Pro BCD - M", brand: "Scubapro", model: "Hydros Pro", size: "M", rentalPrice: 30, isRentable: true, isPublic: true },
  { category: "bcd", name: "Hydros Pro BCD - L", brand: "Scubapro", model: "Hydros Pro", size: "L", rentalPrice: 30, isRentable: true, isPublic: true },
  { category: "bcd", name: "Hydros Pro BCD - XL", brand: "Scubapro", model: "Hydros Pro", size: "XL", rentalPrice: 30, isRentable: true, isPublic: true },
  { category: "bcd", name: "Axiom i3 BCD - M", brand: "Aqualung", model: "Axiom i3", size: "M", rentalPrice: 28, isRentable: true, isPublic: true },
  { category: "bcd", name: "Axiom i3 BCD - L", brand: "Aqualung", model: "Axiom i3", size: "L", rentalPrice: 28, isRentable: true, isPublic: true },

  // Regulators — Aqualung Leg3nd + Scubapro MK25 EVO/S620 Ti
  { category: "regulator", name: "Leg3nd Elite Reg Set 1", brand: "Aqualung", model: "Leg3nd Elite", rentalPrice: 25, isRentable: true, isPublic: true },
  { category: "regulator", name: "Leg3nd Elite Reg Set 2", brand: "Aqualung", model: "Leg3nd Elite", rentalPrice: 25, isRentable: true, isPublic: true },
  { category: "regulator", name: "Leg3nd Elite Reg Set 3", brand: "Aqualung", model: "Leg3nd Elite", rentalPrice: 25, isRentable: true, isPublic: true },
  { category: "regulator", name: "MK25 EVO/S620 Ti Set 1", brand: "Scubapro", model: "MK25 EVO / S620 Ti", rentalPrice: 28, isRentable: true, isPublic: true },
  { category: "regulator", name: "MK25 EVO/S620 Ti Set 2", brand: "Scubapro", model: "MK25 EVO / S620 Ti", rentalPrice: 28, isRentable: true, isPublic: true },
  { category: "regulator", name: "MK25 EVO/S620 Ti Set 3", brand: "Scubapro", model: "MK25 EVO / S620 Ti", rentalPrice: 28, isRentable: true, isPublic: true },

  // Wetsuits — 5mm and 7mm for cold SoCal water (no 3mm here!)
  { category: "wetsuit", name: "Hyperfreak 5/4mm - S", brand: "O'Neill", model: "Hyperfreak Chest Zip 5/4mm", size: "S", rentalPrice: 20, isRentable: true, isPublic: true },
  { category: "wetsuit", name: "Hyperfreak 5/4mm - M", brand: "O'Neill", model: "Hyperfreak Chest Zip 5/4mm", size: "M", rentalPrice: 20, isRentable: true, isPublic: true },
  { category: "wetsuit", name: "Hyperfreak 5/4mm - L", brand: "O'Neill", model: "Hyperfreak Chest Zip 5/4mm", size: "L", rentalPrice: 20, isRentable: true, isPublic: true },
  { category: "wetsuit", name: "Hyperfreak 5/4mm - XL", brand: "O'Neill", model: "Hyperfreak Chest Zip 5/4mm", size: "XL", rentalPrice: 20, isRentable: true, isPublic: true },
  { category: "wetsuit", name: "Thermoprene 7mm - S", brand: "Henderson", model: "Thermoprene Pro 7mm", size: "S", rentalPrice: 22, isRentable: true, isPublic: true },
  { category: "wetsuit", name: "Thermoprene 7mm - M", brand: "Henderson", model: "Thermoprene Pro 7mm", size: "M", rentalPrice: 22, isRentable: true, isPublic: true },
  { category: "wetsuit", name: "Thermoprene 7mm - L", brand: "Henderson", model: "Thermoprene Pro 7mm", size: "L", rentalPrice: 22, isRentable: true, isPublic: true },
  { category: "wetsuit", name: "Thermoprene 7mm - XL", brand: "Henderson", model: "Thermoprene Pro 7mm", size: "XL", rentalPrice: 22, isRentable: true, isPublic: true },

  // Masks
  { category: "mask", name: "Big Eyes Evo Mask 1", brand: "Cressi", model: "Big Eyes Evolution", rentalPrice: 10, isRentable: true, isPublic: true },
  { category: "mask", name: "Big Eyes Evo Mask 2", brand: "Cressi", model: "Big Eyes Evolution", rentalPrice: 10, isRentable: true, isPublic: true },
  { category: "mask", name: "Big Eyes Evo Mask 3", brand: "Cressi", model: "Big Eyes Evolution", rentalPrice: 10, isRentable: true, isPublic: true },
  { category: "mask", name: "Atomic Venom Mask 1", brand: "Atomic Aquatics", model: "Venom", rentalPrice: 12, isRentable: true, isPublic: true },
  { category: "mask", name: "Atomic Venom Mask 2", brand: "Atomic Aquatics", model: "Venom", rentalPrice: 12, isRentable: true, isPublic: true },

  // Fins
  { category: "fins", name: "Seawing Nova - S", brand: "Scubapro", model: "Seawing Nova", size: "S", rentalPrice: 12, isRentable: true, isPublic: true },
  { category: "fins", name: "Seawing Nova - M", brand: "Scubapro", model: "Seawing Nova", size: "M", rentalPrice: 12, isRentable: true, isPublic: true },
  { category: "fins", name: "Seawing Nova - L", brand: "Scubapro", model: "Seawing Nova", size: "L", rentalPrice: 12, isRentable: true, isPublic: true },
  { category: "fins", name: "Avanti Quattro+ - M", brand: "Mares", model: "Avanti Quattro+", size: "M", rentalPrice: 12, isRentable: true, isPublic: true },
  { category: "fins", name: "Avanti Quattro+ - L", brand: "Mares", model: "Avanti Quattro+", size: "L", rentalPrice: 12, isRentable: true, isPublic: true },

  // Dive Computers
  { category: "computer", name: "Peregrine TX 1", brand: "Shearwater", model: "Peregrine TX", rentalPrice: 35, isRentable: true, isPublic: true },
  { category: "computer", name: "Peregrine TX 2", brand: "Shearwater", model: "Peregrine TX", rentalPrice: 35, isRentable: true, isPublic: true },
  { category: "computer", name: "Peregrine TX 3", brand: "Shearwater", model: "Peregrine TX", rentalPrice: 35, isRentable: true, isPublic: true },
  { category: "computer", name: "Descent Mk3 1", brand: "Garmin", model: "Descent Mk3", rentalPrice: 40, isRentable: true, isPublic: true },
  { category: "computer", name: "Descent Mk3 2", brand: "Garmin", model: "Descent Mk3", rentalPrice: 40, isRentable: true, isPublic: true },

  // Dive Lights
  { category: "other", name: "Sola 2500 Light 1", brand: "Light & Motion", model: "Sola Dive 2500", rentalPrice: 18, isRentable: true, isPublic: true },
  { category: "other", name: "Sola 2500 Light 2", brand: "Light & Motion", model: "Sola Dive 2500", rentalPrice: 18, isRentable: true, isPublic: true },
  { category: "other", name: "Sola 2500 Light 3", brand: "Light & Motion", model: "Sola Dive 2500", rentalPrice: 18, isRentable: true, isPublic: true },
  { category: "other", name: "VL4200P Light 1", brand: "BigBlue", model: "VL4200P", rentalPrice: 15, isRentable: true, isPublic: true },
  { category: "other", name: "VL4200P Light 2", brand: "BigBlue", model: "VL4200P", rentalPrice: 15, isRentable: true, isPublic: true },

  // Tanks — shop inventory, not publicly displayed
  { category: "tank", name: "AL80 Tank 1", brand: "Luxfer", model: "AL80", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "AL80 Tank 2", brand: "Luxfer", model: "AL80", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "AL80 Tank 3", brand: "Luxfer", model: "AL80", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "AL80 Tank 4", brand: "Luxfer", model: "AL80", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "AL80 Tank 5", brand: "Luxfer", model: "AL80", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "AL80 Tank 6", brand: "Luxfer", model: "AL80", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "AL80 Tank 7", brand: "Luxfer", model: "AL80", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "AL80 Tank 8", brand: "Luxfer", model: "AL80", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "LP95 Steel Tank 1", brand: "Faber", model: "LP95", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "LP95 Steel Tank 2", brand: "Faber", model: "LP95", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "LP95 Steel Tank 3", brand: "Faber", model: "LP95", rentalPrice: 0, isRentable: false, isPublic: false },
  { category: "tank", name: "LP95 Steel Tank 4", brand: "Faber", model: "LP95", rentalPrice: 0, isRentable: false, isPublic: false },
];

export async function seedTdslaEquipment(client: SeedClient): Promise<CreatedEquipment[]> {
  console.log("Seeding TDSLA equipment...");
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
      }
    } else {
      console.warn(`  Warning: equipment "${spec.name}" returned status ${result.status}`);
    }

    await client.sleep(30);
  }

  console.log(`  TDSLA equipment seeded: ${created.length}/${EQUIPMENT.length}`);
  return created;
}

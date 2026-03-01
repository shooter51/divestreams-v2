import type { SeedClient } from "../client";

export interface CreatedBoat {
  id: string;
  name: string;
}

interface BoatSpec {
  name: string;
  type: string;
  capacity: number;
  description: string;
  registrationNumber: string;
  amenities: string[];
}

const BOATS: BoatSpec[] = [
  {
    name: "Manta",
    type: "Dive Boat",
    capacity: 12,
    description: "Purpose-built dive boat with spacious deck, twin engines, and full dive platform. Ideal for reef and wall dives.",
    registrationNumber: "PW-2024-MN",
    amenities: ["Dive platform", "Sun deck", "Freshwater shower", "Camera station", "Storage lockers", "First aid kit"],
  },
  {
    name: "Neptune",
    type: "RIB",
    capacity: 8,
    description: "Fast rigid inflatable for reaching outer dive sites quickly. Perfect for small groups and drift dives.",
    registrationNumber: "PW-2024-NP",
    amenities: ["Dive platform", "Shade cover", "Storage lockers", "First aid kit"],
  },
  {
    name: "Coral Queen",
    type: "Catamaran",
    capacity: 16,
    description: "Stable catamaran offering a comfortable ride for larger groups. Features a full galley and shaded lounge area.",
    registrationNumber: "PW-2024-CQ",
    amenities: ["Dive platform", "Sun deck", "Toilet", "Freshwater shower", "Camera station", "Storage lockers", "Shade cover", "First aid kit", "Sound system", "BBQ grill"],
  },
  {
    name: "Sea Breeze",
    type: "Speed Boat",
    capacity: 6,
    description: "Nimble tender for shore transfers and small-group snorkel excursions.",
    registrationNumber: "PW-2024-SB",
    amenities: ["Shade cover", "First aid kit"],
  },
];

export async function seedBoats(client: SeedClient): Promise<CreatedBoat[]> {
  console.log("Seeding boats...");
  const created: CreatedBoat[] = [];

  for (const spec of BOATS) {
    const csrf = await client.getCsrfToken();
    const formData = new FormData();
    formData.set("_csrf", csrf);
    formData.set("name", spec.name);
    formData.set("type", spec.type);
    formData.set("capacity", String(spec.capacity));
    formData.set("description", spec.description);
    formData.set("registrationNumber", spec.registrationNumber);
    formData.set("amenities", spec.amenities.join(", "));
    formData.set("isActive", "true");

    const result = await client.post("/tenant/boats/new", formData);

    if (result.ok || result.status === 302) {
      const id = result.location
        ? client.extractId(result.location, "/tenant/boats/")
        : null;
      if (id) {
        created.push({ id, name: spec.name });
        console.log(`  Created boat: "${spec.name}" (id: ${id})`);
      } else {
        console.warn(`  Warning: could not extract boat ID from location: ${result.location}`);
      }
    } else {
      console.warn(`  Warning: boat "${spec.name}" returned status ${result.status}`);
    }

    await client.sleep(50);
  }

  console.log(`Boats seeded: ${created.length}/${BOATS.length}`);
  return created;
}

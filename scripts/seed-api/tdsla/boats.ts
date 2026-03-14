import type { SeedClient } from "../client";
import type { CreatedBoat } from "../modules/boats";
import { uploadImage, randomPhoto } from "../images";

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
    name: "Channel Diver",
    type: "Dive Boat",
    capacity: 22,
    description:
      "Our 46-foot Newton dive boat and the backbone of our Catalina day trips. " +
      "Purpose-built for SoCal diving with a wide dive platform, twin 350hp Cummins diesels, " +
      "and a heated cabin for those early morning crossings. Carries 40 tanks and has a " +
      "full compressor for fills between dives.",
    registrationNumber: "CF-8827-LA",
    amenities: [
      "Dive platform",
      "Hot shower",
      "Heated cabin",
      "Camera table",
      "Tank racks (40)",
      "Compressor",
      "Marine head",
      "Sun deck",
      "First aid & O2 kit",
    ],
  },
  {
    name: "Sea Phantom",
    type: "Dive Boat",
    capacity: 30,
    description:
      "Our 65-foot custom dive vessel built for multi-day Channel Islands expeditions. " +
      "Features 8 sleeping berths, full galley with hot meals, and a spacious dive deck. " +
      "The Sea Phantom runs overnight trips to Anacapa, Santa Cruz, and San Nicolas " +
      "islands year-round.",
    registrationNumber: "CF-9134-LA",
    amenities: [
      "Dive platform",
      "Hot shower",
      "8 sleeping berths",
      "Full galley",
      "Camera table with charging stations",
      "Tank racks (60)",
      "Nitrox membrane system",
      "Marine head (2)",
      "Sun deck",
      "Entertainment system",
      "First aid & O2 kit",
    ],
  },
  {
    name: "Kelp Runner",
    type: "RIB",
    capacity: 10,
    description:
      "Fast 28-foot rigid inflatable for local dive sites. Gets you to Veteran's Park, " +
      "Malaga Cove, or the Redondo Canyon in minutes. Twin 150hp Yamaha outboards. " +
      "Perfect for small groups and shore-dive support.",
    registrationNumber: "CF-7201-LA",
    amenities: [
      "Dive ladder",
      "Shade cover",
      "Tank racks (12)",
      "Freshwater rinse",
      "First aid & O2 kit",
    ],
  },
  {
    name: "Blue Nomad",
    type: "Sailboat",
    capacity: 8,
    description:
      "Our 36-foot Catalina sailboat for unique dive-and-sail experiences along the " +
      "Palos Verdes coastline. Sail to your dive site, gear up, explore the reefs, " +
      "then enjoy sunset drinks on the way back to King Harbor.",
    registrationNumber: "CF-6588-LA",
    amenities: [
      "Dive ladder",
      "Tank storage (10)",
      "Cockpit rinse station",
      "Below-deck cabin",
      "Marine head",
      "Galley (snacks & drinks)",
      "Bluetooth speaker",
      "First aid kit",
    ],
  },
];

export async function seedTdslaBoats(client: SeedClient): Promise<CreatedBoat[]> {
  console.log("Seeding TDSLA boats...");
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

        // Upload 2 images per boat
        for (let i = 0; i < 2; i++) {
          const photo = randomPhoto("wide-angle");
          const alt = `${spec.name} - photo ${i + 1}`;
          const img = await uploadImage(client, "boat", id, photo, alt);
          if (img) console.log(`    📷 Image ${i + 1} uploaded`);
          await client.sleep(200);
        }
      } else {
        console.warn(`  Warning: could not extract boat ID from location: ${result.location}`);
      }
    } else {
      console.warn(`  Warning: boat "${spec.name}" returned status ${result.status}`);
    }

    await client.sleep(50);
  }

  console.log(`  TDSLA boats seeded: ${created.length}/${BOATS.length}`);
  return created;
}

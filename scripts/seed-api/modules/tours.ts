import type { SeedClient } from "../client";

export interface CreatedTour {
  id: string;
  name: string;
}

interface TourSpec {
  name: string;
  type: string;
  duration: number;
  price: number;
  maxParticipants: number;
  minParticipants: number;
  description: string;
  inclusionsStr: string;
  minCertLevel: string;
}

const TOURS: TourSpec[] = [
  {
    name: "Discover Scuba Diving",
    type: "single_dive",
    duration: 240,
    price: 149,
    maxParticipants: 4,
    minParticipants: 1,
    description:
      "No certification required! Try scuba diving in a safe, controlled environment with our expert instructors. Perfect for beginners aged 10 and up.",
    inclusionsStr: "Equipment rental,Instructor guidance,Underwater photos",
    minCertLevel: "",
  },
  {
    name: "Two Tank Morning Reef",
    type: "multi_dive",
    duration: 300,
    price: 129,
    maxParticipants: 16,
    minParticipants: 2,
    description:
      "Explore two stunning reef sites on our comfortable dive boat. Morning departure guarantees the best visibility and marine life activity.",
    inclusionsStr: "Tanks,Weights,Dive guide,Surface interval snacks",
    minCertLevel: "Open Water",
  },
  {
    name: "Night Dive Adventure",
    type: "night_dive",
    duration: 180,
    price: 89,
    maxParticipants: 8,
    minParticipants: 2,
    description:
      "Experience the reef after dark! Witness nocturnal marine life, bioluminescence, and sleeping fish that come alive under your torch light.",
    inclusionsStr: "Dive torch,Tanks,Weights,Dive guide",
    minCertLevel: "Open Water",
  },
  {
    name: "Wreck Explorer",
    type: "single_dive",
    duration: 180,
    price: 99,
    maxParticipants: 6,
    minParticipants: 2,
    description:
      "Dive into history at one of the Keys' most famous artificial reefs. Explore the marine life that has colonized the wreck over decades.",
    inclusionsStr: "Tanks,Weights,Wreck briefing,Dive guide",
    minCertLevel: "Open Water",
  },
  {
    name: "Drift Dive Experience",
    type: "single_dive",
    duration: 180,
    price: 109,
    maxParticipants: 10,
    minParticipants: 2,
    description:
      "Let the gentle Gulf Stream carry you along vibrant coral formations. An exhilarating and effortless way to cover miles of reef.",
    inclusionsStr: "Tanks,Weights,SMB,Dive guide",
    minCertLevel: "Advanced Open Water",
  },
  {
    name: "Manta Ray Encounter",
    type: "night_dive",
    duration: 240,
    price: 149,
    maxParticipants: 8,
    minParticipants: 2,
    description:
      "A magical night dive at our secret manta ray feeding site. Watch these gentle giants glide through the lights feeding on plankton — a bucket-list experience.",
    inclusionsStr: "Dive lights,Tanks,Weights,Dive guide,Hot beverages",
    minCertLevel: "Open Water",
  },
  {
    name: "Dusk Dive",
    type: "single_dive",
    duration: 150,
    price: 79,
    maxParticipants: 10,
    minParticipants: 1,
    description:
      "Dive as the sun sets and the reef transitions from day to night life. The golden hour underwater is truly spectacular.",
    inclusionsStr: "Tanks,Weights,Dive guide",
    minCertLevel: "Open Water",
  },
  {
    name: "Underwater Photography Tour",
    type: "single_dive",
    duration: 240,
    price: 119,
    maxParticipants: 6,
    minParticipants: 1,
    description:
      "A slow-paced, photography-focused dive led by our underwater photography specialist. Learn tips and techniques while capturing stunning marine life images.",
    inclusionsStr: "Tanks,Weights,Photography guide,Post-dive image review",
    minCertLevel: "Open Water",
  },
];

export async function seedTours(client: SeedClient): Promise<CreatedTour[]> {
  console.log("Seeding tours...");
  const created: CreatedTour[] = [];

  for (const spec of TOURS) {
    const csrf = await client.getCsrfToken();
    const formData = new FormData();
    formData.set("_csrf", csrf);
    formData.set("name", spec.name);
    formData.set("type", spec.type);
    formData.set("duration", String(spec.duration));
    formData.set("price", String(spec.price));
    formData.set("maxParticipants", String(spec.maxParticipants));
    formData.set("minParticipants", String(spec.minParticipants));
    formData.set("description", spec.description);
    formData.set("inclusionsStr", spec.inclusionsStr);
    if (spec.minCertLevel) {
      formData.set("minCertLevel", spec.minCertLevel);
    }
    formData.set("currency", "USD");

    const result = await client.post("/tenant/tours/new", formData);

    if (result.ok || result.status === 302) {
      const id = result.location
        ? client.extractId(result.location, "/tenant/tours/")
        : null;
      if (id) {
        created.push({ id, name: spec.name });
        console.log(`  Created tour: "${spec.name}" (id: ${id})`);
      } else {
        console.warn(`  Warning: could not extract tour ID from location: ${result.location}`);
      }
    } else {
      console.warn(`  Warning: tour "${spec.name}" returned status ${result.status}`);
    }

    await client.sleep(50);
  }

  console.log(`Tours seeded: ${created.length}/${TOURS.length}`);
  return created;
}

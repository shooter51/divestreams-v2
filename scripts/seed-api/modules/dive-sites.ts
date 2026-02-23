import type { SeedClient } from "../client";

export interface CreatedDiveSite {
  id: string;
  name: string;
}

interface DiveSiteSpec {
  name: string;
  location: string;
  description: string;
  maxDepth: number;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  conditions: string;
  latitude: number;
  longitude: number;
  highlights: string[];
}

const DIVE_SITES: DiveSiteSpec[] = [
  {
    name: "Blue Coral Garden",
    location: "South Bay",
    description: "Shallow reef teeming with blue corals, clownfish, and nudibranchs. Gentle currents make it ideal for beginners and photography.",
    maxDepth: 12,
    difficulty: "beginner",
    conditions: "Calm waters, minimal current",
    latitude: 7.165,
    longitude: 134.271,
    highlights: ["Blue corals", "Clownfish", "Nudibranchs", "Photography"],
  },
  {
    name: "Rainbow Reef",
    location: "East Channel",
    description: "Colourful soft-coral slope descending from 5 to 25 metres. Home to reef sharks, lionfish, and a resident turtle.",
    maxDepth: 25,
    difficulty: "intermediate",
    conditions: "Mild currents, good visibility",
    latitude: 7.172,
    longitude: 134.280,
    highlights: ["Soft corals", "Reef sharks", "Turtles", "Lionfish"],
  },
  {
    name: "North Reef Wall",
    location: "North Reef",
    description: "Dramatic vertical wall dive with overhangs, sea fans, and pelagic visitors. Currents can be strong at depth.",
    maxDepth: 40,
    difficulty: "advanced",
    conditions: "Strong currents at depth, excellent visibility",
    latitude: 7.185,
    longitude: 134.265,
    highlights: ["Wall dive", "Sea fans", "Pelagics", "Overhangs"],
  },
  {
    name: "Deep Reef Drop-off",
    location: "Outer Reef",
    description: "A sheer drop-off plunging past 45 metres. Schools of barracuda, eagle rays, and occasional hammerheads patrol the blue.",
    maxDepth: 45,
    difficulty: "expert",
    conditions: "Strong currents, deep water, advanced buoyancy required",
    latitude: 7.190,
    longitude: 134.290,
    highlights: ["Drop-off", "Barracuda", "Eagle rays", "Hammerheads"],
  },
  {
    name: "The Anchor Wreck",
    location: "West Bay",
    description: "WWII-era cargo vessel resting at 22 metres, heavily colonised by corals and sponges. Penetration possible for qualified divers.",
    maxDepth: 28,
    difficulty: "advanced",
    conditions: "Moderate currents, reduced visibility near wreck",
    latitude: 7.160,
    longitude: 134.255,
    highlights: ["Wreck dive", "Coral growth", "Sponges", "Penetration"],
  },
  {
    name: "Turtle Bay",
    location: "South Bay",
    description: "Sheltered bay with seagrass beds and a cleaning station. Green and hawksbill turtles are guaranteed on every dive.",
    maxDepth: 14,
    difficulty: "beginner",
    conditions: "Calm, sheltered waters",
    latitude: 7.158,
    longitude: 134.268,
    highlights: ["Green turtles", "Hawksbill turtles", "Seagrass", "Cleaning station"],
  },
  {
    name: "Manta Point",
    location: "Outer Reef",
    description: "Open-water cleaning station where reef mantas gather seasonally. Best from November to April when plankton blooms peak.",
    maxDepth: 20,
    difficulty: "intermediate",
    conditions: "Open ocean swells, seasonal currents",
    latitude: 7.195,
    longitude: 134.285,
    highlights: ["Manta rays", "Cleaning station", "Open water", "Seasonal"],
  },
  {
    name: "Shark Bay",
    location: "North Reef",
    description: "Deep channel where grey reef sharks, whitetip sharks, and nurse sharks congregate. Strong currents demand solid drift-dive skills.",
    maxDepth: 35,
    difficulty: "advanced",
    conditions: "Strong currents, drift dive",
    latitude: 7.182,
    longitude: 134.275,
    highlights: ["Grey reef sharks", "Whitetip sharks", "Nurse sharks", "Drift dive"],
  },
];

export async function seedDiveSites(client: SeedClient): Promise<CreatedDiveSite[]> {
  console.log("Seeding dive sites...");
  const created: CreatedDiveSite[] = [];

  for (const spec of DIVE_SITES) {
    const csrf = await client.getCsrfToken();
    const formData = new FormData();
    formData.set("_csrf", csrf);
    formData.set("name", spec.name);
    formData.set("location", spec.location);
    formData.set("description", spec.description);
    formData.set("maxDepth", String(spec.maxDepth));
    formData.set("difficulty", spec.difficulty);
    formData.set("conditions", spec.conditions);
    formData.set("latitude", String(spec.latitude));
    formData.set("longitude", String(spec.longitude));
    formData.set("highlights", spec.highlights.join(", "));
    formData.set("isActive", "true");

    const result = await client.post("/tenant/dive-sites/new", formData);

    if (result.ok || result.status === 302) {
      const id = result.location
        ? client.extractId(result.location, "/tenant/dive-sites/")
        : null;
      if (id) {
        created.push({ id, name: spec.name });
        console.log(`  Created dive site: "${spec.name}" (id: ${id})`);
      } else {
        console.warn(`  Warning: could not extract dive site ID from location: ${result.location}`);
      }
    } else {
      console.warn(`  Warning: dive site "${spec.name}" returned status ${result.status}`);
    }

    await client.sleep(50);
  }

  console.log(`Dive sites seeded: ${created.length}/${DIVE_SITES.length}`);
  return created;
}

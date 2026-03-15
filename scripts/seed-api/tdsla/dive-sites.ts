import type { SeedClient } from "../client";
import type { CreatedDiveSite } from "../modules/dive-sites";
import { uploadImage, randomPhoto } from "../images";

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

// Real Southern California dive sites with actual coordinates
const DIVE_SITES: DiveSiteSpec[] = [
  {
    name: "Casino Point, Avalon",
    location: "Catalina Island",
    description:
      "Catalina's most famous shore dive and an underwater park since 1965. " +
      "Giant kelp forests tower above rocky reefs teeming with bright orange garibaldi, " +
      "horn sharks, moray eels, and lobster. Visibility regularly exceeds 20 metres. " +
      "The underwater park is protected — no collecting or spearfishing allowed.",
    maxDepth: 30,
    difficulty: "beginner",
    conditions: "Generally calm, mild thermocline at 15m, excellent visibility year-round",
    latitude: 33.3428,
    longitude: -118.3287,
    highlights: ["Kelp forest", "Garibaldi", "Horn sharks", "Moray eels", "Marine park"],
  },
  {
    name: "Blue Cavern, Catalina",
    location: "Catalina Island",
    description:
      "A dramatic rock formation on Catalina's leeward coast with swim-throughs, " +
      "sea caves, and a resident colony of California sea lions. The rocky walls are " +
      "carpeted with colorful invertebrates — Spanish shawl nudibranchs, strawberry " +
      "anemones, and gorgonian fans.",
    maxDepth: 25,
    difficulty: "intermediate",
    conditions: "Light to moderate current, good visibility, sea lion interactions common",
    latitude: 33.4517,
    longitude: -118.4867,
    highlights: ["Swim-throughs", "Sea lions", "Nudibranchs", "Gorgonian fans"],
  },
  {
    name: "Farnsworth Bank",
    location: "Catalina Island",
    description:
      "An offshore pinnacle rising from 90m to within 18m of the surface, famous for " +
      "its rare purple hydrocoral — found nowhere else in California at these depths. " +
      "Pelagic visitors include blue sharks, yellowtail, and the occasional mola mola. " +
      "Advanced dive requiring proper planning and surface support.",
    maxDepth: 45,
    difficulty: "expert",
    conditions: "Strong currents common, open ocean swells, excellent visibility (25m+), thermocline",
    latitude: 33.3417,
    longitude: -118.5217,
    highlights: ["Purple hydrocoral", "Blue sharks", "Yellowtail", "Mola mola", "Deep pinnacle"],
  },
  {
    name: "Italian Gardens, Catalina",
    location: "Catalina Island",
    description:
      "Named for its terraced rock formations resembling Italian hillside gardens. " +
      "Lush kelp forest with dense invertebrate walls, including vibrant purple " +
      "and orange sea urchins, bat stars, and nudibranch species. A relaxing, " +
      "scenic dive suitable for all levels.",
    maxDepth: 24,
    difficulty: "beginner",
    conditions: "Calm, sheltered, excellent visibility",
    latitude: 33.4483,
    longitude: -118.4917,
    highlights: ["Kelp forest", "Bat stars", "Sea urchins", "Nudibranchs", "Scenic terrain"],
  },
  {
    name: "Ship Rock, Catalina",
    location: "Catalina Island",
    description:
      "A massive rock formation jutting from the water's surface, surrounded by " +
      "a California sea lion rookery. Below the surface, vertical walls plunge " +
      "to 30m covered in golden gorgonians and surrounded by schooling blacksmith " +
      "fish. Sea lions often join divers underwater.",
    maxDepth: 30,
    difficulty: "intermediate",
    conditions: "Moderate current, surge near surface, outstanding visibility",
    latitude: 33.4583,
    longitude: -118.4833,
    highlights: ["Sea lion rookery", "Wall dive", "Gorgonians", "Blacksmith schools"],
  },
  {
    name: "Veteran's Park, Redondo Beach",
    location: "Redondo Beach",
    description:
      "Our home dive site and the best shore dive in the South Bay. Sandy bottom " +
      "transitions to rocky reef with resident octopus, bat rays, angel sharks, and " +
      "occasional giant black sea bass. Night dives here are legendary — market squid " +
      "runs light up the water in winter.",
    maxDepth: 15,
    difficulty: "beginner",
    conditions: "Variable surf entry, sandy to rocky, seasonal visibility (3-15m)",
    latitude: 33.8367,
    longitude: -118.3917,
    highlights: ["Shore dive", "Octopus", "Bat rays", "Angel sharks", "Night diving"],
  },
  {
    name: "Redondo Submarine Canyon",
    location: "Redondo Beach",
    description:
      "One of the deepest submarine canyons close to shore in California. The canyon " +
      "rim starts at just 15m and drops to over 300m. Giant black sea bass, angel " +
      "sharks, sevengill sharks, and soupfin sharks patrol the canyon edges. " +
      "An advanced dive site with significant depth potential.",
    maxDepth: 40,
    difficulty: "advanced",
    conditions: "Strong thermocline, variable visibility, depth management critical",
    latitude: 33.835,
    longitude: -118.395,
    highlights: ["Submarine canyon", "Giant black sea bass", "Sevengill sharks", "Angel sharks"],
  },
  {
    name: "Malaga Cove, Palos Verdes",
    location: "Palos Verdes Peninsula",
    description:
      "A rocky reef system along the Palos Verdes coastline with dense kelp canopy " +
      "and incredible macro life. Nudibranchs, hermit crabs, decorator crabs, and " +
      "octopus hide among the rocky crevices. Shore entry via a steep trail — " +
      "worth every step.",
    maxDepth: 20,
    difficulty: "intermediate",
    conditions: "Rocky entry, surge possible, variable visibility, kelp navigation required",
    latitude: 33.7967,
    longitude: -118.4133,
    highlights: ["Kelp forest", "Nudibranchs", "Octopus", "Rocky reef", "Macro photography"],
  },
  {
    name: "Leo Carrillo State Beach",
    location: "Malibu",
    description:
      "A beautiful reef just north of Malibu with sea caves, kelp forest, and " +
      "abundant marine life. Lobster, sheephead, and moray eels are common. " +
      "The sea caves on the north end are accessible at low tide and make for " +
      "dramatic photo opportunities.",
    maxDepth: 18,
    difficulty: "beginner",
    conditions: "Sandy entry, mild surge, good visibility on calm days",
    latitude: 34.045,
    longitude: -118.9367,
    highlights: ["Sea caves", "Kelp forest", "Lobster", "Sheephead", "Moray eels"],
  },
  {
    name: "Anacapa Island",
    location: "Channel Islands National Park",
    description:
      "The closest Channel Island to the mainland and part of the Channel Islands " +
      "National Marine Sanctuary. Pristine kelp forests, giant sea bass, and " +
      "vibrant invertebrate walls. Cathedral Cove offers one of California's " +
      "most breathtaking underwater landscapes.",
    maxDepth: 30,
    difficulty: "intermediate",
    conditions: "Ocean crossing required, currents vary, outstanding visibility (15-30m)",
    latitude: 34.0133,
    longitude: -119.365,
    highlights: ["National Marine Sanctuary", "Giant sea bass", "Cathedral Cove", "Kelp forests"],
  },
];

export async function seedTdslaDiveSites(client: SeedClient): Promise<CreatedDiveSite[]> {
  console.log("Seeding TDSLA dive sites...");
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

        // Upload 2 images per dive site
        const categories = ["reef", "wide-angle", "macro"] as const;
        for (let i = 0; i < 2; i++) {
          const photo = randomPhoto(categories[i % categories.length]);
          const alt = `${spec.name} - photo ${i + 1}`;
          const img = await uploadImage(client, "dive-site", id, photo, alt);
          if (img) console.log(`    📷 Image ${i + 1} uploaded`);
          await client.sleep(200);
        }
      } else {
        console.warn(`  Warning: could not extract dive site ID from location: ${result.location}`);
      }
    } else {
      console.warn(`  Warning: dive site "${spec.name}" returned status ${result.status}`);
    }

    await client.sleep(50);
  }

  console.log(`  TDSLA dive sites seeded: ${created.length}/${DIVE_SITES.length}`);
  return created;
}

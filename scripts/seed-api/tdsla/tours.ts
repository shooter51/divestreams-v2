import type { SeedClient } from "../client";
import type { CreatedTour } from "../modules/tours";
import { uploadImage, randomPhoto, type PhotoCategory } from "../images";

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
  photoCategory?: PhotoCategory;
}

const TOURS: TourSpec[] = [
  {
    name: "Catalina Two-Tank Express",
    type: "multi_dive",
    duration: 600, // 10 hours (6AM-4PM)
    price: 189,
    maxParticipants: 22,
    minParticipants: 6,
    description:
      "Our signature trip. Depart King Harbor at 6 AM for a scenic crossing to Catalina Island. " +
      "Two dives at premier sites like Casino Point, Italian Gardens, or Blue Cavern — chosen " +
      "based on the day's conditions. Hot lunch on board between dives. Back at the dock by 4 PM.",
    inclusionsStr: "Tanks,Weights,Hot lunch,Snacks & drinks,Dive guide,Boat crossing",
    minCertLevel: "Open Water",
    photoCategory: "reef",
  },
  {
    name: "Local Beach Dive",
    type: "single_dive",
    duration: 180,
    price: 69,
    maxParticipants: 8,
    minParticipants: 2,
    description:
      "Guided shore dive at one of our local gems — Veteran's Park, Malaga Cove, or Leo Carrillo. " +
      "Perfect for divers who want to explore SoCal's underrated mainland sites. Our guides know " +
      "every octopus den and cleaning station.",
    inclusionsStr: "Dive guide,Site briefing,Parking pass",
    minCertLevel: "Open Water",
    photoCategory: "reef",
  },
  {
    name: "Night Dive at Veteran's Park",
    type: "night_dive",
    duration: 180,
    price: 79,
    maxParticipants: 6,
    minParticipants: 2,
    description:
      "Experience Redondo Beach after dark. Market squid mating runs in winter, hunting octopus " +
      "year-round, bioluminescent plankton on moonless nights, and sleeping garibaldi tucked into " +
      "the reef. One of SoCal's best night dives — right on our doorstep.",
    inclusionsStr: "Primary dive light,Backup light,Tanks,Weights,Dive guide,Hot chocolate",
    minCertLevel: "Open Water",
    photoCategory: "night",
  },
  {
    name: "Channel Islands Adventure",
    type: "multi_dive",
    duration: 720, // 12 hours
    price: 259,
    maxParticipants: 22,
    minParticipants: 8,
    description:
      "Full-day expedition to the Channel Islands National Marine Sanctuary. Typically Anacapa " +
      "or Santa Cruz Island with 3 dives in pristine waters rarely visited by other operators. " +
      "Expect giant sea bass, harbor seals, and visibility that'll remind you of the tropics.",
    inclusionsStr: "Tanks (3 dives),Weights,Hot breakfast,Lunch,Snacks,Dive guide,Marine sanctuary briefing",
    minCertLevel: "Open Water",
    photoCategory: "wide-angle",
  },
  {
    name: "Kelp Forest Photo Safari",
    type: "single_dive",
    duration: 300,
    price: 149,
    maxParticipants: 8,
    minParticipants: 2,
    description:
      "A slow-paced, photography-focused dive through Catalina's iconic kelp forests. " +
      "Led by our underwater photography specialist, you'll learn composition techniques " +
      "for shooting in kelp, macro subjects, and wide-angle reef scenes. Post-dive " +
      "image review on the boat.",
    inclusionsStr: "Tanks,Weights,Photography guide,GoPro rental (optional),Post-dive image review",
    minCertLevel: "Open Water",
    photoCategory: "macro",
  },
  {
    name: "Shark & Ray Canyon Dive",
    type: "single_dive",
    duration: 240,
    price: 129,
    maxParticipants: 10,
    minParticipants: 2,
    description:
      "Descend to the rim of the Redondo Submarine Canyon to encounter angel sharks, bat rays, " +
      "shovelnose guitarfish, and — if you're lucky — giant black sea bass. Our guides know the " +
      "canyon's edges intimately and will position you for the best encounters.",
    inclusionsStr: "Tanks,Weights,Dive guide,Canyon briefing",
    minCertLevel: "Advanced Open Water",
    photoCategory: "wide-angle",
  },
  {
    name: "Discover Scuba at Casino Point",
    type: "single_dive",
    duration: 360,
    price: 199,
    maxParticipants: 4,
    minParticipants: 1,
    description:
      "No certification required. Experience your first breath underwater in Catalina's " +
      "crystal-clear Casino Point marine park. Includes the boat ride to Avalon, a " +
      "poolside skills session, and a guided dive to 12 metres among kelp and garibaldi. " +
      "Minimum age 10.",
    inclusionsStr: "All equipment,Instructor,Boat crossing,Pool session,Underwater photos,Lunch",
    minCertLevel: "",
    photoCategory: "reef",
  },
  {
    name: "Palos Verdes Dive & Sail",
    type: "multi_dive",
    duration: 360,
    price: 219,
    maxParticipants: 8,
    minParticipants: 2,
    description:
      "A unique experience aboard our sailboat Blue Nomad. Sail the Palos Verdes coastline, " +
      "anchor at two dive sites along the peninsula, and explore rocky reefs with kelp canopy. " +
      "Finish with sunset drinks as we sail back to King Harbor.",
    inclusionsStr: "Tanks (2 dives),Weights,Dive guide,Sailing experience,Sunset drinks & snacks",
    minCertLevel: "Open Water",
    photoCategory: "wide-angle",
  },
  {
    name: "Farnsworth Bank Deep Dive",
    type: "single_dive",
    duration: 480,
    price: 199,
    maxParticipants: 10,
    minParticipants: 4,
    description:
      "The crown jewel for experienced divers. Descend to Farnsworth Bank's famous purple " +
      "hydrocoral gardens at 30-40m depth. This exposed offshore pinnacle attracts pelagics — " +
      "blue sharks, yellowtail, and the occasional ocean sunfish. Deep specialty or equivalent required.",
    inclusionsStr: "Tanks,Weights,Nitrox option,Dive guide,Deep briefing,Safety diver,Hot lunch",
    minCertLevel: "Advanced Open Water",
    photoCategory: "wide-angle",
  },
  {
    name: "Sunset Beach Dive",
    type: "single_dive",
    duration: 150,
    price: 59,
    maxParticipants: 8,
    minParticipants: 2,
    description:
      "Catch the golden hour underwater at Veteran's Park. As the sun drops, the reef " +
      "transitions from day to night — hunting octopus emerge, lobster antenna poke from " +
      "crevices, and the light filtering through kelp is pure magic. Perfect bridge between " +
      "your last day dive and your first night dive.",
    inclusionsStr: "Tanks,Weights,Dive guide",
    minCertLevel: "Open Water",
    photoCategory: "reef",
  },
];

export async function seedTdslaTours(client: SeedClient): Promise<CreatedTour[]> {
  console.log("Seeding TDSLA tours...");
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

        // Upload 2 images per tour
        const category = spec.photoCategory ?? "reef";
        for (let i = 0; i < 2; i++) {
          const photo = randomPhoto(category);
          const alt = `${spec.name} - photo ${i + 1}`;
          const img = await uploadImage(client, "tour", id, photo, alt);
          if (img) console.log(`    📷 Image ${i + 1} uploaded`);
          await client.sleep(200);
        }
      } else {
        console.warn(`  Warning: could not extract tour ID from location: ${result.location}`);
      }
    } else {
      console.warn(`  Warning: tour "${spec.name}" returned status ${result.status}`);
    }

    await client.sleep(50);
  }

  console.log(`  TDSLA tours seeded: ${created.length}/${TOURS.length}`);
  return created;
}

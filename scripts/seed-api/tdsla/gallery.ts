import type { SeedClient } from "../client";
import { sleep } from "../client";
import { getImageBytes } from "../images";

interface Album {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  images: { photoId: string; title: string; category: string; location: string }[];
}

// Verified working Unsplash photo IDs with California diving themes
const ALBUMS: Album[] = [
  {
    name: "Catalina Island",
    slug: "catalina-island",
    description: "Crystal-clear waters and towering kelp forests just 26 miles off the coast",
    sortOrder: 0,
    images: [
      { photoId: "1544551763-46a013bb70d5", title: "Kelp Forest Cathedral", category: "kelp-forests", location: "Casino Point, Avalon" },
      { photoId: "1559825481-12a05cc00344", title: "Garibaldi in the Gardens", category: "marine-life", location: "Italian Gardens, Catalina" },
      { photoId: "1583212292454-1fe6229603b7", title: "Blue Cavern Swim-Through", category: "dive-sites", location: "Blue Cavern, Catalina" },
      { photoId: "1682687220742-aba13b6e50ba", title: "Ship Rock Sea Lions", category: "marine-life", location: "Ship Rock, Catalina" },
    ],
  },
  {
    name: "Channel Islands",
    slug: "channel-islands",
    description: "Pristine national marine sanctuary diving — California's Galapagos",
    sortOrder: 1,
    images: [
      { photoId: "1547592180-85f173990554", title: "Anacapa Kelp Forest", category: "kelp-forests", location: "Anacapa Island" },
      { photoId: "1560275619-4662e36fa65c", title: "Giant Sea Bass Encounter", category: "marine-life", location: "Santa Cruz Island" },
      { photoId: "1571752726703-5e7d1f6a986d", title: "Rocky Reef Wall", category: "dive-sites", location: "Anacapa Island" },
      { photoId: "1516690561799-46d8f74f9abf", title: "Harbor Seal Interaction", category: "marine-life", location: "Santa Cruz Island" },
    ],
  },
  {
    name: "Local Shore Dives",
    slug: "local-shore-dives",
    description: "World-class diving right from the beach — the best of Redondo Beach and Palos Verdes",
    sortOrder: 2,
    images: [
      { photoId: "1544551763-77ef2d0cfc6c", title: "Octopus at Veteran's Park", category: "marine-life", location: "Veteran's Park, Redondo Beach" },
      { photoId: "1582967788606-a171c1080cb0", title: "Angel Shark Encounter", category: "marine-life", location: "Redondo Submarine Canyon" },
      { photoId: "1559825481-12a05cc00344", title: "Nudibranch Macro", category: "macro", location: "Malaga Cove, Palos Verdes" },
      { photoId: "1683009427513-28e163402137", title: "Kelp Canopy Light", category: "kelp-forests", location: "Leo Carrillo State Beach" },
    ],
  },
  {
    name: "Night Dives",
    slug: "night-dives",
    description: "Market squid runs, hunting octopus, and bioluminescence under the stars",
    sortOrder: 3,
    images: [
      { photoId: "1560275619-4662e36fa65c", title: "Hunting Octopus", category: "marine-life", location: "Veteran's Park Night Dive" },
      { photoId: "1582967788606-a171c1080cb0", title: "Squid Run", category: "marine-life", location: "Redondo Beach" },
      { photoId: "1571752726703-5e7d1f6a986d", title: "Lobster on the Reef", category: "marine-life", location: "Malaga Cove Night Dive" },
      { photoId: "1544551763-46a013bb70d5", title: "Torch-Lit Kelp", category: "underwater", location: "Casino Point Night Dive" },
    ],
  },
  {
    name: "Our Students",
    slug: "students",
    description: "Celebrating certifications and first underwater breaths since 2012",
    sortOrder: 4,
    images: [
      { photoId: "1559825481-12a05cc00344", title: "Open Water Skills Session", category: "training", location: "Pool — The Dive Shop LA" },
      { photoId: "1583212292454-1fe6229603b7", title: "First Open Water Dive!", category: "training", location: "Casino Point, Catalina" },
      { photoId: "1544551763-46a013bb70d5", title: "New Divemaster!", category: "training", location: "The Dive Shop LA" },
      { photoId: "1547592180-85f173990554", title: "Rescue Diver Scenario", category: "training", location: "Veteran's Park" },
    ],
  },
  {
    name: "Our Fleet",
    slug: "fleet",
    description: "Meet Channel Diver, Sea Phantom, Kelp Runner, and Blue Nomad",
    sortOrder: 5,
    images: [
      { photoId: "1571752726703-5e7d1f6a986d", title: "Channel Diver at Catalina", category: "boats", location: "Avalon Harbor" },
      { photoId: "1559825481-12a05cc00344", title: "Sea Phantom — Channel Islands", category: "boats", location: "Anacapa Island" },
      { photoId: "1560275619-4662e36fa65c", title: "Kelp Runner in King Harbor", category: "boats", location: "King Harbor, Redondo Beach" },
      { photoId: "1544551763-77ef2d0cfc6c", title: "Blue Nomad — Sail & Dive", category: "boats", location: "Palos Verdes Coastline" },
    ],
  },
  {
    name: "Reef Guardian Program",
    slug: "reef-guardian",
    description: "Our citizen science and conservation program — protecting California's kelp forests",
    sortOrder: 6,
    images: [
      { photoId: "1682687220742-aba13b6e50ba", title: "Kelp Forest Survey", category: "conservation", location: "Catalina Island" },
      { photoId: "1547592180-85f173990554", title: "Reef Check Data Collection", category: "conservation", location: "Palos Verdes" },
      { photoId: "1583212292454-1fe6229603b7", title: "Beach Cleanup Day", category: "conservation", location: "Redondo Beach" },
      { photoId: "1516690561799-46d8f74f9abf", title: "Urchin Barren Restoration", category: "conservation", location: "Catalina Island" },
    ],
  },
];

export async function seedTdslaGallery(client: SeedClient): Promise<void> {
  console.log("Seeding TDSLA gallery...");

  for (const album of ALBUMS) {
    const albumFd = new FormData();
    const albumCsrf = await client.getCsrfToken();
    albumFd.append("_csrf", albumCsrf);
    albumFd.append("name", album.name);
    albumFd.append("slug", album.slug);
    albumFd.append("description", album.description);
    albumFd.append("sortOrder", String(album.sortOrder));
    albumFd.append("isPublic", "true");

    const albumResult = await client.post("/tenant/gallery/new", albumFd);
    const albumId = albumResult.location ? client.extractId(albumResult.location, "/tenant/gallery/") : null;

    if (!albumId) {
      console.warn(`  Warning: Album "${album.name}" — could not extract ID`);
      await sleep(100);
      continue;
    }

    console.log(`  Album: ${album.name} (${albumId.slice(0, 8)}...)`);
    await sleep(100);

    for (const img of album.images) {
      try {
        const imageBytes = await getImageBytes(img.photoId);
        const blob = new Blob([imageBytes], { type: "image/jpeg" });

        const imgFd = new FormData();
        const imgCsrf = await client.getCsrfToken();
        imgFd.append("_csrf", imgCsrf);
        imgFd.append("albumId", albumId);
        imgFd.append("file", blob, `${img.photoId}.jpg`);
        imgFd.append("title", img.title);
        imgFd.append("category", img.category);
        imgFd.append("location", img.location);

        const imgResult = await client.post("/tenant/gallery/upload", imgFd);
        if (!imgResult.ok && imgResult.status !== 302 && imgResult.status !== 303) {
          console.warn(`    Warning: Image "${img.title}" returned ${imgResult.status}`);
        } else {
          console.log(`    Image: ${img.title}`);
        }
      } catch (err) {
        console.warn(`    Warning: Image "${img.title}" failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      await sleep(100);
    }
  }

  console.log("  TDSLA gallery seeded.");
}

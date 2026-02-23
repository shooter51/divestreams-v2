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

// All photo IDs verified working as of 2026-02-23
const ALBUMS: Album[] = [
  {
    name: "Reef Dives",
    slug: "reef-dives",
    description: "Stunning coral reef explorations from our local dive sites",
    sortOrder: 0,
    images: [
      { photoId: "1559825481-12a05cc00344", title: "Coral Garden Reef", category: "coral-reefs", location: "Blue Coral Garden" },
      { photoId: "1583212292454-1fe6229603b7", title: "Reef Fish Schools", category: "coral-reefs", location: "Rainbow Reef" },
      { photoId: "1544551763-46a013bb70d5", title: "Hard Coral Formation", category: "coral-reefs", location: "North Reef Wall" },
      { photoId: "1682687220742-aba13b6e50ba", title: "Sea Fan Colony", category: "coral-reefs", location: "Deep Reef Drop-off" },
    ],
  },
  {
    name: "Wreck Diving",
    slug: "wreck-diving",
    description: "Exploring historic shipwrecks and their marine inhabitants",
    sortOrder: 1,
    images: [
      { photoId: "1571752726703-5e7d1f6a986d", title: "SS Liberty Wreck", category: "wrecks", location: "SS Liberty, Tulamben" },
      { photoId: "1544551763-77ef2d0cfc6c", title: "Wreck Bow Section", category: "wrecks", location: "USAT Liberty" },
      { photoId: "1560275619-4662e36fa65c", title: "Coral-Encrusted Anchor", category: "wrecks", location: "Anchor Wreck Site" },
      { photoId: "1582967788606-a171c1080cb0", title: "Inside the Wreck", category: "wrecks", location: "Sunken Cargo Ship" },
    ],
  },
  {
    name: "Marine Life",
    slug: "marine-life",
    description: "The incredible diversity of marine creatures we encounter",
    sortOrder: 2,
    images: [
      { photoId: "1544551763-77ef2d0cfc6c", title: "Sea Turtle Encounter", category: "marine-life", location: "Turtle Bay" },
      { photoId: "1547592180-85f173990554", title: "Manta Ray Pass", category: "marine-life", location: "Manta Point" },
      { photoId: "1583212292454-1fe6229603b7", title: "Clownfish Family", category: "marine-life", location: "Anemone Garden" },
      { photoId: "1516690561799-46d8f74f9abf", title: "Reef Shark Patrol", category: "marine-life", location: "Shark Bay" },
    ],
  },
  {
    name: "Night Dives",
    slug: "night-dives",
    description: "The ocean transforms after dark - magical bioluminescence and nocturnal creatures",
    sortOrder: 3,
    images: [
      { photoId: "1560275619-4662e36fa65c", title: "Octopus Hunt", category: "underwater", location: "Night Beach Dive" },
      { photoId: "1582967788606-a171c1080cb0", title: "Bioluminescent Plankton", category: "underwater", location: "Plankton Bay" },
      { photoId: "1571752726703-5e7d1f6a986d", title: "Lobster on the Move", category: "marine-life", location: "Rocky Night Site" },
      { photoId: "1544551763-46a013bb70d5", title: "Sleeping Fish", category: "marine-life", location: "Coral Night Site" },
    ],
  },
  {
    name: "Students",
    slug: "students",
    description: "Our students learning and achieving their dive certifications",
    sortOrder: 4,
    images: [
      { photoId: "1559825481-12a05cc00344", title: "Open Water Training", category: "customers", location: "Pool - Main Center" },
      { photoId: "1583212292454-1fe6229603b7", title: "First Open Water Dive", category: "customers", location: "Beginner Beach Site" },
      { photoId: "1544551763-46a013bb70d5", title: "Certification Day!", category: "customers", location: "Main Dive Center" },
      { photoId: "1547592180-85f173990554", title: "Buoyancy Practice", category: "customers", location: "Pool - Main Center" },
    ],
  },
  {
    name: "Equipment Showcase",
    slug: "equipment-showcase",
    description: "Our premium dive equipment available for rental and purchase",
    sortOrder: 5,
    images: [
      { photoId: "1571752726703-5e7d1f6a986d", title: "Premium BCD Collection", category: "equipment", location: "Equipment Room" },
      { photoId: "1559825481-12a05cc00344", title: "Regulator Setup", category: "equipment", location: "Service Center" },
      { photoId: "1583212292454-1fe6229603b7", title: "Wetsuit Selection", category: "equipment", location: "Gear Room" },
      { photoId: "1560275619-4662e36fa65c", title: "Mask and Fins Display", category: "equipment", location: "Equipment Store" },
    ],
  },
];

export async function seedGallery(client: SeedClient): Promise<void> {
  for (const album of ALBUMS) {
    // Create album
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
      console.warn(`  ⚠ Album "${album.name}" created but could not extract ID (location: ${albumResult.location})`);
      await sleep(100);
      continue;
    }

    console.log(`  ✓ Album: ${album.name} (${albumId.slice(0, 8)}...)`);
    await sleep(100);

    // Upload images for this album
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
          console.warn(`    ⚠ Image "${img.title}" may have failed (status ${imgResult.status})`);
        } else {
          console.log(`    ✓ Image: ${img.title}`);
        }
      } catch (err) {
        console.warn(`    ⚠ Image "${img.title}" failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      await sleep(100);
    }
  }
}

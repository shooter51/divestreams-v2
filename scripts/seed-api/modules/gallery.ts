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

const ALBUMS: Album[] = [
  {
    name: "Reef Dives",
    slug: "reef-dives",
    description: "Stunning coral reef explorations from our local dive sites",
    sortOrder: 0,
    images: [
      { photoId: "1559827291-72783e8a3bc2", title: "Coral Garden Reef", category: "coral-reefs", location: "Blue Coral Garden" },
      { photoId: "1583212292-8ffe92f6f7e6", title: "Reef Fish Schools", category: "coral-reefs", location: "Rainbow Reef" },
      { photoId: "1544551763-46a013bb70d5", title: "Hard Coral Formation", category: "coral-reefs", location: "North Reef Wall" },
      { photoId: "1518877593-74b7a8d4d19a", title: "Sea Fan Colony", category: "coral-reefs", location: "Deep Reef Drop-off" },
    ],
  },
  {
    name: "Wreck Diving",
    slug: "wreck-diving",
    description: "Exploring historic shipwrecks and their marine inhabitants",
    sortOrder: 1,
    images: [
      { photoId: "1597289124234-b702c3e9c5e7", title: "SS Liberty Wreck", category: "wrecks", location: "SS Liberty, Tulamben" },
      { photoId: "1566438480900-0ed1eea8899e", title: "Wreck Bow Section", category: "wrecks", location: "USAT Liberty" },
      { photoId: "1560275619-4cc5fa59d671", title: "Coral-Encrusted Anchor", category: "wrecks", location: "Anchor Wreck Site" },
      { photoId: "1590523741831-ab7e8b8f9c7a", title: "Inside the Wreck", category: "wrecks", location: "Sunken Cargo Ship" },
    ],
  },
  {
    name: "Marine Life",
    slug: "marine-life",
    description: "The incredible diversity of marine creatures we encounter",
    sortOrder: 2,
    images: [
      { photoId: "1544551763-77ef2d047051", title: "Sea Turtle Encounter", category: "marine-life", location: "Turtle Bay" },
      { photoId: "1520366498724-09d887e4e791", title: "Manta Ray Pass", category: "marine-life", location: "Manta Point" },
      { photoId: "1500743558285-f37e0d396397", title: "Clownfish Family", category: "marine-life", location: "Anemone Garden" },
      { photoId: "1516690561799-46d8f74f9abf", title: "Reef Shark Patrol", category: "marine-life", location: "Shark Bay" },
    ],
  },
  {
    name: "Night Dives",
    slug: "night-dives",
    description: "The ocean transforms after dark - magical bioluminescence and nocturnal creatures",
    sortOrder: 3,
    images: [
      { photoId: "1566073771259-777d2f984d8b", title: "Octopus Hunt", category: "underwater", location: "Night Beach Dive" },
      { photoId: "1548247416-ec66f4831d5b", title: "Bioluminescent Plankton", category: "underwater", location: "Plankton Bay" },
      { photoId: "1540202573560-49abb9e08b13", title: "Lobster on the Move", category: "marine-life", location: "Rocky Night Site" },
      { photoId: "1517639177637-5bda3cfa28cf", title: "Sleeping Fish", category: "marine-life", location: "Coral Night Site" },
    ],
  },
  {
    name: "Students",
    slug: "students",
    description: "Our students learning and achieving their dive certifications",
    sortOrder: 4,
    images: [
      { photoId: "1581092334651-ddf19f1da69d", title: "Open Water Training", category: "customers", location: "Pool - Main Center" },
      { photoId: "1587738972680-40e77e1e5b99", title: "First Open Water Dive", category: "customers", location: "Beginner Beach Site" },
      { photoId: "1510834253938-52e6eb09dfad", title: "Certification Day!", category: "customers", location: "Main Dive Center" },
      { photoId: "1614850523638-8c7c8ba79db5", title: "Buoyancy Practice", category: "customers", location: "Pool - Main Center" },
    ],
  },
  {
    name: "Equipment Showcase",
    slug: "equipment-showcase",
    description: "Our premium dive equipment available for rental and purchase",
    sortOrder: 5,
    images: [
      { photoId: "1593352216-5f77f49af6bb", title: "Premium BCD Collection", category: "equipment", location: "Equipment Room" },
      { photoId: "1576073637366-18b0bed9a21e", title: "Regulator Setup", category: "equipment", location: "Service Center" },
      { photoId: "1561913376-48ef9d8b8bef", title: "Wetsuit Selection", category: "equipment", location: "Gear Room" },
      { photoId: "1504386106765-9c24f2c3e869", title: "Mask and Fins Display", category: "equipment", location: "Equipment Store" },
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

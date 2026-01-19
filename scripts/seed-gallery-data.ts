/**
 * Seed Gallery Data Script
 *
 * Creates sample gallery albums and images for testing the gallery feature.
 * Run with: npx tsx scripts/seed-gallery-data.ts <organization-id>
 */

import { db } from "../lib/db/index";
import { galleryAlbums, galleryImages } from "../lib/db/schema/gallery";

const sampleAlbums = [
  {
    name: "Recent Adventures",
    slug: "recent-adventures",
    description: "Our latest dive trips and underwater discoveries",
    sortOrder: 0,
  },
  {
    name: "Coral Reefs",
    slug: "coral-reefs",
    description: "Beautiful coral reef formations and ecosystems",
    sortOrder: 1,
  },
  {
    name: "Marine Life",
    slug: "marine-life",
    description: "Amazing encounters with sea creatures",
    sortOrder: 2,
  },
  {
    name: "Wrecks & Caves",
    slug: "wrecks-caves",
    description: "Exploring underwater wrecks and cave systems",
    sortOrder: 3,
  },
  {
    name: "Our Team",
    slug: "our-team",
    description: "Meet our experienced diving instructors and staff",
    sortOrder: 4,
  },
  {
    name: "Happy Customers",
    slug: "happy-customers",
    description: "Photos from our wonderful diving guests",
    sortOrder: 5,
  },
];

const sampleImages = [
  // Recent Adventures
  {
    albumSlug: "recent-adventures",
    title: "Caribbean Reef Dive",
    description: "Exploring the vibrant coral reefs of the Caribbean",
    category: "coral-reefs",
    tags: ["caribbean", "reef", "tropical"],
    location: "Cozumel, Mexico",
    isFeatured: true,
    sortOrder: 0,
  },
  {
    albumSlug: "recent-adventures",
    title: "Sunset Dive Session",
    description: "Evening dive with amazing underwater visibility",
    category: "dive-sites",
    tags: ["sunset", "evening", "scenic"],
    location: "Key Largo, Florida",
    isFeatured: true,
    sortOrder: 1,
  },
  {
    albumSlug: "recent-adventures",
    title: "Group Dive Adventure",
    description: "Team dive exploring a new dive site",
    category: "customers",
    tags: ["group", "adventure", "fun"],
    location: "Bonaire",
    sortOrder: 2,
  },

  // Coral Reefs
  {
    albumSlug: "coral-reefs",
    title: "Staghorn Coral Formation",
    description: "Healthy staghorn coral ecosystem",
    category: "coral-reefs",
    tags: ["coral", "ecosystem", "reef"],
    location: "Great Barrier Reef",
    isFeatured: true,
    sortOrder: 0,
  },
  {
    albumSlug: "coral-reefs",
    title: "Brain Coral Colony",
    description: "Large brain coral with vibrant colors",
    category: "coral-reefs",
    tags: ["coral", "colorful", "macro"],
    location: "Roatan, Honduras",
    sortOrder: 1,
  },
  {
    albumSlug: "coral-reefs",
    title: "Soft Coral Garden",
    description: "Beautiful soft corals swaying in the current",
    category: "coral-reefs",
    tags: ["coral", "soft-coral", "garden"],
    location: "Red Sea, Egypt",
    sortOrder: 2,
  },

  // Marine Life
  {
    albumSlug: "marine-life",
    title: "Sea Turtle Encounter",
    description: "Peaceful green sea turtle swimming by",
    category: "marine-life",
    tags: ["turtle", "wildlife", "endangered"],
    location: "Hawaii",
    isFeatured: true,
    sortOrder: 0,
  },
  {
    albumSlug: "marine-life",
    title: "Reef Shark Patrol",
    description: "Caribbean reef shark cruising the reef",
    category: "marine-life",
    tags: ["shark", "predator", "exciting"],
    location: "Bahamas",
    isFeatured: true,
    sortOrder: 1,
  },
  {
    albumSlug: "marine-life",
    title: "School of Tropical Fish",
    description: "Colorful fish schooling over the reef",
    category: "marine-life",
    tags: ["fish", "tropical", "colorful"],
    location: "Maldives",
    sortOrder: 2,
  },
  {
    albumSlug: "marine-life",
    title: "Octopus in Hiding",
    description: "Camouflaged octopus spotted in its den",
    category: "marine-life",
    tags: ["octopus", "cephalopod", "intelligent"],
    location: "Indonesia",
    sortOrder: 3,
  },
  {
    albumSlug: "marine-life",
    title: "Manta Ray Flyby",
    description: "Majestic manta ray gliding overhead",
    category: "marine-life",
    tags: ["manta", "ray", "majestic"],
    location: "Socorro Islands",
    isFeatured: true,
    sortOrder: 4,
  },

  // Wrecks & Caves
  {
    albumSlug: "wrecks-caves",
    title: "WWII Shipwreck",
    description: "Historic shipwreck from World War II",
    category: "wrecks",
    tags: ["wreck", "history", "advanced"],
    location: "Truk Lagoon",
    sortOrder: 0,
  },
  {
    albumSlug: "wrecks-caves",
    title: "Cave Diving Adventure",
    description: "Exploring an underwater cave system",
    category: "caves",
    tags: ["cave", "technical", "exploration"],
    location: "Cenotes, Mexico",
    sortOrder: 1,
  },
  {
    albumSlug: "wrecks-caves",
    title: "Sunken Plane Wreck",
    description: "Small aircraft wreck colonized by marine life",
    category: "wrecks",
    tags: ["wreck", "plane", "artificial-reef"],
    location: "Jordan, Red Sea",
    sortOrder: 2,
  },

  // Our Team
  {
    albumSlug: "our-team",
    title: "Lead Instructor John",
    description: "PADI Course Director with 20+ years experience",
    category: "team",
    tags: ["instructor", "staff", "professional"],
    photographer: "Studio Photo",
    sortOrder: 0,
  },
  {
    albumSlug: "our-team",
    title: "Instructor Sarah",
    description: "Specialty instructor for wreck and cave diving",
    category: "team",
    tags: ["instructor", "staff", "technical"],
    photographer: "Studio Photo",
    sortOrder: 1,
  },
  {
    albumSlug: "our-team",
    title: "Team Group Photo",
    description: "Our certified dive team ready to guide you",
    category: "team",
    tags: ["team", "group", "professional"],
    photographer: "Studio Photo",
    sortOrder: 2,
  },

  // Happy Customers
  {
    albumSlug: "happy-customers",
    title: "First Time Divers",
    description: "Couple completing their first open water dive",
    category: "customers",
    tags: ["beginners", "happy", "certification"],
    location: "Local Dive Site",
    sortOrder: 0,
  },
  {
    albumSlug: "happy-customers",
    title: "Family Dive Trip",
    description: "Family enjoying a dive vacation together",
    category: "customers",
    tags: ["family", "vacation", "memories"],
    location: "Caribbean",
    sortOrder: 1,
  },
  {
    albumSlug: "happy-customers",
    title: "Advanced Certification",
    description: "Student celebrating advanced certification",
    category: "customers",
    tags: ["certification", "achievement", "proud"],
    location: "Training Center",
    sortOrder: 2,
  },
];

async function seedGalleryData(organizationId: string) {
  console.log(`Seeding gallery data for organization: ${organizationId}`);

  try {
    // Create albums
    console.log("Creating albums...");
    const createdAlbums: Record<string, any> = {};

    for (const albumData of sampleAlbums) {
      const [album] = await db
        .insert(galleryAlbums)
        .values({
          organizationId,
          name: albumData.name,
          slug: albumData.slug,
          description: albumData.description,
          sortOrder: albumData.sortOrder,
          isPublic: true,
        })
        .returning();

      createdAlbums[albumData.slug] = album;
      console.log(`  Created album: ${album.name}`);
    }

    // Create images
    console.log("\nCreating images...");
    for (const imageData of sampleImages) {
      const album = createdAlbums[imageData.albumSlug];

      if (!album) {
        console.warn(`  Warning: Album not found for slug: ${imageData.albumSlug}`);
        continue;
      }

      const [image] = await db
        .insert(galleryImages)
        .values({
          organizationId,
          albumId: album.id,
          title: imageData.title,
          description: imageData.description,
          // Using placeholder image URLs (replace with real images in production)
          imageUrl: `https://picsum.photos/seed/${imageData.title.replace(/\s+/g, "-")}/1200/800`,
          thumbnailUrl: `https://picsum.photos/seed/${imageData.title.replace(/\s+/g, "-")}/400/300`,
          category: imageData.category,
          tags: imageData.tags,
          location: imageData.location,
          photographer: imageData.photographer,
          width: 1200,
          height: 800,
          sortOrder: imageData.sortOrder,
          isFeatured: imageData.isFeatured || false,
          status: "published",
        })
        .returning();

      console.log(`  Created image: ${image.title} (${album.name})`);
    }

    console.log("\nGallery data seeded successfully!");
    console.log(`  Albums: ${sampleAlbums.length}`);
    console.log(`  Images: ${sampleImages.length}`);
  } catch (error) {
    console.error("Error seeding gallery data:", error);
    throw error;
  }
}

// Run the seed script
const organizationId = process.argv[2];

if (!organizationId) {
  console.error("Usage: npx tsx scripts/seed-gallery-data.ts <organization-id>");
  console.error("\nExample:");
  console.error("  npx tsx scripts/seed-gallery-data.ts demo");
  process.exit(1);
}

seedGalleryData(organizationId)
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to seed gallery data:", error);
    process.exit(1);
  });

/**
 * Seed Page Content
 *
 * Creates initial page content for all organizations that don't have it yet.
 * Run this after the migration to populate default About and Home pages.
 *
 * Usage: tsx scripts/seed-page-content.ts
 */

import { db } from "../lib/db";
import { organization, pageContent } from "../lib/db/schema";
import { eq, notInArray } from "drizzle-orm";
import { initializeDefaultPages } from "../lib/db/page-content.server";

async function seedPageContent() {
  console.log("🌱 Seeding page content for organizations...\n");

  try {
    // Get all organizations
    const orgs = await db.select().from(organization);

    console.log(`Found ${orgs.length} organizations\n`);

    for (const org of orgs) {
      console.log(`Processing ${org.name} (${org.slug})...`);

      // Check if organization already has pages
      const existingPages = await db
        .select({ pageId: pageContent.pageId })
        .from(pageContent)
        .where(eq(pageContent.organizationId, org.id));

      if (existingPages.length > 0) {
        console.log(
          `  ✓ Already has ${existingPages.length} page(s): ${existingPages.map((p) => p.pageId).join(", ")}`
        );
        continue;
      }

      // Initialize default pages
      await initializeDefaultPages(org.id, org.name, "system");

      console.log(`  ✓ Created default pages (about, home)`);
    }

    console.log("\n✅ Page content seeding complete!");
  } catch (error) {
    console.error("\n❌ Error seeding page content:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPageContent()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

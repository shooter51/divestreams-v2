import { seedDemoData } from "../lib/db/seed-demo-data.server";
import { db } from "../lib/db";
import { organization } from "../lib/db/schema/auth";
import { eq } from "drizzle-orm";

async function main() {
  const subdomain = process.argv[2] || "demo";
  console.log(`Seeding demo data for organization: ${subdomain}`);

  try {
    // Get the organization ID from the subdomain
    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, subdomain))
      .limit(1);

    if (!org) {
      throw new Error(`Organization with subdomain '${subdomain}' not found`);
    }

    console.log(`Found organization ID: ${org.id}`);
    await seedDemoData(org.id);
    console.log("Done!");
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed:", error);
    process.exit(1);
  }
}

main();

import { seedDemoData } from "../lib/db/seed-demo-data.server";

async function main() {
  const schemaName = process.argv[2] || "tenant_demo";
  console.log(`Seeding demo data for schema: ${schemaName}`);

  try {
    await seedDemoData(schemaName);
    console.log("Done!");
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed:", error);
    process.exit(1);
  }
}

main();

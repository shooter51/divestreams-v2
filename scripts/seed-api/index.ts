#!/usr/bin/env tsx
import { SeedClient, sleep } from "./client";
import { login } from "./auth";
import { resetDemoData } from "./reset";
import { seedSiteSettings } from "./modules/site-settings";
import { seedTours } from "./modules/tours";
import { seedTrips } from "./modules/trips";
import { seedEquipment } from "./modules/equipment";
import { seedCustomers } from "./modules/customers";
import { seedCourses } from "./modules/courses";
import { seedSessions } from "./modules/sessions";
import { seedBookings } from "./modules/bookings";
import { seedGallery } from "./modules/gallery";
import "dotenv/config";

const ENV_URLS: Record<string, string> = {
  test: "https://demo.test.divestreams.com",
  dev: "https://demo.dev.divestreams.com",
  local: "http://demo.localhost:5173",
};

async function main() {
  // Parse --env flag
  const envArg = process.argv.find(a => a.startsWith("--env="))?.split("=")[1] || "test";
  const baseUrl = ENV_URLS[envArg] || ENV_URLS.test;

  const email = process.env.SEED_EMAIL || "demo@divestreams.com";
  const password = process.env.SEED_PASSWORD!;
  const seedKey = process.env.SEED_KEY!;

  if (!password) throw new Error("SEED_PASSWORD env var required");
  if (!seedKey) throw new Error("SEED_KEY env var required");

  console.log(`🌊 Seeding ${baseUrl}...`);

  const client = new SeedClient(baseUrl);

  await resetDemoData(client, seedKey);
  await sleep(500);

  await login(client, email, password);
  await sleep(200);

  await seedSiteSettings(client);

  const tours = await seedTours(client);
  console.log(`✓ Created ${tours.length} tours`);

  const equipment = await seedEquipment(client);
  console.log(`✓ Created ${equipment.length} equipment items`);

  const customers = await seedCustomers(client);
  console.log(`✓ Created ${customers.length} customers`);

  const courses = await seedCourses(client);
  console.log(`✓ Created ${courses.length} courses`);

  const trips = await seedTrips(client, tours);
  console.log(`✓ Created ${trips.length} trips (${trips.filter(t => t.isPast).length} past, ${trips.filter(t => !t.isPast).length} future)`);

  await seedSessions(client, courses);

  await seedBookings(client, customers, trips);

  await seedGallery(client);

  console.log("\n✅ Seeding complete!");
  console.log("   Run: npm run seed:export to generate scripts/sql/demo-seed.sql");
}

main().catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});

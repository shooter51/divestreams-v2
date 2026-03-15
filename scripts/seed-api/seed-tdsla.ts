#!/usr/bin/env tsx
import { SeedClient, sleep } from "./client";
import { login } from "./auth";
import { resetTdslaData } from "./tdsla/reset";
import { seedTdslaOrgSettings } from "./tdsla/org-settings";
import { seedTdslaSiteSettings } from "./tdsla/site-settings";
import { seedTdslaBoats } from "./tdsla/boats";
import { seedTdslaDiveSites } from "./tdsla/dive-sites";
import { seedTdslaTours } from "./tdsla/tours";
import { seedTdslaEquipment } from "./tdsla/equipment";
import { seedTdslaCustomers } from "./tdsla/customers";
import { seedTdslaCourses } from "./tdsla/courses";
import { seedTdslaSessions } from "./tdsla/sessions";
import { seedTdslaTrips } from "./tdsla/trips";
import { seedTdslaBookings } from "./tdsla/bookings";
import { seedTdslaProducts } from "./tdsla/products";
import { seedTdslaDiscounts } from "./tdsla/discounts";
import { seedStatusTransitions } from "./modules/status-transitions";
import { seedTdslaGallery } from "./tdsla/gallery";
import "dotenv/config";

const ENV_URLS: Record<string, string> = {
  prod: "https://tdsla.divestreams.com",
  test: "https://tdsla.test.divestreams.com",
  local: "http://tdsla.localhost:5173",
};

async function main() {
  const envArg = process.argv.find(a => a.startsWith("--env="))?.split("=")[1] || "prod";
  const baseUrl = ENV_URLS[envArg] || ENV_URLS.prod;

  const email = process.env.SEED_EMAIL || "gibsonth@gmail.com";
  const password = process.env.SEED_PASSWORD!;
  const seedKey = process.env.SEED_KEY!;

  if (!password) throw new Error("SEED_PASSWORD env var required");
  if (!seedKey) throw new Error("SEED_KEY env var required");

  console.log(`\n🌊 Seeding TDSLA — The Dive Shop LA`);
  console.log(`   Target: ${baseUrl}`);
  console.log(`   User: ${email}\n`);

  const client = new SeedClient(baseUrl);

  await resetTdslaData(client, seedKey);
  await sleep(500);

  await login(client, email, password);
  await sleep(200);

  // Identity & branding
  await seedTdslaOrgSettings(client);
  await seedTdslaSiteSettings(client);

  // Core entities
  const boats = await seedTdslaBoats(client);
  console.log(`\u2713 Created ${boats.length} boats`);

  const diveSites = await seedTdslaDiveSites(client);
  console.log(`\u2713 Created ${diveSites.length} dive sites`);

  const tours = await seedTdslaTours(client);
  console.log(`\u2713 Created ${tours.length} tours`);

  const equipment = await seedTdslaEquipment(client);
  console.log(`\u2713 Created ${equipment.length} equipment items`);

  const customers = await seedTdslaCustomers(client);
  console.log(`\u2713 Created ${customers.length} customers`);

  const courses = await seedTdslaCourses(client);
  console.log(`\u2713 Created ${courses.length} courses`);

  // Scheduling
  const trips = await seedTdslaTrips(client, tours);
  console.log(`\u2713 Created ${trips.length} trips (${trips.filter(t => t.isPast).length} past, ${trips.filter(t => !t.isPast).length} future)`);

  await seedTdslaSessions(client, courses);

  await seedTdslaBookings(client, customers, trips);

  // POS & promotions
  await seedTdslaProducts(client);
  await seedTdslaDiscounts(client);

  // Mark past trips as completed
  const pastTripIds = trips.filter(t => t.isPast).map(t => t.id);
  await seedStatusTransitions(client, pastTripIds, []);

  // Visual content
  await seedTdslaGallery(client);

  console.log("\n\u2705 TDSLA seeding complete!");
  console.log("   The Dive Shop LA is ready for demo.");
}

main().catch(err => {
  console.error("\u274c TDSLA seed failed:", err);
  process.exit(1);
});

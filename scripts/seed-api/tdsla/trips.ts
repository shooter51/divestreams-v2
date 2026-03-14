import type { SeedClient } from "../client";
import type { CreatedTrip } from "../modules/trips";

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

interface TripSpec {
  tourIndex: number;
  date: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  isPast: boolean;
}

function buildTripSpecs(tours: { id: string; name: string }[]): TripSpec[] {
  const specs: TripSpec[] = [];

  // Tour schedule mapping (matches tour order in tours.ts)
  const tourConfig = [
    { startTime: "05:30", endTime: "16:00", maxP: 22 },  // 0: Catalina Two-Tank Express
    { startTime: "08:00", endTime: "11:00", maxP: 8 },   // 1: Local Beach Dive
    { startTime: "19:30", endTime: "22:30", maxP: 6 },   // 2: Night Dive at Veteran's Park
    { startTime: "05:00", endTime: "17:00", maxP: 22 },  // 3: Channel Islands Adventure
    { startTime: "06:00", endTime: "11:00", maxP: 8 },   // 4: Kelp Forest Photo Safari
    { startTime: "07:00", endTime: "11:00", maxP: 10 },  // 5: Shark & Ray Canyon Dive
    { startTime: "06:00", endTime: "12:00", maxP: 4 },   // 6: Discover Scuba at Casino Point
    { startTime: "09:00", endTime: "15:00", maxP: 8 },   // 7: Palos Verdes Dive & Sail
    { startTime: "05:30", endTime: "14:00", maxP: 10 },  // 8: Farnsworth Bank Deep Dive
    { startTime: "17:00", endTime: "19:30", maxP: 8 },   // 9: Sunset Beach Dive
  ];

  // Past trips: 2 per tour spread over last 6 months
  const pastOffsets = [
    [150, 90],   // Catalina Two-Tank
    [140, 70],   // Local Beach Dive
    [130, 60],   // Night Dive
    [120, 56],   // Channel Islands
    [110, 50],   // Kelp Forest Photo
    [100, 45],   // Shark & Ray
    [95, 42],    // Discover Scuba
    [85, 35],    // Dive & Sail
    [75, 28],    // Farnsworth
    [65, 21],    // Sunset Dive
  ];

  // Future trips: 3-4 per tour over next 3 months
  const futureOffsets = [
    [7, 21, 42, 63],     // Catalina — every other Saturday
    [5, 12, 26, 40],     // Local Beach — weekly-ish
    [10, 24, 38],        // Night Dive — biweekly
    [14, 42, 70],        // Channel Islands — monthly
    [9, 30, 51],         // Kelp Forest Photo
    [8, 22, 43],         // Shark & Ray
    [11, 25, 46],        // Discover Scuba
    [16, 37, 58],        // Dive & Sail
    [20, 48],            // Farnsworth — monthly (weather dependent)
    [3, 10, 17, 31],     // Sunset Dive — weekly
  ];

  for (let i = 0; i < Math.min(tours.length, tourConfig.length); i++) {
    const cfg = tourConfig[i];
    const past = pastOffsets[i] || [];
    const future = futureOffsets[i] || [];

    for (const offset of past) {
      specs.push({
        tourIndex: i,
        date: daysAgo(offset),
        startTime: cfg.startTime,
        endTime: cfg.endTime,
        maxParticipants: cfg.maxP,
        isPast: true,
      });
    }

    for (const offset of future) {
      specs.push({
        tourIndex: i,
        date: daysFromNow(offset),
        startTime: cfg.startTime,
        endTime: cfg.endTime,
        maxParticipants: cfg.maxP,
        isPast: false,
      });
    }
  }

  return specs;
}

export async function seedTdslaTrips(
  client: SeedClient,
  tours: { id: string; name: string }[]
): Promise<CreatedTrip[]> {
  console.log("Seeding TDSLA trips...");

  const specs = buildTripSpecs(tours);
  console.log(`  Creating ${specs.length} trips...`);
  const created: CreatedTrip[] = [];

  for (const spec of specs) {
    const tour = tours[spec.tourIndex];
    if (!tour) continue;

    const csrf = await client.getCsrfToken();
    const formData = new FormData();
    formData.set("_csrf", csrf);
    formData.set("tourId", tour.id);
    formData.set("date", spec.date);
    formData.set("startTime", spec.startTime);
    formData.set("endTime", spec.endTime);
    formData.set("maxParticipants", String(spec.maxParticipants));
    formData.set("isPublic", "true");
    formData.set("isRecurring", "false");

    const result = await client.post("/tenant/trips/new", formData);

    if (result.ok || result.status === 302) {
      console.log(`  Trip: ${tour.name} on ${spec.date} (${spec.isPast ? "past" : "future"})`);
    } else {
      console.warn(`  Warning: trip for "${tour.name}" on ${spec.date} returned ${result.status}`);
    }

    await client.sleep(50);
  }

  // Scrape IDs from list pages
  console.log("  Scraping trip IDs...");
  const upcomingHtml = await client.getHtml("/tenant/trips");
  const upcomingIds = client.parseTripIds(upcomingHtml);
  console.log(`  Found ${upcomingIds.length} upcoming trip IDs`);

  for (const id of upcomingIds) {
    created.push({ id, tourId: "", date: "", isPast: false });
  }

  console.log(`  TDSLA trips seeded: ${specs.length} created, ${created.length} IDs scraped`);
  return created;
}

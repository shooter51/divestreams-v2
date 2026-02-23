import type { SeedClient } from "../client";

export interface CreatedTrip {
  id: string;
  tourId: string;
  date: string;
  isPast: boolean;
}

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
  notes?: string;
}

function buildTripSpecs(tours: { id: string; name: string }[]): TripSpec[] {
  const specs: TripSpec[] = [];

  // Past trips: 2 per tour, dates 6 months ago to 3 weeks ago
  // Distribute across ~24 weeks, 2-3 weeks apart per tour
  const pastOffsets = [
    [168, 147],  // tour 0: ~24wk ago, ~21wk ago
    [140, 119],  // tour 1: ~20wk ago, ~17wk ago
    [112, 91],   // tour 2: ~16wk ago, ~13wk ago
    [84, 63],    // tour 3: ~12wk ago, ~9wk ago
    [56, 42],    // tour 4: ~8wk ago, ~6wk ago
    [35, 28],    // tour 5: ~5wk ago, ~4wk ago
    [24, 21],    // tour 6: ~3.5wk ago, 3wk ago
    [22, 21],    // tour 7: ~3wk ago (slightly different days)
  ];

  // Start times and durations per tour index (matching tour types)
  const tourStartTimes = [
    "09:00", // Discover Scuba
    "08:00", // Two Tank Morning Reef
    "20:00", // Night Dive Adventure
    "09:00", // Wreck Explorer
    "10:00", // Drift Dive
    "20:30", // Manta Ray
    "17:30", // Dusk Dive
    "09:00", // Underwater Photography
  ];
  const tourEndTimes = [
    "13:00", // Discover Scuba
    "13:00", // Two Tank Morning Reef
    "22:00", // Night Dive Adventure
    "12:00", // Wreck Explorer
    "13:00", // Drift Dive
    "23:00", // Manta Ray
    "20:00", // Dusk Dive
    "13:00", // Underwater Photography
  ];
  const tourMaxParticipants = [4, 16, 8, 6, 10, 8, 10, 6];

  for (let tourIdx = 0; tourIdx < Math.min(tours.length, 8); tourIdx++) {
    const [offset1, offset2] = pastOffsets[tourIdx];
    const startTime = tourStartTimes[tourIdx];
    const endTime = tourEndTimes[tourIdx];
    const maxP = tourMaxParticipants[tourIdx];

    specs.push({
      tourIndex: tourIdx,
      date: daysAgo(offset1),
      startTime,
      endTime,
      maxParticipants: maxP,
      isPast: true,
    });
    specs.push({
      tourIndex: tourIdx,
      date: daysAgo(offset2),
      startTime,
      endTime,
      maxParticipants: maxP,
      isPast: true,
    });
  }

  // Future trips: 3 per tour, 2-4 weeks apart in next 3 months
  const futureOffsets = [
    [14, 35, 56],   // tour 0
    [18, 39, 60],   // tour 1
    [21, 42, 63],   // tour 2
    [10, 31, 52],   // tour 3
    [17, 38, 59],   // tour 4
    [24, 45, 66],   // tour 5
    [12, 33, 54],   // tour 6
    [20, 41, 62],   // tour 7
  ];

  for (let tourIdx = 0; tourIdx < Math.min(tours.length, 8); tourIdx++) {
    const [offset1, offset2, offset3] = futureOffsets[tourIdx];
    const startTime = tourStartTimes[tourIdx];
    const endTime = tourEndTimes[tourIdx];
    const maxP = tourMaxParticipants[tourIdx];

    for (const offset of [offset1, offset2, offset3]) {
      specs.push({
        tourIndex: tourIdx,
        date: daysFromNow(offset),
        startTime,
        endTime,
        maxParticipants: maxP,
        isPast: false,
      });
    }
  }

  return specs;
}

export async function seedTrips(
  client: SeedClient,
  tours: { id: string; name: string }[]
): Promise<CreatedTrip[]> {
  console.log("Seeding trips...");

  const specs = buildTripSpecs(tours);
  console.log(`  Creating ${specs.length} trips...`);

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
      console.log(
        `  Created trip: ${tour.name} on ${spec.date} (${spec.isPast ? "past" : "future"})`
      );
    } else {
      console.warn(
        `  Warning: trip for "${tour.name}" on ${spec.date} returned status ${result.status}`
      );
      if (result.html) {
        const errorMatch = result.html.match(/class="text-danger[^"]*"[^>]*>([^<]+)</);
        if (errorMatch) {
          console.warn(`    Error detail: ${errorMatch[1]}`);
        }
      }
    }

    await client.sleep(50);
  }

  // Scrape trip IDs from list pages
  console.log("  Scraping trip IDs from list pages...");

  const pastHtml = await client.getHtml("/tenant/trips?view=past");
  const pastIds = client.parseTripIds(pastHtml);
  console.log(`  Found ${pastIds.length} past trip IDs`);

  const upcomingHtml = await client.getHtml("/tenant/trips?view=upcoming");
  const upcomingIds = client.parseTripIds(upcomingHtml);
  console.log(`  Found ${upcomingIds.length} upcoming trip IDs`);

  const result: CreatedTrip[] = [];

  // Map past IDs back to tours (created in order: tour0*2, tour1*2, ...)
  // We can't reliably match to specific tours by order since the page may sort differently,
  // so we return them with empty tourId and let callers use them generically.
  for (const id of pastIds) {
    result.push({ id, tourId: "", date: "", isPast: true });
  }
  for (const id of upcomingIds) {
    result.push({ id, tourId: "", date: "", isPast: false });
  }

  console.log(`Trips seeded: ${specs.length} created, ${result.length} IDs scraped`);
  return result;
}

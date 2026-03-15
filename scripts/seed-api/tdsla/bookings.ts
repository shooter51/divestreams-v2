import type { SeedClient } from "../client";
import { sleep } from "../client";
import type { CreatedCustomer } from "../modules/customers";
import type { CreatedTrip } from "../modules/trips";

const SPECIAL_REQUESTS = [
  "Bringing my own camera housing — need extra tank rack space",
  "First time diving in cold water — may need 7mm wetsuit",
  "Vegetarian meal preference for the boat",
  "Celebrating 100th dive! Would love a photo",
  "Need full gear rental — traveling from out of state",
  "Have prescription mask lenses, bringing my own",
  "Would like nitrox if available",
  "Two of us — booking for myself and my buddy",
  "Prefer to dive with steel tanks if you have them",
  "Recovering from ear surgery 6 months ago — may equalize slowly",
];

export async function seedTdslaBookings(
  client: SeedClient,
  customers: { id: string; email: string }[],
  trips: { id: string; tourId: string; date: string; isPast: boolean }[]
): Promise<void> {
  console.log("Seeding TDSLA bookings...");

  const futureTrips = trips.filter(t => !t.isPast);
  if (futureTrips.length === 0) {
    console.warn("  No future trips found, skipping bookings");
    return;
  }

  let bookingCount = 0;
  const usedPairs = new Set<string>();

  // 2-5 bookings per future trip
  for (let i = 0; i < futureTrips.length; i++) {
    const trip = futureTrips[i];
    const bookingsForTrip = 2 + (i % 4); // 2-5

    for (let j = 0; j < bookingsForTrip; j++) {
      const customerIndex = (i * 3 + j) % customers.length;
      const customer = customers[customerIndex];

      const pairKey = `${customer.id}:${trip.id}`;
      if (usedPairs.has(pairKey)) continue;
      usedPairs.add(pairKey);

      const participants = bookingCount % 4 === 0 ? "2" : "1";
      const specialRequest = bookingCount % 4 < 1
        ? SPECIAL_REQUESTS[bookingCount % SPECIAL_REQUESTS.length]
        : "";

      const fd = new FormData();
      const csrf = await client.getCsrfToken();
      fd.append("_csrf", csrf);
      fd.append("customerId", customer.id);
      fd.append("tripId", trip.id);
      fd.append("participants", participants);
      fd.append("source", "direct");
      if (specialRequest) fd.append("specialRequests", specialRequest);

      const result = await client.post("/tenant/bookings/new", fd);
      if (!result.ok && result.status !== 302 && result.status !== 303) {
        console.warn(`  Warning: Booking failed (status ${result.status})`);
      } else {
        bookingCount++;
      }
      await sleep(50);
    }
  }

  // Ensure at least 30 bookings
  if (bookingCount < 30) {
    const remaining = 30 - bookingCount;
    for (let k = 0; k < remaining; k++) {
      const trip = futureTrips[k % futureTrips.length];
      const customer = customers[(bookingCount + k * 7) % customers.length];
      const pairKey = `${customer.id}:${trip.id}`;
      if (usedPairs.has(pairKey)) continue;
      usedPairs.add(pairKey);

      const fd = new FormData();
      const csrf = await client.getCsrfToken();
      fd.append("_csrf", csrf);
      fd.append("customerId", customer.id);
      fd.append("tripId", trip.id);
      fd.append("participants", "1");
      fd.append("source", "website");

      const result = await client.post("/tenant/bookings/new", fd);
      if (result.ok || result.status === 302 || result.status === 303) {
        bookingCount++;
      }
      await sleep(50);
    }
  }

  console.log(`  TDSLA bookings seeded: ${bookingCount} total`);
}

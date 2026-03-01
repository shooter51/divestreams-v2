import type { SeedClient } from "../client";
import { sleep } from "../client";

const SPECIAL_REQUESTS = [
  "Vegetarian meal preference",
  "Need full gear rental please",
  "First time diving - extra attention needed",
  "Celebrating anniversary - surprise would be lovely",
  "Have my own regulator and BCD",
  "Prefer morning slots if possible",
  "Photographing underwater - extra time at sites appreciated",
  "Have minor knee injury - need gentle entry/exit",
];

export async function seedBookings(
  client: SeedClient,
  customers: { id: string; email: string }[],
  trips: { id: string; tourId: string; date: string; isPast: boolean }[]
): Promise<void> {
  const futureTrips = trips.filter(t => !t.isPast);

  if (futureTrips.length === 0) {
    console.warn("  ⚠ No future trips found, skipping bookings");
    return;
  }

  let bookingCount = 0;
  const usedCustomerTripPairs = new Set<string>();

  // Distribute customers across future trips
  // Each future trip gets 1-4 bookings
  for (let i = 0; i < futureTrips.length; i++) {
    const trip = futureTrips[i];
    const bookingsForTrip = Math.min(1 + (i % 3), 4); // 1-4 bookings per trip

    for (let j = 0; j < bookingsForTrip; j++) {
      // Pick a customer (cycle through customers)
      const customerIndex = (i * 3 + j) % customers.length;
      const customer = customers[customerIndex];

      const pairKey = `${customer.id}:${trip.id}`;
      if (usedCustomerTripPairs.has(pairKey)) continue;
      usedCustomerTripPairs.add(pairKey);

      const participants = (bookingCount % 3 === 0) ? "2" : "1";
      const includeSpecialRequest = bookingCount % 5 < 2; // ~40% get special requests
      const specialRequest = includeSpecialRequest
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
        console.warn(`  ⚠ Booking for trip ${trip.date} may have failed (status ${result.status})`);
      } else {
        console.log(`  ✓ Booking: trip ${trip.date} × customer ${customer.email}`);
        bookingCount++;
      }
      await sleep(50);
    }
  }

  // Add extra bookings to reach 25+ if needed
  if (bookingCount < 25) {
    const remaining = 25 - bookingCount;
    for (let k = 0; k < remaining; k++) {
      const trip = futureTrips[k % futureTrips.length];
      const customer = customers[(bookingCount + k * 7) % customers.length];
      const pairKey = `${customer.id}:${trip.id}`;
      if (usedCustomerTripPairs.has(pairKey)) continue;
      usedCustomerTripPairs.add(pairKey);

      const fd = new FormData();
      const csrf = await client.getCsrfToken();
      fd.append("_csrf", csrf);
      fd.append("customerId", customer.id);
      fd.append("tripId", trip.id);
      fd.append("participants", "1");
      fd.append("source", "direct");

      const result = await client.post("/tenant/bookings/new", fd);
      if (!result.ok && result.status !== 302 && result.status !== 303) {
        console.warn(`  ⚠ Extra booking may have failed (status ${result.status})`);
      } else {
        console.log(`  ✓ Booking: trip ${trip.date} × customer ${customer.email}`);
        bookingCount++;
      }
      await sleep(50);
    }
  }

  console.log(`  Total bookings created: ${bookingCount}`);
}

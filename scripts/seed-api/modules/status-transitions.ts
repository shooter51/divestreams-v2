import type { SeedClient } from "../client";

export async function seedStatusTransitions(
  client: SeedClient,
  pastTripIds: string[],
  pastBookingIds: string[]
): Promise<void> {
  console.log("Seeding status transitions...");

  // Mark past trips as completed
  for (let i = 0; i < pastTripIds.length; i++) {
    const tripId = pastTripIds[i];
    const csrf = await client.getCsrfToken();
    const formData = new FormData();
    formData.set("_csrf", csrf);
    formData.set("intent", "complete");

    const result = await client.post(`/tenant/trips/${tripId}`, formData);
    if (result.ok) {
      console.log(`  Completed trip ${i + 1}/${pastTripIds.length} (${tripId})`);
    } else {
      console.warn(`  Warning: trip ${tripId} complete returned ${result.status}`);
    }

    await client.sleep(100);
  }

  // Mark past bookings as completed
  for (let i = 0; i < pastBookingIds.length; i++) {
    const bookingId = pastBookingIds[i];
    const csrf = await client.getCsrfToken();
    const formData = new FormData();
    formData.set("_csrf", csrf);
    formData.set("intent", "complete");

    const result = await client.post(`/tenant/bookings/${bookingId}`, formData);
    if (result.ok) {
      console.log(`  Completed booking ${i + 1}/${pastBookingIds.length} (${bookingId})`);
    } else {
      console.warn(`  Warning: booking ${bookingId} complete returned ${result.status}`);
    }

    await client.sleep(100);
  }

  console.log(`Status transitions seeded: ${pastTripIds.length} trips, ${pastBookingIds.length} bookings completed.`);
}

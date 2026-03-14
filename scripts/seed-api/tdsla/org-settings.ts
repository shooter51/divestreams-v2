import type { SeedClient } from "../client";

export async function seedTdslaOrgSettings(client: SeedClient): Promise<void> {
  console.log("Seeding TDSLA org settings...");

  const profileCsrf = await client.getCsrfToken();
  const profileData = new FormData();
  profileData.set("_csrf", profileCsrf);
  profileData.set("intent", "update-profile");
  profileData.set("name", "The Dive Shop LA");
  profileData.set("email", "info@thediveshopla.com");
  profileData.set("phone", "+1 (310) 555-0183");
  profileData.set("website", "https://thediveshopla.com");
  profileData.set("timezone", "America/Los_Angeles");
  profileData.set("currency", "USD");
  profileData.set("street", "233 N Harbor Dr");
  profileData.set("city", "Redondo Beach");
  profileData.set("state", "CA");
  profileData.set("country", "US");
  profileData.set("postalCode", "90277");

  const profileResult = await client.post("/tenant/settings/profile", profileData);
  if (!profileResult.ok) {
    console.warn(`  Warning: profile settings returned ${profileResult.status}`);
  } else {
    console.log("  Business profile updated");
  }

  await client.sleep(100);

  const bookingCsrf = await client.getCsrfToken();
  const bookingData = new FormData();
  bookingData.set("_csrf", bookingCsrf);
  bookingData.set("intent", "update-booking-settings");
  bookingData.set("requireDeposit", "true");
  bookingData.set("depositPercent", "30");
  bookingData.set("cancellationPolicy", "48h");
  bookingData.set("minAdvanceBooking", "48");
  bookingData.set("maxAdvanceBooking", "120");

  const bookingResult = await client.post("/tenant/settings/profile", bookingData);
  if (!bookingResult.ok) {
    console.warn(`  Warning: booking settings returned ${bookingResult.status}`);
  } else {
    console.log("  Booking settings updated");
  }

  console.log("  TDSLA org settings complete.");
}

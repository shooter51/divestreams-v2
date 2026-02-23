import type { SeedClient } from "../client";

export async function seedOrgSettings(client: SeedClient): Promise<void> {
  console.log("Seeding org settings...");

  // 1. Update business profile
  const profileCsrf = await client.getCsrfToken();
  const profileData = new FormData();
  profileData.set("_csrf", profileCsrf);
  profileData.set("intent", "update-profile");
  profileData.set("name", "Blue Horizon Dive Center");
  profileData.set("email", "info@bluehorizondive.com");
  profileData.set("phone", "+1 (305) 555-0147");
  profileData.set("website", "https://bluehorizondive.com");
  profileData.set("timezone", "America/New_York");
  profileData.set("currency", "USD");
  profileData.set("street", "104 Ocean Drive");
  profileData.set("city", "Key Largo");
  profileData.set("state", "FL");
  profileData.set("country", "US");
  profileData.set("postalCode", "33037");

  const profileResult = await client.post("/tenant/settings/profile", profileData);
  if (!profileResult.ok) {
    console.warn(`  Warning: profile settings returned ${profileResult.status}`);
  } else {
    console.log("  Business profile updated");
  }

  await client.sleep(100);

  // 2. Update booking settings
  const bookingCsrf = await client.getCsrfToken();
  const bookingData = new FormData();
  bookingData.set("_csrf", bookingCsrf);
  bookingData.set("intent", "update-booking-settings");
  bookingData.set("requireDeposit", "true");
  bookingData.set("depositPercent", "25");
  bookingData.set("cancellationPolicy", "48h");
  bookingData.set("minAdvanceBooking", "24");
  bookingData.set("maxAdvanceBooking", "180");

  const bookingResult = await client.post("/tenant/settings/profile", bookingData);
  if (!bookingResult.ok) {
    console.warn(`  Warning: booking settings returned ${bookingResult.status}`);
  } else {
    console.log("  Booking settings updated");
  }

  console.log("Org settings seeded successfully.");
}

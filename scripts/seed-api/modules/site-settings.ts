import type { SeedClient } from "../client";

export async function seedSiteSettings(client: SeedClient): Promise<void> {
  console.log("Seeding site settings...");

  // 1. Update general settings
  const generalCsrf = await client.getCsrfToken();
  const generalData = new FormData();
  generalData.set("_csrf", generalCsrf);
  generalData.set("intent", "update-general");
  generalData.set("enabled", "true");
  generalData.set("page-home", "true");
  generalData.set("page-about", "true");
  generalData.set("page-trips", "true");
  generalData.set("page-courses", "true");
  generalData.set("page-equipment", "true");
  generalData.set("page-contact", "true");
  generalData.set("page-gallery", "true");

  const generalResult = await client.post("/tenant/settings/public-site", generalData);
  if (!generalResult.ok) {
    console.warn(`  Warning: general settings returned ${generalResult.status}`);
  } else {
    console.log("  General settings updated");
  }

  await client.sleep(50);

  // 2. Update appearance settings
  const appearanceCsrf = await client.getCsrfToken();
  const appearanceData = new FormData();
  appearanceData.set("_csrf", appearanceCsrf);
  appearanceData.set("intent", "update-appearance");
  appearanceData.set("theme", "ocean");
  appearanceData.set("primaryColor", "#0ea5e9");
  appearanceData.set("secondaryColor", "#0284c7");
  appearanceData.set("fontFamily", "inter");

  const appearanceResult = await client.post("/tenant/settings/public-site/appearance", appearanceData);
  if (!appearanceResult.ok) {
    console.warn(`  Warning: appearance settings returned ${appearanceResult.status}`);
  } else {
    console.log("  Appearance settings updated");
  }

  await client.sleep(50);

  // 3. Update content settings
  const contentCsrf = await client.getCsrfToken();
  const contentData = new FormData();
  contentData.set("_csrf", contentCsrf);
  contentData.set("intent", "update-content");
  contentData.set(
    "aboutContent",
    "Welcome to Blue Horizon Dive Center — your premier destination for unforgettable underwater adventures. " +
    "Founded in 2008, we have been introducing divers to the breathtaking marine life of the Florida Keys for over 15 years. " +
    "Our PADI-certified instructors bring passion and professionalism to every dive, whether you're a first-time snorkeler " +
    "or an experienced wreck diver. We offer small-group tours to ensure personalized attention and maximum enjoyment. " +
    "Come dive with us and discover the wonders beneath the surface."
  );
  contentData.set("heroImageUrl", "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1920&q=80");
  contentData.set("contactAddress", "104 Ocean Drive\nKey Largo, FL 33037");
  contentData.set("contactPhone", "+1 (305) 555-0147");
  contentData.set("contactEmail", "info@bluehorizondive.com");
  contentData.set("contactHours", "Mon–Fri: 7:00 AM – 6:00 PM\nSat–Sun: 6:00 AM – 7:00 PM");

  const contentResult = await client.post("/tenant/settings/public-site/content", contentData);
  if (!contentResult.ok) {
    console.warn(`  Warning: content settings returned ${contentResult.status}`);
  } else {
    console.log("  Content settings updated");
  }

  await client.sleep(50);

  console.log("Site settings seeded successfully.");
}

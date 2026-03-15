import type { SeedClient } from "../client";

export async function seedTdslaSiteSettings(client: SeedClient): Promise<void> {
  console.log("Seeding TDSLA site settings...");

  // 1. Enable all public site pages
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

  // 2. Appearance — deep ocean blue theme
  const appearanceCsrf = await client.getCsrfToken();
  const appearanceData = new FormData();
  appearanceData.set("_csrf", appearanceCsrf);
  appearanceData.set("intent", "update-appearance");
  appearanceData.set("theme", "ocean");
  appearanceData.set("primaryColor", "#1e3a5f");
  appearanceData.set("secondaryColor", "#2d8bc9");
  appearanceData.set("fontFamily", "inter");

  const appearanceResult = await client.post("/tenant/settings/public-site/appearance", appearanceData);
  if (!appearanceResult.ok) {
    console.warn(`  Warning: appearance settings returned ${appearanceResult.status}`);
  } else {
    console.log("  Appearance settings updated");
  }

  await client.sleep(50);

  // 3. Content — the The Dive Shop LA story
  const contentCsrf = await client.getCsrfToken();
  const contentData = new FormData();
  contentData.set("_csrf", contentCsrf);
  contentData.set("intent", "update-content");
  contentData.set(
    "aboutContent",
    "The Dive Shop LA has been Southern California's go-to dive center since 2012, located right " +
    "on King Harbor in Redondo Beach. Founded by Captain Mike Reeves and marine biologist " +
    "Dr. Elena Reeves, we exist to share the incredible underwater world off the LA coast " +
    "with divers of every level.\n\n" +
    "From the towering kelp forests of Catalina Island to the mysterious submarine canyon just " +
    "off Redondo Beach, our team of passionate PADI professionals guides you through some of " +
    "the Pacific's most biodiverse waters. We're known for small group sizes, marine biology " +
    "expertise woven into every dive briefing, and an unwavering commitment to ocean conservation.\n\n" +
    "Our Reef Guardian program has trained over 1,000 citizen scientists since 2015, contributing " +
    "real data to kelp forest restoration projects along the Southern California coast. Every dive " +
    "with us supports ongoing research at the USC Wrigley Institute for Environmental Studies.\n\n" +
    "Whether you're taking your first breath underwater at Casino Point or descending to " +
    "Farnsworth Bank to see the rare purple hydrocoral, The Dive Shop LA is your gateway " +
    "to the best diving the West Coast has to offer."
  );
  // Catalina underwater kelp forest hero image
  contentData.set("heroImageUrl", "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1920&q=80");
  contentData.set("contactAddress", "233 N Harbor Dr\nRedondo Beach, CA 90277");
  contentData.set("contactPhone", "+1 (310) 555-0183");
  contentData.set("contactEmail", "info@thediveshopla.com");
  contentData.set(
    "contactHours",
    "Monday\u2013Friday: 7:00 AM \u2013 6:00 PM\n" +
    "Saturday: 5:30 AM \u2013 7:00 PM\n" +
    "Sunday: 6:00 AM \u2013 5:00 PM\n\n" +
    "Catalina trips depart at 6:00 AM \u2014 check in by 5:30 AM"
  );

  const contentResult = await client.post("/tenant/settings/public-site/content", contentData);
  if (!contentResult.ok) {
    console.warn(`  Warning: content settings returned ${contentResult.status}`);
  } else {
    console.log("  Content settings updated");
  }

  console.log("  TDSLA site settings complete.");
}

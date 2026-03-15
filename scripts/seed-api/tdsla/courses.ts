import type { SeedClient } from "../client";
import { sleep } from "../client";
import type { CreatedCourse } from "../modules/courses";
import { uploadImage, randomPhoto } from "../images";

// PADI 5-Star IDC Center course catalog — what a top SoCal shop would offer
const COURSES = [
  { name: "PADI Open Water Diver", code: "OWD", description: "The world's most popular scuba course. Learn to dive in the kelp forests of Southern California over 4 days. Includes classroom, pool, and 4 open water dives at Catalina or local sites.", price: "499", currency: "USD", maxStudents: "8", minAge: "10", durationDays: "4", classroomHours: "8", poolHours: "5", openWaterDives: "4" },
  { name: "PADI Advanced Open Water", code: "AOWD", description: "Expand your skills with 5 adventure dives including deep and navigation. We do our adventure dives at Catalina and the Redondo Canyon — real California diving.", price: "399", currency: "USD", maxStudents: "6", minAge: "12", durationDays: "3", classroomHours: "4", poolHours: "0", openWaterDives: "5" },
  { name: "PADI Rescue Diver", code: "RD", description: "Learn to prevent and manage dive emergencies. Challenging but rewarding — graduates say it changed how they dive. Includes EFR certification.", price: "449", currency: "USD", maxStudents: "6", minAge: "12", durationDays: "4", classroomHours: "8", poolHours: "6", openWaterDives: "4" },
  { name: "PADI Divemaster", code: "DM", description: "Your first step as a dive professional. Intensive internship program at our Redondo Beach facility with real-world experience on our Catalina and Channel Islands trips.", price: "1499", currency: "USD", maxStudents: "4", minAge: "18", durationDays: "30", classroomHours: "40", poolHours: "20", openWaterDives: "20" },
  { name: "PADI Emergency First Response", code: "EFR", description: "CPR, AED, and first aid training. Prerequisite for Rescue Diver. We train at our dive center with professional medical simulation equipment.", price: "179", currency: "USD", maxStudents: "8", minAge: "10", durationDays: "1", classroomHours: "8", poolHours: "0", openWaterDives: "0" },
  { name: "PADI Enriched Air Nitrox", code: "EANx", description: "Learn to plan and dive with nitrox (up to 40% O2) for longer bottom times — especially valuable for our multi-dive Catalina trips. Our boats carry nitrox on every trip.", price: "179", currency: "USD", maxStudents: "8", minAge: "15", durationDays: "1", classroomHours: "4", poolHours: "0", openWaterDives: "0" },
  { name: "PADI Deep Diver Specialty", code: "DEEP", description: "Go deeper — safely. Required for our Farnsworth Bank trips. 4 dives to progressively greater depths with proper gas management and ascent planning.", price: "299", currency: "USD", maxStudents: "6", minAge: "15", durationDays: "2", classroomHours: "4", poolHours: "0", openWaterDives: "4" },
  { name: "PADI Night Diver Specialty", code: "NIGHT", description: "Master night diving techniques in familiar waters at Veteran's Park before tackling open-water night dives. 3 night dives with increasing independence.", price: "249", currency: "USD", maxStudents: "6", minAge: "15", durationDays: "2", classroomHours: "2", poolHours: "0", openWaterDives: "3" },
  { name: "PADI Wreck Diver Specialty", code: "WRECK", description: "Explore shipwrecks safely. We train on the Yukon wreck off San Diego and local artificial reefs. Learn navigation, penetration techniques, and wreck history.", price: "299", currency: "USD", maxStudents: "6", minAge: "15", durationDays: "2", classroomHours: "4", poolHours: "0", openWaterDives: "4" },
  { name: "PADI Underwater Photographer", code: "UWP", description: "Capture California's underwater beauty. From macro nudibranchs to wide-angle kelp forests, learn composition and technique with our photo specialist.", price: "249", currency: "USD", maxStudents: "6", minAge: "10", durationDays: "2", classroomHours: "4", poolHours: "0", openWaterDives: "2" },
  { name: "PADI Drift Diver Specialty", code: "DRIFT", description: "Master current diving for open-ocean sites. Essential for the Channel Islands where currents shape every dive plan.", price: "199", currency: "USD", maxStudents: "6", minAge: "15", durationDays: "1", classroomHours: "2", poolHours: "0", openWaterDives: "2" },
  { name: "PADI Peak Performance Buoyancy", code: "PPB", description: "Fine-tune your buoyancy for effortless hovering in California's kelp forests. Better buoyancy = better air consumption = longer dives.", price: "199", currency: "USD", maxStudents: "6", minAge: "10", durationDays: "1", classroomHours: "2", poolHours: "2", openWaterDives: "2" },
  { name: "PADI Dry Suit Diver", code: "DSD", description: "Extend your diving season year-round in SoCal's cold water. We train with Bare and DUI dry suits in our gear room and local sites.", price: "299", currency: "USD", maxStudents: "4", minAge: "15", durationDays: "2", classroomHours: "3", poolHours: "2", openWaterDives: "2" },
  { name: "SSI Open Water Diver", code: "SSI-OWD", description: "SSI's comprehensive open water program. Same world-class SoCal training locations, flexible scheduling, digital learning materials included.", price: "479", currency: "USD", maxStudents: "8", minAge: "10", durationDays: "4", classroomHours: "8", poolHours: "5", openWaterDives: "4" },
  { name: "Discover Scuba Experience", code: "DSD-TRY", description: "Try scuba for the first time — no commitment needed. Pool session at our Redondo Beach facility followed by a supervised open water dive (weather permitting).", price: "129", currency: "USD", maxStudents: "4", minAge: "10", durationDays: "0", classroomHours: "1", poolHours: "1", openWaterDives: "1" },
];

export async function seedTdslaCourses(client: SeedClient): Promise<CreatedCourse[]> {
  console.log("Seeding TDSLA courses...");

  for (const course of COURSES) {
    const fd = new FormData();
    const csrf = await client.getCsrfToken();
    fd.append("_csrf", csrf);
    fd.append("name", course.name);
    fd.append("code", course.code);
    fd.append("description", course.description);
    fd.append("price", course.price);
    fd.append("currency", course.currency);
    fd.append("maxStudents", course.maxStudents);
    fd.append("minAge", course.minAge);
    fd.append("durationDays", course.durationDays);
    fd.append("classroomHours", course.classroomHours);
    fd.append("poolHours", course.poolHours);
    fd.append("openWaterDives", course.openWaterDives);
    fd.append("isActive", "true");
    fd.append("isPublic", "true");

    const result = await client.post("/tenant/training/courses/new", fd);
    if (!result.ok && result.status !== 302 && result.status !== 303) {
      console.warn(`  Warning: Course "${course.name}" returned ${result.status}`);
    } else {
      console.log(`  Course: ${course.name}`);
    }
    await sleep(50);
  }

  const html = await client.getHtml("/tenant/training/courses");
  const ids = client.parseCourseIds(html);

  if (ids.length < COURSES.length) {
    console.warn(`  Warning: Expected ${COURSES.length} course IDs but found ${ids.length}`);
  }

  const createdCourses = COURSES.map((course, i) => ({
    id: ids[i] ?? "",
    name: course.name,
  }));

  // Upload images for each course
  console.log("  Uploading course images...");
  for (const course of createdCourses) {
    if (!course.id) continue;
    const photo = randomPhoto("reef");
    const alt = course.name;
    const img = await uploadImage(client, "course", course.id, photo, alt);
    if (img) console.log(`    📷 ${course.name} — image uploaded`);
    await sleep(200);
  }

  return createdCourses;
}

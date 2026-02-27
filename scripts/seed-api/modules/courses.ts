import type { SeedClient } from "../client";
import { sleep } from "../client";

export interface CreatedCourse {
  id: string;
  name: string;
}

const COURSES = [
  { name: "PADI Open Water Diver", code: "OWD", description: "The world's most popular scuba diving course. Learn to dive in just 3-4 days.", price: "399", currency: "USD", maxStudents: "8", minAge: "10", durationDays: "4", classroomHours: "8", poolHours: "4", openWaterDives: "4" },
  { name: "PADI Advanced Open Water", code: "AOWD", description: "Improve your dive skills and expand your knowledge with 5 adventure dives.", price: "299", currency: "USD", maxStudents: "6", minAge: "12", durationDays: "3", classroomHours: "4", poolHours: "0", openWaterDives: "5" },
  { name: "PADI Rescue Diver", code: "RD", description: "Learn to prevent and manage problems in and out of the water.", price: "349", currency: "USD", maxStudents: "6", minAge: "12", durationDays: "3", classroomHours: "8", poolHours: "4", openWaterDives: "4" },
  { name: "PADI Divemaster", code: "DM", description: "Take the first step in your dive professional career.", price: "1200", currency: "USD", maxStudents: "4", minAge: "18", durationDays: "30", classroomHours: "40", poolHours: "20", openWaterDives: "20" },
  { name: "PADI Emergency First Response", code: "EFR", description: "Learn CPR and first aid skills that can save a life.", price: "149", currency: "USD", maxStudents: "8", minAge: "10", durationDays: "1", classroomHours: "8", poolHours: "0", openWaterDives: "0" },
  { name: "PADI Enriched Air Nitrox", code: "EANx", description: "Learn to use nitrox for longer bottom times and safer diving.", price: "149", currency: "USD", maxStudents: "8", minAge: "15", durationDays: "1", classroomHours: "4", poolHours: "0", openWaterDives: "0" },
  { name: "PADI Deep Diver Specialty", code: "DEEP", description: "Go beyond recreational limits with proper deep diving techniques.", price: "249", currency: "USD", maxStudents: "6", minAge: "15", durationDays: "2", classroomHours: "4", poolHours: "0", openWaterDives: "4" },
  { name: "PADI Wreck Diver Specialty", code: "WRECK", description: "Explore sunken ships and other fascinating underwater structures.", price: "249", currency: "USD", maxStudents: "6", minAge: "15", durationDays: "2", classroomHours: "4", poolHours: "0", openWaterDives: "4" },
  { name: "PADI Night Diver Specialty", code: "NIGHT", description: "Discover a completely different world after dark.", price: "199", currency: "USD", maxStudents: "6", minAge: "15", durationDays: "1", classroomHours: "2", poolHours: "0", openWaterDives: "3" },
  { name: "PADI Underwater Photographer", code: "UWP", description: "Capture the beauty of the underwater world on camera.", price: "199", currency: "USD", maxStudents: "6", minAge: "10", durationDays: "2", classroomHours: "4", poolHours: "0", openWaterDives: "2" },
  { name: "PADI Drift Diver Specialty", code: "DRIFT", description: "Learn to use ocean currents as a natural underwater conveyor belt.", price: "199", currency: "USD", maxStudents: "6", minAge: "15", durationDays: "1", classroomHours: "2", poolHours: "0", openWaterDives: "2" },
  { name: "PADI Peak Performance Buoyancy", code: "PPB", description: "Fine-tune your buoyancy skills for effortless diving.", price: "149", currency: "USD", maxStudents: "6", minAge: "10", durationDays: "1", classroomHours: "2", poolHours: "2", openWaterDives: "2" },
  { name: "SSI Open Water Diver", code: "SSI-OWD", description: "Start your diving journey with SSI's comprehensive open water course.", price: "379", currency: "USD", maxStudents: "8", minAge: "10", durationDays: "4", classroomHours: "8", poolHours: "4", openWaterDives: "4" },
  { name: "TDI Advanced Nitrox", code: "ADV-NOX", description: "Use oxygen-enriched air up to 100% for technical diving.", price: "399", currency: "USD", maxStudents: "4", minAge: "18", durationDays: "2", classroomHours: "8", poolHours: "4", openWaterDives: "4" },
  { name: "Try Scuba Experience", code: "TRY", description: "Experience scuba diving for the first time in a safe, supervised environment.", price: "99", currency: "USD", maxStudents: "4", minAge: "8", durationDays: "0", classroomHours: "1", poolHours: "1", openWaterDives: "0" },
];

export async function seedCourses(client: SeedClient): Promise<CreatedCourse[]> {
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
      console.warn(`  ⚠ Course "${course.name}" may have failed (status ${result.status})`);
    } else {
      console.log(`  ✓ Course: ${course.name}`);
    }
    await sleep(50);
  }

  // Get course list and parse IDs
  const html = await client.getHtml("/tenant/training/courses");
  const ids = client.parseCourseIds(html);

  if (ids.length < COURSES.length) {
    console.warn(`  ⚠ Expected ${COURSES.length} course IDs but found ${ids.length}`);
  }

  return COURSES.map((course, i) => ({
    id: ids[i] ?? "",
    name: course.name,
  }));
}

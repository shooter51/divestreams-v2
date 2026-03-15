import type { SeedClient } from "../client";
import { sleep } from "../client";
import type { CreatedCourse } from "../modules/courses";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

// The Dive Shop LA instructors
const INSTRUCTORS = {
  mike: "Captain Mike Reeves",
  elena: "Dr. Elena Reeves",
  danny: "Danny Kowalski",
  lisa: "Lisa Yamamoto",
};

export async function seedTdslaSessions(
  client: SeedClient,
  courses: CreatedCourse[]
): Promise<void> {
  console.log("Seeding TDSLA training sessions...");

  const find = (keyword: string, exclude?: string) =>
    courses.find(c => c.name.includes(keyword) && (!exclude || !c.name.includes(exclude)));

  const owd = find("Open Water Diver", "SSI");
  const aowd = find("Advanced Open Water");
  const rescue = find("Rescue Diver");
  const nitrox = find("Enriched Air Nitrox");
  const deep = find("Deep Diver");
  const night = find("Night Diver");
  const wreck = find("Wreck Diver");
  const photo = find("Underwater Photographer");
  const ppb = find("Peak Performance");
  const drysuit = find("Dry Suit");
  const tryScuba = find("Discover Scuba");

  const sessions = [
    // ── Past sessions (completed) ──
    { courseId: owd?.id, startDate: daysAgo(75), endDate: daysAgo(72), startTime: "08:00", location: "The Dive Shop LA + Casino Point, Catalina", instructorName: INSTRUCTORS.mike, maxStudents: "8", notes: "Full class — 8 students certified. Great visibility at Catalina." },
    { courseId: aowd?.id, startDate: daysAgo(60), endDate: daysAgo(58), startTime: "07:00", location: "Redondo Canyon + Catalina", instructorName: INSTRUCTORS.elena, maxStudents: "6", notes: "Deep dive at canyon, navigation at Veteran's Park. 6/6 passed." },
    { courseId: rescue?.id, startDate: daysAgo(50), endDate: daysAgo(47), startTime: "08:00", location: "The Dive Shop LA + Veteran's Park", instructorName: INSTRUCTORS.danny, maxStudents: "6", notes: "Excellent scenario practice. 5 students certified." },
    { courseId: nitrox?.id, startDate: daysAgo(40), endDate: daysAgo(40), startTime: "09:00", location: "Classroom — The Dive Shop LA", instructorName: INSTRUCTORS.lisa, maxStudents: "8", notes: "Theory + analyzer practical. All 7 students passed." },
    { courseId: deep?.id, startDate: daysAgo(30), endDate: daysAgo(29), startTime: "06:00", location: "Farnsworth Bank, Catalina", instructorName: INSTRUCTORS.mike, maxStudents: "6", notes: "Perfect conditions. Hydrocoral visible. 4 students certified." },
    { courseId: night?.id, startDate: daysAgo(20), endDate: daysAgo(19), startTime: "18:30", location: "Veteran's Park, Redondo Beach", instructorName: INSTRUCTORS.danny, maxStudents: "6", notes: "Squid run on night 2! Best night dive of the season." },
    { courseId: photo?.id, startDate: daysAgo(14), endDate: daysAgo(13), startTime: "08:00", location: "Casino Point + Italian Gardens, Catalina", instructorName: INSTRUCTORS.elena, maxStudents: "6", notes: "Macro day 1, wide-angle day 2. Outstanding student photos." },

    // ── Upcoming sessions ──
    { courseId: owd?.id, startDate: daysFromNow(5), endDate: daysFromNow(8), startTime: "08:00", location: "The Dive Shop LA + Casino Point, Catalina", instructorName: INSTRUCTORS.mike, maxStudents: "8", notes: "" },
    { courseId: owd?.id, startDate: daysFromNow(33), endDate: daysFromNow(36), startTime: "08:00", location: "The Dive Shop LA + Italian Gardens, Catalina", instructorName: INSTRUCTORS.lisa, maxStudents: "8", notes: "" },
    { courseId: owd?.id, startDate: daysFromNow(61), endDate: daysFromNow(64), startTime: "08:00", location: "The Dive Shop LA + Casino Point, Catalina", instructorName: INSTRUCTORS.mike, maxStudents: "8", notes: "" },
    { courseId: aowd?.id, startDate: daysFromNow(12), endDate: daysFromNow(14), startTime: "07:00", location: "Catalina + Redondo Canyon", instructorName: INSTRUCTORS.elena, maxStudents: "6", notes: "" },
    { courseId: aowd?.id, startDate: daysFromNow(47), endDate: daysFromNow(49), startTime: "07:00", location: "Catalina + Redondo Canyon", instructorName: INSTRUCTORS.danny, maxStudents: "6", notes: "" },
    { courseId: rescue?.id, startDate: daysFromNow(19), endDate: daysFromNow(22), startTime: "08:00", location: "The Dive Shop LA + Veteran's Park", instructorName: INSTRUCTORS.danny, maxStudents: "6", notes: "" },
    { courseId: rescue?.id, startDate: daysFromNow(54), endDate: daysFromNow(57), startTime: "08:00", location: "The Dive Shop LA + Veteran's Park", instructorName: INSTRUCTORS.mike, maxStudents: "6", notes: "" },
    { courseId: nitrox?.id, startDate: daysFromNow(8), endDate: daysFromNow(8), startTime: "09:00", location: "Classroom — The Dive Shop LA", instructorName: INSTRUCTORS.lisa, maxStudents: "8", notes: "" },
    { courseId: nitrox?.id, startDate: daysFromNow(43), endDate: daysFromNow(43), startTime: "09:00", location: "Classroom — The Dive Shop LA", instructorName: INSTRUCTORS.lisa, maxStudents: "8", notes: "" },
    { courseId: deep?.id, startDate: daysFromNow(26), endDate: daysFromNow(27), startTime: "06:00", location: "Farnsworth Bank, Catalina", instructorName: INSTRUCTORS.mike, maxStudents: "6", notes: "" },
    { courseId: wreck?.id, startDate: daysFromNow(40), endDate: daysFromNow(41), startTime: "06:00", location: "Yukon Wreck, San Diego", instructorName: INSTRUCTORS.danny, maxStudents: "6", notes: "" },
    { courseId: night?.id, startDate: daysFromNow(10), endDate: daysFromNow(11), startTime: "18:30", location: "Veteran's Park, Redondo Beach", instructorName: INSTRUCTORS.danny, maxStudents: "6", notes: "" },
    { courseId: photo?.id, startDate: daysFromNow(16), endDate: daysFromNow(17), startTime: "08:00", location: "Casino Point + Blue Cavern, Catalina", instructorName: INSTRUCTORS.elena, maxStudents: "6", notes: "" },
    { courseId: ppb?.id, startDate: daysFromNow(7), endDate: daysFromNow(7), startTime: "09:00", location: "Pool + Veteran's Park", instructorName: INSTRUCTORS.lisa, maxStudents: "6", notes: "" },
    { courseId: drysuit?.id, startDate: daysFromNow(30), endDate: daysFromNow(31), startTime: "08:00", location: "Pool + Redondo Canyon", instructorName: INSTRUCTORS.mike, maxStudents: "4", notes: "" },
    { courseId: tryScuba?.id, startDate: daysFromNow(3), endDate: daysFromNow(3), startTime: "10:00", location: "Pool — The Dive Shop LA", instructorName: INSTRUCTORS.lisa, maxStudents: "4", notes: "" },
    { courseId: tryScuba?.id, startDate: daysFromNow(17), endDate: daysFromNow(17), startTime: "10:00", location: "Pool — The Dive Shop LA", instructorName: INSTRUCTORS.lisa, maxStudents: "4", notes: "" },
  ];

  for (const session of sessions) {
    if (!session.courseId) {
      console.warn("  Warning: Skipping session — course not found");
      continue;
    }

    const fd = new FormData();
    const csrf = await client.getCsrfToken();
    fd.append("_csrf", csrf);
    fd.append("courseId", session.courseId);
    fd.append("startDate", session.startDate);
    if (session.endDate) fd.append("endDate", session.endDate);
    fd.append("startTime", session.startTime);
    fd.append("location", session.location);
    fd.append("instructorName", session.instructorName);
    fd.append("maxStudents", session.maxStudents);
    if (session.notes) fd.append("notes", session.notes);

    const result = await client.post("/tenant/training/sessions/new", fd);
    if (!result.ok && result.status !== 302 && result.status !== 303) {
      console.warn(`  Warning: Session ${session.startDate} returned ${result.status}`);
    } else {
      console.log(`  Session: ${session.startDate} @ ${session.location.split(",")[0]}`);
    }
    await sleep(50);
  }

  console.log("  TDSLA sessions seeded.");
}

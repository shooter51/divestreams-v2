import type { SeedClient } from "../client";
import { sleep } from "../client";

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

export async function seedSessions(
  client: SeedClient,
  courses: { id: string; name: string }[]
): Promise<void> {
  const owd = courses.find(c => c.name.includes("Open Water Diver") && c.name.includes("PADI") && !c.name.includes("Advanced") && !c.name.includes("SSI"));
  const aowd = courses.find(c => c.name.includes("Advanced Open Water"));
  const rescue = courses.find(c => c.name.includes("Rescue Diver"));
  const nitrox = courses.find(c => c.name.includes("Enriched Air Nitrox"));
  const deep = courses.find(c => c.name.includes("Deep Diver"));
  const wreck = courses.find(c => c.name.includes("Wreck Diver"));
  const photo = courses.find(c => c.name.includes("Underwater Photographer"));
  const night = courses.find(c => c.name.includes("Night Diver"));
  const tryScuba = courses.find(c => c.name.includes("Try Scuba"));

  const sessions = [
    // Past sessions (2 months ago)
    { courseId: owd?.id, startDate: daysAgo(65), endDate: daysAgo(62), startTime: "08:00", location: "Main Dive Center", instructorName: "Captain Rodriguez", maxStudents: "8", notes: "Completed successfully. 6 students certified." },
    { courseId: aowd?.id, startDate: daysAgo(55), endDate: daysAgo(53), startTime: "08:30", location: "Main Dive Center", instructorName: "Sarah Mitchell", maxStudents: "6", notes: "All students passed. Great conditions." },
    { courseId: rescue?.id, startDate: daysAgo(45), endDate: daysAgo(43), startTime: "08:00", location: "Main Dive Center", instructorName: "James Kowalski", maxStudents: "6", notes: "Strong group. All certified." },
    { courseId: nitrox?.id, startDate: daysAgo(35), endDate: daysAgo(35), startTime: "09:00", location: "Classroom B", instructorName: "Sarah Mitchell", maxStudents: "8", notes: "Theory only course. All passed written exam." },
    { courseId: deep?.id, startDate: daysAgo(25), endDate: daysAgo(24), startTime: "07:30", location: "Blue Hole Dive Site", instructorName: "Captain Rodriguez", maxStudents: "6", notes: "Excellent visibility. 4 students certified." },
    { courseId: wreck?.id, startDate: daysAgo(15), endDate: daysAgo(14), startTime: "07:00", location: "SS Thistlegorm Wreck", instructorName: "James Kowalski", maxStudents: "6", notes: "Amazing wreck dive. 5 students completed." },
    // Upcoming sessions (next 1-3 months)
    { courseId: owd?.id, startDate: daysFromNow(7), endDate: daysFromNow(10), startTime: "08:00", location: "Main Dive Center", instructorName: "Captain Rodriguez", maxStudents: "8", notes: "" },
    { courseId: owd?.id, startDate: daysFromNow(35), endDate: daysFromNow(38), startTime: "08:00", location: "Main Dive Center", instructorName: "Sarah Mitchell", maxStudents: "8", notes: "" },
    { courseId: owd?.id, startDate: daysFromNow(65), endDate: daysFromNow(68), startTime: "08:00", location: "Main Dive Center", instructorName: "Captain Rodriguez", maxStudents: "8", notes: "" },
    { courseId: aowd?.id, startDate: daysFromNow(14), endDate: daysFromNow(16), startTime: "08:30", location: "Main Dive Center", instructorName: "Sarah Mitchell", maxStudents: "6", notes: "" },
    { courseId: aowd?.id, startDate: daysFromNow(50), endDate: daysFromNow(52), startTime: "08:30", location: "Main Dive Center", instructorName: "James Kowalski", maxStudents: "6", notes: "" },
    { courseId: rescue?.id, startDate: daysFromNow(21), endDate: daysFromNow(23), startTime: "08:00", location: "Main Dive Center", instructorName: "James Kowalski", maxStudents: "6", notes: "" },
    { courseId: rescue?.id, startDate: daysFromNow(58), endDate: daysFromNow(60), startTime: "08:00", location: "Main Dive Center", instructorName: "Captain Rodriguez", maxStudents: "6", notes: "" },
    { courseId: nitrox?.id, startDate: daysFromNow(10), endDate: daysFromNow(10), startTime: "09:00", location: "Classroom A", instructorName: "Sarah Mitchell", maxStudents: "8", notes: "" },
    { courseId: nitrox?.id, startDate: daysFromNow(45), endDate: daysFromNow(45), startTime: "09:00", location: "Classroom A", instructorName: "Sarah Mitchell", maxStudents: "8", notes: "" },
    { courseId: deep?.id, startDate: daysFromNow(28), endDate: daysFromNow(29), startTime: "07:30", location: "Blue Hole Dive Site", instructorName: "Captain Rodriguez", maxStudents: "6", notes: "" },
    { courseId: wreck?.id, startDate: daysFromNow(42), endDate: daysFromNow(43), startTime: "07:00", location: "SS Thistlegorm Wreck", instructorName: "James Kowalski", maxStudents: "6", notes: "" },
    { courseId: photo?.id, startDate: daysFromNow(18), endDate: daysFromNow(19), startTime: "09:00", location: "Coral Garden Reef", instructorName: "Sarah Mitchell", maxStudents: "6", notes: "" },
    { courseId: night?.id, startDate: daysFromNow(12), endDate: daysFromNow(12), startTime: "18:00", location: "Night Dive Beach", instructorName: "James Kowalski", maxStudents: "6", notes: "" },
    { courseId: tryScuba?.id, startDate: daysFromNow(3), endDate: daysFromNow(3), startTime: "10:00", location: "Pool - Main Dive Center", instructorName: "Captain Rodriguez", maxStudents: "4", notes: "" },
  ];

  for (const session of sessions) {
    if (!session.courseId) {
      console.warn(`  ⚠ Skipping session - course not found`);
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
      console.warn(`  ⚠ Session ${session.startDate} may have failed (status ${result.status})`);
    } else {
      console.log(`  ✓ Session: ${session.startDate} (course ID: ${session.courseId.slice(0, 8)}...)`);
    }
    await sleep(50);
  }
}

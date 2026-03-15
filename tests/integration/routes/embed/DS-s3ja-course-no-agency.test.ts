/**
 * DS-s3ja: Embed enrollment returns Shop Not Found for valid courses
 *
 * The original bug was that getPublicCourseById() used INNER JOINs on
 * certificationAgencies and certificationLevels tables. If a course was created
 * without linking to these tables, the query returned no rows, causing a 404
 * "Course not found" response.
 *
 * The fix was to change to LEFT JOINs and use template/fallback data when
 * agency/level rows are absent.
 *
 * This test verifies the route loader correctly handles courses where
 * getPublicCourseById returns a course even without agency/level data.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader } from "../../../../app/routes/embed/$tenant.courses.$courseId.enroll";

vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
  getPublicCourseById: vi.fn(),
}));

vi.mock("../../../../lib/db/mutations.public", () => ({
  createWidgetEnrollment: vi.fn(),
}));

import { getOrganizationBySlug, getPublicCourseById } from "../../../../lib/db/queries.public";

describe("DS-s3ja: embed course enrollment — courses without agency/level data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "tdsla" });
  });

  it("loads successfully when course has no agency or level data (LEFT JOIN result)", async () => {
    // This simulates the post-fix behavior: getPublicCourseById uses LEFT JOINs
    // so a course with no linked agency/level still returns a row with null values.
    const courseWithoutAgency = {
      id: "c1",
      name: "Open Water Diver",
      description: null,
      agencyName: null,   // no linked agency row
      agencyCode: null,
      agencyLogo: null,
      levelName: null,    // no linked level row
      levelCode: null,
      price: "299.00",
      depositAmount: null,
      maxStudents: 8,
      durationDays: 4,
      classroomHours: 8,
      poolHours: 4,
      openWaterDives: 4,
      currency: "USD",
      upcomingSessions: [
        { id: "s1", startDate: "2025-07-01", availableSpots: 5, endDate: null, startTime: null, location: null, instructorName: null },
      ],
    };

    (getPublicCourseById as Mock).mockResolvedValue(courseWithoutAgency);

    const result = await loader({
      request: new Request("https://tdsla.divestreams.com/embed/tdsla/courses/c1/enroll?sessionId=s1"),
      params: { tenant: "tdsla", courseId: "c1" },
      context: {},
    } as Parameters<typeof loader>[0]);

    expect(result.course).toBeDefined();
    expect(result.course.id).toBe("c1");
    expect(result.session.id).toBe("s1");
    // agencyName can be null — the route should not throw
    expect(result.course.agencyName).toBeNull();
    expect(result.course.levelName).toBeNull();
  });

  it("throws 404 when getPublicCourseById returns null (course truly does not exist)", async () => {
    (getPublicCourseById as Mock).mockResolvedValue(null);

    await expect(
      loader({
        request: new Request("https://tdsla.divestreams.com/embed/tdsla/courses/nonexistent/enroll?sessionId=s1"),
        params: { tenant: "tdsla", courseId: "nonexistent" },
        context: {},
      } as Parameters<typeof loader>[0])
    ).rejects.toEqual(expect.objectContaining({ status: 404 }));
  });

  it("throws 404 when org slug does not match any organization", async () => {
    (getOrganizationBySlug as Mock).mockResolvedValue(null);

    await expect(
      loader({
        request: new Request("https://unknown.divestreams.com/embed/unknown/courses/c1/enroll?sessionId=s1"),
        params: { tenant: "unknown", courseId: "c1" },
        context: {},
      } as Parameters<typeof loader>[0])
    ).rejects.toEqual(expect.objectContaining({ status: 404 }));
  });
});

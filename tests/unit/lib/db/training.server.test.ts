/**
 * Training Server Database Functions Tests
 *
 * Comprehensive tests for training module database operations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Store for mock return values
let mockReturnValue: unknown[] = [];

// Create a unified chain object that supports all Drizzle patterns
const createDbMock = () => {
  const chain: Record<string, unknown> = {};

  // Promise-like interface
  chain.then = (resolve: (value: unknown[]) => void) => {
    resolve(mockReturnValue);
    return chain;
  };
  chain.catch = () => chain;

  // All query-building methods return the chain
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve([{ id: "new-id" }]));

  return chain;
};

const dbMock = createDbMock();

// Mock the database module
vi.mock("../../../../lib/db/index", () => ({
  db: dbMock,
}));

describe("Training Server - Agency Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturnValue = [];
  });

  it("should get all agencies for an organization", async () => {
    const { getAgencies } = await import("../../../../lib/db/training.server");
    mockReturnValue = [
      { id: "agency-1", name: "PADI", code: "PADI", organizationId: "org-1" },
      { id: "agency-2", name: "SSI", code: "SSI", organizationId: "org-1" },
    ];

    const result = await getAgencies("org-1");

    expect(result).toHaveLength(2);
    expect(dbMock.select).toHaveBeenCalled();
  });

  it("should get agency by ID", async () => {
    const { getAgencyById } = await import("../../../../lib/db/training.server");
    mockReturnValue = [{ id: "agency-1", name: "PADI", organizationId: "org-1" }];

    const result = await getAgencyById("org-1", "agency-1");

    expect(result).toBeDefined();
    expect(result?.id).toBe("agency-1");
  });

  it("should create an agency", async () => {
    const { createAgency } = await import("../../../../lib/db/training.server");
    (dbMock.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "agency-1", name: "PADI", code: "PADI", organizationId: "org-1" },
    ]);

    const result = await createAgency({
      organizationId: "org-1",
      name: "PADI",
      code: "PADI",
    });

    expect(result.id).toBe("agency-1");
    expect(dbMock.insert).toHaveBeenCalled();
  });

  it("should update an agency", async () => {
    const { updateAgency } = await import("../../../../lib/db/training.server");
    (dbMock.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "agency-1", name: "PADI Updated", organizationId: "org-1" },
    ]);

    const result = await updateAgency("org-1", "agency-1", { name: "PADI Updated" });

    expect(result.name).toBe("PADI Updated");
    expect(dbMock.update).toHaveBeenCalled();
  });

  it("should delete an agency", async () => {
    const { deleteAgency } = await import("../../../../lib/db/training.server");

    await deleteAgency("org-1", "agency-1");

    expect(dbMock.delete).toHaveBeenCalled();
  });
});

describe("Training Server - Level Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturnValue = [];
  });

  it("should get all levels for an organization", async () => {
    const { getLevels } = await import("../../../../lib/db/training.server");
    mockReturnValue = [
      { id: "level-1", name: "Open Water", levelNumber: 1, organizationId: "org-1" },
      { id: "level-2", name: "Advanced", levelNumber: 2, organizationId: "org-1" },
    ];

    const result = await getLevels("org-1");

    expect(result).toHaveLength(2);
    expect(dbMock.select).toHaveBeenCalled();
  });

  it("should get level by ID", async () => {
    const { getLevelById } = await import("../../../../lib/db/training.server");
    mockReturnValue = [{ id: "level-1", name: "Open Water", organizationId: "org-1" }];

    const result = await getLevelById("org-1", "level-1");

    expect(result?.id).toBe("level-1");
  });

  it("should create a level", async () => {
    const { createLevel } = await import("../../../../lib/db/training.server");
    (dbMock.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "level-1", name: "Open Water", code: "OW", levelNumber: 1 },
    ]);

    const result = await createLevel({
      organizationId: "org-1",
      agencyId: "agency-1",
      name: "Open Water",
      code: "OW",
      levelNumber: 1,
    });

    expect(result.id).toBe("level-1");
    expect(dbMock.insert).toHaveBeenCalled();
  });

  it("should update a level", async () => {
    const { updateLevel } = await import("../../../../lib/db/training.server");
    (dbMock.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "level-1", name: "Open Water Updated" },
    ]);

    const result = await updateLevel("org-1", "level-1", { name: "Open Water Updated" });

    expect(result.name).toBe("Open Water Updated");
    expect(dbMock.update).toHaveBeenCalled();
  });

  it("should delete a level", async () => {
    const { deleteLevel } = await import("../../../../lib/db/training.server");

    await deleteLevel("org-1", "level-1");

    expect(dbMock.delete).toHaveBeenCalled();
  });
});

describe("Training Server - Course Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturnValue = [];
  });

  it("should get all courses", async () => {
    const { getCourses } = await import("../../../../lib/db/training.server");
    mockReturnValue = [
      { id: "course-1", name: "OW Course", levelId: "level-1" },
      { id: "course-2", name: "AOW Course", levelId: "level-2" },
    ];

    const result = await getCourses("org-1");

    expect(result).toHaveLength(2);
  });

  it("should filter courses by agency", async () => {
    const { getCourses } = await import("../../../../lib/db/training.server");
    mockReturnValue = [{ id: "course-1", name: "OW Course" }];

    await getCourses("org-1", { agencyId: "agency-1" });

    expect(dbMock.where).toHaveBeenCalled();
  });

  it("should filter courses by level", async () => {
    const { getCourses } = await import("../../../../lib/db/training.server");
    mockReturnValue = [];

    await getCourses("org-1", { levelId: "level-1" });

    expect(dbMock.where).toHaveBeenCalled();
  });

  it("should get course by ID", async () => {
    const { getCourseById } = await import("../../../../lib/db/training.server");
    mockReturnValue = [{ id: "course-1", name: "OW Course" }];

    const result = await getCourseById("org-1", "course-1");

    expect(result?.id).toBe("course-1");
  });

  it("should create a course", async () => {
    const { createCourse } = await import("../../../../lib/db/training.server");
    (dbMock.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "course-1", name: "OW Course", duration: 3, price: 399.99 },
    ]);

    const result = await createCourse({
      organizationId: "org-1",
      levelId: "level-1",
      name: "OW Course",
      code: "OWC",
      duration: 3,
      price: 399.99,
    });

    expect(result.id).toBe("course-1");
  });

  it("should update a course", async () => {
    const { updateCourse } = await import("../../../../lib/db/training.server");
    (dbMock.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "course-1", name: "Updated Course" },
    ]);

    const result = await updateCourse("org-1", "course-1", { name: "Updated Course" });

    expect(result.name).toBe("Updated Course");
  });

  it("should delete a course", async () => {
    const { deleteCourse } = await import("../../../../lib/db/training.server");

    await deleteCourse("org-1", "course-1");

    expect(dbMock.delete).toHaveBeenCalled();
  });
});

describe("Training Server - Session Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturnValue = [];
  });

  it("should get all sessions", async () => {
    const { getSessions } = await import("../../../../lib/db/training.server");
    mockReturnValue = [
      { id: "session-1", courseId: "course-1", startDate: new Date() },
      { id: "session-2", courseId: "course-2", startDate: new Date() },
    ];

    const result = await getSessions("org-1");

    expect(result).toHaveLength(2);
  });

  it("should filter sessions by course", async () => {
    const { getSessions } = await import("../../../../lib/db/training.server");
    mockReturnValue = [];

    await getSessions("org-1", { courseId: "course-1" });

    expect(dbMock.where).toHaveBeenCalled();
  });

  it("should filter sessions by status", async () => {
    const { getSessions } = await import("../../../../lib/db/training.server");
    mockReturnValue = [];

    await getSessions("org-1", { status: "scheduled" });

    expect(dbMock.where).toHaveBeenCalled();
  });

  it("should get session by ID", async () => {
    const { getSessionById } = await import("../../../../lib/db/training.server");
    mockReturnValue = [{ id: "session-1", courseId: "course-1" }];

    const result = await getSessionById("org-1", "session-1");

    expect(result?.id).toBe("session-1");
  });

  it("should create a session", async () => {
    const { createSession } = await import("../../../../lib/db/training.server");
    (dbMock.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: "session-1",
        courseId: "course-1",
        instructorId: "inst-1",
        startDate: new Date(),
        endDate: new Date(),
        maxCapacity: 8,
      },
    ]);

    const result = await createSession({
      organizationId: "org-1",
      courseId: "course-1",
      instructorId: "inst-1",
      startDate: new Date(),
      endDate: new Date(),
      maxCapacity: 8,
    });

    expect(result.id).toBe("session-1");
  });

  it("should update a session", async () => {
    const { updateSession } = await import("../../../../lib/db/training.server");
    (dbMock.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: "session-1", maxCapacity: 10 },
    ]);

    const result = await updateSession("org-1", "session-1", { maxCapacity: 10 });

    expect(result.maxCapacity).toBe(10);
  });

  it("should delete a session", async () => {
    const { deleteSession } = await import("../../../../lib/db/training.server");

    await deleteSession("org-1", "session-1");

    expect(dbMock.delete).toHaveBeenCalled();
  });
});

describe("Training Server - Enrollment Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturnValue = [];
  });

  it("should get all enrollments", async () => {
    const { getEnrollments } = await import("../../../../lib/db/training.server");
    mockReturnValue = [
      { id: "enroll-1", sessionId: "session-1", studentId: "student-1" },
      { id: "enroll-2", sessionId: "session-1", studentId: "student-2" },
    ];

    const result = await getEnrollments("org-1");

    expect(result).toHaveLength(2);
  });

  it("should filter enrollments by session", async () => {
    const { getEnrollments } = await import("../../../../lib/db/training.server");
    mockReturnValue = [];

    await getEnrollments("org-1", { sessionId: "session-1" });

    expect(dbMock.where).toHaveBeenCalled();
  });

  it("should filter enrollments by student", async () => {
    const { getEnrollments } = await import("../../../../lib/db/training.server");
    mockReturnValue = [];

    await getEnrollments("org-1", { studentId: "student-1" });

    expect(dbMock.where).toHaveBeenCalled();
  });

  it("should get enrollment by ID", async () => {
    const { getEnrollmentById } = await import("../../../../lib/db/training.server");
    mockReturnValue = [{ id: "enroll-1", sessionId: "session-1" }];

    const result = await getEnrollmentById("org-1", "enroll-1");

    expect(result?.id).toBe("enroll-1");
  });

  it("should create an enrollment", async () => {
    const { createEnrollment } = await import("../../../../lib/db/training.server");

    // Mock session validation
    mockReturnValue = [
      {
        id: "session-1",
        status: "scheduled",
        maxStudents: 10,
        enrolledCount: 3,
      },
    ];

    // Mock customer validation (second query)
    vi.mocked(dbMock.where).mockResolvedValueOnce(mockReturnValue)
      .mockResolvedValueOnce([{ id: "customer-1" }]) // Customer exists
      .mockResolvedValueOnce([]); // No existing enrollment

    (dbMock.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: "enroll-1",
        sessionId: "session-1",
        customerId: "customer-1",
        status: "enrolled",
      },
    ]);

    const result = await createEnrollment({
      organizationId: "org-1",
      sessionId: "session-1",
      customerId: "customer-1",
      status: "enrolled",
    });

    expect(result.id).toBe("enroll-1");
  });

  it("should update an enrollment", async () => {
    const { updateEnrollment } = await import("../../../../lib/db/training.server");

    // Mock the returning value correctly
    mockReturnValue = [{ id: "enroll-1", status: "completed" }];
    (dbMock.returning as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockReturnValue);

    const result = await updateEnrollment("org-1", "enroll-1", { status: "completed" });

    expect(result.status).toBe("completed");
  });

  it("should delete an enrollment", async () => {
    const { deleteEnrollment } = await import("../../../../lib/db/training.server");
    // deleteEnrollment does a select first to get session ID
    mockReturnValue = [{ sessionId: "session-1" }];

    await deleteEnrollment("org-1", "enroll-1");

    expect(dbMock.select).toHaveBeenCalled();
  });
});

describe("Training Server - Dashboard Stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturnValue = [];
  });

  it("should get dashboard stats", async () => {
    const { getTrainingDashboardStats } = await import("../../../../lib/db/training.server");
    mockReturnValue = [
      {
        totalCourses: 10,
        activeSessions: 3,
        totalEnrollments: 45,
        completedEnrollments: 32,
      },
    ];

    const result = await getTrainingDashboardStats("org-1");

    expect(result).toBeDefined();
    expect(dbMock.select).toHaveBeenCalled();
  });

  it("should get upcoming sessions", async () => {
    const { getUpcomingTrainingSessions } = await import("../../../../lib/db/training.server");
    mockReturnValue = [
      { id: "session-1", startDate: new Date() },
      { id: "session-2", startDate: new Date() },
    ];

    const result = await getUpcomingTrainingSessions("org-1");

    expect(result).toHaveLength(2);
    expect(dbMock.limit).toHaveBeenCalledWith(5);
  });

  it("should get upcoming sessions with custom limit", async () => {
    const { getUpcomingTrainingSessions } = await import("../../../../lib/db/training.server");
    mockReturnValue = [];

    await getUpcomingTrainingSessions("org-1", 10);

    expect(dbMock.limit).toHaveBeenCalledWith(10);
  });

  it("should get recent enrollments", async () => {
    const { getRecentEnrollments } = await import("../../../../lib/db/training.server");
    mockReturnValue = [
      { id: "enroll-1", enrollmentDate: new Date() },
      { id: "enroll-2", enrollmentDate: new Date() },
    ];

    const result = await getRecentEnrollments("org-1");

    expect(result).toHaveLength(2);
    expect(dbMock.limit).toHaveBeenCalledWith(5);
  });

  it("should get recent enrollments with custom limit", async () => {
    const { getRecentEnrollments } = await import("../../../../lib/db/training.server");
    mockReturnValue = [];

    await getRecentEnrollments("org-1", 15);

    expect(dbMock.limit).toHaveBeenCalledWith(15);
  });
});

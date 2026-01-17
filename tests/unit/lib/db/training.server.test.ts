import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    then: vi.fn(),
  },
}));

describe("Training Server Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCertificationAgencies", () => {
    it("exports getCertificationAgencies function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.getCertificationAgencies).toBe("function");
    });
  });

  describe("getCertificationLevels", () => {
    it("exports getCertificationLevels function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.getCertificationLevels).toBe("function");
    });
  });

  describe("getTrainingCourses", () => {
    it("exports getTrainingCourses function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.getTrainingCourses).toBe("function");
    });
  });

  describe("getTrainingCourseById", () => {
    it("exports getTrainingCourseById function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.getTrainingCourseById).toBe("function");
    });
  });

  describe("getCourseSessions", () => {
    it("exports getCourseSessions function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.getCourseSessions).toBe("function");
    });
  });

  describe("getEnrollments", () => {
    it("exports getEnrollments function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.getEnrollments).toBe("function");
    });
  });

  describe("getEnrollmentById", () => {
    it("exports getEnrollmentById function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.getEnrollmentById).toBe("function");
    });
  });

  describe("createCertificationAgency", () => {
    it("exports createCertificationAgency function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.createCertificationAgency).toBe("function");
    });
  });

  describe("createCertificationLevel", () => {
    it("exports createCertificationLevel function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.createCertificationLevel).toBe("function");
    });
  });

  describe("createTrainingCourse", () => {
    it("exports createTrainingCourse function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.createTrainingCourse).toBe("function");
    });
  });

  describe("createCourseSession", () => {
    it("exports createCourseSession function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.createCourseSession).toBe("function");
    });
  });

  describe("createEnrollment", () => {
    it("exports createEnrollment function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.createEnrollment).toBe("function");
    });
  });

  describe("updateEnrollmentStatus", () => {
    it("exports updateEnrollmentStatus function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.updateEnrollmentStatus).toBe("function");
    });
  });

  describe("recordSkillCheckoff", () => {
    it("exports recordSkillCheckoff function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.recordSkillCheckoff).toBe("function");
    });
  });

  describe("getStudentProgress", () => {
    it("exports getStudentProgress function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.getStudentProgress).toBe("function");
    });
  });

  describe("checkPrerequisites", () => {
    it("exports checkPrerequisites function", async () => {
      const module = await import("../../../../lib/db/training.server");
      expect(typeof module.checkPrerequisites).toBe("function");
    });
  });
});

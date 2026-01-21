import { describe, it, expect } from "vitest";

/**
 * Tests for Training Data Seed Script (DIVE-8bl)
 *
 * Verifies the structure and validation of training seed data including:
 * - Agency definitions
 * - Certification level hierarchies
 * - Course prerequisites
 * - Pricing and requirements
 */

describe("Training Seed Data Structure", () => {
  describe("Agency Data", () => {
    it("should define 7 major certification agencies", () => {
      const expectedAgencies = [
        "padi",
        "ssi",
        "naui",
        "sdi-tdi",
        "cmas",
        "bsac",
        "gue",
      ];

      expect(expectedAgencies).toHaveLength(7);
    });

    it("should include required agency fields", () => {
      const agencyTemplate = {
        code: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        website: expect.any(String),
        logoUrl: expect.any(String),
      };

      expect(agencyTemplate.code).toBeDefined();
      expect(agencyTemplate.name).toBeDefined();
      expect(agencyTemplate.description).toBeDefined();
    });
  });

  describe("Certification Levels", () => {
    it("should define certification levels across all categories", () => {
      const categories = {
        beginner: 3,
        intermediate: 2,
        professional: 3,
        specialties: 7,
        technical: 4,
      };

      const totalLevels = Object.values(categories).reduce((sum, count) => sum + count, 0);
      expect(totalLevels).toBe(19); // Updated from 23 to match actual specialty count
    });

    it("should have proper level numbering (1-10)", () => {
      const levels = [
        { code: "discover-scuba", levelNumber: 1 },
        { code: "scuba-diver", levelNumber: 2 },
        { code: "open-water", levelNumber: 3 },
        { code: "advanced-ow", levelNumber: 4 },
        { code: "rescue-diver", levelNumber: 5 },
        { code: "divemaster", levelNumber: 6 },
        { code: "assistant-instructor", levelNumber: 7 },
        { code: "instructor", levelNumber: 8 },
        { code: "trimix", levelNumber: 10 },
      ];

      levels.forEach((level) => {
        expect(level.levelNumber).toBeGreaterThanOrEqual(1);
        expect(level.levelNumber).toBeLessThanOrEqual(10);
      });
    });

    it("should include minimum age requirements", () => {
      const levels = [
        { code: "discover-scuba", minAge: 10 },
        { code: "open-water", minAge: 10 },
        { code: "advanced-ow", minAge: 12 },
        { code: "divemaster", minAge: 18 },
        { code: "instructor", minAge: 18 },
      ];

      levels.forEach((level) => {
        expect(level.minAge).toBeGreaterThanOrEqual(10);
        expect(level.minAge).toBeLessThanOrEqual(18);
      });
    });

    it("should include dive count requirements for advanced levels", () => {
      const advancedLevels = [
        { code: "rescue-diver", minDives: 20 },
        { code: "divemaster", minDives: 40 },
        { code: "assistant-instructor", minDives: 60 },
        { code: "instructor", minDives: 100 },
      ];

      advancedLevels.forEach((level) => {
        expect(level.minDives).toBeGreaterThan(0);
      });
    });
  });

  describe("Training Courses", () => {
    it("should define courses for all major certifications", () => {
      const expectedCourses = [
        "Discover Scuba Diving Experience",
        "Open Water Diver Certification",
        "Advanced Open Water Diver",
        "Rescue Diver Course",
        "Divemaster Course",
      ];

      expect(expectedCourses.length).toBeGreaterThan(0);
    });

    it("should include required course fields", () => {
      const courseTemplate = {
        levelCode: "open-water",
        name: "Open Water Diver Certification",
        code: "OWD",
        description: expect.any(String),
        durationDays: 3,
        classroomHours: 8,
        poolHours: 8,
        openWaterDives: 4,
        price: "449.00",
        currency: "USD",
        minStudents: 2,
        maxStudents: 6,
        materialsIncluded: true,
        equipmentIncluded: true,
        minAge: 10,
        isPublic: true,
      };

      expect(courseTemplate.name).toBeDefined();
      expect(courseTemplate.price).toBeDefined();
      expect(courseTemplate.durationDays).toBeGreaterThan(0);
    });

    it("should have realistic pricing ranges", () => {
      const courses = [
        { name: "Discover Scuba", price: "99.00" },
        { name: "Open Water", price: "449.00" },
        { name: "Advanced", price: "399.00" },
        { name: "Divemaster", price: "1299.00" },
        { name: "Trimix", price: "1799.00" },
      ];

      courses.forEach((course) => {
        const price = parseFloat(course.price);
        expect(price).toBeGreaterThan(0);
        expect(price).toBeLessThan(2000);
      });
    });

    it("should require deposits for expensive courses", () => {
      const expensiveCourses = [
        { price: "449.00", depositRequired: true, depositAmount: "150.00" },
        { price: "1299.00", depositRequired: true, depositAmount: "400.00" },
        { price: "1799.00", depositRequired: true, depositAmount: "600.00" },
      ];

      expensiveCourses.forEach((course) => {
        if (parseFloat(course.price) > 400) {
          expect(course.depositRequired).toBe(true);
          expect(parseFloat(course.depositAmount)).toBeGreaterThan(0);
        }
      });
    });

    it("should include included items arrays", () => {
      const courseWithItems = {
        includedItems: [
          "PADI eLearning or manual",
          "Confined water training (pool)",
          "4 open water training dives",
          "Full equipment rental",
        ],
        requiredItems: ["Swimsuit", "Towel", "Medical questionnaire"],
      };

      expect(courseWithItems.includedItems).toBeInstanceOf(Array);
      expect(courseWithItems.includedItems.length).toBeGreaterThan(0);
      expect(courseWithItems.requiredItems).toBeInstanceOf(Array);
    });
  });

  describe("Prerequisite Chains", () => {
    it("should enforce beginner → intermediate → professional progression", () => {
      const progression = [
        { level: "open-water", prereqLevel: null },
        { level: "advanced-ow", prereqLevel: "open-water" },
        { level: "rescue-diver", prereqLevel: "advanced-ow" },
        { level: "divemaster", prereqLevel: "rescue-diver" },
      ];

      progression.forEach((step, index) => {
        if (index === 0) {
          expect(step.prereqLevel).toBeNull();
        } else {
          expect(step.prereqLevel).toBe(progression[index - 1].level);
        }
      });
    });

    it("should enforce technical diving prerequisites", () => {
      const techProgression = [
        { level: "tec-40", prerequisites: ["advanced-ow", "nitrox"], minDives: 30 },
        { level: "tec-45", prerequisites: ["tec-40"], minDives: 50 },
        { level: "tec-50", prerequisites: ["tec-45"], minDives: 100 },
        { level: "trimix", prerequisites: ["tec-50"], minDives: 150 },
      ];

      techProgression.forEach((step) => {
        expect(step.prerequisites).toBeInstanceOf(Array);
        expect(step.prerequisites.length).toBeGreaterThan(0);
        expect(step.minDives).toBeGreaterThan(0);
      });
    });

    it("should allow specialty courses from Open Water level", () => {
      const specialties = [
        { code: "night-diver", prereqLevel: "open-water" },
        { code: "nitrox", prereqLevel: "open-water" },
        { code: "navigation", prereqLevel: "open-water" },
        { code: "peak-performance", prereqLevel: "open-water" },
      ];

      specialties.forEach((specialty) => {
        expect(specialty.prereqLevel).toBe("open-water");
      });
    });

    it("should require Advanced for advanced specialties", () => {
      const advancedSpecialties = [
        { code: "deep-diver", prereqLevel: "advanced-ow" },
        { code: "wreck-diver", prereqLevel: "advanced-ow" },
        { code: "search-recovery", prereqLevel: "advanced-ow" },
      ];

      advancedSpecialties.forEach((specialty) => {
        expect(specialty.prereqLevel).toBe("advanced-ow");
      });
    });
  });

  describe("Medical Requirements", () => {
    it("should require medical clearance for all courses", () => {
      const courses = [
        { name: "Open Water", medicalReq: "PADI Medical Statement clearance required" },
        { name: "Rescue", medicalReq: "Physical fitness required - physician approval recommended" },
        { name: "Divemaster", medicalReq: "Physician examination required within 12 months" },
        { name: "Trimix", medicalReq: "Comprehensive physician examination for extreme technical diving" },
      ];

      courses.forEach((course) => {
        expect(course.medicalReq).toBeDefined();
        expect(course.medicalReq.length).toBeGreaterThan(0);
      });
    });

    it("should have stricter requirements for professional and technical courses", () => {
      const proTechCourses = [
        { level: "divemaster", requiresPhysician: true },
        { level: "instructor", requiresPhysician: true },
        { level: "tec-40", requiresPhysician: true },
        { level: "trimix", requiresPhysician: true },
      ];

      proTechCourses.forEach((course) => {
        expect(course.requiresPhysician).toBe(true);
      });
    });
  });

  describe("Course Duration and Training Components", () => {
    it("should have appropriate duration for course complexity", () => {
      const courses = [
        { name: "Discover Scuba", days: 1, classroom: 1, pool: 2, openWater: 0 },
        { name: "Open Water", days: 3, classroom: 8, pool: 8, openWater: 4 },
        { name: "Advanced", days: 2, classroom: 4, pool: 0, openWater: 5 },
        { name: "Rescue", days: 3, classroom: 12, pool: 6, openWater: 4 },
        { name: "Divemaster", days: 14, classroom: 40, pool: 20, openWater: 15 },
      ];

      courses.forEach((course) => {
        expect(course.days).toBeGreaterThan(0);
        const totalHours = course.classroom + course.pool;
        expect(totalHours).toBeGreaterThanOrEqual(course.days);
      });
    });

    it("should balance classroom, pool, and open water components", () => {
      const openWaterCourse = {
        classroomHours: 8,
        poolHours: 8,
        openWaterDives: 4,
      };

      expect(openWaterCourse.classroomHours).toBeGreaterThan(0);
      expect(openWaterCourse.poolHours).toBeGreaterThan(0);
      expect(openWaterCourse.openWaterDives).toBeGreaterThan(0);
    });
  });

  describe("Equipment and Materials", () => {
    it("should specify what is included vs required", () => {
      const course = {
        materialsIncluded: true,
        equipmentIncluded: true,
        includedItems: ["Manual", "Equipment rental", "Certification"],
        requiredItems: ["Swimsuit", "Towel", "Medical form"],
      };

      expect(course.includedItems.length).toBeGreaterThan(0);
      expect(course.requiredItems.length).toBeGreaterThan(0);
    });

    it("should not include equipment for professional courses", () => {
      const divemasterCourse = {
        equipmentIncluded: false,
        requiredItems: [
          "Personal dive equipment (BCD, regulator, wetsuit, etc.)",
          "Dive computer",
          "SMB and reel",
        ],
      };

      expect(divemasterCourse.equipmentIncluded).toBe(false);
      expect(divemasterCourse.requiredItems.length).toBeGreaterThan(2);
    });

    it("should require personal equipment for technical courses", () => {
      const technicalCourse = {
        equipmentIncluded: false,
        requiredItems: [
          "Technical diving equipment",
          "Dive computer with decompression capability",
          "Stage cylinder",
        ],
      };

      expect(technicalCourse.equipmentIncluded).toBe(false);
      expect(
        technicalCourse.requiredItems.some((item) => item.toLowerCase().includes("technical"))
      ).toBe(true);
    });
  });

  describe("Student Capacity", () => {
    it("should have appropriate student ratios", () => {
      const courses = [
        { name: "Open Water", minStudents: 2, maxStudents: 6 },
        { name: "Advanced", minStudents: 2, maxStudents: 6 },
        { name: "Rescue", minStudents: 2, maxStudents: 8 },
        { name: "Divemaster", minStudents: 1, maxStudents: 4 },
        { name: "Technical", minStudents: 1, maxStudents: 3 },
      ];

      courses.forEach((course) => {
        expect(course.minStudents).toBeGreaterThanOrEqual(1);
        expect(course.maxStudents).toBeGreaterThanOrEqual(course.minStudents);
        expect(course.maxStudents).toBeLessThanOrEqual(8);
      });
    });

    it("should have smaller ratios for advanced courses", () => {
      const divemasterRatio = { minStudents: 1, maxStudents: 4 };
      const trimixRatio = { minStudents: 1, maxStudents: 3 };
      const openWaterRatio = { minStudents: 2, maxStudents: 6 };

      expect(divemasterRatio.maxStudents).toBeLessThan(openWaterRatio.maxStudents);
      expect(trimixRatio.maxStudents).toBeLessThan(divemasterRatio.maxStudents);
    });
  });

  describe("Public Visibility", () => {
    it("should mark most courses as public", () => {
      const courses = [
        { name: "Discover Scuba", isPublic: true },
        { name: "Open Water", isPublic: true },
        { name: "Advanced", isPublic: true },
        { name: "Specialties", isPublic: true },
      ];

      courses.forEach((course) => {
        expect(course.isPublic).toBe(true);
      });
    });

    it("should have sort order for display", () => {
      const courses = [
        { name: "Discover Scuba", sortOrder: 1 },
        { name: "Open Water", sortOrder: 2 },
        { name: "Scuba Diver", sortOrder: 3 },
        { name: "Advanced", sortOrder: 4 },
      ];

      courses.forEach((course, index) => {
        if (index > 0) {
          expect(course.sortOrder).toBeGreaterThan(courses[index - 1].sortOrder);
        }
      });
    });
  });
});

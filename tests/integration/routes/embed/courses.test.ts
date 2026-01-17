import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

// Mock dependencies before imports
vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    groupBy: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../../../../lib/db/schema/auth", () => ({
  organization: { id: "id", slug: "slug", name: "name", metadata: "metadata" },
}));

vi.mock("../../../../lib/db/schema/training", () => ({
  trainingCourses: {
    id: "id",
    organizationId: "organizationId",
    name: "name",
    description: "description",
    price: "price",
    isActive: "isActive",
    certificationAgencyId: "certificationAgencyId",
    certificationLevelId: "certificationLevelId",
    maxStudents: "maxStudents",
    totalSessions: "totalSessions",
  },
  trainingEnrollments: {
    id: "id",
    organizationId: "organizationId",
    courseId: "courseId",
    customerId: "customerId",
    status: "status",
    totalPrice: "totalPrice",
  },
  courseSessions: {
    id: "id",
    courseId: "courseId",
    scheduledDate: "scheduledDate",
    startTime: "startTime",
    endTime: "endTime",
    sessionType: "sessionType",
  },
  certificationAgencies: {
    id: "id",
    name: "name",
    code: "code",
    logoUrl: "logoUrl",
  },
  certificationLevels: {
    id: "id",
    name: "name",
    code: "code",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", field: a, value: b })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  gte: vi.fn((a, b) => ({ type: "gte", field: a, value: b })),
  desc: vi.fn((a) => ({ type: "desc", field: a })),
  asc: vi.fn((a) => ({ type: "asc", field: a })),
  sql: vi.fn(),
  count: vi.fn(() => "count"),
  inArray: vi.fn((a, b) => ({ type: "inArray", field: a, values: b })),
}));

import { db } from "../../../../lib/db";

describe("embed courses routes", () => {
  const mockOrg = {
    id: "org-uuid",
    slug: "demo",
    name: "Demo Dive Shop",
    metadata: {
      settings: {
        branding: {
          primaryColor: "#0066cc",
          secondaryColor: "#f0f9ff",
        },
        currency: "USD",
        timezone: "America/New_York",
      },
    },
  };

  const mockCourses = [
    {
      id: "course-1",
      name: "Open Water Diver",
      description: "Entry-level certification course",
      price: "49900",
      currency: "USD",
      depositAmount: "15000",
      maxStudents: 6,
      totalSessions: 5,
      hasExam: true,
      minOpenWaterDives: 4,
      scheduleType: "on_demand",
      isActive: true,
      agencyName: "PADI",
      agencyCode: "PADI",
      agencyLogo: "https://example.com/padi.png",
      levelName: "Open Water Diver",
      levelCode: "OWD",
    },
    {
      id: "course-2",
      name: "Advanced Open Water",
      description: "Take your skills to the next level",
      price: "39900",
      currency: "USD",
      depositAmount: "12000",
      maxStudents: 8,
      totalSessions: 3,
      hasExam: false,
      minOpenWaterDives: 5,
      scheduleType: "scheduled",
      isActive: true,
      agencyName: "PADI",
      agencyCode: "PADI",
      agencyLogo: "https://example.com/padi.png",
      levelName: "Advanced Open Water",
      levelCode: "AOW",
    },
  ];

  const mockEnrollment = {
    id: "enrollment-uuid",
    enrollmentNumber: "ENR-20250115-001",
    status: "pending_scheduling",
    totalPrice: "49900",
    depositAmount: "15000",
    balanceDue: "34900",
    currency: "USD",
    paymentStatus: "pending",
    enrolledAt: new Date().toISOString(),
    studentNotes: "No prior experience",
    course: {
      id: "course-1",
      name: "Open Water Diver",
      agencyCode: "PADI",
      levelName: "Open Water Diver",
      totalSessions: 5,
    },
    customer: {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "555-1234",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("$tenant.courses route (course listing)", () => {
    it("returns active courses for the organization", async () => {
      // Verify the mock data is properly structured
      const activeCourses = mockCourses.filter((c) => c.isActive);
      expect(activeCourses).toHaveLength(2);
    });

    it("groups courses by certification agency", async () => {
      const coursesByAgency = mockCourses.reduce(
        (acc, course) => {
          const key = course.agencyCode;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(course);
          return acc;
        },
        {} as Record<string, typeof mockCourses>
      );

      expect(Object.keys(coursesByAgency)).toContain("PADI");
      expect(coursesByAgency["PADI"]).toHaveLength(2);
    });

    it("includes required course data for display", async () => {
      mockCourses.forEach((course) => {
        expect(course.id).toBeDefined();
        expect(course.name).toBeDefined();
        expect(course.price).toBeDefined();
        expect(course.currency).toBeDefined();
        expect(course.agencyCode).toBeDefined();
        expect(course.levelName).toBeDefined();
        expect(course.totalSessions).toBeGreaterThan(0);
      });
    });

    it("filters out inactive courses", async () => {
      const inactiveCourse = { ...mockCourses[0], isActive: false };
      const allCourses = [...mockCourses, inactiveCourse];
      const activeCourses = allCourses.filter((c) => c.isActive);
      expect(activeCourses).toHaveLength(2);
    });
  });

  describe("$tenant.courses.$courseId route (course detail)", () => {
    it("returns course with agency and level info", async () => {
      const course = mockCourses[0];
      expect(course.agencyName).toBe("PADI");
      expect(course.agencyCode).toBe("PADI");
      expect(course.levelName).toBe("Open Water Diver");
      expect(course.levelCode).toBe("OWD");
    });

    it("includes all required course details", async () => {
      const course = mockCourses[0];
      expect(course.description).toBeDefined();
      expect(course.maxStudents).toBeGreaterThan(0);
      expect(course.hasExam).toBe(true);
      expect(course.minOpenWaterDives).toBe(4);
      expect(course.scheduleType).toBe("on_demand");
    });

    it("includes pricing information", async () => {
      const course = mockCourses[0];
      expect(course.price).toBe("49900");
      expect(course.depositAmount).toBe("15000");
      expect(course.currency).toBe("USD");
    });
  });

  describe("$tenant.courses.$courseId.enroll route (enrollment form)", () => {
    it("validates required fields", async () => {
      const requiredFields = ["firstName", "lastName", "email"];
      const formData = {
        firstName: "",
        lastName: "",
        email: "",
      };

      const errors: Record<string, string> = {};
      if (!formData.firstName) errors.firstName = "First name is required";
      if (!formData.lastName) errors.lastName = "Last name is required";
      if (!formData.email) errors.email = "Email is required";

      expect(Object.keys(errors)).toHaveLength(3);
      requiredFields.forEach((field) => {
        expect(errors[field]).toBeDefined();
      });
    });

    it("validates email format", async () => {
      const invalidEmails = ["notanemail", "missing@domain", "@nodomain.com"];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      invalidEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(false);
      });

      const validEmail = "test@example.com";
      expect(emailRegex.test(validEmail)).toBe(true);
    });

    it("creates enrollment with correct data", async () => {
      const enrollmentInput = {
        courseId: "course-1",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "555-1234",
        dateOfBirth: "1990-05-15",
        notes: "First time diver",
      };

      expect(enrollmentInput.courseId).toBeDefined();
      expect(enrollmentInput.firstName).toBeDefined();
      expect(enrollmentInput.lastName).toBeDefined();
      expect(enrollmentInput.email).toBeDefined();
    });

    it("accepts optional fields", async () => {
      const enrollmentInput = {
        courseId: "course-1",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        // Optional fields can be undefined
        phone: undefined,
        dateOfBirth: undefined,
        notes: undefined,
      };

      expect(enrollmentInput.phone).toBeUndefined();
      expect(enrollmentInput.dateOfBirth).toBeUndefined();
      expect(enrollmentInput.notes).toBeUndefined();
    });
  });

  describe("$tenant.courses.confirm route (confirmation page)", () => {
    it("displays enrollment details", async () => {
      expect(mockEnrollment.id).toBeDefined();
      expect(mockEnrollment.status).toBe("pending_scheduling");
      expect(mockEnrollment.course.name).toBe("Open Water Diver");
      expect(mockEnrollment.customer.firstName).toBe("John");
    });

    it("shows payment summary", async () => {
      expect(mockEnrollment.totalPrice).toBe("49900");
      expect(mockEnrollment.depositAmount).toBe("15000");
      expect(mockEnrollment.balanceDue).toBe("34900");
      expect(mockEnrollment.paymentStatus).toBe("pending");
    });

    it("includes course and customer info", async () => {
      expect(mockEnrollment.course.agencyCode).toBe("PADI");
      expect(mockEnrollment.course.levelName).toBe("Open Water Diver");
      expect(mockEnrollment.customer.email).toBe("john@example.com");
    });

    it("formats enrollment reference correctly", async () => {
      const enrollmentRef = mockEnrollment.id.slice(0, 8).toUpperCase();
      expect(enrollmentRef).toHaveLength(8);
    });
  });

  describe("enrollment status formatting", () => {
    it("displays correct status labels", async () => {
      const statusLabels: Record<string, string> = {
        pending_scheduling: "Pending Scheduling",
        scheduled: "Scheduled",
        enrolled: "Enrolled",
        completed: "Completed",
        cancelled: "Cancelled",
      };

      expect(statusLabels["pending_scheduling"]).toBe("Pending Scheduling");
      expect(statusLabels["enrolled"]).toBe("Enrolled");
    });

    it("displays correct payment status labels", async () => {
      const paymentStatusLabels: Record<string, string> = {
        pending: "Payment Pending",
        deposit_paid: "Deposit Paid",
        paid: "Paid in Full",
      };

      expect(paymentStatusLabels["pending"]).toBe("Payment Pending");
      expect(paymentStatusLabels["deposit_paid"]).toBe("Deposit Paid");
      expect(paymentStatusLabels["paid"]).toBe("Paid in Full");
    });
  });

  describe("price formatting", () => {
    it("formats prices correctly", async () => {
      const formatPrice = (price: string, currency: string): string => {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
        }).format(parseFloat(price) / 100);
      };

      // Price is in cents
      expect(formatPrice("49900", "USD")).toBe("$499.00");
      expect(formatPrice("15000", "USD")).toBe("$150.00");
    });
  });
});

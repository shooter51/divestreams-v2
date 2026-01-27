import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock the database
vi.mock("../../../../lib/db/index", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

// Mock the schema
vi.mock("../../../../lib/db/schema", () => ({
  trainingSessions: {
    id: "id",
    organizationId: "organization_id",
    status: "status",
    maxStudents: "max_students",
    enrolledCount: "enrolled_count",
  },
  trainingEnrollments: {
    id: "id",
    organizationId: "organization_id",
    sessionId: "session_id",
    customerId: "customer_id",
    enrolledCount: "enrolled_count",
  },
  customers: {
    id: "id",
    organizationId: "organization_id",
  },
}));

describe("Enrollment Validation Tests", () => {
  let dbMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules(); // Reset module cache between tests
    const { db } = await import("../../../../lib/db/index");
    dbMock = db;
  });

  it("should throw error when session not found", async () => {
    // Mock empty session result
    (dbMock.where as Mock).mockResolvedValueOnce([]);

    const { createEnrollment } = await import("../../../../lib/db/training.server");

    await expect(
      createEnrollment({
        organizationId: "org-1",
        sessionId: "non-existent-session",
        customerId: "customer-1",
      })
    ).rejects.toThrow("Session not found");
  });

  it("should throw error when session is cancelled", async () => {
    // Mock session that is cancelled
    (dbMock.where as Mock).mockResolvedValueOnce([
      {
        id: "session-1",
        status: "cancelled",
        maxStudents: 10,
        enrolledCount: 5,
      },
    ]);

    const { createEnrollment } = await import("../../../../lib/db/training.server");

    await expect(
      createEnrollment({
        organizationId: "org-1",
        sessionId: "session-1",
        customerId: "customer-1",
      })
    ).rejects.toThrow("Cannot enroll in a cancelled session");
  });

  it("should throw error when session is full", async () => {
    // Mock session that is full
    (dbMock.where as Mock)
      .mockResolvedValueOnce([
        {
          id: "session-1",
          status: "scheduled",
          maxStudents: 5,
          enrolledCount: 5,
        },
      ])
      .mockResolvedValueOnce([{ id: "customer-1" }]) // Customer exists
      .mockResolvedValueOnce([]); // No existing enrollment

    const { createEnrollment } = await import("../../../../lib/db/training.server");

    await expect(
      createEnrollment({
        organizationId: "org-1",
        sessionId: "session-1",
        customerId: "customer-1",
      })
    ).rejects.toThrow("Session is full");
  });

  it("should throw error when customer not found", async () => {
    // Mock valid session but customer not found
    (dbMock.where as Mock)
      .mockResolvedValueOnce([
        {
          id: "session-1",
          status: "scheduled",
          maxStudents: 10,
          enrolledCount: 3,
        },
      ])
      .mockResolvedValueOnce([]); // Customer not found

    const { createEnrollment } = await import("../../../../lib/db/training.server");

    await expect(
      createEnrollment({
        organizationId: "org-1",
        sessionId: "session-1",
        customerId: "non-existent-customer",
      })
    ).rejects.toThrow("Customer not found");
  });

  it("should throw error when customer already enrolled", async () => {
    // Reset before setting up this specific test
    vi.clearAllMocks();

    // Mock valid session and customer but existing enrollment
    let callCount = 0;
    (dbMock.where as Mock).mockReset().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Session validation
        return Promise.resolve([
          {
            id: "session-1",
            status: "scheduled",
            maxStudents: 10,
            enrolledCount: 3,
          },
        ]);
      } else if (callCount === 2) {
        // Customer validation
        return Promise.resolve([{ id: "customer-1" }]);
      } else if (callCount === 3) {
        // Existing enrollment check - should find an enrollment
        return Promise.resolve([{ id: "existing-enrollment" }]);
      } else {
        // Shouldn't get here
        return Promise.resolve([]);
      }
    });

    const { createEnrollment } = await import("../../../../lib/db/training.server");

    await expect(
      createEnrollment({
        organizationId: "org-1",
        sessionId: "session-1",
        customerId: "customer-1",
      })
    ).rejects.toThrow("Customer is already enrolled in this session");
  });

  it("should allow enrollment in scheduled session", async () => {
    // Reset before setting up this specific test
    vi.clearAllMocks();

    // Mock the select queries that happen in the validation
    let callCount = 0;
    (dbMock.where as Mock).mockReset().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Session validation
        return Promise.resolve([
          {
            id: "session-1",
            status: "scheduled",
            maxStudents: 10,
            enrolledCount: 3,
          },
        ]);
      } else if (callCount === 2) {
        // Customer validation
        return Promise.resolve([{ id: "customer-1" }]);
      } else if (callCount === 3) {
        // Existing enrollment check - should NOT find any enrollment
        return Promise.resolve([]);
      } else {
        // Shouldn't get here
        return Promise.resolve([]);
      }
    });

    (dbMock.returning as Mock).mockResolvedValueOnce([
      {
        id: "enrollment-1",
        sessionId: "session-1",
        customerId: "customer-1",
        status: "enrolled",
      },
    ]);

    const { createEnrollment } = await import("../../../../lib/db/training.server");

    const result = await createEnrollment({
      organizationId: "org-1",
      sessionId: "session-1",
      customerId: "customer-1",
    });

    expect(result.id).toBe("enrollment-1");
    expect(dbMock.insert).toHaveBeenCalled();
    expect(dbMock.update).toHaveBeenCalled(); // Should update enrolled count
  });

  it("should allow enrollment in in_progress session", async () => {
    // Mock session in progress (e.g., started but still accepting students)
    let callCount = 0;
    (dbMock.where as Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([
          {
            id: "session-1",
            status: "in_progress",
            maxStudents: 10,
            enrolledCount: 3,
          },
        ]);
      } else if (callCount === 2) {
        return Promise.resolve([{ id: "customer-1" }]);
      } else {
        return Promise.resolve([]);
      }
    });

    (dbMock.returning as Mock).mockResolvedValueOnce([
      {
        id: "enrollment-1",
        sessionId: "session-1",
        customerId: "customer-1",
        status: "enrolled",
      },
    ]);

    const { createEnrollment } = await import("../../../../lib/db/training.server");

    const result = await createEnrollment({
      organizationId: "org-1",
      sessionId: "session-1",
      customerId: "customer-1",
    });

    expect(result.id).toBe("enrollment-1");
  });

  it("should allow enrollment in completed session (for late enrollments)", async () => {
    // Mock completed session (e.g., makeup class, late enrollment)
    let callCount = 0;
    (dbMock.where as Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([
          {
            id: "session-1",
            status: "completed",
            maxStudents: 10,
            enrolledCount: 8,
          },
        ]);
      } else if (callCount === 2) {
        return Promise.resolve([{ id: "customer-1" }]);
      } else {
        return Promise.resolve([]);
      }
    });

    (dbMock.returning as Mock).mockResolvedValueOnce([
      {
        id: "enrollment-1",
        sessionId: "session-1",
        customerId: "customer-1",
        status: "enrolled",
      },
    ]);

    const { createEnrollment } = await import("../../../../lib/db/training.server");

    const result = await createEnrollment({
      organizationId: "org-1",
      sessionId: "session-1",
      customerId: "customer-1",
    });

    expect(result.id).toBe("enrollment-1");
  });

  it("should allow enrollment when session has no max students limit", async () => {
    // Mock session with no max students (null/undefined)
    let callCount = 0;
    (dbMock.where as Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([
          {
            id: "session-1",
            status: "scheduled",
            maxStudents: null,
            enrolledCount: 100,
          },
        ]);
      } else if (callCount === 2) {
        return Promise.resolve([{ id: "customer-1" }]);
      } else {
        return Promise.resolve([]);
      }
    });

    (dbMock.returning as Mock).mockResolvedValueOnce([
      {
        id: "enrollment-1",
        sessionId: "session-1",
        customerId: "customer-1",
      },
    ]);

    const { createEnrollment } = await import("../../../../lib/db/training.server");

    const result = await createEnrollment({
      organizationId: "org-1",
      sessionId: "session-1",
      customerId: "customer-1",
    });

    expect(result.id).toBe("enrollment-1");
  });
});

/**
 * Integration test for KAN-610: Error 500/400 when accessing 'New Enrollment' on training page
 *
 * BUG DESCRIPTION:
 * User clicks "New Enrollment" button from training dashboard or enrollments list
 * and gets 500/400 error because the route requires sessionId query param but the
 * links don't provide it.
 *
 * FIX:
 * Modified enrollment form loader to support two modes:
 * 1. WITH sessionId - pre-selected session (existing flow from session detail page)
 * 2. WITHOUT sessionId - show session selector (new flow from dashboard/enrollments list)
 *
 * This test verifies both modes work correctly.
 */

import { describe, it, expect, vi } from "vitest";
import { loader } from "../../../../app/routes/tenant/training/enrollments/new";

// Mock dependencies
vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(async () => ({
    user: { id: "user-1", email: "admin@test.com" },
    org: { id: "org-1", name: "Test Org" },
    isPremium: true,
  })),
}));

vi.mock("../../../../lib/db/training.server", () => ({
  getSessionById: vi.fn(async (orgId, sessionId) => {
    if (sessionId === "session-1") {
      return {
        id: "session-1",
        courseName: "Open Water Diver",
        startDate: "2026-02-15",
        maxStudents: 10,
        enrolledCount: 3,
      };
    }
    return null;
  }),
  getSessions: vi.fn(async () => [
    {
      id: "session-1",
      courseName: "Open Water Diver",
      startDate: "2026-02-15",
      startTime: "09:00",
      maxStudents: 10,
      enrolledCount: 3,
    },
    {
      id: "session-2",
      courseName: "Advanced Open Water",
      startDate: "2026-03-01",
      startTime: "10:00",
      maxStudents: 8,
      enrolledCount: 5,
    },
  ]),
  createEnrollment: vi.fn(),
}));

vi.mock("../../../../lib/db/queries.server", () => ({
  getCustomers: vi.fn(async () => ({
    customers: [
      {
        id: "customer-1",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      },
      {
        id: "customer-2",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
      },
    ],
  })),
}));

describe("KAN-610: Enrollment Form Loader", () => {
  describe("Mode 1: WITH sessionId (existing flow - from session detail page)", () => {
    it("should load session and customers when sessionId is provided", async () => {
      const request = new Request("http://localhost/tenant/training/enrollments/new?sessionId=session-1");

      const result = await loader({ request, params: {}, context: {} });

      // Should return pre-selected session mode
      expect(result.mode).toBe("pre-selected");
      expect(result.session).toBeDefined();
      expect(result.session?.id).toBe("session-1");
      expect(result.session?.courseName).toBe("Open Water Diver");
      expect(result.sessions).toBeNull();
      expect(result.customers).toHaveLength(2);
    });

    it("should throw 404 if session not found", async () => {
      const request = new Request("http://localhost/tenant/training/enrollments/new?sessionId=invalid-session");

      try {
        await loader({ request, params: {}, context: {} });
        expect.fail("Should have thrown 404 error");
      } catch (error) {
        // React Router throws Response objects for HTTP errors
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    });
  });

  describe("Mode 2: WITHOUT sessionId (new flow - from dashboard/enrollments list)", () => {
    it("should load all sessions and customers when sessionId is NOT provided", async () => {
      const request = new Request("http://localhost/tenant/training/enrollments/new");

      const result = await loader({ request, params: {}, context: {} });

      // Should return select-session mode
      expect(result.mode).toBe("select-session");
      expect(result.session).toBeNull();
      expect(result.sessions).toBeDefined();
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions?.[0]?.courseName).toBe("Open Water Diver");
      expect(result.sessions?.[1]?.courseName).toBe("Advanced Open Water");
      expect(result.customers).toHaveLength(2);
    });

    it("should NOT throw 400 error when sessionId is missing", async () => {
      const request = new Request("http://localhost/tenant/training/enrollments/new");

      // This should NOT throw - this was the bug
      const result = await loader({ request, params: {}, context: {} });

      expect(result).toBeDefined();
      expect(result.mode).toBe("select-session");
    });
  });

  describe("Completeness: Both modes return customers", () => {
    it("should return customers in pre-selected mode", async () => {
      const request = new Request("http://localhost/tenant/training/enrollments/new?sessionId=session-1");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.customers).toBeDefined();
      expect(result.customers).toHaveLength(2);
      expect(result.customers[0].firstName).toBe("John");
    });

    it("should return customers in select-session mode", async () => {
      const request = new Request("http://localhost/tenant/training/enrollments/new");
      const result = await loader({ request, params: {}, context: {} });

      expect(result.customers).toBeDefined();
      expect(result.customers).toHaveLength(2);
      expect(result.customers[0].firstName).toBe("John");
    });
  });
});

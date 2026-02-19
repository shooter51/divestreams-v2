import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { loader, action } from "../../../../app/routes/embed/$tenant.courses.$courseId.enroll";

vi.mock("../../../../lib/db/queries.public", () => ({
  getOrganizationBySlug: vi.fn(),
  getPublicCourseById: vi.fn(),
}));

vi.mock("../../../../lib/db/mutations.public", () => ({
  createWidgetEnrollment: vi.fn(),
}));

import { getOrganizationBySlug, getPublicCourseById } from "../../../../lib/db/queries.public";
import { createWidgetEnrollment } from "../../../../lib/db/mutations.public";

const mockCourse = {
  id: "c1",
  name: "Open Water",
  upcomingSessions: [
    { id: "s1", startDate: "2025-06-01", availableSpots: 5 },
  ],
};

describe("embed/$tenant.courses.$courseId.enroll route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loader", () => {
    it("throws 404 when no tenant or courseId param", async () => {
      await expect(
        loader({ request: new Request("https://divestreams.com/embed"), params: {}, context: {}, unstable_pattern: "" } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 404 when org not found", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue(null);

      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/demo/courses/c1/enroll?sessionId=s1"),
          params: { tenant: "demo", courseId: "c1" },
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws 400 when no sessionId", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo" });
      (getPublicCourseById as Mock).mockResolvedValue(mockCourse);

      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/demo/courses/c1/enroll"),
          params: { tenant: "demo", courseId: "c1" },
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 400 }));
    });

    it("throws 404 when session not found in course", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo" });
      (getPublicCourseById as Mock).mockResolvedValue(mockCourse);

      await expect(
        loader({
          request: new Request("https://divestreams.com/embed/demo/courses/c1/enroll?sessionId=nonexistent"),
          params: { tenant: "demo", courseId: "c1" },
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof loader>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("returns course, session, and tenantSlug when valid", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo" });
      (getPublicCourseById as Mock).mockResolvedValue(mockCourse);

      const result = await loader({
        request: new Request("https://divestreams.com/embed/demo/courses/c1/enroll?sessionId=s1"),
        params: { tenant: "demo", courseId: "c1" },
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof loader>[0]);

      expect(result.course).toEqual(mockCourse);
      expect(result.session).toEqual(mockCourse.upcomingSessions[0]);
      expect(result.tenantSlug).toBe("demo");
      expect(result.organizationId).toBe("org-1");
    });
  });

  describe("action", () => {
    it("throws 404 when org not found", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue(null);

      const formData = new FormData();
      await expect(
        action({
          request: new Request("https://divestreams.com/embed/demo/courses/c1/enroll", { method: "POST", body: formData }),
          params: { tenant: "demo", courseId: "c1" },
          context: {},
          unstable_pattern: "",
        } as Parameters<typeof action>[0])
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("returns validation errors when fields missing", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo" });

      const formData = new FormData();
      formData.append("sessionId", "s1");
      // Missing firstName, lastName, email

      const result = await action({
        request: new Request("https://divestreams.com/embed/demo/courses/c1/enroll", { method: "POST", body: formData }),
        params: { tenant: "demo", courseId: "c1" },
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.errors).toBeDefined();
      expect(result.errors.firstName).toBeDefined();
      expect(result.errors.lastName).toBeDefined();
      expect(result.errors.email).toBeDefined();
    });

    it("returns email error for invalid email", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo" });

      const formData = new FormData();
      formData.append("sessionId", "s1");
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "invalid-email");

      const result = await action({
        request: new Request("https://divestreams.com/embed/demo/courses/c1/enroll", { method: "POST", body: formData }),
        params: { tenant: "demo", courseId: "c1" },
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.errors.email).toBe("Invalid email address");
    });

    it("redirects to confirmation on successful enrollment", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo" });
      (createWidgetEnrollment as Mock).mockResolvedValue({ id: "enroll-1" });

      const formData = new FormData();
      formData.append("sessionId", "s1");
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "john@example.com");

      const response = await action({
        request: new Request("https://divestreams.com/embed/demo/courses/c1/enroll", { method: "POST", body: formData }),
        params: { tenant: "demo", courseId: "c1" },
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toContain("/embed/demo/courses/confirm");
    });

    it("returns error when enrollment creation fails", async () => {
      (getOrganizationBySlug as Mock).mockResolvedValue({ id: "org-1", slug: "demo" });
      (createWidgetEnrollment as Mock).mockRejectedValue(new Error("Session full"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const formData = new FormData();
      formData.append("sessionId", "s1");
      formData.append("firstName", "John");
      formData.append("lastName", "Doe");
      formData.append("email", "john@example.com");

      const result = await action({
        request: new Request("https://divestreams.com/embed/demo/courses/c1/enroll", { method: "POST", body: formData }),
        params: { tenant: "demo", courseId: "c1" },
        context: {},
        unstable_pattern: "",
      } as Parameters<typeof action>[0]);

      expect(result.errors.form).toBe("Session full");
      consoleSpy.mockRestore();
    });
  });
});

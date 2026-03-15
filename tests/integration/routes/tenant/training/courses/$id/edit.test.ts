/**
 * Training Courses Edit Route Tests
 *
 * Tests for bidirectional translation source locale support.
 * Full route tests are in tests/integration/routes/tenant/training/courses-edit.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("../../../../../../../lib/db/training.server", () => ({
  getCourseById: vi.fn(),
  getAgencies: vi.fn(),
  getLevels: vi.fn(),
  updateCourse: vi.fn(),
}));

vi.mock("../../../../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn(() => ({
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    },
    schema: { images: {} },
  })),
}));

vi.mock("../../../../../../../lib/jobs/index", () => ({
  enqueueTranslation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../../../../app/i18n/resolve-locale", () => ({
  resolveLocale: vi.fn().mockReturnValue("en"),
}));

vi.mock("../../../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn().mockReturnValue("/tenant/training/courses/course-1?notification=ok"),
  useNotification: vi.fn(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn((url) => new Response(null, { status: 302, headers: { Location: url } })),
    useLoaderData: vi.fn(),
    useActionData: vi.fn(),
    useNavigation: vi.fn().mockReturnValue({ state: "idle" }),
    Link: vi.fn(),
  };
});

import { requireOrgContext } from "../../../../../../../lib/auth/org-context.server";
import { updateCourse, getCourseById } from "../../../../../../../lib/db/training.server";
import { enqueueTranslation } from "../../../../../../../lib/jobs/index";
import { resolveLocale } from "../../../../../../../app/i18n/resolve-locale";
import { action } from "../../../../../../../app/routes/tenant/training/courses/$id/edit";

describe("tenant/training/courses/$id/edit route", () => {
  const mockOrgContext = {
    user: { id: "user-1" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
    membership: { role: "owner" },
    subscription: null,
    isPremium: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getCourseById as Mock).mockResolvedValue({
      id: "course-1",
      name: "Open Water",
      description: "Learn to dive",
    });
    (updateCourse as Mock).mockResolvedValue({ id: "course-1" });
  });

  describe("action", () => {
    it("enqueues translation with Spanish source locale when resolveLocale returns es", async () => {
      (resolveLocale as Mock).mockReturnValue("es");

      const formData = new FormData();
      formData.set("name", "Buceo Abierto");
      formData.set("description", "Aprende a bucear");
      formData.set("price", "299");
      formData.set("duration", "3");
      formData.set("maxStudents", "6");
      formData.set("isActive", "true");
      formData.set("isPublic", "true");

      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as unknown);

      const calls = (enqueueTranslation as Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const [data] of calls) {
        expect(data.sourceLocale).toBe("es");
        expect(data.targetLocale).not.toBe("es");
      }
    });

    it("never enqueues translation with same source and target locale", async () => {
      (resolveLocale as Mock).mockReturnValue("en");

      const formData = new FormData();
      formData.set("name", "Open Water Course");
      formData.set("description", "Learn to dive");
      formData.set("price", "299");
      formData.set("isActive", "true");
      formData.set("isPublic", "true");

      const request = new Request("https://demo.divestreams.com/tenant/training/courses/course-1/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: "course-1" }, context: {}, unstable_pattern: "" } as unknown);

      const calls = (enqueueTranslation as Mock).mock.calls;
      for (const [data] of calls) {
        expect(data.sourceLocale).not.toBe(data.targetLocale);
      }
    });
  });
});

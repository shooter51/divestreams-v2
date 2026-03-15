/**
 * Training Courses New Route Tests
 *
 * Tests for bidirectional translation source locale support.
 * Full route tests are in tests/integration/routes/tenant/training/courses-new.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("../../../../../../lib/db/training.server", () => ({
  getAgencies: vi.fn().mockResolvedValue([]),
  getLevels: vi.fn().mockResolvedValue([]),
  createCourse: vi.fn(),
}));

vi.mock("../../../../../../lib/jobs/index", () => ({
  enqueueTranslation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../../../app/i18n/resolve-locale", () => ({
  resolveLocale: vi.fn().mockReturnValue("en"),
}));

vi.mock("../../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn().mockReturnValue("/tenant/training/courses?notification=ok"),
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

import { requireOrgContext } from "../../../../../../lib/auth/org-context.server";
import { createCourse } from "../../../../../../lib/db/training.server";
import { enqueueTranslation } from "../../../../../../lib/jobs/index";
import { resolveLocale } from "../../../../../../app/i18n/resolve-locale";
import { action } from "../../../../../../app/routes/tenant/training/courses/new";

describe("tenant/training/courses/new route", () => {
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
    (createCourse as Mock).mockResolvedValue({ id: "course-new" });
  });

  describe("action", () => {
    it("enqueues translation with Spanish source locale when resolveLocale returns es", async () => {
      (resolveLocale as Mock).mockReturnValue("es");

      const formData = new FormData();
      formData.set("name", "Buceo Para Principiantes");
      formData.set("description", "Curso introductorio de buceo");
      formData.set("price", "199");
      formData.set("isActive", "true");
      formData.set("isPublic", "true");

      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      const calls = (enqueueTranslation as Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const [data] of calls) {
        expect(data.sourceLocale).toBe("es");
        expect(data.targetLocale).not.toBe("es");
      }
    });

    it("enqueues translation with English source locale when resolveLocale returns en", async () => {
      (resolveLocale as Mock).mockReturnValue("en");

      const formData = new FormData();
      formData.set("name", "Beginner Diving Course");
      formData.set("description", "Intro diving course");
      formData.set("price", "199");
      formData.set("isActive", "true");
      formData.set("isPublic", "true");

      const request = new Request("https://demo.divestreams.com/tenant/training/courses/new", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

      const calls = (enqueueTranslation as Mock).mock.calls;
      for (const [data] of calls) {
        expect(data.sourceLocale).toBe("en");
        expect(data.targetLocale).not.toBe("en");
      }
    });
  });
});

/**
 * Translations Settings Route Tests
 *
 * Tests for the translations management route, including bidirectional
 * translation support.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("../../../../../lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
          limit: vi.fn().mockResolvedValue([]),
        }),
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock("../../../../../lib/db/translations.server", () => ({
  upsertContentTranslation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../../lib/jobs/index", () => ({
  enqueueTranslation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../../app/i18n/resolve-locale", () => ({
  resolveLocale: vi.fn().mockReturnValue("en"),
}));

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { enqueueTranslation } from "../../../../../lib/jobs/index";
import { resolveLocale } from "../../../../../app/i18n/resolve-locale";
import { loader, action } from "../../../../../app/routes/tenant/settings/translations";

describe("tenant/settings/translations route", () => {
  const mockOrgContext = {
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
    org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo", customDomain: null },
    membership: { role: "owner" },
    subscription: null,
    limits: {},
    usage: {},
    canAddCustomer: true,
    canAddTour: true,
    canAddBooking: true,
    isPremium: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  describe("loader", () => {
    it("exports a loader function", () => {
      expect(typeof loader).toBe("function");
    });

    it("requires organization context", async () => {
      const request = new Request("https://demo.divestreams.com/tenant/settings/translations");
      await loader({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);
      expect(requireOrgContext).toHaveBeenCalledWith(request);
    });
  });

  describe("action", () => {
    it("exports an action function", () => {
      expect(typeof action).toBe("function");
    });

    describe("retranslate intent", () => {
      it("uses source locale from resolveLocale for retranslation", async () => {
        (resolveLocale as Mock).mockReturnValue("es");

        const formData = new FormData();
        formData.set("intent", "retranslate");
        formData.set("entityType", "tour");
        formData.set("entityId", "tour-1");

        const request = new Request("https://demo.divestreams.com/tenant/settings/translations", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

        // All calls should have sourceLocale = "es"
        const calls = (enqueueTranslation as Mock).mock.calls;
        for (const [data] of calls) {
          expect(data.sourceLocale).toBe("es");
          expect(data.targetLocale).not.toBe("es");
        }
      });

      it("defaults to English source locale when resolveLocale returns en", async () => {
        (resolveLocale as Mock).mockReturnValue("en");

        const formData = new FormData();
        formData.set("intent", "retranslate");
        formData.set("entityType", "tour");
        formData.set("entityId", "tour-1");

        const request = new Request("https://demo.divestreams.com/tenant/settings/translations", {
          method: "POST",
          body: formData,
        });

        await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

        const calls = (enqueueTranslation as Mock).mock.calls;
        for (const [data] of calls) {
          expect(data.sourceLocale).toBe("en");
        }
      });
    });

    it("returns error for unknown intent", async () => {
      const formData = new FormData();
      formData.set("intent", "unknown-intent");

      const request = new Request("https://demo.divestreams.com/tenant/settings/translations", {
        method: "POST",
        body: formData,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown) as { error: string };
      expect(result?.error).toBe("Unknown action");
    });
  });

  describe("default export", () => {
    it("exports a default component", async () => {
      const mod = await import("../../../../../app/routes/tenant/settings/translations");
      expect(typeof mod.default).toBe("function");
    });
  });
});

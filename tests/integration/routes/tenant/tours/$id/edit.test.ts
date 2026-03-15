/**
 * Tour Edit Route Tests
 *
 * Tests for the tour edit route, including bidirectional translation support.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("../../../../../../lib/db/queries.server", () => ({
  getTourById: vi.fn(),
}));

vi.mock("../../../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn().mockReturnValue({
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    },
    schema: {
      tours: {},
      images: {},
    },
  }),
}));

vi.mock("../../../../../../lib/jobs/index", () => ({
  enqueueTranslation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../../../app/i18n/resolve-locale", () => ({
  resolveLocale: vi.fn().mockReturnValue("en"),
}));

vi.mock("../../../../../../lib/validation", () => ({
  tourSchema: {},
  validateFormData: vi.fn().mockReturnValue({ success: true, data: {
    name: "Test Tour",
    description: "A great tour",
    type: "single_dive",
    duration: 120,
    maxParticipants: 8,
    minParticipants: 1,
    price: 99,
    currency: "USD",
    includesEquipment: false,
    includesMeals: false,
    includesTransport: false,
    inclusions: [],
    exclusions: [],
    minCertLevel: "",
    minAge: null,
    requirements: [],
    isActive: true,
    requiresTankSelection: false,
  }}),
  getFormValues: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn().mockReturnValue("/tenant/tours/tour-1?notification=success"),
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
import { enqueueTranslation } from "../../../../../../lib/jobs/index";
import { resolveLocale } from "../../../../../../app/i18n/resolve-locale";
import { getTourById } from "../../../../../../lib/db/queries.server";
import { action } from "../../../../../../app/routes/tenant/tours/$id/edit";

describe("tenant/tours/$id/edit route", () => {
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
    (getTourById as Mock).mockResolvedValue({
      id: "tour-1",
      name: "Existing Tour",
      description: "Description",
      type: "single_dive",
      duration: 120,
      maxParticipants: 8,
      price: "99",
    });
  });

  describe("action", () => {
    it("enqueues translation with Spanish source locale when resolveLocale returns es", async () => {
      (resolveLocale as Mock).mockReturnValue("es");

      const formData = new FormData();
      formData.set("name", "Tour en Español");
      formData.set("type", "single_dive");
      formData.set("maxParticipants", "8");
      formData.set("price", "99");

      const request = new Request("https://demo.divestreams.com/tenant/tours/tour-1/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: "tour-1" }, context: {}, unstable_pattern: "" } as unknown);

      const calls = (enqueueTranslation as Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      for (const [data] of calls) {
        expect(data.sourceLocale).toBe("es");
        expect(data.targetLocale).not.toBe("es");
      }
    });

    it("defaults to English source locale when resolveLocale returns en", async () => {
      (resolveLocale as Mock).mockReturnValue("en");

      const formData = new FormData();
      formData.set("name", "English Tour");
      formData.set("type", "single_dive");
      formData.set("maxParticipants", "8");
      formData.set("price", "99");

      const request = new Request("https://demo.divestreams.com/tenant/tours/tour-1/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: "tour-1" }, context: {}, unstable_pattern: "" } as unknown);

      const calls = (enqueueTranslation as Mock).mock.calls;
      for (const [data] of calls) {
        expect(data.sourceLocale).toBe("en");
      }
    });

    it("never enqueues a job with matching source and target locale", async () => {
      (resolveLocale as Mock).mockReturnValue("es");

      const formData = new FormData();
      formData.set("name", "Tour en Español");
      formData.set("type", "single_dive");
      formData.set("maxParticipants", "8");
      formData.set("price", "99");

      const request = new Request("https://demo.divestreams.com/tenant/tours/tour-1/edit", {
        method: "POST",
        body: formData,
      });

      await action({ request, params: { id: "tour-1" }, context: {}, unstable_pattern: "" } as unknown);

      const calls = (enqueueTranslation as Mock).mock.calls;
      // No job should have the same source and target locale
      for (const [data] of calls) {
        expect(data.sourceLocale).not.toBe(data.targetLocale);
      }
    });
  });
});

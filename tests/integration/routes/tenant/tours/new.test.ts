/**
 * Tours New Route Tests
 *
 * Validates that the route module exports the expected loader, action, meta, and default component.
 * Also verifies bidirectional translation: sourceLocale is detected from request and passed to
 * enqueueTranslation so non-English content is correctly translated.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("../../../../../lib/db/queries.server", () => ({
  createTour: vi.fn(),
}));

vi.mock("../../../../../lib/require-feature.server", () => ({
  requireLimit: vi.fn().mockResolvedValue({ remaining: 10, limit: 20 }),
}));

vi.mock("../../../../../lib/plan-features", () => ({
  DEFAULT_PLAN_LIMITS: { standard: {} },
}));

vi.mock("../../../../../lib/jobs/index", () => ({
  enqueueTranslation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../../lib/storage", () => ({
  getS3Client: vi.fn().mockReturnValue(null),
  uploadToS3: vi.fn(),
  getImageKey: vi.fn(),
  processImage: vi.fn(),
  isValidImageType: vi.fn(),
  getWebPMimeType: vi.fn(),
}));

vi.mock("../../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn().mockReturnValue({ db: {}, schema: {} }),
}));

vi.mock("../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn().mockReturnValue("/tenant/tours/tour-1?notification=ok"),
  useNotification: vi.fn(),
}));

vi.mock("../../../../../app/i18n/resolve-locale", () => ({
  resolveLocale: vi.fn().mockReturnValue("en"),
}));

vi.mock("../../../../../lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
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

import { requireOrgContext } from "../../../../../lib/auth/org-context.server";
import { createTour } from "../../../../../lib/db/queries.server";
import { enqueueTranslation } from "../../../../../lib/jobs/index";
import { resolveLocale } from "../../../../../app/i18n/resolve-locale";

describe("Tours New Route", () => {
  it("exports a default component", async () => {
    const newTour = await import("../../../../../app/routes/tenant/tours/new");
    expect(newTour.default).toBeDefined();
    expect(typeof newTour.default).toBe("function");
  });

  it("exports a loader function", async () => {
    const newTour = await import("../../../../../app/routes/tenant/tours/new");
    expect(newTour.loader).toBeDefined();
    expect(typeof newTour.loader).toBe("function");
  });

  it("exports an action function", async () => {
    const newTour = await import("../../../../../app/routes/tenant/tours/new");
    expect(newTour.action).toBeDefined();
    expect(typeof newTour.action).toBe("function");
  });

  it("exports a meta function", async () => {
    const newTour = await import("../../../../../app/routes/tenant/tours/new");
    expect(newTour.meta).toBeDefined();
    expect(typeof newTour.meta).toBe("function");
  });
});

describe("Tours New Route - bidirectional translation", () => {
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
    (createTour as Mock).mockResolvedValue({ id: "tour-new" });
  });

  it("enqueues translation with Spanish source locale when user locale is es", async () => {
    (resolveLocale as Mock).mockReturnValue("es");
    const { action } = await import("../../../../../app/routes/tenant/tours/new");

    const formData = new FormData();
    formData.set("name", "Aventura de Buceo");
    formData.set("description", "Una experiencia increíble");
    formData.set("type", "single_dive");
    formData.set("maxParticipants", "8");
    formData.set("price", "99");
    formData.set("currency", "USD");
    formData.set("includesEquipment", "false");
    formData.set("includesMeals", "false");
    formData.set("includesTransport", "false");

    const request = new Request("https://demo.divestreams.com/tenant/tours/new", {
      method: "POST",
      body: formData,
    });

    await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

    const calls = (enqueueTranslation as Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [data] of calls) {
      expect(data.sourceLocale).toBe("es");
      // Should translate to English (not Spanish, which is the source)
      expect(data.targetLocale).not.toBe("es");
    }
  });

  it("enqueues translation with English source locale by default", async () => {
    (resolveLocale as Mock).mockReturnValue("en");
    const { action } = await import("../../../../../app/routes/tenant/tours/new");

    const formData = new FormData();
    formData.set("name", "Night Dive Adventure");
    formData.set("type", "night_dive");
    formData.set("maxParticipants", "6");
    formData.set("price", "120");
    formData.set("currency", "USD");
    formData.set("includesEquipment", "false");
    formData.set("includesMeals", "false");
    formData.set("includesTransport", "false");

    const request = new Request("https://demo.divestreams.com/tenant/tours/new", {
      method: "POST",
      body: formData,
    });

    await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

    const calls = (enqueueTranslation as Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [data] of calls) {
      expect(data.sourceLocale).toBe("en");
      expect(data.targetLocale).not.toBe("en");
    }
  });

  it("never enqueues a job where sourceLocale equals targetLocale", async () => {
    (resolveLocale as Mock).mockReturnValue("en");
    const { action } = await import("../../../../../app/routes/tenant/tours/new");

    const formData = new FormData();
    formData.set("name", "Snorkel Tour");
    formData.set("type", "snorkel");
    formData.set("maxParticipants", "10");
    formData.set("price", "50");
    formData.set("currency", "USD");
    formData.set("includesEquipment", "true");
    formData.set("includesMeals", "false");
    formData.set("includesTransport", "false");

    const request = new Request("https://demo.divestreams.com/tenant/tours/new", {
      method: "POST",
      body: formData,
    });

    await action({ request, params: {}, context: {}, unstable_pattern: "" } as unknown);

    const calls = (enqueueTranslation as Mock).mock.calls;
    for (const [data] of calls) {
      expect(data.sourceLocale).not.toBe(data.targetLocale);
    }
  });
});

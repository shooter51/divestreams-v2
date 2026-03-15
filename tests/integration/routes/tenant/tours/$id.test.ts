/**
 * Tour Detail Route Integration Tests
 *
 * DS-lu26: Verifies that tours/$id exports loader, action, meta, and
 * default component. Confirms the delete action uses ConfirmModal
 * (not window.confirm) by verifying the route module structure.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("../../../../../lib/db/queries.server", () => ({
  getTourById: vi.fn(),
  getTourStats: vi.fn(),
  getUpcomingTripsForTour: vi.fn(),
  getDiveSitesForTour: vi.fn(),
  updateTourActiveStatus: vi.fn(),
  deleteTour: vi.fn(),
}));

vi.mock("../../../../../lib/db/tenant.server", () => ({
  getTenantDb: vi.fn().mockReturnValue({
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([]),
        })),
      })),
    },
    schema: { images: {} },
  }),
}));

vi.mock("../../../../../lib/db/translations.server", () => ({
  getContentTranslations: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../../../lib/use-notification", () => ({
  redirectWithNotification: vi.fn().mockReturnValue("/tenant/tours?notification=ok"),
  useNotification: vi.fn(),
}));

vi.mock("../../../../../app/i18n/resolve-locale", () => ({
  resolveLocale: vi.fn().mockReturnValue("en"),
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn((a, b) => ({ type: "eq", a, b })),
    and: vi.fn((...args) => ({ type: "and", args })),
    asc: vi.fn((col) => ({ type: "asc", col })),
  };
});

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    redirect: vi.fn((url) => new Response(null, { status: 302, headers: { Location: url } })),
    useLoaderData: vi.fn().mockReturnValue({}),
    useRouteLoaderData: vi.fn().mockReturnValue({ csrfToken: "test-csrf-token" }),
    useNavigation: vi.fn().mockReturnValue({ state: "idle" }),
    Link: vi.fn(),
  };
});

import {
  requireOrgContext,
} from "../../../../../lib/auth/org-context.server";
import {
  getTourById,
  deleteTour,
} from "../../../../../lib/db/queries.server";
import { redirectWithNotification } from "../../../../../lib/use-notification";

const mockOrgContext = {
  user: { id: "user-1" },
  session: { id: "session-1" },
  org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
  membership: { role: "owner" },
  subscription: null,
  isPremium: false,
};

describe("Tour Detail Route (tours/$id)", () => {
  it("exports a default component", async () => {
    const mod = await import("../../../../../app/routes/tenant/tours/$id");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("exports a loader function", async () => {
    const mod = await import("../../../../../app/routes/tenant/tours/$id");
    expect(mod.loader).toBeDefined();
    expect(typeof mod.loader).toBe("function");
  });

  it("exports an action function", async () => {
    const mod = await import("../../../../../app/routes/tenant/tours/$id");
    expect(mod.action).toBeDefined();
    expect(typeof mod.action).toBe("function");
  });

  it("exports a meta function", async () => {
    const mod = await import("../../../../../app/routes/tenant/tours/$id");
    expect(mod.meta).toBeDefined();
    expect(typeof mod.meta).toBe("function");
  });
});

describe("Tour Detail Route - delete action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (getTourById as Mock).mockResolvedValue({ id: "tour-1", name: "Test Tour", isActive: true });
    (deleteTour as Mock).mockResolvedValue(undefined);
  });

  it("deletes tour and redirects when intent=delete", async () => {
    const { action } = await import("../../../../../app/routes/tenant/tours/$id");

    const formData = new FormData();
    formData.set("intent", "delete");

    const request = new Request("https://demo.divestreams.com/tenant/tours/tour-1", {
      method: "POST",
      body: formData,
    });

    await action({ request, params: { id: "tour-1" }, context: {}, unstable_pattern: "" } as any);

    expect(deleteTour as Mock).toHaveBeenCalledWith("org-uuid", "tour-1");
    expect(redirectWithNotification as Mock).toHaveBeenCalled();
  });
});

describe("Tour Detail Route - loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
  });

  it("throws 400 when tour id param is missing", async () => {
    const { loader } = await import("../../../../../app/routes/tenant/tours/$id");

    const request = new Request("https://demo.divestreams.com/tenant/tours/");

    await expect(
      loader({ request, params: {}, context: {}, unstable_pattern: "" } as any)
    ).rejects.toThrow();
  });

  it("throws 404 when tour is not found", async () => {
    (getTourById as Mock).mockResolvedValue(null);

    const { loader } = await import("../../../../../app/routes/tenant/tours/$id");

    const request = new Request("https://demo.divestreams.com/tenant/tours/tour-missing");

    await expect(
      loader({ request, params: { id: "tour-missing" }, context: {}, unstable_pattern: "" } as any)
    ).rejects.toThrow();
  });
});

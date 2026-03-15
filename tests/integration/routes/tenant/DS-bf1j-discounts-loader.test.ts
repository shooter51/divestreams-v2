/**
 * DS-bf1j: No discount codes visible on tenant discounts page
 *
 * Verify the discounts route loader returns discount codes correctly and
 * that the HAS_POS feature gate properly controls access. An empty result
 * (no codes visible) can occur either from an empty DB table or if the
 * feature gate redirects before the query runs.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../../lib/auth/org-context.server", () => ({
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("../../../../lib/require-feature.server", () => ({
  requireFeature: vi.fn(), // no-op by default; throw to simulate missing feature
}));

vi.mock("../../../../lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("../../../../lib/db/translations.server", () => ({
  bulkGetContentTranslations: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("../../../../lib/jobs/index", () => ({
  enqueueTranslation: vi.fn(),
}));

import { requireOrgContext } from "../../../../lib/auth/org-context.server";
import { requireFeature } from "../../../../lib/require-feature.server";
import { db } from "../../../../lib/db";
import { loader } from "../../../../app/routes/tenant/discounts";

const mockOrgContext = {
  user: { id: "user-1", name: "Test User", email: "test@example.com" },
  session: { id: "session-1" },
  org: { id: "org-uuid", name: "Demo Dive Shop", slug: "demo" },
  membership: { role: "owner" },
  isPremium: true,
  subscription: {
    planDetails: {
      features: { has_pos: true },
    },
  },
};

function makeSelectChain(returnValue: unknown) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(returnValue),
  };
  return chain;
}

describe("DS-bf1j: tenant/discounts loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOrgContext as Mock).mockResolvedValue(mockOrgContext);
    (requireFeature as Mock).mockReturnValue(undefined); // feature enabled
  });

  it("returns discount codes when they exist in the database", async () => {
    const mockCodes = [
      {
        id: "disc-1",
        code: "SUMMER20",
        description: "20% summer discount",
        discountType: "percentage",
        discountValue: "20",
        minBookingAmount: null,
        maxUses: null,
        usedCount: 0,
        validFrom: null,
        validTo: null,
        isActive: true,
        applicableTo: "all",
        createdAt: new Date("2025-01-01"),
        organizationId: "org-uuid",
      },
    ];

    (db.select as Mock).mockReturnValue(makeSelectChain(mockCodes));

    const request = new Request("https://demo.divestreams.com/tenant/discounts");
    const result = await loader({ request, params: {}, context: {} });

    expect(result.discountCodes).toHaveLength(1);
    expect(result.discountCodes[0].code).toBe("SUMMER20");
  });

  it("returns empty array when no discount codes exist", async () => {
    (db.select as Mock).mockReturnValue(makeSelectChain([]));

    const request = new Request("https://demo.divestreams.com/tenant/discounts");
    const result = await loader({ request, params: {}, context: {} });

    expect(result.discountCodes).toHaveLength(0);
  });

  it("includes isPremium status from org context", async () => {
    (db.select as Mock).mockReturnValue(makeSelectChain([]));

    const request = new Request("https://demo.divestreams.com/tenant/discounts");
    const result = await loader({ request, params: {}, context: {} });

    expect(result.isPremium).toBe(true);
  });

  it("requires POS feature — redirect occurs when has_pos is not enabled", async () => {
    // Simulate the feature gate throwing a redirect
    (requireFeature as Mock).mockImplementation(() => {
      throw new Response(null, { status: 302, headers: { Location: "/tenant?upgrade=has_pos" } });
    });

    const request = new Request("https://demo.divestreams.com/tenant/discounts");

    let thrown: unknown;
    try {
      await loader({ request, params: {}, context: {} });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(302);
  });

  it("queries discount codes scoped to the organization", async () => {
    const selectChain = makeSelectChain([]);
    (db.select as Mock).mockReturnValue(selectChain);

    const request = new Request("https://demo.divestreams.com/tenant/discounts");
    await loader({ request, params: {}, context: {} });

    // Verify the query chain was invoked (scoped by org via where clause)
    expect(db.select).toHaveBeenCalled();
    expect(selectChain.where).toHaveBeenCalled();
  });
});
